/**
 * Data dictionary service layer
 */

import { writeError } from '@/common/db-errors'
import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import { changedFields, parseIntText, parseYesNo } from '@/common/validation'
import type { Db } from '@/db/client'
import { dictItemToDict, dictTypeToDict, type DictItem, type DictType } from '@/db/schema'
import type { z } from 'zod'
import { DictsRepository, type DictItemUpdate } from './repository'
import {
  CSV_HEADER_TO_FIELD,
  ITEM_TABLE_HEADERS,
  type dictItemBody,
  type dictTypeBody,
} from './schema'

type DictTypeInput = z.output<typeof dictTypeBody>
type DictItemInput = z.output<typeof dictItemBody>

export class DictsService {
  private readonly repo: DictsRepository

  constructor(private readonly db: Db) {
    this.repo = new DictsRepository(db)
  }

  private async inTx<T>(fn: (repo: DictsRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new DictsRepository(tx)))
    } catch (err) {
      throw writeError(err)
    }
  }

  private async typeToDict(type: DictType, includeItems = false) {
    const itemCount = await this.repo.countItems(type.id)
    const items = includeItems ? await this.repo.listItemsOrdered(type.id) : undefined
    return dictTypeToDict(type, itemCount, items)
  }

  /** An item with its dict type's code and name */
  private async itemToDict(item: DictItem) {
    return dictItemToDict(item, await this.repo.getType(item.dict_type_id))
  }

  // ---------------------------------------------------------------- Lookup

  async getTypeOr404(id: number): Promise<DictType> {
    const type = await this.repo.getType(id)
    if (!type) throw notFound()
    return type
  }

  async getItemOr404(id: number): Promise<DictItem> {
    const item = await this.repo.getItem(id)
    if (!item) throw notFound()
    return item
  }

  // ---------------------------------------------------------------- options

  async getDictOptions(rawCodes: string) {
    if (!rawCodes) throw new ServiceError('codes 参数不能为空', 400)

    const codes: string[] = []
    const seen = new Set<string>()
    for (const code of rawCodes.split(',').map((c) => c.trim()).filter(Boolean)) {
      if (seen.has(code)) continue
      seen.add(code)
      codes.push(code)
    }

    const types = await this.repo.listActiveTypesByCodes(codes)
    const typeMap = new Map(types.map((t) => [t.code, t]))

    const result: Record<string, unknown[]> = {}
    for (const code of codes) {
      const type = typeMap.get(code)
      if (!type) {
        result[code] = []
        continue
      }
      const items = await this.repo.listActiveItemsOrdered(type.id)
      result[code] = items.map((item) => ({
        label: item.label,
        value: item.value,
        color: item.color,
        is_default: item.is_default,
      }))
    }
    return result
  }

  // ---------------------------------------------------------------- dict_types

  async listDictTypes(page: number, perPage: number, search: string, isActive: boolean | null) {
    const { total, rows } = await this.repo.listTypesPage(page, perPage, search, isActive)
    const counts = await this.repo.countItemsByTypeIds(rows.map((r) => r.id))
    return {
      items: rows.map((row) => dictTypeToDict(row, counts.get(row.id) ?? 0)),
      total,
      page,
      per_page: perPage,
    }
  }

  async createDictType(values: DictTypeInput) {
    if (await this.repo.getTypeByCode(values.code)) throw new ServiceError('字典编码已存在', 400)
    const created = await this.inTx((repo) => repo.insertType(values))
    return this.typeToDict(created)
  }

  async getDictType(type: DictType, includeItems: boolean) {
    return this.typeToDict(type, includeItems)
  }

  async updateDictType(type: DictType, values: Partial<DictTypeInput>) {
    if (values.code !== undefined && (await this.repo.getTypeByCodeExcluding(values.code, type.id))) {
      throw new ServiceError('字典编码已存在', 400)
    }

    const changes = changedFields(type, values)
    await this.inTx(async (repo) => {
      if (Object.keys(changes).length > 0) await repo.updateType(type.id, changes)
    })
    return this.typeToDict((await this.repo.getType(type.id))!)
  }

  async deleteDictType(type: DictType) {
    if ((await this.repo.countItems(type.id)) > 0) {
      throw new ServiceError('该字典下仍有字典项，请先清空后再删除', 400)
    }
    await this.inTx((repo) => repo.deleteType(type.id))
    return { message: '删除成功' }
  }

  // ---------------------------------------------------------------- dict_items

  async listDictItems(type: DictType, search: string, isActive: boolean | null) {
    const items = await this.repo.listItemsFiltered(type.id, search, isActive)
    return {
      items: items.map((item) => dictItemToDict(item, type)),
      total: items.length,
      dict_type: await this.typeToDict(type),
    }
  }

  async createDictItem(type: DictType, values: DictItemInput) {
    if (await this.repo.getItemByTypeValue(type.id, values.value)) {
      throw new ServiceError('同一字典下字典值不能重复', 400)
    }

    const created = await this.inTx(async (repo) => {
      if (values.is_default) await repo.clearDefaultExcludingId(type.id, -1)
      return repo.insertItem({ ...values, dict_type_id: type.id })
    })
    return dictItemToDict(created, type)
  }

  async getDictItem(item: DictItem) {
    return this.itemToDict(item)
  }

  async updateDictItem(item: DictItem, values: Partial<DictItemInput>) {
    const { dict_type_id: typeId, ...rest } = values
    const targetType = await this.repo.getType(typeId ?? item.dict_type_id)
    if (!targetType) throw new ServiceError('字典类型不存在', 404)

    if (await this.repo.getItemDuplicate(targetType.id, rest.value ?? item.value, item.id)) {
      throw new ServiceError('同一字典下字典值不能重复', 400)
    }

    await this.inTx(async (repo) => {
      if (rest.is_default) await repo.clearDefaultExcludingId(targetType.id, item.id)
      const changes = changedFields(item, { ...rest, dict_type_id: targetType.id })
      if (Object.keys(changes).length > 0) await repo.updateItem(item.id, changes)
    })
    return this.itemToDict((await this.repo.getItem(item.id))!)
  }

  async deleteDictItem(item: DictItem) {
    await this.inTx((repo) => repo.deleteItem(item.id))
    return { message: '删除成功' }
  }

  // ---------------------------------------------------------------- Import/export

  async exportDictItems(type: DictType, fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'csv')
    const items = await this.repo.listItemsOrdered(type.id)
    const rows = items.map((item) => [
      item.label,
      item.value,
      item.color || '',
      item.sort_order ?? 0,
      item.is_default ? '是' : '否',
      item.is_active ? '是' : '否',
      item.description || '',
    ])
    return buildTable(ITEM_TABLE_HEADERS, rows, `dict_${type.code}_items`, fileType)
  }

  async downloadDictItemsTemplate(type: DictType, fileTypeRaw: unknown) {
    const fileType = normalizeTableFileType(fileTypeRaw, 'csv')
    const rows = [['示例标签', 'sample_value', '#1677ff', 0, '否', '是', '可选']]
    return buildTable(ITEM_TABLE_HEADERS, rows, `dict_${type.code}_import_template`, fileType)
  }

  async importDictItems(type: DictType, file: UploadedFile | null) {
    if (!file) throw new ServiceError('请上传导入文件', 400)
    let table
    try {
      table = await readTableFile(file)
    } catch (err) {
      if (err instanceof TableFileError) throw new ServiceError(err.message, 400)
      throw err
    }
    if (table.fieldnames.length === 0) throw new ServiceError('导入内容为空', 400)

    const headerMap = new Map<string, string>()
    for (const header of table.fieldnames) {
      const normalized = header.trim()
      if (Object.hasOwn(CSV_HEADER_TO_FIELD, normalized)) headerMap.set(header, CSV_HEADER_TO_FIELD[normalized]!)
    }
    const mappedFields = new Set(headerMap.values())
    if (!mappedFields.has('label') || !mappedFields.has('value')) {
      throw new ServiceError('导入文件缺少必填列：字典标签、字典值', 400)
    }

    return this.inTx(async (repo) => {
      let created = 0
      let updated = 0

      for (const [line, row] of table.rows) {
        const mapped: Record<string, string> = {}
        for (const [key, val] of Object.entries(row)) {
          const field = headerMap.get(key)
          if (field) mapped[field] = val
        }

        const label = (mapped.label ?? '').trim()
        const value = (mapped.value ?? '').trim()
        if (!label || !value) throw new ServiceError(`第 ${line} 行“字典标签/字典值”不能为空`, 400)

        const isDefault = parseYesNo(mapped.is_default)
        const isActive = parseYesNo(mapped.is_active)
        const color = (mapped.color ?? '').trim() || null
        const description = (mapped.description ?? '').trim() || null
        const existing = await repo.getItemByTypeValue(type.id, value)

        let finalDefault: boolean | null
        let finalValue: string
        if (existing) {
          const next: DictItemUpdate = {
            label,
            color,
            sort_order: parseIntText(mapped.sort_order, existing.sort_order ?? 0),
            description,
          }
          if (isDefault !== null) next.is_default = isDefault
          if (isActive !== null) next.is_active = isActive
          const changes = changedFields(existing, next)
          if (Object.keys(changes).length > 0) await repo.updateItem(existing.id, changes)
          finalDefault = isDefault ?? existing.is_default
          finalValue = existing.value
          updated += 1
        } else {
          const inserted = await repo.insertItem({
            dict_type_id: type.id,
            label,
            value,
            color,
            sort_order: parseIntText(mapped.sort_order, 0),
            is_default: isDefault === true,
            is_active: isActive === null ? true : isActive,
            description,
          })
          finalDefault = inserted.is_default
          finalValue = inserted.value
          created += 1
        }

        if (finalDefault) await repo.clearDefaultKeepingValue(type.id, finalValue)
      }

      return { message: '导入成功', created, updated }
    })
  }
}
