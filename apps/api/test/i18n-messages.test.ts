/**
 * Missing-translation check for API response messages.
 *
 * Parses apps/api/src with the TypeScript compiler API, collects the Chinese text that can reach users through
 * `error` / `message` / `error_rows[].reason`, and asserts every entry is translated by src/i18n/messages.ts:
 * - plain literals must be an exact MESSAGES key;
 * - template literals (`${…}` = any text) must match a PATTERNS regex (or an exact key) with sample values.
 *
 * Sinks:
 * - `new ServiceError(msg, status)` (skipped when status is a literal >= 500: the error handler replaces the text
 *   with the generic 500 message), and calls to helpers that forward a parameter into `new ServiceError(param, …)`
 * - `error:` / `message:` properties of object literals (reply.send({...}), returned bodies)
 * - `buildErrorRow(line, reason, row)`
 *
 * Values are followed through const identifiers, `a ? b : c`, `a ?? b` / `a || b`, `CONST_MAP[key]`, calls to
 * functions declared in src (their return values, including `const [ok, reason] = fn()` tuples), and
 * `err.message` where `err` is narrowed to an error class declared in src (collects every `new ThatClass(msg)`).
 *
 * Not user text, never collected: arguments of `*.log.*` / `console.*`, export/import header maps, AI prompts,
 * seed / demo data, SQL — none of them flow into a sink; the checks at the bottom keep it that way.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { MESSAGES, PATTERNS } from '@/i18n/messages'

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(API_DIR, 'src') + path.sep
const I18N_DIR = path.join(SRC_DIR, 'i18n') + path.sep

const HAN = /\p{Script=Han}/u
/** Values tried for each `${…}`; a template passes when any of them is translated */
const PLACEHOLDERS = ['X', '1']

interface Collected {
  file: string
  line: number
  /** Literal text, or the template with each `${…}` replaced by \u0000 */
  text: string
  template: boolean
}

function buildProgram(): ts.Program {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(API_DIR, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!parsed) throw new Error('cannot read tsconfig.json')
  return ts.createProgram(
    parsed.fileNames.filter((f) => path.resolve(f).startsWith(SRC_DIR)),
    parsed.options,
  )
}

function inSrc(sf: ts.SourceFile): boolean {
  const file = path.resolve(sf.fileName)
  return file.startsWith(SRC_DIR) && !file.startsWith(I18N_DIR) && !sf.isDeclarationFile
}

