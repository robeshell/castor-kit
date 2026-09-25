import { describe, expect, it } from 'vitest'
import { dbConstraintError, findPgError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'

describe('dbConstraintError', () => {
  it('输入数据导致的约束 / 数据错误 → 400 中文提示', () => {
    const cases: Array<[string, string]> = [
      ['23505', '数据重复：唯一字段的值已存在'],
      ['23502', '必填字段不能为空'],
      ['23503', '关联的数据不存在或仍被引用'],
      ['22001', '字段长度超出限制'],
      ['22003', '数值超出范围'],
      ['22P02', '字段格式不正确'],
    ]
    for (const [code, message] of cases) {
      const err = dbConstraintError({ code, severity: 'ERROR' })
      expect(err).toBeInstanceOf(ServiceError)
      expect([err!.statusCode, err!.message]).toEqual([400, message])
    }
  })

  it('沿 drizzle 包装的 cause 链找到 pg 错误', () => {
    const wrapped = Object.assign(new Error('Failed query: insert ...'), { cause: { code: '23505', constraint: 'x_code_unique' } })
    expect(findPgError(wrapped)).toMatchObject({ code: '23505', constraint: 'x_code_unique' })
    expect(dbConstraintError(wrapped)?.statusCode).toBe(400)
  })

  it('其他错误（连接失败、语法错误、非 pg 错误）返回 null，由调用方按 500 处理', () => {
    expect(dbConstraintError({ code: '42601' })).toBeNull()
    expect(dbConstraintError({ code: 'ECONNREFUSED' })).toBeNull()
    expect(dbConstraintError(new Error('boom'))).toBeNull()
    expect(dbConstraintError(null)).toBeNull()
  })
})
