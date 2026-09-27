/**
 * Detail tabs page service layer
 */

import { notFound } from '@/common/http'
import { changedFields } from '@/common/validation'
import type { Db } from '@/db/client'
import { detailMemberToDict, type DetailMember } from '@/db/schema'
import { DetailTabsRepository } from './repository'
import type { MemberInput } from './schema'

const DEFAULT_COLOR = '#4080FF'

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

  async createMember(values: MemberInput) {
    const member = await this.repo.insert({ ...values, avatar_color: values.avatar_color ?? DEFAULT_COLOR })
    return detailMemberToDict(member)
  }

  async updateMember(member: DetailMember, values: Partial<MemberInput>) {
    const patch = values.avatar_color === null ? { ...values, avatar_color: DEFAULT_COLOR } : values
    const changed = changedFields(member, patch)
    if (Object.keys(changed).length > 0) await this.repo.update(member.id, changed)
    return detailMemberToDict((await this.repo.getMember(member.id))!)
  }

  async deleteMember(member: DetailMember) {
    await this.repo.delete(member.id)
    return { message: '删除成功' }
  }
}
