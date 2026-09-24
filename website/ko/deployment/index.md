# 배포 가이드

## Docker 배포 (권장)

Docker는 공식 권장 배포 방법입니다. 명령 하나로 PostgreSQL과 Node 서버(Fastify 백엔드가 빌드된 React 프론트엔드도 함께 제공)를 시작하며, 컨테이너 시작 시 Drizzle 마이그레이션, RBAC 동기화, AI SQL 읽기 전용 역할 설정이 자동으로 실행됩니다.

### 1. 설치 마법사 사용 (가장 간단)

```bash
bash setup.sh
```

마법사가 `.env.production`(랜덤 `SECRET_KEY`, 데이터베이스 비밀번호, 읽기 전용 비밀번호)을 작성한 뒤 빌드하고 시작합니다. 기본 포트는 5000입니다.

### 2. 또는 환경 변수 수동 설정

```bash
cp .env.example .env.production
```

`.env.production`을 편집하여 최소한 다음 네 항목을 설정하세요(하나라도 없으면 `docker-compose.yml`이 시작을 거부합니다):

```env
SECRET_KEY=a-random-string-of-64-or-more-characters   # 필수 — 세션 암호화 키
ADMIN_PASSWORD=your-admin-password                   # 필수 — 초기 관리자 비밀번호
POSTGRES_PASSWORD=your-db-password                   # 필수 — PostgreSQL 비밀번호
POSTGRES_RO_PASSWORD=your-readonly-password          # 필수 — AI SQL 읽기 전용 역할 aurastack_ro의 비밀번호
```

그다음 빌드 및 시작:

```bash
docker compose --env-file .env.production up -d --build
```

최초 실행은 2~5분이 소요됩니다(이미지 다운로드 + 의존성 설치 + 프론트엔드/백엔드 빌드). 이후 시작은 빠릅니다.

### 3. 애플리케이션 접속

**http://localhost:8080**(또는 `APP_PORT`에 설정한 포트, 마법사 기본값은 5000)을 열고 `admin` / `<ADMIN_PASSWORD>`로 로그인하세요.

### 컨테이너 시작 시 수행되는 작업

이미지는 `node:22-alpine` 기반이며 non-root 사용자로 실행됩니다. 엔트리포인트 `docker-entrypoint.sh`가 다음을 실행합니다:

1. `node dist/setup-once.js` — PostgreSQL advisory lock 하에서: 마이그레이션 → RBAC 증분 동기화 → AI SQL 읽기 전용 역할 생성/갱신 (여러 레플리카가 동시에 시작해도 하나만 작업 수행)
2. `node dist/main.js` — 컨테이너 내부 5000 포트에서 서버 시작, `/health`로 헬스 체크

---

## 환경 변수 참조

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SECRET_KEY` | _(필수)_ | 세션 암호화 키 (castor-kit는 HKDF로 이 값에서 쿠키 키를 파생). |
| `ADMIN_PASSWORD` | _(필수)_ | `admin` 계정의 초기 비밀번호. |
| `POSTGRES_PASSWORD` | _(필수)_ | PostgreSQL 서비스 비밀번호. |
| `POSTGRES_RO_PASSWORD` | _(필수)_ | AI SQL 읽기 전용 역할 비밀번호. compose가 이 값으로 `AI_SQL_DATABASE_URL`을 구성. |
| `APP_PORT` | `8080` | 앱 컨테이너에 매핑되는 호스트 포트 (마법사는 5000을 기록). |
| `AI_API_KEY` | _(빈값)_ | AI 기능 API 키. 비워두면 AI 페이지가 비활성화됩니다. |
| `AI_API_BASE` | _(빈값)_ | OpenAI 호환 엔드포인트 (예: `https://api.openai.com/v1`, Azure OpenAI, 로컬 프록시). |
| `AI_MODEL` | _(빈값)_ | 모델 이름, 예: `gpt-4o`. |
| `ENABLE_TASK_SCHEDULER` | `true` | 예약 작업 스케줄러 활성화. |
| `RUN_SCHEDULER_IN_WEB` | `true` | 웹 프로세스 안에서 스케줄러 실행 (다중 레플리카에서는 `false`로 설정하고 별도 worker 실행). |
| `SESSION_TTL_HOURS` | `8` | 세션 유효 시간(시간 단위). |
| `SESSION_COOKIE_SECURE` | _(빈값 = 자동)_ | 비워두면 HTTPS 요청에서만 쿠키에 `Secure` 플래그가 붙습니다. |
| `CORS_ORIGINS` | _(빈값)_ | 허용할 교차 출처 목록 (쉼표로 구분). |
| `COMPOSE_DB_VOLUME` / `COMPOSE_INSTANCE_VOLUME` | `castor-kit_postgres_data` / `castor-kit_app_instance` | 데이터베이스와 업로드 파일용 볼륨 이름. |

