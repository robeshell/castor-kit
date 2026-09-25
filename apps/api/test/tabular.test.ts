import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildTable, normalizeTableFileType, readTableFile, sanitizeFormula, TableFileError } from '@/common/tabular'

describe('tabular', () => {
  it('公式注入防护', () => {
    for (const v of ['=1+1', '+1', '@SUM(A1)', '\tx', '\rx', '-abc']) expect(sanitizeFormula(v)).toBe(`'${v}`)
    for (const v of ['-1', '-.5', 'abc', '1+1', '']) expect(sanitizeFormula(v)).toBe(v)
  })

  it('file_type 归一化：xls 回落默认 csv', () => {
    expect(normalizeTableFileType('XLSX')).toBe('xlsx')
    expect(normalizeTableFileType('xls')).toBe('csv')
    expect(normalizeTableFileType(undefined)).toBe('csv')
  })

  it('CSV 输出：BOM、\\r\\n、最小引用', async () => {
    const t = await buildTable(['名称', '备注'], [['a,b', 'say "hi"'], ['=cmd', null], [1.0, 2.5]], 'x', 'csv')
    expect(t.filename).toBe('x.csv')
    expect(t.contentType).toBe('text/csv; charset=utf-8')
    expect(t.payload.toString('utf8')).toBe('﻿名称,备注\r\n"a,b","say ""hi"""\r\n\'=cmd,\r\n1,2.5\r\n')
  })

  it('CSV 读取：BOM、空行跳过且不计行号、全空行跳过但计行号、缺列补空', async () => {
    const csv = '﻿用户名,密码\r\nalice,1\r\n\r\n,\r\nbob\r\n'
    const r = await readTableFile({ filename: 'a.CSV', data: Buffer.from(csv) })
    expect(r.fieldnames).toEqual(['用户名', '密码'])
    expect(r.rows).toEqual([
      [2, { 用户名: 'alice', 密码: '1' }],
      [4, { 用户名: 'bob', 密码: '' }],
    ])
  })

  it('xlsx 往返', async () => {
    const t = await buildTable(['a', 'b'], [['x', 2], ['', '']], 'y', 'xlsx')
    const r = await readTableFile({ filename: 'y.xlsx', data: t.payload })
    expect(r.fieldnames).toEqual(['a', 'b'])
    expect(r.rows).toEqual([[2, { a: 'x', b: '2' }]])
  })

  it('xlsx 读取数值/日期/布尔', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('S')
    ws.addRow(['n', 'f', 'd', 'b'])
    ws.addRow([3, 1.5, new Date(Date.UTC(2026, 0, 2, 3, 4, 5)), true])
    const r = await readTableFile({ filename: 'z.xlsx', data: Buffer.from(await wb.xlsx.writeBuffer()) })
    expect(r.rows[0]![1]).toEqual({ n: '3', f: '1.5', d: '2026-01-02 03:04:05', b: 'True' })
  })

  it('校验：xls 明确拒绝、非法扩展名、空文件、编码错误、超 5MB', async () => {
    const cases: [string, Buffer, string][] = [
      ['a.xls', Buffer.from('x'), '不支持 .xls 格式，请另存为 .xlsx 后重新上传'],
      ['a.txt', Buffer.from('x'), '仅支持 csv/xlsx 文件'],
      ['a.csv', Buffer.alloc(0), '导入文件内容为空'],
      ['a.csv', Buffer.from([0xff, 0xfe, 0x00]), 'CSV 编码错误，请使用 UTF-8 编码'],
      ['a.csv', Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), '文件过大，最大支持 5MB'],
    ]
    for (const [filename, data, message] of cases) {
      await expect(readTableFile({ filename, data })).rejects.toThrow(new TableFileError(message))
    }
    await expect(readTableFile(null)).rejects.toThrow('请上传导入文件')
  })
})
