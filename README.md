# Cursor MCP 자동 코드 리뷰 서버

GitHub 커밋 및 Pull Request 전 자동 코드 리뷰를 수행하는 서버입니다.

## 기능

- 코드 커밋 전 자동 검사
- Pull Request 오픈 및 업데이트 시 자동 리뷰
- 코드 문제에 대한 자동 이슈 생성
- 실시간 이벤트 알림 (SSE)
- 여러 프로그래밍 언어 지원

## 설치 및 실행

### 필수 조건

- Node.js 14 이상
- GitHub 계정 및 개인 액세스 토큰

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/cursor-mcp-server.git
cd cursor-mcp-server

# 의존성 설치
npm install
```

### 환경 변수 설정

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```
# GitHub API 인증
GITHUB_TOKEN=your_github_token_here

# GitHub 웹훅 시크릿 (GitHub Webhook 설정 시 사용한 시크릿)
WEBHOOK_SECRET=your_webhook_secret_here

# 서버 구성
PORT=3000
```

GitHub 토큰은 `repo` 권한이 있어야 합니다.

### 실행

```bash
# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm start
```

# ngrok(임시)

```bash
ngrok http 3000
```

## GitHub 웹훅 설정

1. GitHub 저장소에서 **Settings > Webhooks > Add webhook** 로 이동합니다.

2. 다음 정보를 입력합니다:

   - **Payload URL**: `http://your-server-url/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: `.env` 파일에 설정한 `WEBHOOK_SECRET` 값과 동일하게 입력
   - **Which events would you like to trigger this webhook?**:
     - `Pull requests`
     - `Pushes`

3. **Active** 체크박스를 선택하고 **Add webhook**을 클릭합니다.

## API 엔드포인트

### 코드 리뷰

- **URL**: `/api/review`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "file": "path/to/file.js",
    "content": "파일 내용"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "file": "path/to/file.js",
    "feedback": "리뷰 피드백 내용",
    "issues": {
      "critical": [...],
      "warning": [...],
      "suggestion": [...],
      "info": [...]
    }
  }
  ```

### SSE 스트림

- **URL**: `/sse`
- **Method**: `GET`
- **이벤트 유형**:
  - `review_started`: 코드 리뷰 시작
  - `review_completed`: 코드 리뷰 완료
  - `review_error`: 코드 리뷰 오류
  - `pr_review_started`: PR 리뷰 시작
  - `pr_review_completed`: PR 리뷰 완료
  - `push_detected`: 푸시 감지
  - `push_analyzed`: 푸시 분석 완료
  - `issue_created`: 이슈 생성
  - `webhook_error`: 웹훅 처리 오류

## 리뷰 규칙 커스터마이징

코드 리뷰 규칙을 커스터마이징하려면 `mcp-server.js` 파일의 `reviewCode` 함수를 수정하세요. 기본적으로 다음 규칙이 적용됩니다:

- JavaScript/TypeScript:
  - console.log 검사
  - 파일 크기 검사
  - 메모리 누수 검사 (addEventListener/removeEventListener)
  - 미사용 변수 검사
- Python:
  - print 문 검사
- 모든 파일:
  - TODO 주석 검사
  - 긴 줄 검사 (100자 초과)

## 라이센스

MIT
