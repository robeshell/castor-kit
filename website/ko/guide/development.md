# 개발 가이드

## 프로젝트 구조

castor-kit는 pnpm 모노레포이며, 백엔드, 프론트엔드, MCP 서버는 각각 독립된 워크스페이스 패키지입니다:

```
castor-kit/
├── package.json                    # 워크스페이스 루트 스크립트 (pnpm dev / verify / scaffold ...)
├── pnpm-workspace.yaml
├── AGENTS.md                       # AI 컨텍스트 (모든 AI 도구가 읽음)
├── apps/
│   ├── api/                        # @castor-kit/api — Fastify + TypeScript 백엔드
│   │   ├── src/
│   │   │   ├── main.ts             # 웹 프로세스 진입점
│   │   │   ├── worker.ts           # 독립 스케줄러 프로세스 진입점
│   │   │   ├── app.ts              # 플러그인 / 라우트 / 오류 처리 / 정적 리소스
│   │   │   ├── config.ts           # 다중 환경 설정 (Zod 검증)
│   │   │   ├── router.ts           # 최상위 라우트 조립
│   │   │   ├── common/             # auth / csrf / tabular / pagination / serialize / scheduler ...
│   │   │   ├── db/schema/          # Drizzle 테이블 정의 (admin/, component-center/, index.ts)
│   │   │   └── modules/
│   │   │       ├── admin/          # 시스템 도메인: users, roles, menu, logs, dicts, scheduled-task ...
│   │   │       │   └── users/      # schema.ts / repository.ts / service.ts / routes.ts
│   │   │       └── component-center/   # 예제 도메인: list-page, kanban, gantt, ai-chat ...
│   │   ├── drizzle/                # Drizzle SQL 마이그레이션 + meta/_journal.json
│   │   ├── scripts/
│   │   │   ├── scaffold.ts         # 코드 스켈레톤 생성기
│   │   │   ├── verify-feature.ts   # 기능 검증 게이트
│   │   │   ├── seed-rbac.ts        # RBAC 시드 데이터 (메뉴 트리의 단일 진실 공급원)
│   │   │   ├── setup-once.ts       # 마이그레이션 + RBAC + 읽기 전용 역할 (컨테이너 시작 시 실행)
│   │   │   └── generate-openapi.ts / import-apifox.ts
│   │   └── test/                   # Vitest (실제 PostgreSQL 대상)
│   ├── web/                        # @castor-kit/web — React 19 + Vite + shadcn/ui 프론트엔드 (JSX)
│   │   ├── scripts/shadcn-add.sh   # 로컬 중계를 거쳐 npx shadcn@latest add 실행
│   │   └── src/
│   │       ├── App.jsx             # 동적 라우팅 (import.meta.glob)
│   │       ├── index.css           # Tailwind v4 + 디자인 토큰 (라이트 / 다크)
│   │       ├── context/            # AuthContext / ThemeContext
│   │       ├── components/ui/      # shadcn/ui 기본 컴포넌트
│   │       ├── components/app/     # 앱 셸: 사이드바, 상단 바, ⌘K, 테마 전환
│   │       ├── lib/                # cn / toast / format / motion / chart-theme
│   │       ├── modules/
│   │       │   ├── admin/          # 시스템 관리 페이지
│   │       │   └── component_center/   # 컴포넌트 예제 페이지
│   │       └── shared/
│   │           ├── api/request.js  # Axios 인스턴스 (baseURL='/api')
│   │           └── components/     # 공통 비즈니스 컴포넌트: PageHeader / DataTable / FormDialog / ImportDialog …
│   └── mcp/                        # @castor-kit/mcp — MCP 서버
└── docs/
    └── templates/                  # AI 코드 스켈레톤 템플릿 (backend/*.ts, frontend/*)
```

백엔드 계층: `db/schema → schema (Zod) → repository → service → routes`. 각 기능 모듈은 `modules/<domain>/<module>/` 아래의 파일 4개로 구성되며, 테이블 정의는 `db/schema/<domain>/<module>.ts`에 있습니다.

---

## AI로 기능 생성하기

castor-kit는 AI 기반 개발을 위해 설계되었습니다. 가장 빠른 방법은 Claude Code의 `/new-feature-autopilot` 스킬을 사용하는 것입니다.

**예제 프롬프트:**

```
고객 관리 페이지 생성. 필드: 이름, 전화번호, 회사, 상태
```

AI가 자동으로:
1. `AGENTS.md`와 `docs/templates/`를 읽어 프로젝트 규칙 파악
2. 모든 기술적 세부사항을 자동 추론 — 추가 질문 없음
3. **비즈니스 미리보기**를 표시하여 확인 요청
4. 완전한 모듈 생성: 테이블 정의 → Zod 스키마 → repository → service → routes → 프론트엔드 페이지 → RBAC 항목 → DB 마이그레이션
5. `pnpm verify` 품질 게이트 실행

---

## 수동 코드 생성

직접 스캐폴딩하려면:

```bash
# 생성될 파일 미리보기
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20" --dry-run

# 실제 생성
pnpm scaffold -- --name customer --domain admin \
  --fields "name:str,phone:str20,company:str,status:str20"
```

