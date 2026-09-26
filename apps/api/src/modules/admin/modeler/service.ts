/**
 * Visual modeler (development only, super admins): turns a module spec into code by running
 * scripts/modeler-run.ts as a detached process, and lists / undoes what it generated.
 *
 * The generator (scripts/scaffold.ts) is loaded at runtime from its file, so the production bundle never contains it;
 * the routes aren't registered outside development anyway (see routes.ts).
 */

import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Agent } from 'undici'
import { AI_CALL_DEFAULTS, aiConfigured, createAiAgent, languageModelFor, upstreamStatusOf } from '@/common/ai'
import { ServiceError } from '@/common/errors'
import type { Settings } from '@/common/settings'
import { utcNowIso } from '@/common/serialize'
import type { Db } from '@/db/client'
import type { SpecFile } from '../../../../scripts/scaffold'
import {
  activeJobId,
  API_DIR,
  ensureModelerDir,
  jobDir,
  listJobs,
  logPath,
  newJobId,
  readLog,
  readModules,
  readState,
  REPO_ROOT,
  specPath,
  writeLock,
  writeState,
  type JobState,
} from './files'
import { ModelerRepository } from './repository'

type ScaffoldModule = typeof import('../../../../scripts/scaffold')

const GENERATE_STEPS = [
  { key: 'scaffold', label: '生成代码' },
  { key: 'migrate', label: '迁移数据库' },
  { key: 'seed', label: '同步菜单权限' },
  { key: 'openapi', label: '更新接口文档' },
  { key: 'verify', label: '门禁检查' },
]
const UNDO_STEPS = [
  { key: 'database', label: '删除表、菜单与代码' },
  { key: 'finish', label: '完成' },
]

/** Field types the modeler offers, in the order shown */
export const FIELD_TYPES = ['str', 'str20', 'str50', 'str500', 'text', 'int', 'float', 'bool', 'date', 'datetime', 'enum', 'dict', 'image', 'file']

const AI_TIMEOUT_MS = 60_000

const aiSpecSchema = z.object({
  name: z.string().describe('模块名：英文 snake_case，单数，如 device、purchase_order'),
  title: z.string().describe('页面标题（中文），如「设备台账」'),
  fields: z
    .array(
      z.object({
        name: z.string().describe('字段名：英文 snake_case'),
        type: z.enum(FIELD_TYPES as [string, ...string[]]),
        label: z.string().describe('中文标签'),
        required: z.boolean(),
        unique: z.boolean(),
        default: z.string().nullable().describe('默认值（字符串形式），没有则为 null'),
        options: z
          .array(z.object({ value: z.string().describe('英文值，如 in_use'), label: z.string().describe('中文名称') }))
          .nullable()
          .describe('type 为 enum 时的固定选项，否则为 null'),
        dict: z.string().nullable().describe('type 为 dict 时的字典编码（只能用给出的字典），否则为 null'),
      }),
    )
    .min(1)
    .max(30),
  translations: z
    .array(z.object({ zh: z.string(), en: z.string(), ja: z.string() }))
    .describe('标题、每个字段标签、每个选项名称的英文与日文翻译'),
})
type AiSpec = z.infer<typeof aiSpecSchema>

const translationsSchema = z.object({ items: z.array(z.object({ zh: z.string(), en: z.string(), ja: z.string() })) })

