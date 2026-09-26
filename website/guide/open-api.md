# 开放接口：API Token 与 Webhook

脚本、定时任务和其他系统可以用 **API Token** 调用 castor-kit 的接口；castor-kit 里的数据变化时，用 **Webhook** 主动推送给其他系统。

## API Token

### 打开功能

API Token 默认关闭。管理员在「系统管理 → 系统配置 → 系统设置 → 安全」里打开「允许使用 API Token」（`security.api_tokens_enabled`）。关闭后已有的 Token 全部暂停使用，重新打开后恢复；演示模式下不能打开。

### 创建

每个用户在「个人设置 → API Token」里创建自己的 Token：

- 填写名称，选择有效期（30 天、90 天、180 天、1 年或永不过期），勾选权限
- 只能勾选自己拥有的菜单 / 按钮权限；勾选一个按钮时，它所在的页面权限会一并授予
- 创建需要近期验证过身份（10 分钟内登录或验证过，否则会先弹出「验证身份」）
- Token 形如 `ck_` 加 43 个字符，**只在创建时显示一次**；之后列表里只显示前 11 位
- 每人最多 20 个有效 Token

### 使用

在请求头里带上 Token：

```bash
curl -H "Authorization: Bearer ck_xxxxxxxx…" \
  https://admin.example.com/api/admin/users?per_page=50
```

- 带 Bearer 的请求只按 Token 认证：不读 cookie、不需要 CSRF 头、不会创建登录会话
- **实际权限 = Token 勾选的权限 ∩ 创建人当前的权限**。超级管理员创建的 Token 也只有它勾选的权限；创建人被降权后 Token 随之收紧
- 数据权限按创建人计算（见 [数据权限](/guide/rbac#数据权限)）
- 接口列表与参数见仓库里的 `docs/apifox-full.openapi.json`：`security` 里列了 `bearerAuth` 的接口可以用 Token 调用，只列 `cookieAuth` 的（账号安全、系统设置等）不行

| 情况 | 响应 |
|---|---|
| 系统设置里没有打开 API Token | 401 `API Token 未开启` |
| Token 不存在、已吊销、已过期，或创建人被停用 / 删除 | 401 `API Token 无效或已过期` |
| 调用了不接受 Token 的接口 | 403 `该接口不支持 API Token` |
| Token 没有这个接口需要的权限 | 403（与普通用户无权限时相同） |

错误信息和其他接口一样按 `Accept-Language` 翻译。

下列账号与安全类接口一律不接受 Token，即使 Token 拥有全部权限：登录 / 退出、找回密码、修改密码、验证身份、两步验证（包括管理员重置别人的两步验证）、个人设置、在线用户与会话、API Token 管理本身、修改系统设置与测试按钮、Webhook 的所有写操作（新增、修改、删除、重新生成密钥、发送测试、重新投递）和查看密钥。读取系统设置、Webhook 列表这类只读接口可以用。

### 管理

- 本人在「个人设置 → API Token」里随时吊销，吊销后下一次请求即失效
- 「系统管理 → 安全审计 → API Token」（菜单权限 `system_api_tokens`）列出数据权限范围内所有人的 Token，可以按名称、前缀、创建人搜索，按有效 / 已过期 / 已吊销筛选；有按钮权限 `system_api_tokens_revoke` 时可以吊销。非超级管理员不能吊销超级管理员的 Token
- 每个 Token 记录最近使用时间和 IP；操作日志的 `api_token_id` 列注明请求来自哪个 Token

::: tip 后端开发
新增账号或安全相关的接口（修改密码、密钥、会话等）时，把路径加进 `apps/api/src/common/api-token.ts` 的 `API_TOKEN_DENIED`。其他接口不用做任何处理：`hasMenuPermission` 已经按 Token 的权限判断。
:::

## Webhook

### 配置

「系统管理 → 系统配置 → Webhook」（查看需要 `system_webhooks`，新增 / 编辑 / 删除分别需要 `system_webhooks_add` / `_edit` / `_delete`）：

- **推送地址**：http 或 https。不能指向云服务器元数据（`169.254.169.254`）等保留地址；生产环境默认也不能指向内网，需要时设置 `SETTINGS_ALLOW_PRIVATE_NETWORK=true`。发送时在连接层会再检查一次实际 IP
- **订阅事件**：具体事件、某一类的全部事件（如 `user.*`）或全部事件（`*`）
- **签名密钥**：新增后显示一次；之后在「签名密钥」里查看或重新生成，都需要近期验证身份
- 新增 Webhook、修改推送地址时，所有超级管理员会收到站内通知
- 「发送测试」立即发送一个 `ping` 事件并显示结果；「投递记录」列出每次投递的请求内容、响应和重试情况，可以重新投递

### 事件

| 事件 | 触发时机 | `data` |
|---|---|---|
| `user.created` / `user.updated` / `user.deleted` | 新增用户；修改资料、状态、角色（包括本人在个人设置里改资料）；删除 | 用户（不含密码）；删除时为 `{ id, username }` |
| `role.created` / `role.updated` / `role.deleted` | 新增角色；修改名称、权限、数据范围；删除 | 角色；删除时为 `{ id, code }` |
| `department.created` / `department.updated` / `department.deleted` | 新增部门；修改（包括更换上级部门）；删除 | 部门；删除时为 `{ id, code }` |
| `<模块>.created` / `.updated` / `.deleted` | 用 `pnpm scaffold` 生成的模块 | 记录；删除时为 `{ id }` |
| `ping` | 「发送测试」按钮 | `{ message, webhook }` |

事件在业务数据**写入成功之后**发出；推送失败不会影响业务操作。导入和调整排序不发事件。

### 请求格式

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

- 返回任意 2xx 表示成功。重定向不会跟随，算作失败
- 10 秒超时；响应体只保存前 2000 个字符
- 失败后按 1 分钟、5 分钟、30 分钟、2 小时、6 小时重试，第 6 次仍失败记为「失败」。停用 Webhook 后排队中的重试也会停止
- `X-Castor-Delivery` 是事件 ID，重试和手动重新投递都不变，接收方可以用它去重

### 校验签名

签名是用密钥对「时间戳 + `.` + 原始请求体」计算的 HMAC-SHA256。接收方应该用**原始请求体**（不要先解析再序列化）计算并比较，同时拒绝时间戳太旧的请求防止重放：

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

### 在自己的模块里发事件

`pnpm scaffold` 生成的模块已经会发 `<模块>.created / updated / deleted`。手写的模块照这个方式接入：

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

- 在事务提交**之后**调用 `emit`，事务回滚时就不会发出事件
- `emit` 写好投递记录就返回（发送在后台进行），从不抛错；不要用它决定业务逻辑
- 推送的是 `xxxToDict()` 的输出，不要带密码哈希、密钥之类的字段
- `declareEvents` 里的说明是 Webhook 页面上显示的中文原文，译文加到 `apps/web/src/modules/admin/pages/webhooks/locales/`
