import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Database, Play, RefreshCw, Table2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { getDBSchema } from '@/modules/component_center/api/ai_sql'
import EmptyState from '@/shared/components/EmptyState'
import { SearchInput } from '@/shared/components/Filters'
import { DetailSheet } from '@/shared/components/FormDialog'

/**
 * Backend schema text -> [{ name, columns: [{ name, type, notNull, defaultValue }] }]
 *   TABLE users (
 *     id  integer NOT NULL DEFAULT nextval(...),
 *     username  character varying NOT NULL
 *   )
 */
function parseSchema(schemaText, tableNames = []) {
  const map = new Map()
  for (const m of (schemaText || '').matchAll(/TABLE (\S+) \(\n([\s\S]*?)\n\)/g)) {
    const columns = m[2]
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean)
      .map((line) => {
        const [name, ...rest] = line.split(/\s{2,}/)
        const spec = rest.join(' ')
        const defaultIdx = spec.indexOf(' DEFAULT ')
        const defaultValue = defaultIdx >= 0 ? spec.slice(defaultIdx + 9) : ''
        const head = defaultIdx >= 0 ? spec.slice(0, defaultIdx) : spec
        const notNull = / NOT NULL$/.test(head)
        const type = head.replace(/ NOT NULL$/, '')
        return { name, type, notNull, defaultValue }
      })
    map.set(m[1], columns)
  }
  const names = tableNames.length ? tableNames : [...map.keys()]
  return names.map((name) => ({ name, columns: map.get(name) || [] }))
}

function TableItem({ table, onQuery }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <div className="flex items-center gap-1 pr-1.5">
        <CollapsibleTrigger className="hover:bg-muted/60 flex min-w-0 flex-1 items-center gap-2 rounded-l-lg px-3 py-2 text-left transition-colors duration-150">
          <ChevronRight
            className={cn('text-muted-foreground size-3.5 shrink-0 transition-transform duration-200', open && 'rotate-90')}
          />
          <Table2 className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate font-mono text-[13px]">{table.name}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums">{t('{{count}} 列', { count: table.columns.length })}</span>
        </CollapsibleTrigger>
        <Button variant="ghost" size="icon-xs" aria-label={t('查询 {{name}}', { name: table.name })} title={t('填入查询语句')} onClick={() => onQuery(table.name)}>
          <Play />
        </Button>
      </div>
      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <ul className="border-t px-3 py-1.5">
          {table.columns.map((col) => (
            <li key={col.name} className="flex items-baseline gap-2 py-1 text-xs">
              <span className="min-w-0 truncate font-mono">{col.name}</span>
              {col.notNull ? <span className="text-warning shrink-0 text-[10px] font-medium">NOT NULL</span> : null}
              <span className="text-muted-foreground ml-auto shrink-0 truncate font-mono text-[11px]" title={col.defaultValue ? `DEFAULT ${col.defaultValue}` : undefined}>
                {col.type}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Schema browser (data from GET /ai/sql/schema; sensitive tables are filtered out by the backend) */
export default function SchemaSheet({ open, onOpenChange, onQueryTable }) {
  const { t } = useTranslation()
  const [tables, setTables] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [keyword, setKeyword] = useState('')
  const requestedRef = useRef(false)

  const applySchema = (res) => setTables(parseSchema(res?.schema, Array.isArray(res?.tables) ? res.tables : []))

  // Load once, the first time the sheet opens
  useEffect(() => {
    if (!open || requestedRef.current) return
    requestedRef.current = true
    getDBSchema()
      .then(applySchema)
      .catch((err) => {
        setFailed(true)
        toast.apiError(err, '获取数据库结构失败')
      })
  }, [open])

  const refresh = async () => {
    setRefreshing(true)
    try {
      applySchema(await getDBSchema())
      setFailed(false)
    } catch (err) {
      toast.apiError(err, '获取数据库结构失败')
    } finally {
      setRefreshing(false)
    }
  }

  const loading = refreshing || (tables === null && !failed)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!tables) return []
    if (!kw) return tables
    return tables.filter((table) => table.name.toLowerCase().includes(kw) || table.columns.some((c) => c.name.toLowerCase().includes(kw)))
  }, [tables, keyword])

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="表结构"
      description="AI 生成 SQL 时参考的业务表（敏感表不对外暴露）"
      width={460}
      footer={
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn(loading && 'animate-spin')} />
          {t('刷新')}
        </Button>
      }
    >
      <div className="space-y-3">
        <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索表名 / 字段名" className="sm:w-full" />
        {loading && !tables ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Database} title={tables?.length ? '没有匹配的表' : '暂无可查询的表'} />
        ) : (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs tabular-nums">{t('共 {{count}} 张表', { count: filtered.length })}</p>
            {filtered.map((table) => (
              <TableItem key={table.name} table={table} onQuery={onQueryTable} />
            ))}
          </div>
        )}
      </div>
    </DetailSheet>
  )
}