스캐폴더가 하는 일:

- 테이블 정의 `db/schema/admin/customer.ts`와 모듈 `modules/admin/customer/{schema,repository,service,routes}.ts` 작성
- 프론트엔드 API 파일과 shadcn/ui 목록 페이지 작성(사용자 관리 페이지와 같은 구조: 검색, 추가/편집/삭제, 가져오기/내보내기; 필드 타입은 폼 컴포넌트로 자동 매핑)
- `db/schema/index.ts`와 도메인 라우터 `modules/admin/router.ts`에 등록
- `drizzle-kit generate`를 실행하여 마이그레이션 SQL 생성

`--domain`은 `admin` 또는 `component_center`입니다. 필드 타입: `str` (100), `str20`, `str50`, `str500`, `text`, `int`, `float` (numeric 10,2), `bool`, `date`, `datetime`.

---

## 프론트엔드 규칙

프론트엔드(`apps/web`)는 **shadcn/ui + Tailwind CSS v4 + motion + lucide-react**(JavaScript / JSX, UI 문구는 중국어)를 사용하며, UI는 Semi Design에서 이전되었습니다. 자세한 내용은 [프론트엔드 개편 계획](https://github.com/robeshell/castor-kit/blob/main/docs/frontend-redesign-plan.md)을 참고하세요.

- **페이지 구조**: 목록 페이지는 `modules/admin/pages/users/index.jsx`를 따릅니다 — `PageHeader` → `FilterBar` → `DataTable` → `FormDialog`(react-hook-form + `FormFields`) → `ImportDialog` / `ExportDialog`. 삭제는 `ConfirmAction`, 알림은 `@/lib/toast`
- **필드 → 폼 컴포넌트**: `str` → `FormInput`, `text` → `FormTextarea`, `int` / `float` → `FormNumber`, `bool` → `FormSwitch`, `date` → `FormDate`, `datetime` → `FormDateTime`. 테이블에서 `bool`은 `StatusBadge`, 시간은 `formatDate` / `formatDateTime`으로 표시
- **스타일**: Tailwind 시맨틱 색상 클래스만 사용(`bg-card`, `text-muted-foreground`, `bg-brand-soft` …)하므로 다크 모드가 자동으로 맞춰집니다. Ocean 그라데이션(blue → sky → cyan)은 포인트로만 쓰고, `variant="brand"` 주 버튼은 페이지당 최대 1개
- **금지**: `@douyinfe/*` import, `var(--semi-*)`, 하드코딩된 16진수 색상, 인라인 스타일 위주의 레이아웃
- **shadcn 기본 컴포넌트 추가**: 이 환경에서는 shadcn CLI가 ui.shadcn.com에 직접 연결되지 않으므로 중계 스크립트를 사용합니다(로컬 레지스트리 중계를 띄우고 `REGISTRY_URL`로 `npx shadcn@latest add`를 실행한 뒤 종료):

```bash
apps/web/scripts/shadcn-add.sh hover-card
```

---

## RBAC 및 메뉴 관리

모든 메뉴 항목과 버튼 권한은 `apps/api/scripts/seed-rbac.ts`의 `MENUS_DATA`에 정의되어 있습니다(단일 진실 공급원). 메뉴를 추가한 후 다음을 실행하세요:

```bash
pnpm seed:rbac -- --incremental
```

`--incremental`은 `code` 기준으로 upsert하며, 기존 데이터는 절대 삭제하지 않고, 새 메뉴를 슈퍼 관리자 역할에 부여합니다.

**메뉴 항목 형식 (`seed-rbac.ts` 내):**

```ts
{ id: 26, name: "Customers", code: "system_customer", icon: "IconUser", path: "/system/customer",
  component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// 버튼 권한: ID = 메뉴 ID × 10 + n
{ id: 261, name: "Create", code: "system_customer_add",    icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "Edit",   code: "system_customer_edit",   icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "Delete", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "Export", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "Import", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

::: tip component 필드 형식
`component` 필드는 `apps/web/src/modules/<module>/pages/<subdir>/<page>/index.jsx`에 매핑됩니다(`admin/customer` → `modules/admin/pages/customer/index.jsx`).
컴포넌트 센터 페이지는 하위 디렉토리 경로를 사용합니다. 예: `component_center/admin/kanban_page`.
:::

메뉴 ID 범위는 `AGENTS.md`에 정리되어 있습니다(시스템 21–39, 컴포넌트 센터 40–499, 신규 비즈니스 도메인은 1000부터).

---

## 데이터베이스 마이그레이션

castor-kit는 Drizzle로 마이그레이션을 관리하며, 마이그레이션 파일은 리뷰 가능한 순수 SQL입니다(`apps/api/drizzle/`). 테이블 정의를 변경한 후 마이그레이션을 생성하고 적용하세요:

```bash
# 마이그레이션 파일 생성 (주의: db:generate 뒤에 -- 없음)
pnpm db:generate --name add_customer_table

# 적용
pnpm db:migrate

# 테이블이 실제로 존재하는지 확인
psql -d castor_kit -c '\d customers'
```

::: warning 마이그레이션은 반드시 실제로 적용해야 합니다
마이그레이션 파일을 생성하는 것만으로는 충분하지 않습니다. `pnpm db:migrate`를 실행하고 `psql \d`로 테이블/컬럼이 존재하는지 확인하세요. `pnpm verify`의 `migration_applied` 검사도 데이터베이스의 마이그레이션 기록과 대조합니다.
:::

---

## 기능 검증

기능 구현 후 검증 게이트를 실행하세요:

```bash
pnpm verify -- --module customer --skip-build
```

TypeScript 타입, 계층 규칙(로컬 권한 헬퍼 금지), 마이그레이션 체인 무결성과 적용 여부, OpenAPI 동기화, AI 문서가 참조하는 경로, 백엔드/프론트엔드 파일과 등록, RBAC 시드를 검사합니다. 프론트엔드 페이지에 이전 UI 스택(`@douyinfe/*`, `var(--semi-*)`)이 남아 있지 않은지도 검사합니다. CI에서는 `--skip-build`를 빼서 프로덕션 프론트엔드 빌드까지 검증하고, AI가 읽을 수 있는 구조화된 출력이 필요하면 `--json`을 추가하세요.

---

## 자주 쓰는 명령어

```bash
pnpm dev                       # api (5001) + web (5173)
pnpm typecheck                 # TypeScript 타입 검사
pnpm test                      # Vitest (castor_kit_test 데이터베이스 필요)
pnpm build                     # web + api + mcp 빌드
pnpm db:generate --name <desc> # 마이그레이션 생성
pnpm db:migrate                # 마이그레이션 적용
pnpm seed:rbac -- --incremental
pnpm verify -- --module <name>
pnpm openapi:generate          # 라우트로부터 docs/apifox-full.openapi.json 채우기
pnpm openapi:apifox            # Apifox로 푸시 (APIFOX_PROJECT_ID / APIFOX_ACCESS_TOKEN 필요)
pnpm mcp                       # MCP 서버 시작
```

테스트 데이터베이스: `createdb -T castor_kit castor_kit_test`(개발 데이터베이스 복제) 또는 `createdb castor_kit_test`(빈 데이터베이스, 테스트가 마이그레이션을 자동 실행).

---

## AI 도구 통합

castor-kit에는 모든 주요 AI 코딩 도구를 위한 컨텍스트 파일이 사전 설정되어 있습니다:

| 도구 | 설정 파일 | 기능 |
|---|---|---|
| Claude Code | `CLAUDE.md` + `.claude/skills/` | `/new-feature-autopilot` 엔드투엔드 스킬 + `shadcn-ui-skills` 프론트엔드 가이드 |
| Cursor | `.cursor/rules/` | Autopilot 워크플로우 자동 트리거 |
| GitHub Copilot | `.github/copilot-instructions.md` | 프로젝트 규칙 전역 주입 |
| Windsurf | `.windsurfrules` | 프로젝트 규칙 전역 주입 |
| Codex CLI | `CODEX.md` | `AGENTS.md`를 기본으로 읽음 |
| MCP 클라이언트 | `apps/mcp` | scaffold / verify / RBAC / 마이그레이션 도구 |

모든 도구는 `AGENTS.md`의 핵심 컨텍스트를 공유하며, 여기에는 전체 프로젝트 아키텍처, 명명 규칙, 안티 패턴, 납품 워크플로우가 담겨 있습니다.

---

## 환경 변수

### 개발 환경 (`apps/api/.env.development`)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `NODE_ENV` | `development` | 실행 환경: `development` / `production` / `test` |
| `DEV_DATABASE_URL` | `postgresql://localhost/castor_kit_dev` | 로컬 PostgreSQL 연결 문자열 |
| `TEST_DATABASE_URL` | `postgresql://localhost/castor_kit_test` | `pnpm test`가 사용하는 테스트 데이터베이스 |
| `SECRET_KEY` | 내장 개발용 키 | 세션 암호화 키 (개발 환경에서는 선택) |
| `ADMIN_PASSWORD` | `admin123` | `pnpm seed:rbac`가 관리자 계정에 사용하는 비밀번호 |
| `PORT` | `5001` | 백엔드 포트 (Vite 프록시 대상이 5001) |
| `AI_API_KEY` | — | AI 기능 API 키 (개발 환경에서는 선택) |
| `AI_API_BASE` | — | OpenAI 호환 엔드포인트 (예: `https://api.openai.com/v1`) |
| `AI_MODEL` | — | 모델 이름 |
| `RUN_SCHEDULER_IN_WEB` | `false` | 웹 프로세스 안에서 예약 작업 스케줄러 실행 여부 |

### 프로덕션 환경 (`.env.production`)

프로덕션 변수는 [배포 가이드](/ko/deployment/#환경-변수-참조)를 참고하세요.

::: warning 프로덕션 시크릿 키
프로덕션에서는 반드시 강력한 랜덤 `SECRET_KEY`를 설정하세요. 세션 키가 이 값에서 파생되므로, 변경하면 모든 활성 사용자 세션이 무효화됩니다.
:::