::: warning
프로덕션(`NODE_ENV=production`)에서는 `SECRET_KEY`, `ADMIN_PASSWORD`, `AI_SQL_DATABASE_URL` 중 하나라도 없으면 서버가 시작을 거부합니다. `AI_API_KEY`가 설정되지 않으면 AI 채팅과 AI 프롬프트 워크샵 페이지에서 오류가 발생합니다. 다른 모든 기능은 정상 작동합니다.
:::

---

## 유용한 명령어

```bash
# 애플리케이션 로그 스트리밍
docker compose logs -f app

# 모든 컨테이너 중지 (데이터베이스 데이터 유지)
docker compose down

# 모든 컨테이너 중지 및 데이터베이스 볼륨 삭제
docker compose down -v

# 코드 업데이트 후 재빌드
docker compose --env-file .env.production up -d --build
```

---

## AuraStack에서 전환하기

castor-kit는 AuraStack을 Node.js로 재작성한 프로젝트이며 동일한 데이터베이스 스키마를 사용합니다. 이미 Docker로 AuraStack을 운영 중인 서버에서는 castor-kit가 기존 볼륨을 재사용할 수 있습니다:

```bash
COMPOSE_DB_VOLUME=aurastack_postgres_data \
COMPOSE_INSTANCE_VOLUME=aurastack_app_instance \
docker compose --env-file .env.production up -d --build
```

- 최초 시작 시 베이스라인 마이그레이션은 적용됨으로만 표시되며, 기존 테이블은 변경되지 않고 `alembic_version` 테이블도 그대로 유지됩니다
- 비밀번호 해시는 호환되므로 계정은 그대로 사용할 수 있지만, 세션 쿠키는 호환되지 않습니다 — 전환 후 모든 사용자가 한 번 다시 로그인해야 합니다
- `.env.production`의 기존 `FLASK_ENV` 항목은 더 이상 사용되지 않으며, compose가 `NODE_ENV=production`을 설정합니다

---

## 수동 서버 배포

Docker 없이 VPS나 베어메탈 서버에 배포하는 경우. Node 22+, pnpm, PostgreSQL 14+가 필요합니다.

### 1. 의존성 설치 및 빌드

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

프론트엔드는 `apps/web/dist/`에, 백엔드는 `apps/api/dist/`에 빌드됩니다. 프로덕션에서는 Node 서버가 프론트엔드 정적 파일을 직접 제공합니다.

### 2. 환경 변수 설정

```bash
cp .env.example .env.production
```

`.env.production` 편집(저장소 루트 또는 `apps/api/` 어느 쪽이든 가능):

```env
SECRET_KEY=your-strong-random-secret
DATABASE_URL=postgresql://user:password@localhost/aurastack
ADMIN_PASSWORD=your-admin-password
POSTGRES_RO_PASSWORD=your-readonly-password
AI_SQL_DATABASE_URL=postgresql://aurastack_ro:your-readonly-password@localhost/aurastack
```

### 3. 데이터베이스 초기화

```bash
NODE_ENV=production node apps/api/dist/setup-once.js
```

마이그레이션을 실행하고, RBAC 데이터를 동기화하며, `POSTGRES_RO_PASSWORD`로 읽기 전용 역할 `aurastack_ro`를 생성합니다.

### 4. 서버 시작

```bash
NODE_ENV=production node apps/api/dist/main.js
```

기본적으로 `0.0.0.0:5000`에서 수신하며, `PORT` 환경 변수로 변경할 수 있습니다. 프로세스 상주에는 systemd나 pm2를 사용하세요.

::: tip 독립 스케줄러 프로세스
다중 인스턴스 배포에서는 웹 프로세스에 `RUN_SCHEDULER_IN_WEB=false`를 설정하고 스케줄러 프로세스를 하나만 실행하세요:
```bash
NODE_ENV=production node apps/api/dist/worker.js
```
:::

---

## Nginx 리버스 프록시

TLS 종료, 압축, 정적 파일 캐싱을 위해 Node 서버 앞에 Nginx를 배치합니다.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket 지원 (컴포넌트 센터 WebSocket / 성능 모니터링 페이지)
    location /ws {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
    }
}
```

::: tip TLS / HTTPS
Nginx 플러그인을 사용한 [Certbot](https://certbot.eff.org/)으로 무료 Let's Encrypt 인증서를 받고 자동 갱신:
```bash
certbot --nginx -d your-domain.com
```
:::

---

## 업데이트

### Docker

```bash
git pull
docker compose --env-file .env.production up -d --build
```

Compose가 최신 코드로 이미지를 재빌드하며, 컨테이너 시작 시 마이그레이션과 RBAC 동기화가 자동으로 실행됩니다. 수동 작업이 필요 없습니다.

### 수동 배포

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production node apps/api/dist/setup-once.js
# Node 서버 재시작 (예: systemd를 통해)
sudo systemctl restart castor-kit
```
