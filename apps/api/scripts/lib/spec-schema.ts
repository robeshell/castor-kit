/**
 * JSON Schema of a `pnpm scaffold -- --spec` file, built from the scaffold's own tables (field types, name rules,
 * reserved names, text limits) so it can't drift from the code. Written to docs/spec.schema.json by
 * `pnpm scaffold -- --write-schema`; test/scaffold.test.ts checks the file is up to date.
 *
 * The schema is structural: editors and agents catch typos and missing keys early. The authoritative check stays
 * validateSpec (`pnpm scaffold -- --spec <file> --validate-only`), which also knows cross-field rules.
 */

import { FIELD_TYPE_MAP, NAME_RE, RESERVED_FIELDS, SPEC_KEYS, UNIQUE_TYPES, UNSAFE_TEXT } from '../scaffold'

/** What each field type is for (shown by editors; AGENTS.md "字段类型推断规则" has the full table) */
export const FIELD_TYPE_NOTES: Record<string, string> = {
  str: '一般文本，最长 100（名称、标题、地址……）',
  str50: '短文本，最长 50',
  str20: '编码 / 电话 / 编号类短文本，最长 20',
  str500: '长一些的单行文本，最长 500（链接、备注摘要）',
  text: '不限长度的多行文本（描述、正文）',
  int: '整数（数量、序号、年龄）',
  float: '数值，最多 2 位小数（金额、价格、比例）；接口里以字符串返回',
  bool: '是 / 否',
  date: '日期 YYYY-MM-DD',
  datetime: '日期时间',
  file: '附件（文件中心的文件 ID）',
  image: '图片（文件中心的文件 ID）',
  enum: '少量、固定不变的选项（状态、类型）：必须写 options',
  dict: '可由管理员维护的选项（分类、来源、行业）：必须写 dict（数据字典编码）',
}

export function specJsonSchema(): Record<string, unknown> {
  // Read inside the function: scaffold.ts imports this module, so its constants aren't initialized at load time
  const types = Object.keys(FIELD_TYPE_MAP)
  /** "not these characters" as a whole-string pattern (titles and labels land in JSX and string literals) */
  const safeText = `^[^${UNSAFE_TEXT.source.slice(1, -1)}]+$`
  const text = (max: number, description: string) => ({ type: 'string', minLength: 1, maxLength: max, pattern: safeText, description })
  const onlyFor = (typeList: string[], key: string) => ({
    if: { properties: { type: { not: { enum: typeList } } }, required: ['type'] },
    then: { properties: { [key]: { const: false } } },
  })
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'castor-kit 模块规格（pnpm scaffold -- --spec <file>）',
    description:
      '从一句业务需求推断出的模块规格。这里只做结构检查；唯一只用于文本和数字、默认值要符合字段类型等规则以 ' +
      '`pnpm scaffold -- --spec <file> --validate-only` 为准。怎么推断见 AGENTS.md「从一句需求到 spec」，示例见 docs/examples/specs/。',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'title', 'fields'],
    properties: {
      $schema: { type: 'string', description: '编辑器提示用，指向本文件' },
      name: {
        type: 'string',
        pattern: NAME_RE.source,
        maxLength: 40,
        description: '模块名，snake_case 单数英文（如 device、customer_order）；表名 = name + s，接口 = /api/admin/<kebab>s',
      },
      domain: { enum: ['admin', 'component_center'], default: 'admin', description: '业务模块用 admin（默认）' },
      title: text(50, '模块中文名：页面标题、菜单名、接口文档都用它，如「设备台账」'),
      dataScope: { type: 'boolean', default: false, description: '数据按部门 / 创建人隔离（数据权限）时为 true' },
      fields: { type: 'array', minItems: 1, maxItems: 50, items: { $ref: '#/$defs/field' }, description: '业务字段（id、created_at、updated_at 自动生成，不要写）' },
      menu: {
        type: 'object',
        additionalProperties: false,
        properties: {
          parentId: { type: 'integer', description: '父菜单 ID；缺省放在「业务管理」目录（ID 1000）' },
          icon: { type: 'string', description: 'apps/web/src/lib/menu-icons.js 里的图标名' },
        },
        description: '写了才会把菜单和按钮权限加进 scripts/seed-rbac.ts；新业务模块一般写 {}',
      },
      i18n: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          SPEC_KEYS.i18n.map((lang) => [lang, { type: 'object', additionalProperties: { type: 'string' }, description: `中文 → ${lang} 译文（标题、字段名、选项名）` }]),
        ),
      },
    },
    $defs: {
      field: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type', 'label'],
        properties: {
          name: { type: 'string', pattern: NAME_RE.source, maxLength: 40, not: { enum: [...RESERVED_FIELDS] }, description: '字段名，snake_case 英文' },
          type: {
            enum: types,
            description: types.map((t) => `${t}：${FIELD_TYPE_NOTES[t] ?? ''}`).join('；'),
          },
          label: text(50, '字段中文名：表头、表单、导入模板和接口文档都用它'),
          required: { type: 'boolean', description: '必填（NOT NULL，新增和编辑时校验）；文件 / 图片字段不能必填' },
          unique: { type: 'boolean', description: `唯一（只用于 ${[...UNIQUE_TYPES].join(' / ')}）` },
          default: { type: ['string', 'number', 'boolean', 'null'], description: '新增时的默认值，要符合字段类型（enum 写选项值）' },
          options: { type: 'array', minItems: 1, items: { $ref: '#/$defs/option' }, description: 'enum 字段的选项' },
          dict: { type: 'string', pattern: '^[A-Za-z0-9_.-]{1,100}$', description: 'dict 字段的数据字典编码（如 device_category）' },
        },
        allOf: [
          { if: { properties: { type: { const: 'enum' } }, required: ['type'] }, then: { required: ['options'] } },
          { if: { properties: { type: { const: 'dict' } }, required: ['type'] }, then: { required: ['dict'] } },
          onlyFor([...UNIQUE_TYPES], 'unique'),
          {
            if: { properties: { type: { enum: ['file', 'image'] } }, required: ['type'] },
            then: { properties: { required: { const: false }, default: { enum: [null, ''] } } },
          },
        ],
      },
      option: {
        type: 'object',
        additionalProperties: false,
        required: ['value', 'label'],
        properties: {
          value: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,50}$', description: '存进数据库的值（英文，如 in_use）' },
          label: text(50, '显示的中文名，如「使用中」'),
        },
      },
    },
  }
}

/** docs/spec.schema.json content */
export function specSchemaText(): string {
  return `${JSON.stringify(specJsonSchema(), null, 2)}\n`
}