function collectMessages(): Collected[] {
  const program = buildProgram()
  const checker = program.getTypeChecker()
  const sources = program.getSourceFiles().filter(inSrc)
  const found = new Map<string, Collected>()

  const unwrap = (node: ts.Expression): ts.Expression => {
    let cur = node
    while (
      ts.isParenthesizedExpression(cur) ||
      ts.isAsExpression(cur) ||
      ts.isNonNullExpression(cur) ||
      ts.isSatisfiesExpression(cur) ||
      ts.isTypeAssertionExpression(cur)
    ) {
      cur = cur.expression
    }
    return cur
  }

  const symbolOf = (node: ts.Node): ts.Symbol | undefined => {
    const sym = checker.getSymbolAtLocation(node)
    return sym && sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym
  }

  const declaredInSrc = (decl: ts.Node | undefined): boolean => !!decl && inSrc(decl.getSourceFile())

  const isConstDeclaration = (decl: ts.VariableDeclaration): boolean =>
    ts.isVariableDeclarationList(decl.parent) && (decl.parent.flags & ts.NodeFlags.Const) !== 0

  const isStatusAtLeast500 = (arg: ts.Expression | undefined): boolean => {
    const status = arg && unwrap(arg)
    return !!status && ts.isNumericLiteral(status) && Number(status.text) >= 500
  }

  /** Constant text of an expression (used to inline `${CONST}` inside templates) */
  const constantText = (node: ts.Expression): string | undefined => {
    const expr = unwrap(node)
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text
    if (!ts.isIdentifier(expr)) return undefined
    const decl = symbolOf(expr)?.valueDeclaration
    if (decl && ts.isVariableDeclaration(decl) && isConstDeclaration(decl) && decl.initializer && declaredInSrc(decl)) {
      return constantText(decl.initializer)
    }
    return undefined
  }

  const record = (node: ts.Node, text: string, template: boolean) => {
    if (!HAN.test(text)) return
    const sf = node.getSourceFile()
    const file = path.relative(API_DIR, sf.fileName)
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
    found.set(`${file}:${line}:${text}`, { file, line, text, template })
  }

  /** Return expressions of a function body (nested functions excluded) */
  const returnsOf = (fn: ts.SignatureDeclaration): ts.Expression[] => {
    const body = (fn as ts.FunctionLikeDeclaration).body
    if (!body) return []
    if (!ts.isBlock(body)) return [body]
    const out: ts.Expression[] = []
    const walk = (node: ts.Node) => {
      if (ts.isReturnStatement(node)) {
        if (node.expression) out.push(node.expression)
        return
      }
      if (ts.isFunctionLike(node)) return
      ts.forEachChild(node, walk)
    }
    ts.forEachChild(body, walk)
    return out
  }

  const functionDeclarationOf = (callee: ts.Expression): ts.SignatureDeclaration | undefined => {
    const decl = symbolOf(callee)?.valueDeclaration
    if (!decl || !declaredInSrc(decl)) return undefined
    if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) return decl
    if (ts.isVariableDeclaration(decl) && decl.initializer) {
      const init = unwrap(decl.initializer)
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init
    }
    return undefined
  }

  // `new ErrorClass(msg)` sites, by class symbol (for `err.message` after `err instanceof ErrorClass`)
  const constructions = new Map<ts.Symbol, ts.NewExpression[]>()
  // helpers forwarding a parameter into `new ServiceError(param, …)`: function symbol → parameter index
  const helpers = new Map<ts.Symbol, number>()

  for (const sf of sources) {
    const walk = (node: ts.Node) => {
      if (ts.isNewExpression(node)) {
        const cls = symbolOf(node.expression)
        if (cls) constructions.set(cls, [...(constructions.get(cls) ?? []), node])
        const arg = node.arguments?.[0] && unwrap(node.arguments[0])
        if (cls?.name === 'ServiceError' && arg && ts.isIdentifier(arg) && !isStatusAtLeast500(node.arguments?.[1])) {
          const param = symbolOf(arg)?.valueDeclaration
          if (param && ts.isParameter(param) && ts.isIdentifier(param.name)) {
            const fn = param.parent
            const fnName = ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn) ? fn.name
              : ts.isVariableDeclaration(fn.parent) ? fn.parent.name : undefined
            const fnSymbol = fnName && symbolOf(fnName)
            if (fnSymbol) helpers.set(fnSymbol, fn.parameters.indexOf(param))
          }
        }
      }
      ts.forEachChild(node, walk)
    }
    walk(sf)
  }

  const seen = new Set<ts.Node>()

  /** Collect every text an expression can evaluate to */
  const resolve = (node: ts.Expression | undefined): void => {
    if (!node || seen.has(node)) return
    seen.add(node)
    const expr = unwrap(node)

    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      record(expr, expr.text, false)
    } else if (ts.isTemplateExpression(expr)) {
      let text = expr.head.text
      let template = false
      for (const span of expr.templateSpans) {
        const inlined = constantText(span.expression)
        if (inlined === undefined) template = true
        text += (inlined ?? '\u0000') + span.literal.text
      }
      record(expr, text, template)
    } else if (ts.isConditionalExpression(expr)) {
      resolve(expr.whenTrue)
      resolve(expr.whenFalse)
    } else if (
      ts.isBinaryExpression(expr) &&
      (expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
        expr.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      resolve(expr.left)
      resolve(expr.right)
    } else if (ts.isIdentifier(expr)) {
      const decl = symbolOf(expr)?.valueDeclaration
      if (!decl || !declaredInSrc(decl)) return
      if (ts.isVariableDeclaration(decl) && isConstDeclaration(decl)) {
        resolve(decl.initializer)
      } else if (ts.isBindingElement(decl) && ts.isArrayBindingPattern(decl.parent)) {
        // const [ok, reason] = fn(...)
        const index = decl.parent.elements.indexOf(decl)
        const owner = decl.parent.parent
        const init = ts.isVariableDeclaration(owner) && owner.initializer ? unwrap(owner.initializer) : undefined
        const fn = init && ts.isCallExpression(init) ? functionDeclarationOf(init.expression) : undefined
        for (const ret of fn ? returnsOf(fn) : []) {
          const tuple = unwrap(ret)
          if (ts.isArrayLiteralExpression(tuple)) resolve(tuple.elements[index])
        }
      }
    } else if (ts.isElementAccessExpression(expr)) {
      // CONST_MAP[key]
      const target = unwrap(expr.expression)
      const decl = ts.isIdentifier(target) ? symbolOf(target)?.valueDeclaration : undefined
      const init = decl && ts.isVariableDeclaration(decl) && decl.initializer ? unwrap(decl.initializer) : undefined
      if (init && ts.isObjectLiteralExpression(init) && declaredInSrc(decl)) {
        for (const prop of init.properties) if (ts.isPropertyAssignment(prop)) resolve(prop.initializer)
      }
    } else if (ts.isCallExpression(expr)) {
      const fn = functionDeclarationOf(expr.expression)
      for (const ret of fn ? returnsOf(fn) : []) resolve(ret)
    } else if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'message') {
      // err.message with err narrowed to an error class declared in src
      const type = checker.getTypeAtLocation(expr.expression)
      for (const part of type.isUnion() ? type.types : [type]) {
        const cls = part.getSymbol()
        // ServiceError construction sites are sinks themselves (with the >= 500 rule)
        if (!cls || cls.name === 'ServiceError' || !declaredInSrc(cls.valueDeclaration)) continue
        for (const site of constructions.get(cls) ?? []) resolve(site.arguments?.[0])
      }
    }
  }

  const isLogCall = (node: ts.Node): boolean => {
    if (!ts.isCallExpression(node)) return false
    const callee = node.expression.getText()
    return /^console\./.test(callee) || /(^|\.)log\.\w+$/.test(callee)
  }

  const insideLogCall = (node: ts.Node): boolean => {
    for (let cur: ts.Node | undefined = node.parent; cur && !ts.isSourceFile(cur); cur = cur.parent) {
      if (isLogCall(cur)) return true
      if (ts.isFunctionLike(cur)) return false
    }
    return false
  }

  for (const sf of sources) {
    const walk = (node: ts.Node) => {
      if (ts.isNewExpression(node) && symbolOf(node.expression)?.name === 'ServiceError') {
        if (!isStatusAtLeast500(node.arguments?.[1])) resolve(node.arguments?.[0])
      } else if (ts.isCallExpression(node)) {
        const callee = symbolOf(node.expression)
        const index = callee && helpers.get(callee)
        if (index !== undefined) resolve(node.arguments[index])
        if (callee?.name === 'buildErrorRow') resolve(node.arguments[1])
      } else if (
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        ts.isObjectLiteralExpression(node.parent) &&
        ['error', 'message'].includes(node.name.getText()) &&
        !insideLogCall(node)
      ) {
        resolve(ts.isPropertyAssignment(node) ? node.initializer : node.name)
      }
      ts.forEachChild(node, walk)
    }
    walk(sf)
  }

  return [...found.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

function isTranslated(item: Pick<Collected, 'text' | 'template'>): boolean {
  if (!item.template) return Object.hasOwn(MESSAGES, item.text)
  return PLACEHOLDERS.some((value) => {
    const sample = item.text.replaceAll('\u0000', value)
    return Object.hasOwn(MESSAGES, sample) || PATTERNS.some((p) => p.re.test(sample))
  })
}

const show = (text: string) => text.replaceAll('\u0000', '${…}')

describe('i18n messages coverage', () => {
  const collected = collectMessages()
  const texts = new Set(collected.map((c) => show(c.text)))

  it('every user-facing Chinese message in src has an en-US / ja-JP translation', () => {
    const missing = collected.filter((c) => !isTranslated(c)).map((c) => `${c.file}:${c.line}  ${show(c.text)}`)
    expect(missing, `untranslated messages (add them to src/i18n/messages.ts):\n${missing.join('\n')}`).toEqual([])
  })

  it('collector follows indirect sources and skips non-user text', () => {
    expect(collected.length).toBeGreaterThan(200)
    for (const text of [
      '资源不存在', // reply.send({ error })
      '用户名已存在', // new ServiceError
      '缺少权限: ${…}', // template in a conditional
      '请求体格式错误', // const message = cond ? … : …
      '服务器内部错误，请稍后重试', // imported constant
      '数据重复：唯一字段的值已存在', // CONST_MAP[code]
      '请填写完整信息', // const error = validate…(); new ServiceError(error)
      '只允许 SELECT 查询语句', // const [safe, reason] = isSafeSql(sql)
      'Cron 表达式不能为空', // err.message after instanceof ScheduledTaskSchemaError
      '不允许访问内网地址（${…} 解析为 ${…}）', // new ScheduledTaskSchemaError(blockedHostMessage(…))
      '仅支持 csv/xlsx 文件', // err.message after instanceof TableFileError
      '保存模板失败，请稍后重试', // err.message after instanceof AiPromptPersistError
      '新增用户必须提供密码', // buildErrorRow
    ]) {
      expect(texts, text).toContain(text)
    }
    for (const text of [
      '健康检查失败', // request.log.error
      '创建通知失败，请稍后重试', // ServiceError(…, 500): replaced by the generic message
      '你是 castor-kit 项目的专属 AI 助手。\n\n', // AI prompt
      '用户名', // export / import header
      '广东', // demo data
    ]) {
      expect(texts, text).not.toContain(text)
    }
  })

  it('scaffold-generated messages are translated (keep in sync with scripts/scaffold.ts)', () => {
    const scaffold = [
      { text: '无权限新增', template: false },
      { text: '无权限编辑', template: false },
      { text: '无权限删除', template: false },
      { text: '无权限导出', template: false },
      { text: '无权限导入', template: false },
      { text: '\u0000的值无效', template: true }, // invalid(field): `${fieldLabel(field)}的值无效`
      { text: '\u0000不能为空', template: true }, // import: `${requiredHeader}不能为空`
    ]
    expect(scaffold.filter((item) => !isTranslated(item)).map((item) => show(item.text))).toEqual([])
  })

  it('PATTERNS are anchored and only reference existing capture groups', () => {
    for (const { re, ...translations } of PATTERNS) {
      expect(re.source.startsWith('^') && re.source.endsWith('$'), String(re)).toBe(true)
      const groups = new RegExp(`${re.source}|`).exec('')!.length - 1
      for (const text of Object.values(translations)) {
        for (const [, n] of text.matchAll(/\$(\d+)/g)) expect(Number(n), `${re} → ${text}`).toBeLessThanOrEqual(groups)
      }
    }
  })

  it('MESSAGES / PATTERNS entries have non-empty translations for every language', () => {
    for (const [key, entry] of Object.entries(MESSAGES)) {
      expect(entry['en-US'].trim(), key).not.toBe('')
      expect(entry['ja-JP'].trim(), key).not.toBe('')
    }
    for (const entry of PATTERNS) {
      expect(entry['en-US'].trim(), String(entry.re)).not.toBe('')
      expect(entry['ja-JP'].trim(), String(entry.re)).not.toBe('')
    }
  })
})
