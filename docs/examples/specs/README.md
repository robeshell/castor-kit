# Requirement → spec examples

Each JSON file corresponds to one of the requirement sentences below and is the `pnpm scaffold -- --spec` spec an AI agent should infer from it. The format and field meanings are in [`docs/spec.schema.json`](../../spec.schema.json), and the inference rules in `AGENTS.md` "From a one-line requirement to a spec (start here for new modules)". These files are checked by `apps/api/test/scaffold.test.ts`: they must pass `validateSpec`, conform to the JSON Schema, and the generated API docs must follow the OpenAPI writing rules.

The requirements are quoted in Chinese, as a user would write them, followed by an English translation. The labels in the JSON files are Chinese too, because UI copy is written in Chinese as the i18n key.

Validate first and see exactly what will be generated, then generate:

```bash
pnpm scaffold -- --spec docs/examples/specs/device.json --validate-only
pnpm scaffold -- --spec docs/examples/specs/device.json --dry-run
```

## device.json — 设备台账 (equipment register)

> 做一个设备台账：设备编号、名称、状态（闲置 / 使用中 / 维修中 / 已报废，新设备默认闲置）、分类（分类以后会增加，管理员自己维护）、采购价格、采购日期、设备照片、说明书、备注。编号不能重复。
>
> English: Build an equipment register: device number, name, status (idle / in use / under repair / scrapped; new devices default to idle), category (more categories will be added later, maintained by admins), purchase price, purchase date, device photo, manual, remarks. Numbers must not repeat.

| In the requirement | Inferred | Why |
|---|---|---|
| Device number, must not repeat (设备编号，不能重复) | `str50`, `required` + `unique` | Codes / numbers use `str50`; "must not repeat" = unique, and a device can't be without a number, so it is also required |
| Name (名称) | `str`, `required` | Names use `str`; the record's main name is required, and it is also the list's search field |
| Status (four values), default idle (状态) | `enum` + `options`, `default: "idle"`, `required`, option `tone`s | The options are fixed and spelled out in the requirement → `enum`; option values are English, display names Chinese. A status with a default is also required, so it can't be cleared when editing. The list shows options as badges: in use → `success`, under repair → `warning`, scrapped → `danger`, idle stays `neutral` (the default) |
| Category, maintained by admins (分类) | `dict`, `dict: "device_category"` | The options will grow or shrink and admins maintain them → data dictionary; the dictionary is created under `系统管理 → 系统配置 → 数据字典` (System → System config → Data dictionary) |
| Purchase price (采购价格) | `float` | Money |
| Purchase date (采购日期) | `date` | Date only |
| Device photo / manual (设备照片 / 说明书) | `image` / `file` | Images / attachments store the file ID from the file center; they can't be required |
| Remarks (备注) | `text` | Multi-line text |
| (not mentioned) | `menu: {}` | A new business module needs a menu; it goes under `业务管理` (Business) |
| (not mentioned) | `i18n` | Optional: English / Japanese for the title, field names and option names; without it the page falls back to the fields' English names |

## customer.json — 客户管理 (customer management)

> 客户管理：客户名称、联系人、联系电话、邮箱、客户等级（普通 / 重要 / VIP，默认普通）、客户来源（来源渠道会变）、所在城市、备注。销售只能看到自己部门的客户。
>
> English: Customer management: customer name, contact person, phone, email, customer tier (normal / important / VIP, default normal), customer source (the source channels will change), city, remarks. Sales staff can only see their own department's customers.

| In the requirement | Inferred | Why |
|---|---|---|
| Can only see their own department's customers (只能看到自己部门的客户) | `dataScope: true` | Data is isolated by department / creator; the exact scope is set by the role's data scope |
| Phone (联系电话) | `str20` | Phone numbers |
| Customer tier (three values) (客户等级) | `enum`, `default: "normal"` | Fixed options |
| Customer source, channels will change (客户来源) | `dict` | The options will grow or shrink |
| Contact person, city (联系人、城市) | `str50` | Short text |

## contract.json — 合同管理 (contract management)

> 合同管理：合同编号（唯一）、合同名称、客户名称、合同金额、签订日期、到期日期、合同状态（草稿 / 执行中 / 已完成 / 已终止，默认草稿）、是否自动续约、合同附件。编号、名称、客户、金额必须填。
>
> English: Contract management: contract number (unique), contract name, customer name, contract amount, signing date, expiry date, contract status (draft / active / completed / terminated, default draft), auto-renew or not, contract attachment. Number, name, customer and amount are mandatory.

| In the requirement | Inferred | Why |
|---|---|---|
| Mandatory (必须填) | `required: true` on those fields | Fields the requirement names are required; the contract status has a default, so it is required too (can't be cleared when editing); nothing else is |
| Auto-renew or not (是否自动续约) | `bool`, `default: false` | "Whether / or not" wording |
| Contract attachment (合同附件) | `file` | Attachments |
| Customer name (客户名称) | `str` | The requirement only asks for the name; linking to a customer table is a relation between tables, which scaffold doesn't generate; write it by hand after generating |

## expense.json — 报销单 (expense claim)

> 报销单：报销事由、报销金额、发生日期、报销类别（差旅 / 餐饮 / 办公 / 其他）、票据照片、说明。事由、金额、日期、类别必填。员工只能看到自己的报销单。
>
> English: Expense claim: reason, amount, date incurred, category (travel / meals / office / other), receipt photo, notes. Reason, amount, date and category are required. Employees can only see their own claims.

| In the requirement | Inferred | Why |
|---|---|---|
| Employees can only see their own (员工只能看到自己的) | `dataScope: true` | "Own data only" is one kind of data scope, configured on the role |
| Expense category (four values) (报销类别) | `enum`, no default | Fixed options; the requirement names no default, so don't set one |
| Receipt photo (票据照片) | `image` | Images |

The approval process in the requirement (submit, review, reject) is outside scaffold's scope: generate the claim itself first, then write the process for the business separately.
