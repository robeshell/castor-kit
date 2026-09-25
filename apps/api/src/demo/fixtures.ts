/**
 * Sample data for the public demo (DEMO_MODE), restored by resetDemoData().
 * Rows carry explicit ids so parent / child references stay intact; created_at / updated_at are set at reset time,
 * and date columns are shifted so the data always looks current (see DATE_BASE in reset.ts).
 * Tables are listed parents first; this order is also the insert order.
 */

export type FixtureRow = Record<string, string | number | boolean | null | unknown[] | Record<string, unknown>>

export const DEMO_FIXTURES: [table: string, rows: FixtureRow[]][] = [
  ['kanban_boards', [
    {
      "id": 1,
      "title": "待办",
      "board_code": "todo",
      "color": "#8c8c8c",
      "sort_order": 0,
      "wip_limit": 0,
      "is_active": true
    },
    {
      "id": 2,
      "title": "进行中",
      "board_code": "in_progress",
      "color": "#4080FF",
      "sort_order": 1,
      "wip_limit": 3,
      "is_active": true
    },
    {
      "id": 3,
      "title": "审核中",
      "board_code": "review",
      "color": "#FA8C16",
      "sort_order": 2,
      "wip_limit": 0,
      "is_active": true
    },
    {
      "id": 4,
      "title": "已完成",
      "board_code": "done",
      "color": "#00B96B",
      "sort_order": 3,
      "wip_limit": 0,
      "is_active": true
    }
  ]],
  ['kanban_cards', [
    {
      "id": 1,
      "board_id": 1,
      "title": "用户权限模块需求评审",
      "card_code": "CARD-001",
      "description": "梳理用户权限相关需求，输出 PRD 文档",
      "priority": "high",
      "assignee": "Alice",
      "due_date": "2026-03-28",
      "tags": "需求,权限",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 2,
      "board_id": 1,
      "title": "数据导出功能优化",
      "card_code": "CARD-002",
      "description": "支持 Excel/CSV 多格式导出，增加字段筛选",
      "priority": "medium",
      "assignee": "Bob",
      "due_date": "2026-04-05",
      "tags": "优化,导出",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": 3,
      "board_id": 1,
      "title": "修复移动端菜单适配问题",
      "card_code": "CARD-003",
      "description": null,
      "priority": "low",
      "assignee": null,
      "due_date": null,
      "tags": "Bug,移动端",
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": 4,
      "board_id": 2,
      "title": "看板拖拽功能开发",
      "card_code": "CARD-004",
      "description": "使用 dnd-kit 实现 Kanban 跨列拖拽",
      "priority": "urgent",
      "assignee": "Charlie",
      "due_date": "2026-03-22",
      "tags": "开发,前端",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 5,
      "board_id": 2,
      "title": "ECharts 大屏接入真实数据",
      "card_code": "CARD-005",
      "description": "对接后端 API 替换静态示例数据",
      "priority": "high",
      "assignee": "Alice",
      "due_date": "2026-03-25",
      "tags": "数据,图表",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": 6,
      "board_id": 3,
      "title": "动态表单页单元测试",
      "card_code": "CARD-006",
      "description": "完成核心接口的单元测试覆盖，目标 80%+",
      "priority": "medium",
      "assignee": "Dave",
      "due_date": "2026-03-21",
      "tags": "测试",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 7,
      "board_id": 4,
      "title": "组件中心菜单分类改造",
      "card_code": "CARD-007",
      "description": "将示例页面按行业方向分为 6 大类",
      "priority": "medium",
      "assignee": "Charlie",
      "due_date": null,
      "tags": "重构",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 8,
      "board_id": 4,
      "title": "树形列表页实现",
      "card_code": "CARD-008",
      "description": null,
      "priority": "low",
      "assignee": "Bob",
      "due_date": null,
      "tags": "",
      "sort_order": 1,
      "is_active": true
    }
  ]],
  ['query_managements', [
    {
      "id": 1,
      "name": "订单异常预警看板",
      "query_code": "init_query_order_alert",
      "category": "order",
      "keyword": "异常订单,预警",
      "data_source": "orders",
      "owner": "admin",
      "priority": 90,
      "is_active": true,
      "description": "用于演示订单异常排查流程",
      "image_url": null,
      "image_urls": null,
      "file_url": null,
      "file_urls": null,
      "status": "published",
      "condition_logic": "AND",
      "conditions_json": "{\"groups\":[{\"name\":\"异常订单\",\"logic\":\"AND\"}],\"items\":[{\"field\":\"status\",\"operator\":\"eq\",\"value\":\"abnormal\",\"logic\":\"AND\"},{\"field\":\"amount\",\"operator\":\"gt\",\"value\":500,\"logic\":\"AND\"}]}",
      "display_config": "{\"selected_fields\":[\"order_no\",\"status\",\"amount\",\"created_at\"],\"preview_rows\":10,\"sort_by\":\"created_at\",\"sort_order\":\"desc\"}",
      "permission_config": "{\"visible_roles\":[\"super_admin\"],\"editable_roles\":[\"super_admin\"]}",
      "schema_config": "{\"version\":\"1.0.0\",\"author\":\"system-seed\"}",
      "version": 1,
      "published_at": null
    },
    {
      "id": 2,
      "name": "高价值用户复购分析",
      "query_code": "init_query_user_rebuy",
      "category": "user",
      "keyword": "复购,高价值",
      "data_source": "users",
      "owner": "admin",
      "priority": 75,
      "is_active": true,
      "description": "用于演示用户分层查询模板",
      "image_url": null,
      "image_urls": null,
      "file_url": null,
      "file_urls": null,
      "status": "draft",
      "condition_logic": "OR",
      "conditions_json": "{\"groups\":[{\"name\":\"高价值用户\",\"logic\":\"OR\"}],\"items\":[{\"field\":\"level\",\"operator\":\"eq\",\"value\":\"vip\",\"logic\":\"OR\"},{\"field\":\"amount\",\"operator\":\"gt\",\"value\":10000,\"logic\":\"OR\"}]}",
      "display_config": "{\"selected_fields\":[\"user_id\",\"nickname\",\"level\",\"register_at\"],\"preview_rows\":8,\"sort_by\":\"register_at\",\"sort_order\":\"desc\"}",
      "permission_config": "{\"visible_roles\":[\"super_admin\"],\"editable_roles\":[\"super_admin\"]}",
      "schema_config": "{\"version\":\"1.0.0\",\"author\":\"system-seed\"}",
      "version": 1,
      "published_at": null
    }
  ]],
  ['tree_nodes', [
    {
      "id": 1,
      "name": "组织架构",
      "node_code": "init_tree_org_root",
      "parent_id": null,
      "node_type": "category",
      "icon": "IconHome",
      "description": "组织结构总览",
      "sort_order": 1,
      "is_active": true,
      "status": "active",
      "owner": "admin"
    },
    {
      "id": 2,
      "name": "业务中心",
      "node_code": "init_tree_business",
      "parent_id": 1,
      "node_type": "folder",
      "icon": "IconGridSquare",
      "description": "业务线节点",
      "sort_order": 1,
      "is_active": true,
      "status": "active",
      "owner": "admin"
    },
    {
      "id": 3,
      "name": "数据运营组",
      "node_code": "init_tree_data_ops",
      "parent_id": 2,
      "node_type": "member",
      "icon": "IconUser",
      "description": "负责日常指标运营",
      "sort_order": 1,
      "is_active": true,
      "status": "active",
      "owner": "admin"
    },
    {
      "id": 4,
      "name": "风险策略组",
      "node_code": "init_tree_risk",
      "parent_id": 2,
      "node_type": "member",
      "icon": "IconAlertTriangle",
      "description": "负责风险策略执行",
      "sort_order": 2,
      "is_active": true,
      "status": "active",
      "owner": "admin"
    }
  ]],
  ['stats_items', [
    {
      "id": 1,
      "name": "华东订单中心",
      "item_code": "init_stats_order_east",
      "category": "order",
      "status": "published",
      "amount": 1265000.5,
      "quantity": 3420,
      "owner": "陈晨",
      "priority": 90,
      "is_active": true,
      "description": "华东大区订单汇总"
    },
    {
      "id": 2,
      "name": "会员复购专项",
      "item_code": "init_stats_user_rebuy",
      "category": "user",
      "status": "draft",
      "amount": 885000.0,
      "quantity": 980,
      "owner": "李楠",
      "priority": 70,
      "is_active": true,
      "description": "会员复购数据追踪"
    },
    {
      "id": 3,
      "name": "风控拦截成效",
      "item_code": "init_stats_risk_block",
      "category": "risk",
      "status": "archived",
      "amount": 312000.88,
      "quantity": 126,
      "owner": "王博",
      "priority": 60,
      "is_active": false,
      "description": "历史风控策略效果复盘"
    }
  ]],
  ['card_items', [
    {
      "id": 1,
      "title": "活动运营周报",
      "card_code": "init_card_ops_weekly",
      "subtitle": "多渠道投放效果追踪",
      "category": "order",
      "cover_url": "https://images.unsplash.com/photo-1551281044-8b1f67f3f42b",
      "tag": "运营",
      "status": "published",
      "owner": "周青",
      "priority": 80,
      "is_active": true,
      "description": "用于展示卡片列表中的运营分析卡片"
    },
    {
      "id": 2,
      "title": "客户流失预警",
      "card_code": "init_card_user_churn",
      "subtitle": "近30天活跃下降用户",
      "category": "user",
      "cover_url": "https://images.unsplash.com/photo-1460925895917-afdab827c52f",
      "tag": "用户",
      "status": "draft",
      "owner": "林可",
      "priority": 65,
      "is_active": true,
      "description": "用于演示用户留存分析卡片"
    },
    {
      "id": 3,
      "title": "财务对账稽核",
      "card_code": "init_card_finance_check",
      "subtitle": "订单与支付流水核对",
      "category": "finance",
      "cover_url": "https://images.unsplash.com/photo-1554224155-6726b3ff858f",
      "tag": "财务",
      "status": "published",
      "owner": "高蕾",
      "priority": 88,
      "is_active": true,
      "description": "用于演示财务稽核场景卡片"
    }
  ]],
  ['cc_detail_members', [
    {
      "id": 1,
      "name": "张伟",
      "department": "产品部",
      "role_title": "产品总监",
      "email": "zhangwei@example.com",
      "phone": "13800001001",
      "status": "active",
      "join_date": "2021-03-15",
      "avatar_color": "#4080FF",
      "bio": "负责公司核心产品规划与迭代，具备丰富的 B 端产品经验。",
      "sort_order": 0,
      "is_active": true
    },
    {
      "id": 2,
      "name": "李娜",
      "department": "设计部",
      "role_title": "UI/UX 设计师",
      "email": "lina@example.com",
      "phone": "13800001002",
      "status": "active",
      "join_date": "2022-06-01",
      "avatar_color": "#FF7D00",
      "bio": "专注于企业级后台系统的交互设计，擅长设计规范建设。",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": 3,
      "name": "王磊",
      "department": "研发部",
      "role_title": "前端工程师",
      "email": "wanglei@example.com",
      "phone": "13800001003",
      "status": "active",
      "join_date": "2022-09-20",
      "avatar_color": "#00B96B",
      "bio": "熟悉 React 生态，负责组件中心前端模块开发。",
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": 4,
      "name": "刘芳",
      "department": "研发部",
      "role_title": "后端工程师",
      "email": "liufang@example.com",
      "phone": "13800001004",
      "status": "active",
      "join_date": "2021-11-08",
      "avatar_color": "#722ED1",
      "bio": "负责服务端 API 开发与数据库设计，精通 Flask 和 PostgreSQL。",
      "sort_order": 3,
      "is_active": true
    },
    {
      "id": 5,
      "name": "陈浩",
      "department": "测试部",
      "role_title": "测试工程师",
      "email": "chenhao@example.com",
      "phone": "13800001005",
      "status": "active",
      "join_date": "2023-02-14",
      "avatar_color": "#EB2F96",
      "bio": "负责功能测试与自动化测试脚本编写，覆盖率达 85% 以上。",
      "sort_order": 4,
      "is_active": true
    },
    {
      "id": 6,
      "name": "赵静",
      "department": "运营部",
      "role_title": "运营专员",
      "email": "zhaojing@example.com",
      "phone": "13800001006",
      "status": "probation",
      "join_date": "2026-02-01",
      "avatar_color": "#FA8C16",
      "bio": "试用期成员，负责内容运营与用户增长活动策划。",
      "sort_order": 5,
      "is_active": true
    },
    {
      "id": 7,
      "name": "孙鹏",
      "department": "研发部",
      "role_title": "全栈工程师",
      "email": "sunpeng@example.com",
      "phone": "13800001007",
      "status": "leave",
      "join_date": "2020-07-01",
      "avatar_color": "#8C8C8C",
      "bio": "当前处于休假状态，预计下月返岗，擅长全栈架构设计。",
      "sort_order": 6,
      "is_active": true
    },
    {
      "id": 8,
      "name": "吴婷",
      "department": "产品部",
      "role_title": "产品经理",
      "email": "wuting@example.com",
      "phone": "13800001008",
      "status": "active",
      "join_date": "2023-05-22",
      "avatar_color": "#13C2C2",
      "bio": "负责数据分析类产品线，熟悉数据可视化业务场景。",
      "sort_order": 7,
      "is_active": true
    }
  ]],
  ['cc_gantt_tasks', [
    {
      "id": 1,
      "title": "产品设计阶段",
      "task_type": "phase",
      "start_date": "2026-01-01",
      "end_date": "2026-01-31",
      "progress": 100,
      "assignee": "张伟",
      "priority": "high",
      "status": "completed",
      "color": "#4080FF",
      "sort_order": 0
    },
    {
      "id": 2,
      "title": "需求调研与竞品分析",
      "task_type": "task",
      "start_date": "2026-01-01",
      "end_date": "2026-01-10",
      "progress": 100,
      "assignee": "张伟",
      "priority": "high",
      "status": "completed",
      "color": "#4080FF",
      "sort_order": 1
    },
    {
      "id": 3,
      "title": "UI 原型设计与评审",
      "task_type": "task",
      "start_date": "2026-01-11",
      "end_date": "2026-01-31",
      "progress": 100,
      "assignee": "李娜",
      "priority": "medium",
      "status": "completed",
      "color": "#4080FF",
      "sort_order": 2
    },
    {
      "id": 4,
      "title": "开发阶段",
      "task_type": "phase",
      "start_date": "2026-02-01",
      "end_date": "2026-03-31",
      "progress": 80,
      "assignee": null,
      "priority": "critical",
      "status": "in_progress",
      "color": "#00B96B",
      "sort_order": 3
    },
    {
      "id": 5,
      "title": "后端 API 开发",
      "task_type": "task",
      "start_date": "2026-02-01",
      "end_date": "2026-03-10",
      "progress": 100,
      "assignee": "刘芳",
      "priority": "high",
      "status": "completed",
      "color": "#00B96B",
      "sort_order": 4
    },
    {
      "id": 6,
      "title": "前端页面开发",
      "task_type": "task",
      "start_date": "2026-02-10",
      "end_date": "2026-03-25",
      "progress": 75,
      "assignee": "王磊",
      "priority": "high",
      "status": "in_progress",
      "color": "#00B96B",
      "sort_order": 5
    },
    {
      "id": 7,
      "title": "前后端联调",
      "task_type": "milestone",
      "start_date": "2026-03-26",
      "end_date": "2026-03-31",
      "progress": 0,
      "assignee": "孙鹏",
      "priority": "critical",
      "status": "not_started",
      "color": "#FA8C16",
      "sort_order": 6
    },
    {
      "id": 8,
      "title": "测试阶段",
      "task_type": "phase",
      "start_date": "2026-04-01",
      "end_date": "2026-04-30",
      "progress": 0,
      "assignee": null,
      "priority": "high",
      "status": "not_started",
      "color": "#722ED1",
      "sort_order": 7
    },
    {
      "id": 9,
      "title": "功能测试与缺陷修复",
      "task_type": "task",
      "start_date": "2026-04-01",
      "end_date": "2026-04-20",
      "progress": 0,
      "assignee": "陈浩",
      "priority": "high",
      "status": "not_started",
      "color": "#722ED1",
      "sort_order": 8
    },
    {
      "id": 10,
      "title": "生产环境部署上线",
      "task_type": "milestone",
      "start_date": "2026-05-10",
      "end_date": "2026-05-15",
      "progress": 0,
      "assignee": "刘芳",
      "priority": "critical",
      "status": "not_started",
      "color": "#EB2F96",
      "sort_order": 9
    }
  ]],
  ['cc_advanced_table_rows', [
    {
      "id": 1,
      "row_code": "ADV-001",
      "name": "订单履约时效看板",
      "category": "order",
      "owner": "陈晨",
      "status": "published",
      "priority": 95,
      "progress": 88,
      "score": 96.5,
      "tags": "核心,履约,SLA",
      "is_active": true,
      "is_pinned": true,
      "due_date": "2026-03-28",
      "sort_order": 30,
      "remark": "支持行内编辑与置顶演示"
    },
    {
      "id": 2,
      "row_code": "ADV-002",
      "name": "会员成长计划",
      "category": "user",
      "owner": "李楠",
      "status": "draft",
      "priority": 76,
      "progress": 45,
      "score": 82.0,
      "tags": "会员,留存,A/B",
      "is_active": true,
      "is_pinned": false,
      "due_date": "2026-04-03",
      "sort_order": 20,
      "remark": "适合演示拖拽排序"
    },
    {
      "id": 3,
      "row_code": "ADV-003",
      "name": "风控规则复盘",
      "category": "risk",
      "owner": "王博",
      "status": "published",
      "priority": 82,
      "progress": 64,
      "score": 85.5,
      "tags": "风控,策略,复盘",
      "is_active": true,
      "is_pinned": false,
      "due_date": "2026-03-25",
      "sort_order": 10,
      "remark": "用于批量状态更新演示"
    },
    {
      "id": 4,
      "row_code": "ADV-004",
      "name": "财务对账自动化",
      "category": "finance",
      "owner": "高蕾",
      "status": "archived",
      "priority": 60,
      "progress": 100,
      "score": 91.0,
      "tags": "财务,自动化",
      "is_active": false,
      "is_pinned": false,
      "due_date": null,
      "sort_order": 40,
      "remark": "用于筛选与列设置演示"
    },
    {
      "id": 5,
      "row_code": "ADV-005",
      "name": "用户召回策略优化",
      "category": "user",
      "owner": "周青",
      "status": "published",
      "priority": 68,
      "progress": 33,
      "score": 78.8,
      "tags": "召回,消息触达",
      "is_active": true,
      "is_pinned": false,
      "due_date": "2026-04-10",
      "sort_order": 50,
      "remark": "用于行选择和批量操作演示"
    }
  ]],
  ['ai_prompt_templates', [
    {
      "id": 1,
      "name": "产品需求分析",
      "category": "product",
      "description": "将原始需求整理为用户故事、验收标准与优先级建议",
      "content": "你是一位资深产品经理。请分析以下需求，给出用户故事、验收标准和优先级建议。\n\n需求描述：{{requirement}}\n\n目标用户：{{target_users}}\n\n请按以下格式输出：\n1. 用户故事\n2. 验收标准\n3. 优先级（P0/P1/P2）\n4. 技术风险",
      "variables": [
        "requirement",
        "target_users"
      ],
      "tags": "产品,需求",
      "is_active": true
    },
    {
      "id": 2,
      "name": "代码 Review",
      "category": "dev",
      "description": "从性能、安全性、可读性和最佳实践角度审查代码",
      "content": "请对以下代码进行 Code Review，重点关注：性能、安全性、可读性和最佳实践。\n\n语言：{{language}}\n\n代码：\n```\n{{code}}\n```\n\n请给出具体的改进建议和示例。",
      "variables": [
        "language",
        "code"
      ],
      "tags": "开发,Review",
      "is_active": true
    },
    {
      "id": 3,
      "name": "市场文案生成",
      "category": "marketing",
      "description": "为产品生成标题、卖点与 CTA 文案",
      "content": "你是一位专业文案策划师。请为以下产品撰写吸引用户的市场文案。\n\n产品名称：{{product_name}}\n产品特点：{{features}}\n目标受众：{{audience}}\n文案风格：{{tone}}\n\n请生成：1) 主标题  2) 副标题  3) 核心卖点（3条）  4) CTA 按钮文字",
      "variables": [
        "product_name",
        "features",
        "audience",
        "tone"
      ],
      "tags": "营销,文案",
      "is_active": true
    },
    {
      "id": 4,
      "name": "数据分析报告",
      "category": "data",
      "description": "基于数据生成摘要、趋势与改进建议",
      "content": "请根据以下数据，生成一份专业的分析报告。\n\n数据时间范围：{{date_range}}\n数据来源：{{data_source}}\n关键指标：{{metrics}}\n\n请包含：摘要、趋势分析、异常点说明、改进建议。",
      "variables": [
        "date_range",
        "data_source",
        "metrics"
      ],
      "tags": "数据,报告",
      "is_active": true
    },
    {
      "id": 5,
      "name": "会议纪要整理",
      "category": "office",
      "description": "把会议记录整理成规范纪要并给出行动计划",
      "content": "请将以下会议记录整理成规范的会议纪要。\n\n会议主题：{{meeting_topic}}\n参会人员：{{participants}}\n会议时间：{{meeting_time}}\n\n原始记录：\n{{raw_notes}}\n\n输出格式：1) 会议背景  2) 讨论要点  3) 决议事项  4) 行动计划（负责人+截止日期）",
      "variables": [
        "meeting_topic",
        "participants",
        "meeting_time",
        "raw_notes"
      ],
      "tags": "办公,效率",
      "is_active": true
    }
  ]],
  ['dynamic_form_records', [
    {
      "id": 1,
      "title": "服务器配置清单",
      "record_code": "DF-001",
      "category": "config",
      "status": "published",
      "owner": "陈晨",
      "priority": 80,
      "is_active": true,
      "description": "生产环境应用服务器的关键配置"
    },
    {
      "id": 2,
      "title": "新员工入职信息",
      "record_code": "DF-002",
      "category": "profile",
      "status": "draft",
      "owner": "李楠",
      "priority": 60,
      "is_active": true,
      "description": "入职当天需要登记的基础信息"
    },
    {
      "id": 3,
      "title": "接口性能指标",
      "record_code": "DF-003",
      "category": "spec",
      "status": "published",
      "owner": "王博",
      "priority": 70,
      "is_active": true,
      "description": "核心接口的性能基线"
    }
  ]],
  ['dynamic_form_fields', [
    {
      "id": 1,
      "record_id": 1,
      "field_key": "cpu_cores",
      "field_value": "8",
      "field_type": "number",
      "sort_order": 1,
      "remark": "vCPU"
    },
    {
      "id": 2,
      "record_id": 1,
      "field_key": "memory_gb",
      "field_value": "32",
      "field_type": "number",
      "sort_order": 2,
      "remark": null
    },
    {
      "id": 3,
      "record_id": 1,
      "field_key": "region",
      "field_value": "华东 2",
      "field_type": "text",
      "sort_order": 3,
      "remark": null
    },
    {
      "id": 4,
      "record_id": 1,
      "field_key": "backup_enabled",
      "field_value": "true",
      "field_type": "boolean",
      "sort_order": 4,
      "remark": null
    },
    {
      "id": 5,
      "record_id": 1,
      "field_key": "expire_date",
      "field_value": "2026-12-31",
      "field_type": "date",
      "sort_order": 5,
      "remark": null
    },
    {
      "id": 6,
      "record_id": 2,
      "field_key": "name",
      "field_value": "赵敏",
      "field_type": "text",
      "sort_order": 1,
      "remark": null
    },
    {
      "id": 7,
      "record_id": 2,
      "field_key": "department",
      "field_value": "产品部",
      "field_type": "text",
      "sort_order": 2,
      "remark": null
    },
    {
      "id": 8,
      "record_id": 2,
      "field_key": "join_date",
      "field_value": "2026-04-01",
      "field_type": "date",
      "sort_order": 3,
      "remark": null
    },
    {
      "id": 9,
      "record_id": 2,
      "field_key": "probation",
      "field_value": "true",
      "field_type": "boolean",
      "sort_order": 4,
      "remark": null
    },
    {
      "id": 10,
      "record_id": 3,
      "field_key": "p95_ms",
      "field_value": "180",
      "field_type": "number",
      "sort_order": 1,
      "remark": "毫秒"
    },
    {
      "id": 11,
      "record_id": 3,
      "field_key": "qps",
      "field_value": "1200",
      "field_type": "number",
      "sort_order": 2,
      "remark": null
    },
    {
      "id": 12,
      "record_id": 3,
      "field_key": "error_rate",
      "field_value": "0.2",
      "field_type": "number",
      "sort_order": 3,
      "remark": "百分比"
    },
    {
      "id": 13,
      "record_id": 3,
      "field_key": "owner",
      "field_value": "王博",
      "field_type": "text",
      "sort_order": 4,
      "remark": null
    }
  ]],
  ['notifications', [
    {
      "id": 1,
      "title": "欢迎使用 castor-kit",
      "content": "系统已成功部署，所有功能已就绪，欢迎开始使用！",
      "noti_type": "success",
      "link": "/dashboard",
      "is_global": true,
      "user_id": null
    },
    {
      "id": 2,
      "title": "新用户注册提醒",
      "content": "系统管理员请注意：有新用户在等待审核，请及时前往用户管理页面处理。",
      "noti_type": "info",
      "link": "/system/users",
      "is_global": true,
      "user_id": null
    },
    {
      "id": 3,
      "title": "系统维护通知",
      "content": "计划于本周末 02:00-04:00 进行系统维护，期间服务可能短暂中断，请提前做好安排。",
      "noti_type": "warning",
      "link": null,
      "is_global": true,
      "user_id": null
    },
    {
      "id": 4,
      "title": "AI 功能已上线",
      "content": "全新 AI 对话与提示词工坊功能已正式上线，欢迎体验！",
      "noti_type": "info",
      "link": "/component-center/ai/chat",
      "is_global": true,
      "user_id": null
    },
    {
      "id": 5,
      "title": "test",
      "content": "11",
      "noti_type": "success",
      "link": null,
      "is_global": true,
      "user_id": null
    },
    {
      "id": 6,
      "title": "csrf ok",
      "content": "",
      "noti_type": "info",
      "link": null,
      "is_global": true,
      "user_id": null
    }
  ]],
  ['announcements', [
    {
      "id": 1,
      "title": "欢迎体验 castor-kit 演示环境",
      "content": "这是公开演示环境：系统管理为只读，组件示例里的数据可以随意增删改，所有数据每 24 小时自动恢复。",
      "announce_type": "system",
      "status": "published",
      "is_top": true,
      "sort_order": 0,
      "publish_at": "2026-03-21T09:00:00"
    },
    {
      "id": 2,
      "title": "新功能：标签栏与外观设置",
      "content": "支持六种主题色、三种导航布局和标签栏页面保活，在右上角的「外观设置」里切换。",
      "announce_type": "update",
      "status": "published",
      "is_top": false,
      "sort_order": 1,
      "publish_at": "2026-03-20T10:00:00"
    },
    {
      "id": 3,
      "title": "季度运营活动排期",
      "content": "下季度的运营活动排期正在整理中，确认后发布。",
      "announce_type": "activity",
      "status": "draft",
      "is_top": false,
      "sort_order": 2,
      "publish_at": null
    }
  ]],
  ['dict_types', [
    {
      "id": 1,
      "name": "订单状态",
      "code": "order_status",
      "description": "订单流转的各个状态",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": 2,
      "name": "任务优先级",
      "code": "task_priority",
      "description": "看板与甘特图使用的优先级",
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": 3,
      "name": "支付方式",
      "code": "pay_method",
      "description": "订单支持的支付渠道",
      "sort_order": 3,
      "is_active": true
    }
  ]],
  ['dict_items', [
    {
      "id": 1,
      "dict_type_id": 1,
      "label": "待付款",
      "value": "pending",
      "color": "#d97706",
      "sort_order": 1,
      "is_default": true,
      "is_active": true,
      "description": null
    },
    {
      "id": 2,
      "dict_type_id": 1,
      "label": "已付款",
      "value": "paid",
      "color": "#2563eb",
      "sort_order": 2,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 3,
      "dict_type_id": 1,
      "label": "已发货",
      "value": "shipped",
      "color": "#0284c7",
      "sort_order": 3,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 4,
      "dict_type_id": 1,
      "label": "已完成",
      "value": "done",
      "color": "#16a34a",
      "sort_order": 4,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 5,
      "dict_type_id": 1,
      "label": "已取消",
      "value": "cancelled",
      "color": "#737373",
      "sort_order": 5,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 6,
      "dict_type_id": 2,
      "label": "高",
      "value": "high",
      "color": "#dc2626",
      "sort_order": 1,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 7,
      "dict_type_id": 2,
      "label": "中",
      "value": "medium",
      "color": "#d97706",
      "sort_order": 2,
      "is_default": true,
      "is_active": true,
      "description": null
    },
    {
      "id": 8,
      "dict_type_id": 2,
      "label": "低",
      "value": "low",
      "color": "#16a34a",
      "sort_order": 3,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 9,
      "dict_type_id": 3,
      "label": "微信支付",
      "value": "wechat",
      "color": "#16a34a",
      "sort_order": 1,
      "is_default": true,
      "is_active": true,
      "description": null
    },
    {
      "id": 10,
      "dict_type_id": 3,
      "label": "支付宝",
      "value": "alipay",
      "color": "#2563eb",
      "sort_order": 2,
      "is_default": false,
      "is_active": true,
      "description": null
    },
    {
      "id": 11,
      "dict_type_id": 3,
      "label": "银行卡",
      "value": "card",
      "color": "#737373",
      "sort_order": 3,
      "is_default": false,
      "is_active": true,
      "description": null
    }
  ]],
  ['scheduled_tasks', [
    {
      "id": 1,
      "name": "每日数据备份",
      "task_code": "daily_backup",
      "cron_expression": "0 3 * * *",
      "request_method": "POST",
      "request_url": "https://example.com/api/backup",
      "request_headers": null,
      "request_body": null,
      "timeout_seconds": 30,
      "is_active": false,
      "remark": "演示用，已停用",
      "last_status": "idle",
      "run_count": 0
    },
    {
      "id": 2,
      "name": "每小时同步订单",
      "task_code": "sync_orders",
      "cron_expression": "0 * * * *",
      "request_method": "GET",
      "request_url": "https://example.com/api/orders/sync",
      "request_headers": null,
      "request_body": null,
      "timeout_seconds": 10,
      "is_active": false,
      "remark": "演示用，已停用",
      "last_status": "idle",
      "run_count": 0
    }
  ]],
]
