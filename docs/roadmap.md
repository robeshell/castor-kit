# castor-kit feature roadmap

> This document is the development plan for upcoming features: each item states its goal, scope, data model, API, UI, permissions and acceptance criteria, and development follows it.
> Status is updated as work progresses; when a plan changes, update this document first, then write code. Architecture and conventions are defined by `AGENTS.md` and `docs/architecture.md`.

## Overview

| Phase | Feature | Priority | Depends on | Status |
|---|---|---|---|---|
| 0 | User profile (nickname, email, phone, avatar, enable / disable, last login) | — | — | Done |
| 1 | Departments and data scopes (`all` / `dept_and_children` / `dept` / `self` / `custom`) | — | 0 | Done |
| 1 | File center (`local` / S3-compatible storage, deduplication, references, orphan cleanup) | — | 0 | Done |
| 2 | Account security and system settings (server-side sessions, online users, two-factor authentication, password recovery, rate limiting, password policy) | — | 0 | Done |
| 2 | Open API: API tokens and webhooks | — | — | Done |
| — | Public demo mode and Render + Neon deployment | — | — | Done |
| — | Global AI assistant (see [AI assistant](../website/guide/assistant.md)) | — | — | Done |
| 3 | [Approval workflow](#approval-workflow) | Low | 1 | Not started |
| 3 | [Multi-tenancy](#multi-tenancy) | Low | 1, 2 | Not started |

The design and conventions of finished features are in `docs/architecture.md` (section 4 "Cross-cutting conventions") and on the docs site (`website/guide/`). Multi-tenancy touches the most code, so it comes last.

Online visual modeling (a low-code platform) is not planned: castor-kit's direction is to have AI agents generate feature code, and the entry point is `pnpm scaffold -- --spec` (the agent writes the inferred spec as JSON and then generates from it, getting Chinese labels, required / unique / default values, fixed options, data dictionaries and the menu right in one go). Ongoing investment goes into making generated features more accurate across different AI agents (the spec's JSON Schema and examples, OpenAPI rule checks, MCP tools).

## General delivery requirements

Each item ships as its own PR and meets these requirements:

- The backend follows the layering rules (`db/schema` → `schema` → `repository` → `service` → `routes`); migrations are actually applied and checked with `psql \d`
- New menus and button permissions go into `apps/api/scripts/seed-rbac.ts` (pick IDs that are actually free, following `AGENTS.md` "Menu ID allocation"), synced with `pnpm seed:rbac -- --incremental`
- UI copy is written as `t('中文原文')` (the Chinese source text is the i18n key), with complete en-US / ja-JP translations; new backend errors are registered in `apps/api/src/i18n/messages.ts`; code comments are in English
- New endpoints have API tests and shared frontend components have unit tests; `pnpm verify` is all green
- The same PR updates the docs in all three languages (`website/`) and the `[Unreleased]` section of `CHANGELOG.md`; if new environment variables are involved, update `apps/api/.env.example` and the configuration docs too
- Existing deployments upgrade smoothly: new columns get a default value or are nullable, and existing data is not broken

---

## Approval workflow

**Scope (first version)**

- Workflow definition: nodes are start, approval (a named user / role / department head / head of the initiator's parent department), conditional branch (on form fields), and end; parallel countersigning is not in the first version
- `workflow_definitions` (versioned), `workflow_instances`, `workflow_tasks`, `workflow_histories`
- Designer: canvas-based node editing (a component like React Flow could be used; evaluate its bundle size before adding it)
- "My to-dos / My completed / Started by me" pages; approve, reject, reassign, withdraw
- Integrating business modules: a module declares that it can start an approval, stores `workflow_instance_id`, and the approval result is written back to the business status
- Notifications: reuse the notification module and notify the approver when a to-do arrives

**Acceptance**: one sample business process (e.g. a leave or purchase request) goes all the way through start → conditional branch → approval → result written back; the history is traceable.

---

## Multi-tenancy

**Goal**: make castor-kit usable as a SaaS foundation, with one deployment serving multiple tenants whose data is isolated from each other.

**Key points of the design**

- A `tenants` table; all business tables plus users, roles, departments, files, etc. get a `tenant_id`
- Tenant resolution: subdomain or request header, determined at login and stored in the session
- Isolation: PostgreSQL row-level security (RLS) as the safety net, while the application layer also adds a `tenant_id` condition; the super admin splits into a platform admin and tenant admins
- Menus and features are switched per tenant plan; file storage uses a directory / prefix per tenant
- Scaffold and `verify`: new tables get `tenant_id` by default, and the gate checks that queries include the tenant condition

**Risk**: it touches almost every table and query, and has the highest data migration cost; it needs its own data migration and rollback plan, and should start only after features such as the approval workflow are stable.

**Acceptance**: the data, users and files of two tenants are completely isolated; any cross-tenant access returns 404; single-tenant deployments are unaffected (default tenant).
