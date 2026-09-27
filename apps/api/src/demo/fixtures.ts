/**
 * Sample data for the public demo (DEMO_MODE), restored by resetDemoData().
 * Rows carry explicit ids so parent / child references stay intact; created_at / updated_at are set at reset time,
 * and date columns are shifted so the data always looks current (see DATE_BASE in reset.ts).
 * Tables are listed parents first; this order is also the insert order.
 */

export type FixtureRow = Record<string, string | number | boolean | null | unknown[] | Record<string, unknown>>

export const DEMO_FIXTURES: [table: string, rows: FixtureRow[]][] = [
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
  // Shared demo data of the page patterns (Component gallery → Page patterns): a project tree three levels deep, parents first
  // (sort_order = sibling order in the tree; board_order = card order within each status column of the kanban, from 0)
  ['demo_records', [
    {
      "id": 1,
      "name": "官网改版",
      "code": "PRJ-WEB",
      "category": "design",
      "status": "in_progress",
      "owner": "周青",
      "priority": 4,
      "is_active": true,
      "amount": "120000.00",
      "quantity": 40,
      "progress": 55,
      "start_date": "2026-03-02",
      "end_date": "2026-04-17",
      "parent_id": null,
      "sort_order": 1,
      "board_order": 0,
      "cover": null,
      "description": "新版官网：视觉升级、产品页重写、内容迁移",
      "tags": [
        "官网",
        "品牌"
      ],
      "extra": {
        "客户": "市场部",
        "预算来源": "年度品牌预算",
        "风险等级": "中"
      }
    },
    {
      "id": 2,
      "name": "移动端 App 3.0",
      "code": "PRJ-APP",
      "category": "product",
      "status": "in_progress",
      "owner": "王磊",
      "priority": 5,
      "is_active": true,
      "amount": "260000.00",
      "quantity": 120,
      "progress": 35,
      "start_date": "2026-03-09",
      "end_date": "2026-05-01",
      "parent_id": null,
      "sort_order": 2,
      "board_order": 2,
      "cover": null,
      "description": "3.0 大版本：支付重构与灰度发布",
      "tags": [
        "App",
        "支付"
      ],
      "extra": {
        "客户": "零售事业部",
        "预算来源": "产品研发预算",
        "风险等级": "高"
      }
    },
    {
      "id": 3,
      "name": "春季营销活动",
      "code": "PRJ-MKT",
      "category": "marketing",
      "status": "in_progress",
      "owner": "赵敏",
      "priority": 3,
      "is_active": true,
      "amount": "80000.00",
      "quantity": 25,
      "progress": 40,
      "start_date": "2026-03-10",
      "end_date": "2026-04-10",
      "parent_id": null,
      "sort_order": 3,
      "board_order": 7,
      "cover": null,
      "description": "春季上新活动：策划、素材、渠道投放",
      "tags": [
        "活动",
        "投放"
      ],
      "extra": {
        "客户": "市场部",
        "预算来源": "季度营销预算"
      }
    },
    {
      "id": 4,
      "name": "数据平台迁移",
      "code": "PRJ-DATA",
      "category": "engineering",
      "status": "todo",
      "owner": "孙浩",
      "priority": 4,
      "is_active": true,
      "amount": "150000.00",
      "quantity": 60,
      "progress": 0,
      "start_date": "2026-04-06",
      "end_date": "2026-05-15",
      "parent_id": null,
      "sort_order": 4,
      "board_order": 6,
      "cover": null,
      "description": "旧数仓迁移到新平台，保证历史数据一致",
      "tags": [
        "数据",
        "迁移"
      ],
      "extra": {
        "风险等级": "高"
      }
    },
    {
      "id": 5,
      "name": "客服知识库整理",
      "code": "PRJ-KB",
      "category": "operations",
      "status": "done",
      "owner": "高蕾",
      "priority": 2,
      "is_active": true,
      "amount": "12000.00",
      "quantity": 16,
      "progress": 100,
      "start_date": "2026-02-23",
      "end_date": "2026-03-13",
      "parent_id": null,
      "sort_order": 5,
      "board_order": 5,
      "cover": null,
      "description": "整理常见问题并归档旧文档",
      "tags": [
        "客服",
        "文档"
      ],
      "extra": {}
    },
    {
      "id": 6,
      "name": "视觉设计稿",
      "code": "PRJ-WEB-01",
      "category": "design",
      "status": "done",
      "owner": "林可",
      "priority": 4,
      "is_active": true,
      "amount": "30000.00",
      "quantity": 10,
      "progress": 100,
      "start_date": "2026-03-02",
      "end_date": "2026-03-13",
      "parent_id": 1,
      "sort_order": 1,
      "board_order": 0,
      "cover": null,
      "description": "首页、产品页、关于我们三套设计稿",
      "tags": [
        "设计"
      ],
      "extra": {}
    },
    {
      "id": 7,
      "name": "前端页面开发",
      "code": "PRJ-WEB-02",
      "category": "engineering",
      "status": "in_progress",
      "owner": "陈越",
      "priority": 4,
      "is_active": true,
      "amount": "60000.00",
      "quantity": 20,
      "progress": 60,
      "start_date": "2026-03-16",
      "end_date": "2026-04-03",
      "parent_id": 1,
      "sort_order": 2,
      "board_order": 3,
      "cover": null,
      "description": "按设计稿实现响应式页面",
      "tags": [
        "前端"
      ],
      "extra": {}
    },
    {
      "id": 8,
      "name": "内容迁移与上线",
      "code": "PRJ-WEB-03",
      "category": "operations",
      "status": "todo",
      "owner": "高蕾",
      "priority": 3,
      "is_active": true,
      "amount": "8000.00",
      "quantity": 6,
      "progress": 0,
      "start_date": "2026-04-06",
      "end_date": "2026-04-17",
      "parent_id": 1,
      "sort_order": 3,
      "board_order": 3,
      "cover": null,
      "description": "旧站内容迁移、SEO 跳转、正式上线",
      "tags": [
        "上线"
      ],
      "extra": {}
    },
    {
      "id": 9,
      "name": "需求评审",
      "code": "PRJ-APP-01",
      "category": "product",
      "status": "done",
      "owner": "王磊",
      "priority": 3,
      "is_active": true,
      "amount": "5000.00",
      "quantity": 4,
      "progress": 100,
      "start_date": "2026-03-09",
      "end_date": "2026-03-13",
      "parent_id": 2,
      "sort_order": 1,
      "board_order": 1,
      "cover": null,
      "description": "3.0 需求范围与优先级确认",
      "tags": [
        "需求"
      ],
      "extra": {}
    },
    {
      "id": 10,
      "name": "支付模块重构",
      "code": "PRJ-APP-02",
      "category": "engineering",
      "status": "in_progress",
      "owner": "何川",
      "priority": 5,
      "is_active": true,
      "amount": "90000.00",
      "quantity": 36,
      "progress": 40,
      "start_date": "2026-03-16",
      "end_date": "2026-04-10",
      "parent_id": 2,
      "sort_order": 2,
      "board_order": 4,
      "cover": null,
      "description": "支付流程拆分为独立服务",
      "tags": [
        "支付",
        "后端"
      ],
      "extra": {
        "风险等级": "高"
      }
    },
    {
      "id": 11,
      "name": "灰度发布",
      "code": "PRJ-APP-03",
      "category": "operations",
      "status": "todo",
      "owner": "孙浩",
      "priority": 4,
      "is_active": true,
      "amount": "10000.00",
      "quantity": 8,
      "progress": 0,
      "start_date": "2026-04-20",
      "end_date": "2026-05-01",
      "parent_id": 2,
      "sort_order": 3,
      "board_order": 4,
      "cover": null,
      "description": "按 5% / 20% / 100% 分三批放量",
      "tags": [
        "发布"
      ],
      "extra": {}
    },
    {
      "id": 12,
      "name": "活动策划案",
      "code": "PRJ-MKT-01",
      "category": "marketing",
      "status": "done",
      "owner": "赵敏",
      "priority": 3,
      "is_active": true,
      "amount": "6000.00",
      "quantity": 3,
      "progress": 100,
      "start_date": "2026-03-10",
      "end_date": "2026-03-16",
      "parent_id": 3,
      "sort_order": 1,
      "board_order": 2,
      "cover": null,
      "description": "活动主题、节奏与预算分配",
      "tags": [
        "策划"
      ],
      "extra": {}
    },
    {
      "id": 13,
      "name": "投放素材制作",
      "code": "PRJ-MKT-02",
      "category": "design",
      "status": "in_progress",
      "owner": "林可",
      "priority": 3,
      "is_active": true,
      "amount": "18000.00",
      "quantity": 12,
      "progress": 50,
      "start_date": "2026-03-17",
      "end_date": "2026-03-31",
      "parent_id": 3,
      "sort_order": 2,
      "board_order": 5,
      "cover": null,
      "description": "海报、短视频与落地页素材",
      "tags": [
        "素材",
        "设计"
      ],
      "extra": {}
    },
    {
      "id": 14,
      "name": "渠道投放",
      "code": "PRJ-MKT-03",
      "category": "marketing",
      "status": "todo",
      "owner": "赵敏",
      "priority": 2,
      "is_active": true,
      "amount": "50000.00",
      "quantity": 10,
      "progress": 0,
      "start_date": "2026-04-01",
      "end_date": "2026-04-10",
      "parent_id": 3,
      "sort_order": 3,
      "board_order": 5,
      "cover": null,
      "description": "按渠道分配预算并跟踪转化",
      "tags": [
        "投放"
      ],
      "extra": {
        "渠道": "社交媒体、搜索广告"
      }
    },
    {
      "id": 15,
      "name": "迁移方案评审",
      "code": "PRJ-DATA-01",
      "category": "engineering",
      "status": "todo",
      "owner": "孙浩",
      "priority": 4,
      "is_active": true,
      "amount": "4000.00",
      "quantity": 5,
      "progress": 0,
      "start_date": "2026-04-06",
      "end_date": "2026-04-10",
      "parent_id": 4,
      "sort_order": 1,
      "board_order": 0,
      "cover": null,
      "description": "迁移步骤、回滚方案与停机窗口",
      "tags": [
        "方案"
      ],
      "extra": {}
    },
    {
      "id": 16,
      "name": "首页与导航",
      "code": "PRJ-WEB-02-A",
      "category": "engineering",
      "status": "done",
      "owner": "陈越",
      "priority": 3,
      "is_active": true,
      "amount": "20000.00",
      "quantity": 8,
      "progress": 100,
      "start_date": "2026-03-16",
      "end_date": "2026-03-24",
      "parent_id": 7,
      "sort_order": 1,
      "board_order": 3,
      "cover": null,
      "description": "首页、全局导航与页脚",
      "tags": [
        "前端"
      ],
      "extra": {}
    },
    {
      "id": 17,
      "name": "产品详情页",
      "code": "PRJ-WEB-02-B",
      "category": "engineering",
      "status": "in_progress",
      "owner": "何川",
      "priority": 3,
      "is_active": true,
      "amount": "25000.00",
      "quantity": 8,
      "progress": 45,
      "start_date": "2026-03-23",
      "end_date": "2026-04-01",
      "parent_id": 7,
      "sort_order": 2,
      "board_order": 6,
      "cover": null,
      "description": "产品详情、规格对比与询价表单",
      "tags": [
        "前端"
      ],
      "extra": {}
    },
    {
      "id": 18,
      "name": "接入新支付网关",
      "code": "PRJ-APP-02-A",
      "category": "engineering",
      "status": "in_progress",
      "owner": "何川",
      "priority": 5,
      "is_active": true,
      "amount": "50000.00",
      "quantity": 20,
      "progress": 55,
      "start_date": "2026-03-16",
      "end_date": "2026-03-31",
      "parent_id": 10,
      "sort_order": 1,
      "board_order": 1,
      "cover": null,
      "description": "对接新网关的下单、回调与对账",
      "tags": [
        "支付"
      ],
      "extra": {}
    },
    {
      "id": 19,
      "name": "退款流程",
      "code": "PRJ-APP-02-B",
      "category": "engineering",
      "status": "todo",
      "owner": "陈越",
      "priority": 4,
      "is_active": true,
      "amount": "25000.00",
      "quantity": 10,
      "progress": 0,
      "start_date": "2026-03-30",
      "end_date": "2026-04-10",
      "parent_id": 10,
      "sort_order": 2,
      "board_order": 1,
      "cover": null,
      "description": "部分退款、原路退回与失败重试",
      "tags": [
        "支付"
      ],
      "extra": {}
    },
    {
      "id": 20,
      "name": "历史数据校验",
      "code": "PRJ-DATA-02",
      "category": "engineering",
      "status": "todo",
      "owner": "孙浩",
      "priority": 3,
      "is_active": true,
      "amount": "20000.00",
      "quantity": 15,
      "progress": 0,
      "start_date": "2026-04-13",
      "end_date": "2026-05-08",
      "parent_id": 4,
      "sort_order": 2,
      "board_order": 2,
      "cover": null,
      "description": "逐表比对行数与关键指标",
      "tags": [
        "数据"
      ],
      "extra": {}
    },
    {
      "id": 21,
      "name": "常见问题梳理",
      "code": "PRJ-KB-01",
      "category": "operations",
      "status": "done",
      "owner": "高蕾",
      "priority": 2,
      "is_active": true,
      "amount": "6000.00",
      "quantity": 10,
      "progress": 100,
      "start_date": "2026-02-23",
      "end_date": "2026-03-06",
      "parent_id": 5,
      "sort_order": 1,
      "board_order": 4,
      "cover": null,
      "description": "按业务线整理 120 条常见问题",
      "tags": [
        "客服"
      ],
      "extra": {}
    },
    {
      "id": 22,
      "name": "旧版文档归档",
      "code": "PRJ-KB-02",
      "category": "operations",
      "status": "archived",
      "owner": "高蕾",
      "priority": 1,
      "is_active": false,
      "amount": "2000.00",
      "quantity": 2,
      "progress": 100,
      "start_date": "2026-03-02",
      "end_date": "2026-03-13",
      "parent_id": 5,
      "sort_order": 2,
      "board_order": 0,
      "cover": null,
      "description": "旧版帮助文档只读归档",
      "tags": [
        "文档"
      ],
      "extra": {}
    },
    {
      "id": 23,
      "name": "2025 年度复盘",
      "code": "PRJ-2025",
      "category": "product",
      "status": "archived",
      "owner": "王磊",
      "priority": 1,
      "is_active": false,
      "amount": null,
      "quantity": null,
      "progress": 100,
      "start_date": "2026-02-16",
      "end_date": "2026-02-27",
      "parent_id": null,
      "sort_order": 6,
      "board_order": 1,
      "cover": null,
      "description": "年度项目复盘与经验沉淀",
      "tags": [
        "复盘"
      ],
      "extra": {}
    },
    {
      "id": 24,
      "name": "新人培训手册",
      "code": "PRJ-IDEA",
      "category": null,
      "status": "todo",
      "owner": null,
      "priority": 0,
      "is_active": true,
      "amount": null,
      "quantity": null,
      "progress": 0,
      "start_date": null,
      "end_date": null,
      "parent_id": null,
      "sort_order": 7,
      "board_order": 7,
      "cover": null,
      "description": "待认领：新员工入职培训资料",
      "tags": [],
      "extra": {}
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