function aiPrompt(description: string, dicts: Array<{ code: string; name: string }>): string {
  return [
    '你在为 castor-kit 管理后台设计一个数据管理模块（列表 + 新增 / 编辑表单 + 导入导出）。根据需求给出模块名、标题和字段清单。',
    '',
    '字段类型（type）：',
    '- str：名称、标题、姓名、邮箱（100 字符）；str50：编码、编号、代码；str20：手机、电话、颜色、短代码；str500：外部链接 URL',
    '- text：描述、备注、说明、正文、详情',
    '- int：数量、次数、排序、进度百分比；float：金额、价格、费用、成本（两位小数）',
    '- bool：是否、启用、开关；date：日期（无时间）；datetime：带时间的时间点',
    '- enum：状态、类型、级别等几个固定取值，写出 options（value 英文 snake_case，label 中文）',
    '- dict：取值来自下面已有的数据字典时使用，dict 填字典编码',
    '- image：图片、照片、头像、封面；file：附件、合同、扫描件',
    '',
    '规则：不要包含 id、创建时间、更新时间（自动添加）；编号 / 编码类通常必填且唯一；名称类通常必填；',
    '状态类给一个合理的默认值（选项的 value）；image / file 不能必填；唯一只用于文本和数字字段；字段 3–12 个为宜。',
    `可用的数据字典：${dicts.length ? dicts.map((d) => `${d.code}（${d.name}）`).join('、') : '无'}`,
    '',
    // OpenAI-compatible APIs only get JSON mode, not the schema: the shape has to be in the prompt
    '只输出一个 JSON 对象，不要其他文字，格式：',
    '{"name":"device","title":"设备台账","fields":[{"name":"code","type":"str50","label":"设备编号","required":true,"unique":true,"default":null,"options":null,"dict":null},{"name":"status","type":"enum","label":"状态","required":true,"unique":false,"default":"idle","options":[{"value":"idle","label":"闲置"},{"value":"in_use","label":"使用中"}],"dict":null}],"translations":[{"zh":"设备台账","en":"Devices","ja":"設備台帳"},{"zh":"设备编号","en":"Device no.","ja":"設備番号"}]}',
    'translations 要包含标题、每个字段标签、每个选项名称。',
    '',
    `需求：${description}`,
  ].join('\n')
}

function toSpec(ai: AiSpec): SpecFile & { i18n: NonNullable<SpecFile['i18n']> } {
  const en: Record<string, string> = {}
  const ja: Record<string, string> = {}
  for (const t of ai.translations) {
    if (t.zh && t.en) en[t.zh] = t.en
    if (t.zh && t.ja) ja[t.zh] = t.ja
  }
  return {
    name: ai.name,
    title: ai.title,
    fields: ai.fields.map((f) => ({
      name: f.name,
      type: f.type,
      label: f.label,
      required: f.required,
      unique: f.unique,
      ...(f.default !== null && f.default !== '' ? { default: f.default } : {}),
      ...(f.type === 'enum' ? { options: f.options ?? [] } : {}),
      ...(f.type === 'dict' && f.dict ? { dict: f.dict } : {}),
    })),
    i18n: { 'en-US': en, 'ja-JP': ja },
  }
}

export class ModelerService {
  private agent: Agent | null = null
  private readonly repo: ModelerRepository

  constructor(
    db: Db,
    private readonly ai: () => Promise<Settings['ai']>,
    private readonly allowPrivate: () => boolean,
  ) {
    this.repo = new ModelerRepository(db)
  }

  async close(): Promise<void> {
    await this.agent?.destroy()
  }

  private scaffold(): Promise<ScaffoldModule> {
    return import(pathToFileURL(join(API_DIR, 'scripts', 'scaffold.ts')).href) as Promise<ScaffoldModule>
  }

  /** What the page needs to build a spec: field types, parent menus, dictionaries, whether AI is configured */
  async meta() {
    const parents = await this.repo.listDirectories()
    const dicts = await this.repo.listDictionaries()
    return {
      types: FIELD_TYPES,
      parents,
      dicts,
      ai_configured: aiConfigured(await this.ai()),
      running: activeJobId(),
    }
  }

  /** Problems with a spec: the generator's own checks plus "the module already exists" */
  async validate(spec: SpecFile): Promise<string[]> {
    const { validateSpec, buildSpec } = await this.scaffold()
    const errors = validateSpec(spec)
    if (errors.length > 0) return errors
    const s = buildSpec(spec.name, spec.domain ?? 'admin', [], {})
    const taken = [
      join(API_DIR, 'src', 'modules', s.domainDir, s.kebab),
      join(API_DIR, 'src', 'db', 'schema', s.domainDir, `${s.kebab}.ts`),
      join(REPO_ROOT, 'apps', 'web', 'src', 'modules', s.webModule, 'pages', spec.name),
    ].some((p) => existsSync(p))
    if (taken) return [`模块 ${spec.name} 已存在，请换一个模块名`]
    const seed = readFileSync(join(API_DIR, 'scripts', 'seed-rbac.ts'), 'utf8')
    if (seed.includes(`code: "${s.permPrefix}"`)) return [`权限码 ${s.permPrefix} 已存在，请换一个模块名`]
    return []
  }

