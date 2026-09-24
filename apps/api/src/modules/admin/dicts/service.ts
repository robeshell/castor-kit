/**
 * 数据字典 service 层（对齐 AuraStack backend/app/admin/service/dicts.py）
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import { pyTruthy } from '@/common/py'
import { buildTable, normalizeTableFileType, readTableFile, TableFileError, type UploadedFile } from '@/common/tabular'
import type { Db } from '@/db/client'
import { dictItemToDict, dictTypeToDict, type DictItem, type DictType } from '@/db/schema'
import { DictsRepository, type DictItemUpdate, type DictTypeUpdate } from './repository'
import {
  CSV_HEADER_TO_FIELD,
  ITEM_TABLE_HEADERS,
  LEGACY_CSV_HEADER_TO_FIELD,
  normalizeString,
  parseBool,
  parseInt,
} from './schema'
import { bindBool, bindInt, bindText, lookupInt, omitNull, pyEq } from '@/common/sqla-bind'

type Data = Record<string, unknown>

const TYPE_UPDATE_BINDERS: Record<string, (v: unknown) => unknown> = {
  name: bindText,
  code: bindText,
  description: bindText,
  sort_order: bindInt,
  is_active: bindBool,
}

const ITEM_UPDATE_BINDERS: Record<string, (v: unknown) => unknown> = {
  dict_type_id: bindInt,
  label: bindText,
  value: bindText,
  color: bindText,
  sort_order: bindInt,
  is_default: bindBool,
  is_active: bindBool,
  description: bindText,
}

/**
 * `for field in fields: if field in data: setattr(item, field, data[field])` + commit：
 * 只有值变化（Python `==`）的列才进 UPDATE；全部未变化时 SQLAlchemy 不发 UPDATE（updated_at 不变）。
 */
function collectChanges<T extends object>(
  current: T,
  data: Data,
  binders: Record<string, (v: unknown) => unknown>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {}
  for (const [field, bind] of Object.entries(binders)) {
    if (!(field in data)) continue
    if (pyEq(data[field], (current as Record<string, unknown>)[field])) continue
    changes[field] = bind(data[field])
  }
  return changes
}

export class DictsService {
  private readonly repo: DictsRepository

  constructor(private readonly db: Db) {
    this.repo = new DictsRepository(db)
  }

