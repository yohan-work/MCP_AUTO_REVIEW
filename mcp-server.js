#!/usr/bin/env node

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Octokit } = require("octokit");
const crypto = require("crypto");
require('dotenv').config();

// 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;

// GitHub API 설정
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// 미들웨어
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// SSE 클라이언트 목록
let clients = [];

// SSE 연결 설정
app.get("/sse", (req, res) => {
  // SSE 헤더 설정
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 클라이언트에게 연결 확인 메시지 전송
  res.write('data: {"message": "Connected to MCP Server"}\n\n');

  // 클라이언트 ID 생성
  const clientId = Date.now();

  // 새 클라이언트 추가
  const newClient = {
    id: clientId,
    res,
  };
  clients.push(newClient);

  // 연결 해제 이벤트 처리
  req.on("close", () => {
    console.log(`Client ${clientId} disconnected`);
    clients = clients.filter((client) => client.id !== clientId);
  });
});

// SSE 이벤트 전송 함수
function sendSSEEvent(eventType, data) {
  clients.forEach((client) => {
    client.res.write(`event: ${eventType}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// 기본 경로
app.get("/", (req, res) => {
  res.json({
    message: "Cursor MCP 코드 리뷰 서버가 실행 중입니다",
    endpoints: [
      {
        path: "/api/review",
        method: "POST",
        description: "코드 리뷰를 수행합니다",
      },
      {
        path: "/webhook/github",
        method: "POST",
        description: "GitHub 웹훅을 처리합니다",
      },
      {
        path: "/sse",
        method: "GET",
        description: "SSE 이벤트 스트림에 연결합니다",
      },
    ],
  });
});

// GitHub 웹훅 검증 함수
function verifyWebhookSignature(req) {
  if (!WEBHOOK_SECRET) {
    console.warn("WEBHOOK_SECRET 환경 변수가 설정되지 않았습니다. 서명 검증을 건너뜁니다.");
    return true;
  }
  
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    return false;
  }
  
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// GitHub 웹훅 엔드포인트
app.post("/webhook/github", async (req, res) => {
  try {
    // 웹훅 서명 검증
    if (!verifyWebhookSignature(req)) {
      console.error("GitHub 웹훅 서명이 유효하지 않습니다");
      return res.status(401).json({
        success: false,
        message: "서명이 유효하지 않습니다",
      });
    }

    const event = req.headers["x-github-event"];
    
    // Pull Request 이벤트 처리
    if (event === "pull_request") {
      // PR이 열리거나 수정되었을 때만 처리
      const action = req.body.action;
      if (action === "opened" || action === "synchronize") {
        const pr = req.body.pull_request;
        const repo = req.body.repository;
        
        console.log(`PR #${pr.number} 코드 리뷰 시작: ${repo.full_name}`);
        
        // SSE 이벤트로 PR 리뷰 시작 알림
        sendSSEEvent("pr_review_started", { 
          repo: repo.full_name,
          pr: pr.number,
          title: pr.title
        });
        
        // PR 파일 변경 내용 가져오기
        const prFiles = await octokit.rest.pulls.listFiles({
          owner: repo.owner.login,
          repo: repo.name,
          pull_number: pr.number,
        });
        
        // 각 파일 분석
        let allIssues = [];
        
        for (const file of prFiles.data) {
          // 파일 내용 가져오기
          const fileContent = await octokit.rest.repos.getContent({
            owner: repo.owner.login,
            repo: repo.name,
            path: file.filename,
            ref: pr.head.sha,
          });
          
          // Base64 디코딩
          const content = Buffer.from(fileContent.data.content, 'base64').toString();
          
          // 코드 리뷰 수행
          const issues = reviewCode(file.filename, content);
          if (issues.length > 0) {
            allIssues.push({
              file: file.filename,
              issues: issues,
              feedback: generateFeedback(file.filename, issues)
            });
          }
        }
        
        // 리뷰 결과를 PR에 코멘트로 추가
        if (allIssues.length > 0) {
          let commentBody = `## Cursor MCP 자동 코드 리뷰 결과\n\n`;
          
          allIssues.forEach(fileResult => {
            commentBody += `### ${fileResult.file}\n\n`;
            commentBody += fileResult.feedback + "\n\n";
          });
          
          // PR에 코멘트 추가
          await octokit.rest.issues.createComment({
            owner: repo.owner.login,
            repo: repo.name,
            issue_number: pr.number,
            body: commentBody,
          });
          
          console.log(`PR #${pr.number}에 리뷰 코멘트를 추가했습니다.`);
        } else {
          // 문제 없음 코멘트
          await octokit.rest.issues.createComment({
            owner: repo.owner.login,
            repo: repo.name,
            issue_number: pr.number,
            body: `## Cursor MCP 자동 코드 리뷰 결과\n\n🎉 코드 리뷰 통과! 문제가 발견되지 않았습니다.`,
          });
          
          console.log(`PR #${pr.number}에 코드 리뷰 통과 코멘트를 추가했습니다.`);
        }
        
        // SSE 이벤트로 PR 리뷰 완료 알림
        sendSSEEvent("pr_review_completed", { 
          repo: repo.full_name,
          pr: pr.number,
          issues_count: allIssues.reduce((sum, file) => sum + file.issues.length, 0)
        });
      }
    }
    
    // Push 이벤트 처리 (커밋 전 검사)
    else if (event === "push") {
      const repo = req.body.repository;
      const ref = req.body.ref;
      const commits = req.body.commits;
      
      // master 또는 main 브랜치에 푸시된 경우
      if (ref === "refs/heads/main" || ref === "refs/heads/master") {
        console.log(`${repo.full_name} 리포지토리의 ${ref} 브랜치에 푸시 감지`);
        
        // SSE 이벤트로 푸시 감지 알림
        sendSSEEvent("push_detected", {
          repo: repo.full_name,
          branch: ref,
          commits_count: commits.length
        });
        
        // 각 커밋의 변경된 파일 분석
        let allCommitIssues = [];
        
        for (const commit of commits) {
          const addedFiles = commit.added || [];
          const modifiedFiles = commit.modified || [];
          const allChanged = [...addedFiles, ...modifiedFiles];
          
          let commitIssues = {
            commit: commit.id,
            message: commit.message,
            files: []
          };
          
          // 변경된 각 파일에 대해 코드 리뷰 수행
          for (const filepath of allChanged) {
            try {
              // 파일 내용 가져오기
              const fileContent = await octokit.rest.repos.getContent({
                owner: repo.owner.login,
                repo: repo.name,
                path: filepath,
                ref: commit.id,
              });
              
              // Base64 디코딩
              const content = Buffer.from(fileContent.data.content, 'base64').toString();
              
              // 코드 리뷰 수행
              const issues = reviewCode(filepath, content);
              if (issues.length > 0) {
                commitIssues.files.push({
                  file: filepath,
                  issues: issues,
                  feedback: generateFeedback(filepath, issues)
                });
              }
            } catch (error) {
              console.error(`파일 ${filepath} 분석 중 오류:`, error);
            }
          }
          
          if (commitIssues.files.length > 0) {
            allCommitIssues.push(commitIssues);
          }
        }
        
        // 문제가 발견된 경우 이슈 생성
        if (allCommitIssues.length > 0) {
          let issueBody = `## Cursor MCP 자동 코드 리뷰 - 푸시 감지\n\n`;
          issueBody += `${ref} 브랜치에 푸시된 커밋에서 다음 문제가 발견되었습니다:\n\n`;
          
          allCommitIssues.forEach(commit => {
            issueBody += `### 커밋: ${commit.id.substring(0, 7)} - ${commit.message}\n\n`;
            
            commit.files.forEach(file => {
              issueBody += `#### ${file.file}\n\n`;
              issueBody += file.feedback + "\n\n";
            });
          });
          
          // 이슈 생성
          const issue = await octokit.rest.issues.create({
            owner: repo.owner.login,
            repo: repo.name,
            title: `[MCP 자동 리뷰] ${ref} 브랜치 푸시에서 발견된 코드 문제`,
            body: issueBody,
            labels: ["automated-review", "code-quality"]
          });
          
          console.log(`리포지토리 ${repo.full_name}에 이슈 #${issue.data.number}를 생성했습니다.`);
          
          // SSE 이벤트로 이슈 생성 알림
          sendSSEEvent("issue_created", {
            repo: repo.full_name,
            issue: issue.data.number,
            issues_count: allCommitIssues.reduce((sum, commit) => 
              sum + commit.files.reduce((sum, file) => sum + file.issues.length, 0), 0)
          });
        } else {
          console.log(`${repo.full_name} 리포지토리의 푸시에서 문제가 발견되지 않았습니다.`);
          
          // SSE 이벤트로 검사 완료 알림
          sendSSEEvent("push_analyzed", {
            repo: repo.full_name,
            branch: ref,
            status: "success"
          });
        }
      }
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("GitHub 웹훅 처리 오류:", error);
    
    // SSE 이벤트로 오류 전송
    sendSSEEvent("webhook_error", {
      error: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: "웹훅 처리 중 오류가 발생했습니다",
      error: error.message,
    });
  }
});