  private start(kind: JobState['kind'], payload: unknown, module: string, title: string): JobState {
    ensureModelerDir()
    const running = activeJobId()
    if (running) throw new ServiceError('已有建模任务在运行，请等它结束', 409)
    const id = newJobId()
    mkdirSync(jobDir(id), { recursive: true })
    writeFileSync(specPath(id), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    const state: JobState = {
      id,
      kind,
      module,
      title,
      status: 'running',
      steps: (kind === 'generate' ? GENERATE_STEPS : UNDO_STEPS).map((s) => ({ ...s, status: 'pending' as const })),
      error: null,
      rolledBack: false,
      created_at: utcNowIso(),
      finished_at: null,
    }
    writeState(state)
    const out = openSync(logPath(id), 'a')
    try {
      const child = spawn(join(API_DIR, 'node_modules', '.bin', 'tsx'), ['scripts/modeler-run.ts', id], {
        cwd: API_DIR,
        detached: true,
        stdio: ['ignore', out, out],
        env: { ...process.env, FORCE_COLOR: '0' },
      })
      // Held until the runner writes its own lock (it could otherwise start a second job in between)
      if (child.pid) writeLock(id, child.pid)
      child.unref()
    } finally {
      closeSync(out)
    }
    return state
  }

  async generate(spec: SpecFile): Promise<JobState> {
    const errors = await this.validate(spec)
    if (errors.length > 0) throw new ServiceError(errors[0]!, 400, { errors })
    // Menus always go in (under the business group unless the page chose another parent)
    return this.start('generate', { ...spec, menu: spec.menu ?? {} }, spec.name, spec.title?.trim() || spec.name)
  }

  undo(name: string): JobState {
    const m = readModules().find((x) => x.name === name)
    if (!m) throw new ServiceError('没有找到这个模块，只能撤销建模器生成的模块', 404)
    return this.start('undo', { name }, name, m.title)
  }

  job(id: string, offset: number) {
    if (!/^[\w-]+$/.test(id)) throw new ServiceError('任务不存在', 404)
    const state = readState(id)
    if (!state) throw new ServiceError('任务不存在', 404)
    return { job: state, log: readLog(id, offset) }
  }

  history() {
    return { modules: readModules().reverse(), jobs: listJobs().slice(0, 20), running: activeJobId() }
  }

  private model() {
    return this.ai().then((ai) => {
      if (!aiConfigured(ai)) throw new ServiceError('未配置 AI 模型，请在「系统设置 → AI」中填写 API Key 和模型名', 400)
      this.agent ??= createAiAgent(this.allowPrivate(), AI_TIMEOUT_MS)
      return languageModelFor(ai, this.agent)
    })
  }

  /** A spec draft from a one-sentence description */
  async suggest(description: string) {
    const text = description.trim()
    if (!text) throw new ServiceError('请描述要做的功能', 400)
    if (text.length > 1000) throw new ServiceError('描述最多 1000 个字符', 400)
    const model = await this.model()
    const dicts = (await this.meta()).dicts
    try {
      const result = await generateText({
        ...AI_CALL_DEFAULTS,
        model,
        prompt: aiPrompt(text, dicts),
        output: Output.object({ schema: aiSpecSchema, name: 'module_spec' }),
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      })
      const spec = toSpec(result.output)
      return { spec, errors: (await this.scaffold()).validateSpec(spec) }
    } catch (err) {
      throw aiError(err)
    }
  }

  /** English / Japanese for Chinese texts (title, labels, option names) */
  async translate(texts: string[]) {
    const list = [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))].slice(0, 200)
    if (list.length === 0) return { items: [] }
    const model = await this.model()
    try {
      const result = await generateText({
        ...AI_CALL_DEFAULTS,
        model,
        prompt:
          '把下面管理后台里的中文界面文字翻译成英文和日文，简洁、符合后台界面习惯（英文用 Sentence case）。' +
          '只输出一个 JSON 对象，格式：{"items":[{"zh":"设备编号","en":"Device no.","ja":"設備番号"}]}，按原顺序包含每一项。\n' +
          list.map((t) => `- ${t}`).join('\n'),
        output: Output.object({ schema: translationsSchema, name: 'translations' }),
        abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
      })
      return { items: result.output.items.filter((i) => list.includes(i.zh)) }
    } catch (err) {
      throw aiError(err)
    }
  }
}

function aiError(err: unknown): ServiceError {
  if (err instanceof ServiceError) return err
  const status = upstreamStatusOf(err)
  if (status === 429) return new ServiceError('AI 生成失败：模型服务的调用次数已达上限（429），请稍后再试', 400)
  if (status) return new ServiceError(`AI 生成失败（模型服务返回 ${status}），请检查模型配置后重试`, 400)
  return new ServiceError('AI 生成失败，请稍后重试或手动填写', 400)
}
