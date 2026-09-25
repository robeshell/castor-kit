# 시작하기

## 환경 요구사항

사용 시나리오에 맞는 방법을 선택하세요:

| 방법 | 요구사항 |
|---|---|
| **Docker (권장)** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) — 다른 도구 불필요 |
| **로컬 개발** | Node 22+, pnpm (`corepack enable`만으로 충분), PostgreSQL 14+ |

---

## Docker 원클릭 실행 (권장)

Docker는 castor-kit를 가장 빠르게 실행하는 방법입니다. 설치 마법사가 모든 것을 자동으로 처리합니다.

### 1. Docker Desktop 설치

[Docker Desktop](https://www.docker.com/products/docker-desktop/)을 다운로드하여 설치하세요. 왼쪽 하단 상태 아이콘이 녹색("Running")으로 바뀌면 계속 진행합니다.

### 2. 저장소 클론 후 설치 마법사 실행

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
bash setup.sh
```

대화형 마법사가 관리자 비밀번호, 포트, 선택적 AI 설정을 묻고, `SECRET_KEY`, 데이터베이스 비밀번호, AI SQL 읽기 전용 비밀번호를 생성하여 `.env.production`에 기록합니다. 최초 실행은 전체 약 3~5분이 소요됩니다.

### 3. 애플리케이션 접속

**http://localhost:5000**(마법사에서 선택한 포트, 기본값 5000)을 열고 다음으로 로그인하세요:

- **사용자명:** `admin`
- **비밀번호:** 설치 시 설정한 비밀번호 (기본값: `admin123`)

::: tip 수동 Docker 실행 (마법사 미사용)
수동으로 설정하려면:

```bash
cp .env.example .env.production
# .env.production 편집 — 최소한 다음을 설정:
#   SECRET_KEY / ADMIN_PASSWORD / POSTGRES_PASSWORD / POSTGRES_RO_PASSWORD
docker compose --env-file .env.production up -d --build
```

`APP_PORT`를 설정하지 않으면 앱은 **8080** 포트로 노출됩니다.
:::

---

## 로컬 개발 환경

소스 코드를 수정하고 변경 사항을 실시간으로 확인하려는 경우에 사용합니다. castor-kit는 pnpm 모노레포이므로 모든 명령은 저장소 루트에서 실행합니다.

### 1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/robeshell/castor-kit.git
cd castor-kit
corepack enable        # package.json에 고정된 pnpm 버전 활성화
pnpm install
```

### 2. 환경 변수 설정

```bash
cp apps/api/.env.example apps/api/.env.development
```

`apps/api/.env.development`를 열고 최소한 데이터베이스 연결을 설정하세요:

```env
DEV_DATABASE_URL=postgresql://youruser@localhost/castor_kit
```

개발 환경에서 `NODE_ENV`의 기본값은 `development`이며, `SECRET_KEY`와 `ADMIN_PASSWORD`는 비워 두어도 됩니다(내장 개발용 키와 `admin123`이 사용됨).

### 3. 데이터베이스 초기화

```bash
# 데이터베이스 생성
createdb castor_kit

# Drizzle 마이그레이션 실행 (빈 데이터베이스에 모든 테이블 생성)
pnpm db:migrate

# RBAC 데이터 시드 (메뉴, 슈퍼 관리자 역할, 관리자 계정)
pnpm seed:rbac
```

::: warning 플래그 없는 seed:rbac는 전체 재구성입니다
플래그 없이 `pnpm seed:rbac`를 실행하면 계정, 역할, 메뉴를 모두 지우고 다시 생성합니다 — 최초 초기화에만 사용하세요. 이후 메뉴 변경에는 `pnpm seed:rbac -- --incremental`을 사용하세요.
:::

### 4. 개발 서버 시작

```bash
pnpm dev
```

Fastify 백엔드(포트 5001, `tsx watch`로 핫 리로드)와 Vite 프론트엔드(포트 5173, `/api`와 `/ws`는 백엔드로 프록시)가 함께 시작됩니다. 터미널 두 개에서 `pnpm dev:api`와 `pnpm dev:web`으로 각각 시작할 수도 있습니다.

**http://localhost:5173**을 열고 `admin` / `admin123`으로 로그인하세요.

::: tip macOS 더블클릭 실행
데이터베이스를 초기화한 후에는 프로젝트 루트의 **`启动castor-kit.command`**를 더블클릭하기만 하면 됩니다. `pnpm install`, `pnpm setup-once`, `pnpm dev`가 차례로 실행됩니다.
:::

---

## AI 도구 설정

castor-kit에는 모든 주요 AI 코딩 도구를 위한 컨텍스트가 사전 설정되어 있습니다. 클론 후 바로 작업을 시작할 수 있으며 추가 설정이 필요 없습니다.

### Claude Code (권장)

```bash
# 설치
npm install -g @anthropic-ai/claude-code

# 프로젝트 디렉토리에서 실행
cd castor-kit
claude
```

Claude Code는 시작 시 `CLAUDE.md`와 `AGENTS.md`를 자동으로 읽어들입니다. 내장 스킬 사용:

```
/new-feature-autopilot
```

### Cursor

1. [Cursor](https://cursor.sh) 다운로드 및 설치
2. Cursor에서 프로젝트 디렉토리 열기
3. `.cursor/rules/`의 규칙이 자동으로 로드 — 채팅창에 요구사항을 설명하기만 하면 됩니다

### GitHub Copilot

1. VS Code에 **GitHub Copilot** 확장 설치
2. VS Code에서 프로젝트 디렉토리 열기
3. `.github/copilot-instructions.md`가 프로젝트 컨텍스트로 자동 주입됨
4. Copilot Chat(`Ctrl+Shift+I`)으로 요구사항 설명

### Windsurf

1. [Windsurf](https://codeium.com/windsurf) 다운로드 및 설치
2. Windsurf에서 프로젝트 디렉토리 열기
3. `.windsurfrules` 자동 로드 — Cascade에서 요구사항 설명

### Codex CLI

```bash
# 설치
npm install -g @openai/codex

# 프로젝트 디렉토리에서 실행
cd castor-kit
codex "고객 관리 페이지 생성. 필드: 이름, 전화번호, 회사, 상태"
```

Codex CLI는 `AGENTS.md`를 기본으로 읽으며, `CODEX.md`에 명령과 권한 관련 참고 사항이 추가로 정리되어 있습니다.

### MCP 클라이언트 (Claude Desktop 등)

castor-kit에는 스캐폴딩, 검증 게이트, RBAC 동기화, 마이그레이션을 MCP 도구로 제공하는 MCP 서버(`apps/mcp`)가 포함되어 있습니다. `claude_desktop_config.json`에 추가하세요:

```json
{
  "mcpServers": {
    "castor-kit": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/castor-kit", "-s", "mcp"]
    }
  }
}
```

---

## AI 개발 워크플로우

Claude Code를 예로 든 전체 흐름:

### 1. 요구사항 설명

```
/new-feature-autopilot

고객 관리 페이지 생성. 필드: 이름, 전화번호, 회사, 상태 (활성/비활성)
```

### 2. AI가 기술 사양 자동 추론

AI가 `AGENTS.md`와 `docs/templates/`를 읽고 자동으로 추론합니다:

- 테이블 컬럼 타입 (Drizzle 문법)
- API 라우트 명명
- 프론트엔드 페이지 경로
- RBAC 권한 코드와 메뉴 ID

**기술적인 질문에 답할 필요가 없습니다.**

### 3. 비즈니스 미리보기 확인

AI가 코드를 건드리기 전에 쉬운 말로 된 미리보기를 보여줍니다:

```
📋 고객 관리

위치: 시스템 → 고객 관리
기능: 목록, 추가, 편집, 삭제, 가져오기, 내보내기
필드:
  · 이름 (필수)
  · 전화번호
  · 회사
  · 상태

진행할까요, 아니면 조정할 부분이 있나요?
```

### 4. 완전한 모듈 자동 생성

확인 후 AI가 `pnpm scaffold`를 실행하고 비즈니스 로직을 채웁니다:

| 파일 | 내용 |
|---|---|
| `apps/api/src/db/schema/admin/customer.ts` | Drizzle 테이블 정의 + `toDict` |
| `apps/api/src/modules/admin/customer/schema.ts` | Zod 검증, 가져오기/내보내기 필드 매핑 |
| `apps/api/src/modules/admin/customer/repository.ts` | 데이터베이스 접근 |
| `apps/api/src/modules/admin/customer/service.ts` | 비즈니스 로직 |
| `apps/api/src/modules/admin/customer/routes.ts` | Fastify 라우트 + 권한 검사 |
| `apps/web/src/modules/admin/pages/customer/index.jsx` | React 목록 페이지 (가져오기/내보내기 포함) |
| `apps/api/drizzle/` | Drizzle SQL 마이그레이션 |
| `apps/api/scripts/seed-rbac.ts` | 메뉴 + 버튼 권한 항목 |

이어서 `pnpm seed:rbac -- --incremental`을 실행하고, `pnpm setup-once`로 마이그레이션을 적용한 뒤, `psql \d`로 테이블이 존재하는지 확인합니다.

### 5. 검증

```bash
pnpm verify -- --module customer
```

모든 검사를 통과하면 기능을 배포할 준비가 된 것입니다.
