import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'

interface Task {
  id: number
  title: string
  owner: string
}

const TASKS: Task[] = [
  { id: 1, title: 'Renew the SSL certificate', owner: 'Mia' },
  { id: 2, title: 'Archive last quarter reports', owner: 'Leo' },
  { id: 3, title: 'Rotate the API tokens', owner: 'Ava' },
  { id: 4, title: 'Clean up stale feature flags', owner: 'Noah' },
  { id: 5, title: 'Review the on-call schedule', owner: 'Mia' },
]

const columns: DataTableColumn<Task>[] = [
  { key: 'title', title: '标题', dataIndex: 'title' },
  { key: 'owner', title: '负责人', dataIndex: 'owner', width: 120 },
]

export default function SelectionToolbar() {
  const { t } = useTranslation()
  const [rows, setRows] = useState(TASKS)
  // Selection is controlled: the page owns the keys (the rowKey values, 'id' by default)
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])

  const removeSelected = () => {
    setRows((prev) => prev.filter((row) => !selectedKeys.includes(row.id)))
    setSelectedKeys([])
    toast.success('已删除')
  }

  return (
    <div className="space-y-3">
      {/* The toolbar follows the selection; a fixed height keeps the table from jumping */}
      <div className="flex h-8 items-center gap-2">
        {selectedKeys.length > 0 ? (
          <>
            <span className="text-sm tabular-nums">{t('已选 {{count}} 项', { count: selectedKeys.length })}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedKeys([])}>
              {t('取消选择')}
            </Button>
            <ConfirmAction title="删除选中的任务？" description="删除后不可恢复。" confirmText="删除" onConfirm={removeSelected}>
              <Button variant="outline" size="sm" className="text-danger hover:text-danger">
                <Trash2 />
                {t('批量删除')}
              </Button>
            </ConfirmAction>
          </>
        ) : (
          <span className="text-muted-foreground text-sm">{t('勾选行后可以批量操作')}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setRows(TASKS)
            setSelectedKeys([])
          }}
        >
          <RotateCcw />
          {t('重置')}
        </Button>
      </div>
      <DataTable columns={columns} data={rows} selectable selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
    </div>
  )
}
