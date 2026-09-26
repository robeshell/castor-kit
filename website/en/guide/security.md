# Account security & settings

castor-kit keeps sign-in state on the server, so sessions can be listed and signed out. On top of that it offers two-step verification, password reset by email, password rules and rate limits. Features that add friction are off by default; administrators turn them on under System → System settings.

## System settings

The System settings page holds switches and parameters that can change at runtime. They are stored in the `system_settings` table and apply within a few seconds, without a restart.

| Setting | Purpose | Default |
|---|---|---|
| `security.totp_enabled` | Two-step verification master switch | Off |
| `security.totp_required_roles` | Roles that must use two-step verification | None |
| `security.password_reset_enabled` | Password reset by email | Off |
| `security.password_min_length` | Minimum password length (6–64) | `6` |
| `security.password_require_letters_digits` | Passwords must contain letters and digits | Off |
| `security.password_require_symbol` | Passwords must contain a symbol | Off |
| `security.session_ttl_hours` | Session lifetime (hours, 1–720, sliding) | `SESSION_TTL_HOURS` |
| `security.rate_limit_per_minute` | `/api` requests per IP per minute | `600` |
| `security.auth_rate_limit_per_minute` | Sign-in requests per IP per minute (sign-in, 2FA code and password reset share it) | `20` |

- The defaults match the previous behavior: after upgrading, nothing changes until a switch is turned on
- A switch whose prerequisites are missing can't be turned on, and the page says why. For example, password reset needs mail to be configured, and neither two-step verification nor password reset can be turned on in demo mode
- Secrets and infrastructure (SMTP, S3, database …) stay in environment variables and never go into this table
- Viewing needs the menu permission `system_settings`; saving needs the button permission `system_settings_edit`

### Adding a setting

Settings are defined in `SETTING_DEFINITIONS` in `apps/api/src/common/settings.ts`: type, default, bounds, whether it is public (public ones are sent to signed-out pages through `/api/admin/app-info`) and why it may be unavailable. Code reads them with `app.settings.get()`; on hot paths that run for every request (like rate limiting) use `app.settings.peek()`, which returns the cached values without waiting for the database.

When a new feature should be "off by default, an admin can turn it on", add a setting here rather than another environment variable.

## Server-side sessions

- Signing in creates a row in `sessions`. The `castor_session` cookie is still encrypted but holds only the session ID and the CSRF token; the row decides whether the request is signed in and as whom
- Each request checks the session once; last activity and expiry are updated at most once a minute (sliding expiry)
- Sessions that expired or were revoked more than a day ago are deleted hourly by the scheduler process

These actions end sessions right away; the next request gets 401:

| Action | Affects |
|---|---|
| Sign out | The current session |
| Change password | The user's other sessions (this device stays signed in) |
| An admin changes the password, disables or deletes the user | All of that user's sessions |
| Password reset through an email link | All of that user's sessions |
| Force sign-out | The chosen session |

On the backend, check sign-in with `isSignedIn(request)` from `common/session.ts`; don't read cookie fields.

### Online users

System → Online users lists the signed-in sessions (user, device, IP, sign-in time and last activity), filtered by the viewer's [data scope](/en/guide/rbac#data-scope). With the button permission `system_sessions_revoke` an admin can force a sign-out, except for their own current session; only super admins can sign out super admins.

Under Profile → Signed-in devices, every user sees where they are signed in and can sign out one device or all others.

## Two-step verification

Once turned on in System settings:

1. Users go to Profile → Two-step verification, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password …) and enter the first code. They get 10 recovery codes, shown only once
2. Enrolled users enter a 6-digit code after their password when signing in, or a recovery code instead
3. Members of the roles listed under "Required for roles" who haven't enrolled are asked to set it up at sign-in and go straight in afterwards; they can't turn it off themselves
4. When a user loses both phone and recovery codes, an admin resets their two-step verification from the bottom-left of the Edit user dialog under Users (needs `system_users_edit`; only super admins can reset super admins)

Details:

- TOTP (6 digits, 30 s, SHA-1), with one period of clock drift either way; a code for a given period can be used only once
- The secret is stored encrypted with AES-256-GCM, using a key derived from `SECRET_KEY`; changing `SECRET_KEY` invalidates existing enrollments
- Recovery codes are stored as sha256 hashes and each works once
- Wrong codes count toward the sign-in lockout just like wrong passwords (`LOGIN_MAX_FAILURES` / `LOGIN_LOCKOUT_MINUTES`)
- After the password but before the second step, the session is pending: it can't reach any endpoint that needs sign-in and expires after 5 minutes. Passing the step issues a new session ID. The "signed in" log entry and last sign-in time are recorded only then
- Turning the master switch off only stops sign-in from asking for codes; enrollments are kept and apply again when it is turned back on

## Password reset

Configure mail (`SMTP_HOST` etc., see [Configuration](/en/reference/configuration#mail)) and `APP_BASE_URL` first, then turn it on in System settings. The sign-in page then shows "Forgot password?":

1. The user enters the email on their account. The answer is the same whether or not the email exists, so it doesn't reveal accounts
2. The link looks like `<APP_BASE_URL>/reset-password?token=…`; it is valid for 30 minutes and works once, and a new request invalidates earlier links
3. The new password is checked against the password rules; afterwards the user is signed out everywhere. Accounts with two-step verification still need a code at the next sign-in

The email follows the user's current interface language. In local development, `MAIL_DRIVER=log` prints mails to the backend log instead of sending them.

## Password rules

Every place a password is set checks the rules from System settings: changing a password, creating and editing users, importing users and password reset. Existing passwords are not affected. Frontend forms read the same rules from `app-info` and validate before submitting.

## Rate limits

- Every `/api` and `/ws` request counts per IP; over the per-minute limit the response is 429 with a translated error and a `Retry-After` header. Static files and `/health` don't count
- Sign-in, 2FA codes and password reset share a stricter limit
- Counters live in process memory: with several instances each one counts separately, so the effective limit can be up to the setting times the number of instances
- `RATE_LIMIT_ENABLED=false` turns it off entirely (it is off in the test environment)

Rate limits and the sign-in lockout work together: one limits how often requests come in, the other how many attempts may fail.
