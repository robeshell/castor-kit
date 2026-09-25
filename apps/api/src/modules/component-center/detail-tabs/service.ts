/**
 * Detail tabs page service layer
 */

import { ServiceError } from '@/common/errors'
import { notFound } from '@/common/http'
import type { Db } from '@/db/client'
import { detailMemberToDict, type DetailMember } from '@/db/schema'
import { parseLooseDate } from '@/common/py-date'
import { DetailTabsRepository, type DetailMemberPatch } from './repository'
import { changedFields, colorOrDefault, hasKey, normalizeStatus, parseBool, parseIntOr, strOrEmpty, strOrNull } from './schema'

type Data = Record<string, unknown>

export class DetailTabsService {
  private readonly repo: DetailTabsRepository

  constructor(db: Db) {
    this.repo = new DetailTabsRepository(db)
  }

  async getMemberOr404(id: number): Promise<DetailMember> {
    const member = await this.repo.getMember(id)
    if (!member) throw notFound()
    return member
  }

  async getAllMembers(search: string | null) {
    return (await this.repo.allMembers(search)).map(detailMemberToDict)
  }

  async getMember(id: number) {
    return detailMemberToDict(await this.getMemberOr404(id))
  }

  async createMember(data: Data) {
    const name = strOrEmpty(data.name)
    if (!name) throw new ServiceError('姓名不能为空')

    const member = await this.repo.insert({
      name,
      department: strOrNull(data.department),
      role_title: strOrNull(data.role_title),
      email: strOrNull(data.email),
      phone: strOrNull(data.phone),
      status: normalizeStatus(data.status),
      join_date: parseLooseDate(data.join_date),
      avatar_color: colorOrDefault(data.avatar_color),
      bio: strOrNull(data.bio),
      sort_order: parseIntOr(data.sort_order, 0),
      is_active: parseBool(data.is_active, true),
    })
    return detailMemberToDict(member)
  }

  async updateMember(member: DetailMember, data: Data) {
    if (hasKey(data, 'name') && !strOrEmpty(data.name)) throw new ServiceError('姓名不能为空')

    const patch: DetailMemberPatch = {}
    if (hasKey(data, 'name')) patch.name = strOrEmpty(data.name)
    if (hasKey(data, 'department')) patch.department = strOrNull(data.department)
    if (hasKey(data, 'role_title')) patch.role_title = strOrNull(data.role_title)
    if (hasKey(data, 'email')) patch.email = strOrNull(data.email)
    if (hasKey(data, 'phone')) patch.phone = strOrNull(data.phone)
    if (hasKey(data, 'avatar_color')) patch.avatar_color = colorOrDefault(data.avatar_color)
    if (hasKey(data, 'bio')) patch.bio = strOrNull(data.bio)
    if (hasKey(data, 'sort_order')) patch.sort_order = parseIntOr(data.sort_order, member.sort_order || 0)
    if (hasKey(data, 'is_active')) patch.is_active = parseBool(data.is_active, member.is_active)
    if (hasKey(data, 'status')) patch.status = normalizeStatus(data.status)
    if (hasKey(data, 'join_date')) patch.join_date = parseLooseDate(data.join_date)

    const changed = changedFields(member, patch)
    if (Object.keys(changed).length > 0) await this.repo.update(member.id, changed)
    return detailMemberToDict((await this.repo.getMember(member.id))!)
  }

  async deleteMember(member: DetailMember) {
    await this.repo.delete(member.id)
    return { message: '删除成功' }
  }
}