// MCP 코드 리뷰 엔드포인트
app.post("/api/review", async (req, res) => {
  try {
    const { file, content } = req.body;

    if (!file || !content) {
      return res.status(400).json({
        success: false,
        message: "파일 경로와 내용이 필요합니다",
      });
    }

    console.log(`파일 리뷰 중: ${file}`);

    // 간단한 코드 리뷰 로직
    const issues = reviewCode(file, content);

    // SSE 이벤트로 리뷰 시작 알림
    sendSSEEvent("review_started", { file });

    // 결과 객체
    const result = {
      success: true,
      file,
      feedback: generateFeedback(file, issues),
      issues: categorizeSeverity(issues),
    };

    // SSE 이벤트로 리뷰 결과 전송
    sendSSEEvent("review_completed", result);

    // 응답 반환
    return res.json(result);
  } catch (error) {
    console.error("코드 리뷰 오류:", error);

    // SSE 이벤트로 오류 전송
    sendSSEEvent("review_error", {
      file: req.body.file,
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: "코드 리뷰 처리 중 오류가 발생했습니다",
      error: error.message,
    });
  }
});

// 간단한 코드 리뷰 로직
function reviewCode(file, content) {
  const issues = [];
  const fileExt = file.split(".").pop().toLowerCase();

  // 파일 유형별 분석
  if (["js", "jsx", "ts", "tsx"].includes(fileExt)) {
    // JavaScript/TypeScript 분석

    // 콘솔 로그 검사
    if (content.includes("console.log(")) {
      issues.push({
        type: "console_log",
        message: "프로덕션 코드에 console.log가 포함되어 있습니다",
        severity: "warning",
        line: findLineNumber(content, "console.log("),
      });
    }

    // 큰 함수 검사 (100줄 초과)
    const lines = content.split("\n");
    if (lines.length > 100) {
      issues.push({
        type: "large_file",
        message: "파일이 너무 큽니다. 100줄 미만으로 유지하는 것이 좋습니다",
        severity: "suggestion",
        line: 1,
      });
    }

    // 잠재적 메모리 누수 검사
    if (
      content.includes("addEventListener") &&
      !content.includes("removeEventListener")
    ) {
      issues.push({
        type: "memory_leak",
        message:
          "addEventListener를 사용하지만 removeEventListener가 없습니다. 메모리 누수가 발생할 수 있습니다",
        severity: "critical",
        line: findLineNumber(content, "addEventListener"),
      });
    }
    
    // 미사용 변수 검사 (간단한 구현)
    const varDeclarationRegex = /(?:const|let|var)\s+(\w+)\s*=/g;
    let match;
    while ((match = varDeclarationRegex.exec(content)) !== null) {
      const varName = match[1];
      // 선언 이후에 변수가 사용되는지 확인 (매우 기본적인 검사)
      const useRegex = new RegExp(`[^a-zA-Z0-9_]${varName}[^a-zA-Z0-9_]`, 'g');
      useRegex.lastIndex = match.index + match[0].length;
      if (!useRegex.test(content)) {
        issues.push({
          type: "unused_variable",
          message: `'${varName}' 변수가 선언되었지만 사용되지 않는 것 같습니다`,
          severity: "warning",
          line: findLineNumber(content.substring(0, match.index), "\n") + 1,
        });
      }
    }
  } else if (["py"].includes(fileExt)) {
    // Python 분석
    if (content.includes("print(")) {
      issues.push({
        type: "print_statement",
        message: "프로덕션 코드에 print문이 포함되어 있습니다",
        severity: "warning",
        line: findLineNumber(content, "print("),
      });
    }
  }

  // 모든 파일 유형에 대한 일반적인 검사

  // TODO 주석 검사
  if (content.includes("TODO")) {
    issues.push({
      type: "todo_comment",
      message: "미완성 TODO 주석이 있습니다",
      severity: "info",
      line: findLineNumber(content, "TODO"),
    });
  }

  // 긴 줄 검사
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    if (line.length > 100) {
      issues.push({
        type: "long_line",
        message: "줄 길이가 100자를 초과합니다",
        severity: "suggestion",
        line: idx + 1,
      });
    }
  });

  return issues;
}

