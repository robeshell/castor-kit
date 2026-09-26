# オープン API：API トークンと Webhook

スクリプトや定期ジョブ、他のシステムは **API トークン** で castor-kit の API を呼び出せます。castor-kit でデータが変わったときは、**Webhook** で他のシステムへ通知します。

## API トークン

### 有効にする

API トークンは初期状態ではオフです。管理者が「システム管理 → システム構成 → システム設定 → セキュリティ」で「API トークンを許可」（`security.api_tokens_enabled`）をオンにします。オフにすると既存のトークンはすべて停止し、再びオンにすると復帰します。デモモードではオンにできません。

### 作成

各ユーザーは「個人設定 → API Token」で自分のトークンを作成します。

- 名前を入力し、有効期間（30 日・90 日・180 日・1 年・無期限）を選び、権限をチェックします
- チェックできるのは自分が持つメニュー / ボタン権限だけです。ボタンをチェックすると、そのボタンがあるページの権限も付与されます
- 作成には直近の本人確認が必要です（10 分以内にログインまたは本人確認をしていない場合は、先に「本人確認」ダイアログが開きます）
- トークンは `ck_` と 43 文字からなり、**作成時に一度だけ表示されます**。一覧には先頭 11 文字だけが表示されます
- 有効なトークンは 1 人 20 個まで

### 使い方

リクエストヘッダーにトークンを付けます。

```bash
curl -H "Authorization: Bearer ck_xxxxxxxx…" \
  https://admin.example.com/api/admin/users?per_page=50
```

