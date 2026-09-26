# Permissions (RBAC)

castor-kit uses role-based access control: users have roles, and roles are granted menu and button permissions. Menus decide what appears in the sidebar, which frontend routes exist, and who can access which backend APIs.

## Data model

| Table | Description |
|---|---|
| `admin_users` | Admin users |
| `roles` | Roles |
| `menus` | Menus and button permissions; `parent_id` references the same table to form a tree |
| `user_roles` | Users ↔ roles, many-to-many (composite primary key) |
| `role_menus` | Roles ↔ menus, many-to-many (composite primary key) |
| `departments` | Departments; `parent_id` references the same table to form a tree. Users belong to one through `admin_users.dept_id` |
| `role_depts` | Roles ↔ departments, used by the "custom departments" data scope |

The `menu_type` column in `menus` distinguishes two kinds of records:

| `menu_type` | Meaning | Shown in navigation |
|---|---|---|
| `menu` | A page menu or a group | Yes (when `is_visible` is true) |
| `button` | A button permission, attached to a page menu | No |

The main fields of a menu record are `id`, `name`, `code`, `icon`, `path`, `component`, `parent_id`, `sort_order`, `menu_type`, `is_visible` and `is_active`. `path` is the browser URL, and `component` decides which frontend page to load (see [Frontend](/en/guide/frontend#dynamic-routing)).

## Permission codes

| Kind | Format | Example |
|---|---|---|
| Menu permission | `<domain>_<resource>` | `system_users` |
| Add button | `<domain>_<resource>_add` | `system_users_add` |
| Edit button | `<domain>_<resource>_edit` | `system_users_edit` |
| Delete button | `<domain>_<resource>_delete` | `system_users_delete` |
| Export button | `<domain>_<resource>_export` | `system_users_export` |
| Import button | `<domain>_<resource>_import` | `system_users_import` |

Domain prefixes: `system_` for the `admin` domain, `cc_` for the `component_center` domain. A standard list page should have all five button permissions above.

::: info Legacy codes
Menus 31 and 33–37 in the Component Gallery use `system_*` codes (e.g. `system_list_page`), and some other pages use the `cc_admin_*` form. These codes are already in the database; don't change them. New modules always use `cc_<name>`, matching the permission prefix printed by `pnpm scaffold`.
:::

## Where permissions are enforced

| Where | Mechanism |
|---|---|
| Backend APIs | Routes call `await hasMenuPermission(request, code)` and return 403 if it fails. See [Backend](/en/guide/backend#permission-checks) |
| Sidebar and routes | The frontend fetches the current user's menu tree from `GET /api/admin/my-menus` and only creates routes for the page menus in it |
| Frontend buttons | `useAuth()` provides `menuCodes` and `hasPermission(code)`, which you can use to hide buttons based on permissions |

The backend check is the real security boundary; hiding buttons on the frontend is only a UX nicety.

## Super admin

The role with `code = 'super_admin'` has every permission:

- The backend's `hasMenuPermission` lets it through unconditionally.
- Every run of `seed-rbac` grants it all menus.

Exception: `GET /api/admin/my-menus` has no super admin shortcut; it returns the menus actually granted to the role. Since `seed-rbac` grants all menus to the super admin, the two normally match.

### Not locking yourself out

So a mistake can't leave nobody able to run the system, the backend enforces these rules (the UI disables the matching controls):

- The super admin role can't be deleted and its code can't change; its data scope is always "All data" and it always has every menu. Only its name and description are editable
- Only super admins can grant or remove the super admin role, and only super admins can edit, disable or delete super admin accounts (otherwise anyone who can edit users could reset a super admin's password)
- You can't remove the super admin role from yourself, or disable or delete yourself
- The last active super admin can't be disabled, deleted or lose the role; imports are checked the same way

If the super admin role or the `admin` account still ends up broken, run `pnpm seed:rbac -- --incremental` (with Docker, restarting the container does it): it recreates the `super_admin` role, grants it every menu again and puts the `admin` account back in it. It doesn't restore other accounts' roles, and doesn't reset passwords or account status.

## seed-rbac.ts: the single source of truth for menus

All menus and button permissions are defined in `MENUS_DATA` in `apps/api/scripts/seed-rbac.ts`. To add or change a menu, edit this file and then sync it to the database.

### Adding a menu

For example, adding "客户管理" (Customers) under System (the IDs are for illustration only; see [Menu ID allocation](#menu-id-allocation) below for real values):

```ts
// Page menu
{ id: 26, name: "客户管理", code: "system_customer", icon: "IconUser", path: "/system/customers", component: "admin/customer", parent_id: 2, sort_order: 10, menu_type: "menu", is_visible: true, is_active: true },
// Button permissions: id = menu id × 10 + index
{ id: 261, name: "新增客户", code: "system_customer_add", icon: null, path: null, component: null, parent_id: 26, sort_order: 1, menu_type: "button", is_visible: false, is_active: true },
{ id: 262, name: "编辑客户", code: "system_customer_edit", icon: null, path: null, component: null, parent_id: 26, sort_order: 2, menu_type: "button", is_visible: false, is_active: true },
{ id: 263, name: "删除客户", code: "system_customer_delete", icon: null, path: null, component: null, parent_id: 26, sort_order: 3, menu_type: "button", is_visible: false, is_active: true },
{ id: 264, name: "导出客户", code: "system_customer_export", icon: null, path: null, component: null, parent_id: 26, sort_order: 4, menu_type: "button", is_visible: false, is_active: true },
{ id: 265, name: "导入客户", code: "system_customer_import", icon: null, path: null, component: null, parent_id: 26, sort_order: 5, menu_type: "button", is_visible: false, is_active: true },
```

- For `component`, use the Menu component value printed by `pnpm scaffold`.
- For `icon`, reuse a name that already exists in the map in `apps/web/src/lib/menu-icons.js`.
- New menus also need translated names, keyed by `code`, in `apps/web/src/locales/menus/en-US.json` and `ja-JP.json`; see [Internationalization](/en/guide/i18n#menu-name-translations).

### Syncing to the database

```bash
pnpm seed:rbac -- --incremental
```

What `--incremental` does:

- Matches by `code`: existing menus only have their fields updated (IDs stay the same); missing ones are inserted with the specified ID
- Only inserts and updates; **never deletes** existing records
- Grants all menus to the super admin
- After inserting, syncs the ID sequence of the `menus` table so later inserts don't collide on the primary key
- Creates the `admin` account only if it doesn't exist

To delete a menu, run the SQL by hand, e.g. `DELETE FROM menus WHERE id = <id>`.

::: warning Full rebuild
`pnpm seed:rbac` without `--incremental` wipes `user_roles`, `role_menus`, `admin_users`, `roles` and `menus`, then rewrites them. Use it only to initialize an empty database.
:::

::: tip Automatic sync on deploy
With Docker, the container runs `setup-once` on every start, which includes the incremental RBAC sync. New menus therefore go live with each code update without wiping existing users and roles.
:::

## Menu ID allocation

Menu IDs are hard-coded in `MENUS_DATA`, and `role_menus` references menus by ID, so existing IDs must never be renumbered.

| Scope | ID range |
|---|---|
| System (`parent_id=2`) | 21–39 |
| Component Gallery (`parent_id=3`) | 40–499 |
| └ Admin Pages (`parent_id=40`) | 401–409 |
| └ Data Visualization (`parent_id=41`) | 411–419 |
| └ 3D / Creative (`parent_id=42`) | 421–429 |
| └ AI Apps (`parent_id=44`) | 441–449 |
| └ Editors / Low-code (`parent_id=45`) | 451–459 |
| └ Engineering Tools (`parent_id=46`) | 461–469 |
| New business domains | Starting from 1000 |
| Button permissions | Menu ID × 10 + index (e.g. 21 → 211…215) |

Some legacy IDs sit inside these ranges: 31 and 33–37 belong to the Component Gallery, 32 is Scheduled Tasks, and Notifications and Announcements are 100002 and 100003. Check which IDs are actually taken before picking one:

```bash
grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
```

## Managing RBAC in the UI

Four pages under System map to the RBAC data:

| Page | Purpose |
|---|---|
| Users | Create users, assign roles, edit nickname / email / phone / avatar, enable or disable accounts |
| Roles | Create roles, tick the menu and button permissions for each, and set its data scope |
| Departments | Maintain the department tree (parent, head, order, status) that users belong to and data scope uses |
| Menus | View and adjust the menu tree |

::: tip
Menus added or changed in the UI are not written back to `seed-rbac.ts`. Also, the incremental sync updates the fields of menus with the same `code` from `MENUS_DATA`, so UI changes to menus defined there are overwritten on the next sync (including container restarts). Menus that should persist and ship with the code belong in `MENUS_DATA`.
:::

### Disabling accounts

"Disable" on the Users page needs the `system_users_status` button permission (edit permission doesn't include it). Once an account is disabled:

- It can't sign in even with the right password: the API returns 403 "This account has been disabled" and records a failed sign-in
- Sessions that are already signed in end on their next request (401, the frontend goes back to the sign-in page) — every signed-in request checks that the account still exists and is active
- You can't disable yourself, or disable or delete the last active super admin; the same rules apply to the status column on import

## Data scope

Menu and button permissions decide which features someone can use; data scope decides which rows they can see. It is set per role:

| Data scope | Visible rows |
|---|---|
| All data (`all`, default) | Everything |
| Own department and below (`dept_and_children`) | The user's department and all its sub-departments |
| Own department (`dept`) | The user's department |
| Own data only (`self`) | Rows the user created |
| Custom departments (`custom`) | The departments ticked on the role |

- A user with several roles sees the **union** of their scopes; super admins and anyone with an "All data" role are unrestricted
- A restricted scope that works out empty (say, a "Own department" role for a user with no department) shows nothing — it never falls back to everything
- Rows outside the scope are a 404 on detail, update and delete, so their existence doesn't leak; exports are limited the same way
- Disabled departments still count as sub-departments; the department tree itself is not scoped
- The roles import template and export carry a 数据范围 column (label or code) and a 部门编码 column (custom departments, comma-separated)

To try it quickly, run `pnpm seed:demo`: it adds a sample department tree, two roles (department manager: own department and below; staff: own data only) and six sample users (password `demo123456` by default). Signed in as `zhang.wei` you only see 研发部 (R&D) and its sub-departments; as `li.na`, only yourself.

### What is scoped

- **Users**: filtered by the user's department, and "Own data only" means yourself. A restricted admin can only assign users to departments inside their scope
- **Modules generated with `--data-scope`**: the table gets `dept_id` (owning department) and `created_by` (creator), stamped with the current user and their department on create

```bash
pnpm scaffold -- --name contract --domain admin --fields "title:str,amount:float" --data-scope
```

### Adding it to your own module

Resolve the scope in routes and filter in the repository; the repository never sees `request`:

```ts
// routes.ts
import { currentActor, resolveDataScope } from '@/common/data-scope'
const scope = await resolveDataScope(request)          // cached per request
return service.listItems(page, per_page, search, scope)

// repository.ts
import { dataScopeWhere } from '@/common/data-scope'
const where = and(this.searchWhere(search), dataScopeWhere(scope, { deptColumn: t.dept_id, ownerColumn: t.created_by }))
```

Declare `export const DATA_SCOPE = { deptColumn: 'dept_id', ownerColumn: 'created_by' }` in the module's `schema.ts`; the `data_scope_filter` check in `pnpm verify` then confirms the repository uses `dataScopeWhere`.