// 특정 문자열이 있는 줄 번호 찾기
function findLineNumber(content, searchString) {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return 1;
}

// 피드백 메시지 생성
function generateFeedback(file, issues) {
  if (issues.length === 0) {
    return `${file} 파일에서 문제가 발견되지 않았습니다. 훌륭합니다!`;
  }

  let feedback = `${file} 파일 리뷰 결과:\n\n`;

  const criticalIssues = issues.filter(
    (issue) => issue.severity === "critical"
  );
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const suggestions = issues.filter((issue) => issue.severity === "suggestion");
  const infos = issues.filter((issue) => issue.severity === "info");

  if (criticalIssues.length > 0) {
    feedback += "심각한 문제:\n";
    criticalIssues.forEach((issue) => {
      feedback += `- [줄 ${issue.line}] ${issue.message}\n`;
    });
    feedback += "\n";
  }

  if (warnings.length > 0) {
    feedback += "경고:\n";
    warnings.forEach((issue) => {
      feedback += `- [줄 ${issue.line}] ${issue.message}\n`;
    });
    feedback += "\n";
  }

  if (suggestions.length > 0) {
    feedback += "제안:\n";
    suggestions.forEach((issue) => {
      feedback += `- [줄 ${issue.line}] ${issue.message}\n`;
    });
    feedback += "\n";
  }

  if (infos.length > 0) {
    feedback += "정보:\n";
    infos.forEach((issue) => {
      feedback += `- [줄 ${issue.line}] ${issue.message}\n`;
    });
  }

  return feedback;
}

// 이슈를 심각도별로 분류
function categorizeSeverity(issues) {
  return {
    critical: issues.filter((issue) => issue.severity === "critical"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    suggestion: issues.filter((issue) => issue.severity === "suggestion"),
    info: issues.filter((issue) => issue.severity === "info"),
  };
}

// 서버 시작
app.listen(PORT, () => {
  console.log(
    `🚀 Cursor MCP 코드 리뷰 서버가 http://localhost:${PORT}에서 실행 중입니다`
  );
  console.log(`🔍 코드 리뷰 엔드포인트: http://localhost:${PORT}/api/review`);
  console.log(`🔗 GitHub 웹훅 엔드포인트: http://localhost:${PORT}/webhook/github`);
  console.log(`📡 SSE 스트림: http://localhost:${PORT}/sse`);
});
