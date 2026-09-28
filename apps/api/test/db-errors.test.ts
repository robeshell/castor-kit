import { describe, expect, it } from 'vitest'
import { dbConstraintError, findPgError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'

describe('dbConstraintError', () => {
  it('输入数据导致的约束 / 数据错误 → 400 中文提示', () => {
    const cases: Array<[string, string]> = [
      ['23505', '已有记录使用了相同的值，请换一个值后再保存'],
      ['23502', '有必填字段没有填写，请补全后再保存'],
      ['23503', '关联的数据不存在，或这条数据仍被其他数据使用，请检查关联后重试'],
      ['22001', '有字段超出了长度上限，请缩短后再保存'],
      ['22003', '有数字超出了允许的范围，请检查后再保存'],
      ['22P02', '有字段的格式不正确（例如数字字段里填了文字），请检查后再保存'],
    ]
    for (const [code, message] of cases) {
      const err = dbConstraintError({ code, severity: 'ERROR' })
      expect(err).toBeInstanceOf(ServiceError)
      expect([err!.statusCode, err!.message]).toEqual([400, message])
    }
  })

  it('names the column when pg reports it (unique detail, not-null column)', () => {
    expect(dbConstraintError({ code: '23505', detail: 'Key (code)=(A-1) already exists.' })?.message).toBe('字段「code」的值已被使用，请换一个值后再保存')
    expect(dbConstraintError({ code: '23502', column: 'name' })?.message).toBe('必填字段「name」没有填写，请补全后再保存')
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
