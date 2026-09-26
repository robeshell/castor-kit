# Open API: API tokens and webhooks

Scripts, cron jobs and other systems call castor-kit's API with **API tokens**; when data changes in castor-kit, **webhooks** push it to other systems.

## API tokens

### Turning them on

API tokens are off by default. An administrator turns on "Allow API tokens" (`security.api_tokens_enabled`) under System → Configuration → System settings → Security. Turning it off pauses every existing token until it's turned back on; it can't be turned on in demo mode.

### Creating a token

Each user creates their own tokens under Profile → API Token:

- Enter a name, pick an expiry (30 days, 90 days, 180 days, 1 year or never) and check permissions
- Only menu / button permissions you have can be checked; checking a button also grants the page it belongs to
- Creating a token needs a recent identity check (a sign-in or check within 10 minutes; otherwise the "Verify identity" dialog opens first)
- A token looks like `ck_` plus 43 characters and is **shown only once**, at creation; the list shows its first 11 characters
- At most 20 active tokens per user

### Using a token

Send the token in the request header:

```bash
curl -H "Authorization: Bearer ck_xxxxxxxx…" \
  https://admin.example.com/api/admin/users?per_page=50
```

- A request with a Bearer token is authenticated by the token only: no cookie is read, no CSRF header is needed and no session is created
- **Effective permissions = the token's permissions ∩ the creator's current permissions.** A super admin's token also has only the permissions checked on it; when the creator loses a permission, the token loses it too
- Data scope follows the creator (see [Data scope](/en/guide/rbac#data-scope))
- Endpoints and parameters are in `docs/apifox-full.openapi.json` in the repository: operations whose `security` lists `bearerAuth` accept tokens; those listing only `cookieAuth` (account security, system settings and similar) don't

| Situation | Response |
|---|---|
| API tokens aren't turned on in System settings | 401 `API Token 未开启` (API tokens are turned off) |
| The token doesn't exist, was revoked or expired, or its creator was disabled / deleted | 401 `API Token 无效或已过期` (invalid or expired) |
| The endpoint doesn't accept tokens | 403 `该接口不支持 API Token` (not available to API tokens) |
| The token lacks the permission the endpoint needs | 403 (as for a user without the permission) |

Error messages follow the `Accept-Language` header like every other API error.

These account and security endpoints never accept tokens, even a token with every permission: sign-in / sign-out, password reset, changing the password, identity checks, two-step verification (including an admin resetting someone else's), the profile, online users and sessions, API token management itself, changing System settings and its test buttons, and every webhook write (add, change, delete, regenerate the secret, send a test, redeliver) or viewing its secret. Read-only endpoints such as reading System settings or the webhook list do accept tokens.

### Managing tokens

- Owners revoke their tokens under Profile → API Token at any time; the next request with the token fails
- System → Security → API Token (menu permission `system_api_tokens`) lists everyone's tokens within your data scope, searchable by name, prefix and creator and filterable by active / expired / revoked; with the button permission `system_api_tokens_revoke` you can revoke them. Only super admins can revoke a super admin's token
- Each token records when and from which IP it was last used; the `api_token_id` column of the operation log shows which token made a request

::: tip Backend development
When you add an account or security endpoint (password, secrets, sessions …), add its path to `API_TOKEN_DENIED` in `apps/api/src/common/api-token.ts`. Other endpoints need nothing: `hasMenuPermission` already checks the token's permissions.
:::

## Webhooks

### Setting one up

System → Configuration → Webhook (viewing needs `system_webhooks`; adding / editing / deleting need `system_webhooks_add` / `_edit` / `_delete`):

- **Endpoint URL**: http or https. It can't point at reserved addresses such as cloud metadata (`169.254.169.254`), nor at internal networks in production unless `SETTINGS_ALLOW_PRIVATE_NETWORK=true`. The actual IP is checked again when connecting
- **Events**: single events, every event of a kind (such as `user.*`) or everything (`*`)
- **Signing secret**: shown once after adding; view or regenerate it later under "Signing secret", both behind an identity check
- Adding a webhook or changing its URL sends a notification to every super admin
- "Send test" sends a `ping` event right away and shows the result; "Deliveries" lists each delivery's request, response and retries, and can redeliver

### Events

| Event | When | `data` |
|---|---|---|
| `user.created` / `user.updated` / `user.deleted` | a user is added; profile, status or roles change (including users editing their own profile); deleted | the user (no password); `{ id, username }` on delete |
| `role.created` / `role.updated` / `role.deleted` | a role is added; its name, permissions or data scope change; deleted | the role; `{ id, code }` on delete |
| `department.created` / `department.updated` / `department.deleted` | a department is added; changed (including a new parent); deleted | the department; `{ id, code }` on delete |
| `<module>.created` / `.updated` / `.deleted` | modules generated with `pnpm scaffold` | the record; `{ id }` on delete |
| `ping` | the "Send test" button | `{ message, webhook }` |

Events are sent **after** the data was written; a failed push never fails the operation. Imports and reordering don't send events.

### Request format

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

- Any 2xx answer is a success. Redirects aren't followed and count as failures
- 10-second timeout; only the first 2000 characters of the response are kept
- Failures are retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours; if the 6th attempt fails the delivery is marked failed. Disabling a webhook also stops its queued retries
- `X-Castor-Delivery` is the event id; it stays the same across retries and manual redeliveries, so receivers can de-duplicate on it

### Verifying the signature

The signature is HMAC-SHA256 with the secret over "timestamp + `.` + raw request body". Compute it over the **raw body** (don't parse and re-serialize it) and reject old timestamps to prevent replays:

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

### Sending events from your own module

Modules generated by `pnpm scaffold` already send `<module>.created / updated / deleted`. For hand-written modules:

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

- Call `emit` **after** the transaction committed, so a rolled-back write sends nothing
- `emit` returns once the deliveries are stored (sending happens in the background) and never throws; don't base business logic on it
- Send the `xxxToDict()` output, never password hashes, secrets and the like
- The labels passed to `declareEvents` are the Chinese source text shown on the webhook page; add their translations to `apps/web/src/modules/admin/pages/webhooks/locales/`
