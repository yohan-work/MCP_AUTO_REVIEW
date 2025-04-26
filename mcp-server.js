#!/usr/bin/env node

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// 서버 설정
const app = express();
const PORT = process.env.PORT || 3000;

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
        path: "/sse",
        method: "GET",
        description: "SSE 이벤트 스트림에 연결합니다",
      },
    ],
  });
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
  console.log(`📡 SSE 스트림: http://localhost:${PORT}/sse`);
});
