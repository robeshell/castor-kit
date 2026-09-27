import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderPlus, Plus, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import EmptyState from '@/shared/components/EmptyState'

const PROJECTS = ['Apollo', 'Borealis', 'Cassini', 'Dragonfly']

export default function EmptyStates() {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('zeus')
  const matches = PROJECTS.filter((name) => name.toLowerCase().includes(keyword.trim().toLowerCase()))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Defaults: the Inbox icon and the title '暂无数据' */}
      <div className="rounded-lg border">
        <EmptyState />
      </div>

      {/* Nothing created yet: say why it is empty and offer the next step */}
      <div className="rounded-lg border">
        <EmptyState
          icon={FolderPlus}
          title="还没有项目"
          description="创建第一个项目，再邀请成员一起协作。"
          action={
            <Button size="sm" onClick={() => toast.info('这里打开新建表单')}>
              <Plus />
              {t('新建项目')}
            </Button>
          }
        />
      </div>

      {/* No search results: text with variables goes through t(), the action clears the filter */}
      <div className="flex flex-col rounded-lg border">
        <div className="border-b p-3">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('搜索项目')} aria-label={t('搜索项目')} className="h-8" />
        </div>
        {matches.length ? (
          <ul className="divide-y text-[13px]">
            {matches.map((name) => (
              <li key={name} className="px-4 py-2.5">
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={SearchX}
            title="没有匹配的结果"
            description={t('没有名称包含「{{keyword}}」的项目。', { keyword: keyword.trim() })}
            action={
              <Button size="sm" variant="outline" onClick={() => setKeyword('')}>
                {t('清除搜索')}
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