- Bearer 付きのリクエストはトークンだけで認証されます。Cookie は読まず、CSRF ヘッダーも不要で、ログインセッションも作られません
- **実際の権限 = トークンでチェックした権限 ∩ 作成者の現在の権限**。スーパー管理者が作成したトークンも、チェックした権限しか持ちません。作成者の権限が減ると、トークンの権限も減ります
- データ権限は作成者を基準にします（[データ権限](/ja/guide/rbac#データ権限) を参照）
- エンドポイントとパラメーターはリポジトリの `docs/apifox-full.openapi.json` にあります。`security` に `bearerAuth` がある API はトークンで呼び出せ、`cookieAuth` だけの API（アカウントのセキュリティ、システム設定など）は呼び出せません

| 状況 | レスポンス |
|---|---|
| システム設定で API トークンがオンになっていない | 401 `API Token 未开启`（API トークンはオフ） |
| トークンが存在しない、失効・期限切れ、または作成者が無効化 / 削除された | 401 `API Token 无效或已过期`（無効または期限切れ） |
| トークンを受け付けないエンドポイント | 403 `该接口不支持 API Token`（API トークンでは使えない） |
| エンドポイントに必要な権限がトークンにない | 403（権限のないユーザーと同じ） |

エラーメッセージは他の API エラーと同じく `Accept-Language` ヘッダーに従って翻訳されます。

次のアカウント・セキュリティ系エンドポイントは、すべての権限を持つトークンでも受け付けません：ログイン / ログアウト、パスワード再設定、パスワード変更、本人確認、2 段階認証（管理者による他人のリセットを含む）、個人設定、オンラインユーザーとセッション、API トークン管理そのもの、システム設定の変更とテストボタン、Webhook のすべての書き込み操作（追加・変更・削除・シークレットの再生成・テスト送信・再送）とシークレットの表示。システム設定や Webhook 一覧の読み取りなど、読み取り専用のエンドポイントは使えます。

### 管理

- 本人は「個人設定 → API Token」でいつでも失効させられます。失効後の次のリクエストから使えなくなります
- 「システム管理 → セキュリティ監査 → API Token」（メニュー権限 `system_api_tokens`）には、データ権限の範囲内にある全員のトークンが表示されます。名前・プレフィックス・作成者で検索し、有効 / 期限切れ / 失効済みで絞り込めます。ボタン権限 `system_api_tokens_revoke` があれば失効させられます。スーパー管理者のトークンを失効させられるのはスーパー管理者だけです
- 各トークンは最終使用日時と IP を記録します。操作ログの `api_token_id` 列で、どのトークンによるリクエストかがわかります

::: tip バックエンド開発
アカウントやセキュリティに関わるエンドポイント（パスワード、シークレット、セッションなど）を追加したら、パスを `apps/api/src/common/api-token.ts` の `API_TOKEN_DENIED` に加えてください。それ以外のエンドポイントは何もする必要はありません。`hasMenuPermission` がトークンの権限で判定します。
:::

## Webhook

### 設定

「システム管理 → システム構成 → Webhook」（表示には `system_webhooks`、追加 / 編集 / 削除にはそれぞれ `system_webhooks_add` / `_edit` / `_delete` が必要）：

- **送信先 URL**：http または https。クラウドのメタデータ（`169.254.169.254`）などの予約アドレスは指定できず、本番環境では初期状態で内部ネットワークも指定できません。必要なら `SETTINGS_ALLOW_PRIVATE_NETWORK=true` を設定します。送信時には接続段階で実際の IP を再確認します
- **購読イベント**：個々のイベント、種類ごとのすべてのイベント（`user.*` など）、またはすべてのイベント（`*`）
- **署名シークレット**：追加直後に一度表示されます。後から「署名シークレット」で表示・再生成でき、どちらも本人確認が必要です
- Webhook の追加や送信先 URL の変更は、すべてのスーパー管理者にサイト内通知されます
- 「テスト送信」は `ping` イベントをすぐに送り、結果を表示します。「配信履歴」には各配信のリクエスト、レスポンス、再試行の状況が表示され、再送もできます

### イベント

| イベント | タイミング | `data` |
|---|---|---|
| `user.created` / `user.updated` / `user.deleted` | ユーザーの追加、プロフィール・状態・ロールの変更（本人による個人設定での変更を含む）、削除 | ユーザー（パスワードは含まない）。削除時は `{ id, username }` |
| `role.created` / `role.updated` / `role.deleted` | ロールの追加、名前・権限・データ範囲の変更、削除 | ロール。削除時は `{ id, code }` |
| `department.created` / `department.updated` / `department.deleted` | 部署の追加、変更（親部署の変更を含む）、削除 | 部署。削除時は `{ id, code }` |
| `<モジュール>.created` / `.updated` / `.deleted` | `pnpm scaffold` で生成したモジュール | レコード。削除時は `{ id }` |
| `ping` | 「テスト送信」ボタン | `{ message, webhook }` |

イベントはデータの**書き込みが成功した後**に送信され、送信に失敗しても業務操作には影響しません。インポートと並べ替えではイベントを送信しません。

### リクエスト形式

```http
POST /your/endpoint HTTP/1.1
Content-Type: application/json
User-Agent: castor-kit-webhook
X-Castor-Event: user.created
X-Castor-Delivery: 8939b329-81ce-47fe-b5a6-e8746a0cbaa1
X-Castor-Timestamp: 1790410668
X-Castor-Signature: sha256=e6f82d49…

{"id":"8939b329-…","event":"user.created","created_at":"2026-09-26T08:17:48.687000","data":{…}}
```

- 2xx を返せば成功です。リダイレクトには従わず、失敗として扱います
- タイムアウトは 10 秒。レスポンス本文は先頭 2000 文字だけ保存します
- 失敗すると 1 分、5 分、30 分、2 時間、6 時間後に再試行し、6 回目も失敗すると「失敗」になります。Webhook を無効にすると、待機中の再試行も止まります
- `X-Castor-Delivery` はイベント ID で、再試行や手動の再送でも変わりません。受信側はこれで重複を除けます

### 署名の検証

署名は「タイムスタンプ + `.` + 生のリクエスト本文」をシークレットで HMAC-SHA256 したものです。**生の本文**で計算し（解析してから再シリアライズしない）、古すぎるタイムスタンプは拒否してリプレイを防ぎます。

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(secret, headers, rawBody) {
  const timestamp = headers['x-castor-timestamp']
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
  const actual = headers['x-castor-signature'] ?? ''
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
```

```python
import hashlib, hmac, time

def verify(secret: str, headers, raw_body: bytes) -> bool:
    timestamp = headers["X-Castor-Timestamp"]
    if abs(time.time() - int(timestamp)) > 300:
        return False
    digest = hmac.new(secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(headers.get("X-Castor-Signature", ""), f"sha256={digest}")
```

### 自分のモジュールからイベントを送る

`pnpm scaffold` で生成したモジュールは、すでに `<モジュール>.created / updated / deleted` を送信します。手書きのモジュールは次のように組み込みます。

```ts
// routes.ts
import { declareEvents } from '@/common/webhooks'

declareEvents({ 'device.created': '设备已新增', 'device.updated': '设备已修改', 'device.deleted': '设备已删除' })

export async function registerDeviceRoutes(app: FastifyInstance) {
  const service = new DeviceService(app.db, app.events)
  // …
}

// service.ts: after the transaction committed
const item = deviceToDict(row)
await this.events?.emit('device.created', item)
```

- `emit` はトランザクションの**コミット後**に呼びます。ロールバックされた書き込みではイベントが送られません
- `emit` は配信レコードを保存した時点で戻り（送信はバックグラウンド）、例外を投げません。業務ロジックの判断には使わないでください
- 送るのは `xxxToDict()` の出力です。パスワードハッシュやシークレットなどは含めないでください
- `declareEvents` に渡す説明は Webhook ページに表示される中国語の原文です。翻訳を `apps/web/src/modules/admin/pages/webhooks/locales/` に追加してください
