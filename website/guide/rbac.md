# 权限 RBAC

castor-kit 使用基于角色的权限控制：用户拥有角色，角色被授予菜单和按钮权限。菜单同时决定侧边栏显示、前端路由和后端接口的访问权限。

## 数据结构

| 表 | 说明 |
|---|---|
| `admin_users` | 后台用户 |
| `roles` | 角色 |
| `menus` | 菜单与按钮权限，`parent_id` 自引用形成树 |
| `user_roles` | 用户 ↔ 角色，多对多（复合主键） |
| `role_menus` | 角色 ↔ 菜单，多对多（复合主键） |

`menus` 表的 `menu_type` 区分两类记录：

| `menu_type` | 含义 | 是否显示在导航中 |
|---|---|---|
| `menu` | 页面菜单或分组 | 是（`is_visible` 为真时） |
| `button` | 按钮权限，挂在页面菜单下 | 否 |

菜单记录的主要字段：`id`、`name`、`code`、`icon`、`path`、`component`、`parent_id`、`sort_order`、`menu_type`、`is_visible`、`is_active`。其中 `path` 是浏览器地址，`component` 决定加载哪个前端页面（见 [前端开发](/guide/frontend#动态路由)）。

## 权限编码

| 类型 | 格式 | 示例 |
|---|---|---|
| 菜单权限 | `<domain>_<resource>` | `system_users` |
| 新增按钮 | `<domain>_<resource>_add` | `system_users_add` |
| 编辑按钮 | `<domain>_<resource>_edit` | `system_users_edit` |
| 删除按钮 | `<domain>_<resource>_delete` | `system_users_delete` |
| 导出按钮 | `<domain>_<resource>_export` | `system_users_export` |
| 导入按钮 | `<domain>_<resource>_import` | `system_users_import` |

域前缀：`admin` 域为 `system_`，`component_center` 域为 `cc_`。标准列表页应当具备以上五个按钮权限。

::: info 历史编码
组件示例中心的 31、33–37 号菜单使用 `system_*` 编码（如 `system_list_page`），另有部分页面使用 `cc_admin_*` 形式。这些编码已经入库，不要修改；新模块一律使用 `cc_<name>`，与 `pnpm scaffold` 输出的权限前缀一致。
:::

## 权限在哪里生效

| 位置 | 机制 |
|---|---|
| 后端接口 | routes 中调用 `await hasMenuPermission(request, code)`，不满足返回 403。见 [后端开发](/guide/backend#权限检查) |
| 侧边栏与路由 | 前端通过 `GET /api/admin/my-menus` 获取当前用户的菜单树，只为其中的页面菜单生成路由 |
| 前端按钮 | `useAuth()` 提供 `menuCodes` 和 `hasPermission(code)`，可用于按权限隐藏按钮 |

后端检查是真正的安全边界，前端隐藏按钮只是体验优化。

## 超级管理员

`code = 'super_admin'` 的角色拥有全部权限：

- 后端的 `hasMenuPermission` 对它直接放行。
- `seed-rbac` 每次运行都会把全部菜单授予它。

例外：`GET /api/admin/my-menus` 不做超级管理员短路，而是按角色实际被授予的菜单返回。因为 `seed-rbac` 会把全部菜单授予超级管理员，正常情况下两者一致。

## 菜单的唯一事实源：seed-rbac.ts

所有菜单和按钮权限都定义在 `apps/api/scripts/seed-rbac.ts` 的 `MENUS_DATA` 中。新增或修改菜单时改这个文件，然后同步到数据库。

### 添加菜单

以在“系统管理”下添加“客户管理”为例（ID 仅为示意，实际取值见下文“菜单 ID 分配”）：

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

- `component` 使用 `pnpm scaffold` 输出的 Menu component 值。
- `icon` 沿用 `apps/web/src/lib/menu-icons.js` 映射表里已有的名字。
- 新菜单还需要在 `apps/web/src/locales/menus/en-US.json` 和 `ja-JP.json` 中按 `code` 添加译名，见 [多语言](/guide/i18n#菜单名翻译)。

### 同步到数据库

```bash
pnpm seed:rbac -- --incremental
```

`--incremental` 的行为：

- 按 `code` 匹配：已存在的菜单只更新字段（ID 不变），不存在的按指定 ID 插入
- 只新增和更新，**不删除**任何已有记录
- 把全部菜单授予超级管理员
- 插入后同步 `menus` 表的 ID 序列，避免后续新增撞主键
- `admin` 账号不存在时才创建

删除菜单需要手动执行 SQL，例如 `DELETE FROM menus WHERE id = <id>`。

::: warning 全量重建
不带 `--incremental` 的 `pnpm seed:rbac` 会清空 `user_roles`、`role_menus`、`admin_users`、`roles`、`menus` 后重新写入，只用于空库初始化。
:::

::: tip 部署时自动同步
Docker 部署时，容器每次启动都会执行 `setup-once`，其中包含增量 RBAC 同步，所以新菜单随代码更新自动生效，不会清掉已有用户和角色。
:::

## 菜单 ID 分配

菜单 ID 在 `MENUS_DATA` 中写死，`role_menus` 通过 ID 引用菜单，所以已有 ID 不能重排。

| 范围 | ID 区间 |
|---|---|
| 系统管理（`parent_id=2`） | 21–39 |
| 组件示例中心（`parent_id=3`） | 40–499 |
| 　管理系统（`parent_id=40`） | 401–409 |
| 　数据可视化（`parent_id=41`） | 411–419 |
| 　3D / 创意（`parent_id=42`） | 421–429 |
| 　AI 应用（`parent_id=44`） | 441–449 |
| 　编辑器 / 低代码（`parent_id=45`） | 451–459 |
| 　工程 / 工具类（`parent_id=46`） | 461–469 |
| 新业务域 | 从 1000 开始 |
| 按钮权限 | 菜单 ID × 10 + 序号（如 21 → 211…215） |

区间里夹着历史遗留 ID：31、33–37 属于组件示例中心，32 是定时任务，消息通知和公告是 100002、100003。取 ID 前先查实际占用：

```bash
grep -oE "id: [0-9]+" apps/api/scripts/seed-rbac.ts | awk '{print $2}' | sort -n | uniq
```

## 在界面上管理

系统管理下的三个页面对应 RBAC 数据：

| 页面 | 作用 |
|---|---|
| 用户管理 | 创建用户、分配角色 |
| 角色权限 | 创建角色、为角色勾选菜单和按钮权限 |
| 菜单管理 | 查看和调整菜单树 |

::: tip
在界面上新增或修改的菜单不会写回 `seed-rbac.ts`。另外，增量同步会按 `MENUS_DATA` 更新同 `code` 菜单的字段，所以对已定义菜单在界面上做的修改，会在下次同步（包括容器重启）时被覆盖。需要长期保留、随代码部署的菜单，应当写进 `MENUS_DATA`。
:::