  private async inTx<T>(fn: (repo: DictsRepository) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction((tx) => fn(new DictsRepository(tx)))
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : String(err), 500)
    }
  }

  private async typeToDict(type: DictType, includeItems = false) {
    const itemCount = await this.repo.countItems(type.id)
    const items = includeItems ? await this.repo.listItemsOrdered(type.id) : undefined
    return dictTypeToDict(type, itemCount, items)
  }

  /** DictItem.to_dict()（include_type=True） */
  private async itemToDict(item: DictItem) {
    return dictItemToDict(item, await this.repo.getType(item.dict_type_id))
  }

  // ---------------------------------------------------------------- 查找

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

  async createDictType(data: Data) {
    const name = normalizeString(data.name)
    const code = normalizeString(data.code)

    if (!name) throw new ServiceError('字典名称不能为空', 400)
    if (!code) throw new ServiceError('字典编码不能为空', 400)
    if (await this.repo.getTypeByCode(code)) throw new ServiceError('字典编码已存在', 400)

    const created = await this.inTx((repo) =>
      repo.insertType({
        name,
        code,
        description: omitNull(bindText(data.description)),
        sort_order: omitNull(bindInt('sort_order' in data ? data.sort_order : 0)),
        is_active: omitNull(bindBool('is_active' in data ? data.is_active : true)),
      }),
    )
    return this.typeToDict(created)
  }

  async getDictType(type: DictType, includeItems: boolean) {
    return this.typeToDict(type, includeItems)
  }

  async updateDictType(type: DictType, data: Data) {
    if ('name' in data && !normalizeString(data.name)) throw new ServiceError('字典名称不能为空', 400)

    if ('code' in data) {
      const newCode = normalizeString(data.code)
      if (!newCode) throw new ServiceError('字典编码不能为空', 400)
      if (await this.repo.getTypeByCodeExcluding(newCode, type.id)) throw new ServiceError('字典编码已存在', 400)
    }

    const changes = collectChanges(type, data, TYPE_UPDATE_BINDERS) as DictTypeUpdate
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

  async createDictItem(type: DictType, data: Data) {
    const label = normalizeString(data.label)
    const value = normalizeString(data.value)

    if (!label) throw new ServiceError('字典标签不能为空', 400)
    if (!value) throw new ServiceError('字典值不能为空', 400)
    if (await this.repo.getItemByTypeValue(type.id, value)) {
      throw new ServiceError('同一字典下字典值不能重复', 400)
    }

    const created = await this.inTx(async (repo) => {
      if (pyTruthy(data.is_default)) await repo.clearDefaultExcludingId(type.id, -1)
      return repo.insertItem({
        dict_type_id: type.id,
        label,
        value,
        color: omitNull(bindText(data.color)),
        sort_order: omitNull(bindInt('sort_order' in data ? data.sort_order : 0)),
        is_default: omitNull(bindBool('is_default' in data ? data.is_default : false)),
        is_active: omitNull(bindBool('is_active' in data ? data.is_active : true)),
        description: omitNull(bindText(data.description)),
      })
    })
    return dictItemToDict(created, type)
  }

  async getDictItem(item: DictItem) {
    return this.itemToDict(item)
  }

  async updateDictItem(item: DictItem, data: Data) {
    const targetTypeId = lookupInt('dict_type_id' in data ? data.dict_type_id : item.dict_type_id)
    const targetType = targetTypeId === null ? null : await this.repo.getType(targetTypeId)
    if (!targetType) throw new ServiceError('字典类型不存在', 404)

    const targetValue = normalizeString('value' in data ? data.value : item.value)
    if (!targetValue) throw new ServiceError('字典值不能为空', 400)

    if (await this.repo.getItemDuplicate(targetType.id, targetValue, item.id)) {
      throw new ServiceError('同一字典下字典值不能重复', 400)
    }

    if ('label' in data && !normalizeString(data.label)) throw new ServiceError('字典标签不能为空', 400)

    await this.inTx(async (repo) => {
      if (pyTruthy(data.is_default)) await repo.clearDefaultExcludingId(targetType.id, item.id)
      const changes = collectChanges(item, data, ITEM_UPDATE_BINDERS) as DictItemUpdate
      if (Object.keys(changes).length > 0) await repo.updateItem(item.id, changes)
    })
    return this.itemToDict((await this.repo.getItem(item.id))!)
  }

  async deleteDictItem(item: DictItem) {
    await this.inTx((repo) => repo.deleteItem(item.id))
    return { message: '删除成功' }
  }

  // ---------------------------------------------------------------- 导入导出

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
      const normalized = normalizeString(header)
      if (Object.hasOwn(CSV_HEADER_TO_FIELD, normalized)) headerMap.set(header, CSV_HEADER_TO_FIELD[normalized]!)
      else if (Object.hasOwn(LEGACY_CSV_HEADER_TO_FIELD, normalized)) {
        headerMap.set(header, LEGACY_CSV_HEADER_TO_FIELD[normalized]!)
      }
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

        const label = normalizeString(mapped.label)
        const value = normalizeString(mapped.value)
        if (!label || !value) throw new ServiceError(`第 ${line} 行“字典标签/字典值”不能为空`, 400)

        const isDefault = parseBool(mapped.is_default)
        const isActive = parseBool(mapped.is_active)
        const color = normalizeString(mapped.color) || null
        const description = normalizeString(mapped.description) || null
        const existing = await repo.getItemByTypeValue(type.id, value)

        let finalDefault: boolean | null
        let finalValue: string
        if (existing) {
          const next: DictItemUpdate = {
            label,
            color,
            sort_order: parseInt(mapped.sort_order, existing.sort_order || 0),
            description,
          }
          if (isDefault !== null) next.is_default = isDefault
          if (isActive !== null) next.is_active = isActive
          const changes = Object.fromEntries(
            Object.entries(next).filter(([k, v]) => !pyEq(v, (existing as Record<string, unknown>)[k])),
          ) as DictItemUpdate
          if (Object.keys(changes).length > 0) await repo.updateItem(existing.id, changes)
          finalDefault = isDefault ?? existing.is_default
          finalValue = existing.value
          updated += 1
        } else {
          const inserted = await repo.insertItem({
            dict_type_id: type.id,
            label,
            value,
            color: omitNull(color),
            sort_order: parseInt(mapped.sort_order, 0),
            is_default: isDefault === true,
            is_active: isActive === null ? true : isActive,
            description: omitNull(description),
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
