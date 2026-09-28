/**
 * Page patterns → Kanban: the reference implementation of the kanban board pattern, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when records move through a fixed set of states and people reorder them by hand (tasks, tickets, leads).
 * The columns are the values of an enum field (status, in board order), cards are the records, ordered by
 * board_order, a field of their own (the tree pattern orders siblings by sort_order, so the two never disturb each
 * other). What to copy:
 * - Loading: one list request sorted by board_order, grouped into columns on the client and sorted by (board_order,
 *   id). It fetches up to 200 records (the list's page cap), so the pattern fits a bounded board; a larger one would
 *   load each column on its own or filter first.
 * - Dragging (@dnd-kit): within a column and across columns; the card moves between columns while it is dragged
 *   (onDragOver), the final order is settled on drop (onDragEnd). Drag needs the edit permission.
 * - Saving: optimistic. The board is updated at once, then one `reorder` request carries the cards of the columns
 *   that changed ({ id, board_order: index, status: column }); on failure the board rolls back to its state at drag
 *   start. Untouched columns are not sent.
 * - The last column (archived) is collapsed to a narrow rail that still accepts drops.
 * - Cards are created in a column (status preset, appended at its end), edited and deleted through the shared
 *   FormDialog / ConfirmAction; buttons follow the cc_patterns_add / _edit / _delete permissions.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Data,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type DndContextProps,
  type Over,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, ChevronsLeftRight, CircleAlert, GripVertical, Pencil, Plus, Trash2, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/format'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createItem,
  deleteItem,
  getItems,
  reorder,
  updateItem,
  type DemoRecord as Row,
  type DemoRecordReorderBody,
} from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  STATUS_OPTIONS,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormDate, FormGrid, FormInput, FormNumber, FormSelect, FormTags, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

/** The columns: every status value, in board order, in the shared status tones */
const COLUMNS = STATUS_OPTIONS.map(({ value, label, tone }) => ({ status: value, label, tone }))
/** The column shown collapsed (a narrow rail that still accepts drops) until it is expanded */
const COLLAPSIBLE: Status = 'archived'

/** Priority is an integer (higher = more urgent); the chip's tone steps up with it */
function priorityTone(priority: number): StatusTone {
  if (priority >= 5) return 'danger'
  if (priority >= 4) return 'warning'
  if (priority >= 3) return 'brand'
  return 'neutral'
}

/** Cards per column, each list in board order */
type Board = Record<Status, Row[]>

/** status is NOT NULL in the database (default todo); the API type is nullable because every field is */
const statusOf = (record: Row): Status => record.status ?? 'todo'

/** Board order: board_order, then id */
const byBoardOrder = (a: Row, b: Row) => (a.board_order ?? 0) - (b.board_order ?? 0) || a.id - b.id

function groupByStatus(records: Row[]): Board {
  const board: Board = { todo: [], in_progress: [], done: [], archived: [] }
  for (const record of records) board[statusOf(record)].push(record)
  for (const { status } of COLUMNS) board[status].sort(byBoardOrder)
  return board
}

function columnOf(board: Board, cardId: number): Status | null {
  return COLUMNS.find(({ status }) => board[status].some((c) => c.id === cardId))?.status ?? null
}

/** board_order that puts a card after the last one of its column (stored orders may have gaps and ties) */
const nextBoardOrder = (cards: Row[]) => Math.max(-1, ...cards.map((c) => c.board_order ?? 0)) + 1

const orderSignature = (board: Board) => COLUMNS.map(({ status }) => board[status].map((c) => c.id).join(',')).join('|')

// ─── dnd ids and data ─────────────────────────────────────────────────
/** useSortable data of a card (SortableCard) */
interface CardDragData {
  type: 'card'
  card: Row
}
/** useDroppable data of a column (Column / CollapsedColumn) */
interface ColumnDropData {
  type: 'column'
  status: Status
}

const cardDndId = (id: number) => `card-${id}`
const columnDndId = (status: Status) => `column-${status}`
const isCardDndId = (dndId: UniqueIdentifier) => String(dndId).startsWith('card-')
const parseCardDndId = (dndId: UniqueIdentifier) => Number(String(dndId).slice('card-'.length))
/** SortableCard is the only draggable, and it sets { type: 'card', card } */
const isCardDragData = (data: Data | undefined): data is CardDragData => data?.type === 'card'
const isColumnDropData = (data: Data | undefined): data is ColumnDropData => data?.type === 'column'

/** Pointer over a card → the card; over empty column space → the column; no pointer (keyboard drag) → closest corners */
function collisionDetection(args: Parameters<CollisionDetection>[0]) {
  const hits = pointerWithin(args)
  if (hits.length) {
    const cardHits = hits.filter((h) => isCardDndId(h.id))
    return cardHits.length ? cardHits : hits
  }
  return closestCorners(args)
}

// On drop the lifted card settles back into its slot (the overlay spring curve)
const dropAnimation: DropAnimation = {
  duration: 240,
  easing: 'cubic-bezier(.32,.72,0,1)',
  sideEffects: ({ active, dragOverlay }) => {
    active.node.style.opacity = '0'
    dragOverlay.node.querySelector('[data-lift]')?.setAttribute('data-dropping', '')
    return () => {
      active.node.style.opacity = ''
    }
  },
}

/** What the card dialog holds and submits (a subset of the create / edit body) */
interface FormValues {
  name: string
  code: string
  status: Status
  category: Category | null
  owner: string
  priority: number | null
  end_date: string
  tags: string[]
  description: string
}

const emptyValues = (status: Status): FormValues => ({
  name: '',
  code: '',
  status,
  category: null,
  owner: '',
  priority: 0,
  end_date: '',
  tags: [],
  description: '',
})

const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  status: statusOf(record),
  category: record.category,
  owner: record.owner ?? '',
  priority: record.priority,
  end_date: formatDate(record.end_date, ''),
  tags: record.tags,
  description: record.description ?? '',
})

// ─── Card ─────────────────────────────────────────────────────────────
interface CardBodyProps {
  card: Row
  /** Local date (YYYY-MM-DD): open cards due before it are overdue */
  today: string
  /** Drag handle for the keyboard, next to the name */
  grip?: ReactNode
  /** Edit / delete buttons shown next to the name */
  actions?: ReactNode
  /** Drag overlay look (tilted, raised) */
  lifted?: boolean
}

function CardBody({ card, today, grip, actions, lifted = false }: CardBodyProps) {
  const { t } = useTranslation()
  const category = categoryLabel(card.category)
  const priority = card.priority ?? 0
  const due = formatDate(card.end_date, '')
  const open = card.status === 'todo' || card.status === 'in_progress'
  const overdue = Boolean(due) && open && due < today
  return (
    <div
      data-lift={lifted ? '' : undefined}
      className={cn(
        'bg-card ring-border rounded-lg p-3 text-left shadow-xs ring-1',
        'transition-[scale,rotate,box-shadow] duration-200 ease-[cubic-bezier(.32,.72,0,1)]',
        lifted && 'rotate-[1.2deg] scale-[1.03] cursor-grabbing shadow-xl data-[dropping]:scale-100 data-[dropping]:rotate-0 data-[dropping]:shadow-xs',
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[13px] leading-5 font-medium break-words">{card.name}</p>
        {grip}
        {actions}
      </div>
      {category || priority > 0 || card.tags.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {priority > 0 ? <StatusBadge tone={priorityTone(priority)}>{`P${priority}`}</StatusBadge> : null}
          {category ? <StatusBadge>{category}</StatusBadge> : null}
          {card.tags.map((tag) => (
            <span key={tag} className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-[11px]">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {card.owner || due ? (
        <div className="text-muted-foreground mt-2.5 flex items-center gap-3 text-xs">
          {card.owner ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{card.owner}</span>
            </span>
          ) : null}
          {due ? (
            // Overdue is said in words and with its own icon, not by the red alone
            <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'text-danger')}>
              {overdue ? <CircleAlert className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
              {due}
              {overdue ? <span className="font-medium">{t('已逾期')}</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface CardActionsProps {
  card: Row
  /** Absent without the edit permission */
  onEdit?: (card: Row) => void
  /** Absent without the delete permission */
  onDelete?: (card: Row) => Promise<void>
}

/** Edit / delete buttons; key and pointer events stop here so pressing them never starts a drag */
function CardActions({ card, onEdit, onDelete }: CardActionsProps) {
  const { t } = useTranslation()
  if (!onEdit && !onDelete) return null
  return (
    <div
      className="-mt-1 -mr-1.5 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 max-md:opacity-100"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {onEdit ? (
        <Button variant="ghost" size="icon" className="text-muted-foreground size-6" aria-label={t('编辑')} onClick={() => onEdit(card)}>
          <Pencil />
        </Button>
      ) : null}
      {onDelete ? (
        <ConfirmAction
          title={t('确定删除卡片「{{name}}」？', { name: card.name })}
          description="删除后不可恢复。"
          confirmText="删除"
          onConfirm={() => onDelete(card)}
        >
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-danger size-6" aria-label={t('删除')}>
            <Trash2 />
          </Button>
        </ConfirmAction>
      ) : null}
    </div>
  )
}

interface SortableCardProps extends CardActionsProps {
  today: string
  /** Dragging needs the edit permission */
  draggable: boolean
}

function SortableCard({ card, today, draggable, onEdit, onDelete }: SortableCardProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
    data: { type: 'card', card } satisfies CardDragData,
    disabled: !draggable,
  })
  // The pointer drags the whole card; the keyboard drags through the grip button (a card holding the edit / delete
  // buttons can't itself be a button). Read-only cards (no edit permission) have no grip.
  const grip = draggable ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      aria-roledescription={t('可拖拽卡片')}
      aria-label={t('拖动卡片「{{name}}」', { name: card.name })}
      className="text-muted-foreground hover:text-foreground -mt-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:opacity-100"
    >
      <GripVertical className="size-3.5" />
    </button>
  ) : null
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Key presses reach these listeners by bubbling up from the grip, which dnd-kit checks is the activator
      {...(draggable ? listeners : {})}
      className={cn('group/card relative rounded-lg select-none', draggable && 'cursor-grab touch-manipulation', isDragging && 'z-10')}
    >
      <div className={cn(isDragging && 'invisible')}>
        <CardBody card={card} today={today} grip={grip} actions={<CardActions card={card} onEdit={onEdit} onDelete={onDelete} />} />
      </div>
      {isDragging ? <div className="border-primary/35 bg-brand-soft absolute inset-0 rounded-lg border border-dashed" /> : null}
    </div>
  )
}

// ─── Columns ──────────────────────────────────────────────────────────
interface ColumnProps extends Omit<SortableCardProps, 'card'> {
  column: (typeof COLUMNS)[number]
  cards: Row[]
  /** The dragged card is in this column */
  highlighted: boolean
  /** Absent without the add permission */
  onAdd?: (status: Status) => void
  /** Collapse back to a rail (the collapsible column only) */
  onCollapse?: () => void
}

function Column({ column, cards, highlighted, today, draggable, onAdd, onEdit, onDelete, onCollapse }: ColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: columnDndId(column.status),
    data: { type: 'column', status: column.status } satisfies ColumnDropData,
  })
  const active = highlighted || isOver
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-muted/55 dark:bg-muted/35 flex w-[288px] shrink-0 flex-col rounded-xl transition-[background-color,box-shadow] duration-200',
        active && 'bg-brand-soft ring-primary/30 ring-1 ring-inset',
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StatusBadge tone={column.tone} variant="plain" dot className="min-w-0 flex-1 text-[13px] font-semibold">
          {column.label}
        </StatusBadge>
        <span className="bg-background text-muted-foreground ring-border inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium tabular-nums ring-1">
          {cards.length}
        </span>
        {onCollapse ? (
          <Button variant="ghost" size="icon" className="text-muted-foreground -mr-1 size-6" aria-label={t('收起')} onClick={onCollapse}>
            <ChevronsLeftRight />
          </Button>
        ) : null}
      </div>

      <div className="flex max-h-[calc(100dvh-280px)] min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-0.5 pb-1">
        <SortableContext items={cards.map((c) => cardDndId(c.id))} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} today={today} draggable={draggable} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        {cards.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-xs transition-colors',
              active && 'border-primary/50 text-primary',
            )}
          >
            {draggable ? t('拖拽卡片到此处') : t('暂无卡片')}
          </div>
        ) : null}
      </div>

      {onAdd ? (
        <div className="p-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 w-full justify-start"
            onClick={() => onAdd(column.status)}
          >
            <Plus />
            {t('添加卡片')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

interface CollapsedColumnProps {
  column: (typeof COLUMNS)[number]
  count: number
  onExpand: () => void
}

/** A collapsed column: a narrow rail with the label and count; still a drop target (the card goes to its end) */
function CollapsedColumn({ column, count, onExpand }: CollapsedColumnProps) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: columnDndId(column.status),
    data: { type: 'column', status: column.status } satisfies ColumnDropData,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onExpand}
      aria-label={t('展开「{{name}}」', { name: t(column.label) })}
      className={cn(
        'bg-muted/55 dark:bg-muted/35 text-muted-foreground hover:text-foreground flex min-h-40 w-11 shrink-0 flex-col items-center gap-2 rounded-xl py-3 transition-[background-color,box-shadow,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isOver && 'bg-brand-soft text-primary ring-primary/30 ring-1 ring-inset',
      )}
    >
      <ChevronsLeftRight className="size-4" />
      <span className="text-[11px] font-medium tabular-nums">{count}</span>
      <span className="text-[13px] font-semibold [writing-mode:vertical-rl]">{t(column.label)}</span>
    </button>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3">
      {[3, 2, 4].map((n, i) => (
        <div key={i} className="bg-muted/55 dark:bg-muted/35 w-[288px] shrink-0 space-y-2 rounded-xl p-3">
          <Skeleton className="mb-3 h-4 w-24" />
          {Array.from({ length: n }).map((_, j) => (
            <Skeleton key={j} className="h-[76px] w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────
/** Most records the board loads (the list endpoint's page cap) */
const MAX_CARDS = 200

export default function KanbanPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  const [board, setBoard] = useState<Board>(() => groupByStatus([]))
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [activeCard, setActiveCard] = useState<Row | null>(null)
  /** The board when the drag started: the rollback target */
  const dragSnapshot = useRef<Board | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const form = useForm<FormValues>({ defaultValues: emptyValues('todo') })

  // Screen-reader instructions and announcements in the UI language (dnd-kit's defaults are English and name ids)
  const cardName = (data: Data | undefined) => (isCardDragData(data) ? data.card.name : '')
  const placeOf = (over: Over | null) => {
    if (!over) return null
    const data = over.data.current
    const status = isCardDragData(data) ? statusOf(data.card) : isColumnDropData(data) ? data.status : null
    const column = COLUMNS.find((c) => c.status === status)
    return column ? t(column.label) : null
  }
  const accessibility: DndContextProps['accessibility'] = {
    screenReaderInstructions: { draggable: t('按空格或回车拿起卡片，用方向键移动，再按空格或回车放下，按 Esc 取消。') },
    announcements: {
      onDragStart: ({ active }) => t('已拿起卡片「{{name}}」', { name: cardName(active.data.current) }),
      onDragOver: ({ active, over }) => {
        const place = placeOf(over)
        return place
          ? t('「{{name}}」移到「{{column}}」列', { name: cardName(active.data.current), column: place })
          : t('「{{name}}」不在任何列上', { name: cardName(active.data.current) })
      },
      onDragEnd: ({ active, over }) => {
        const place = placeOf(over)
        return place
          ? t('已放下「{{name}}」，位于「{{column}}」列', { name: cardName(active.data.current), column: place })
          : t('已放下「{{name}}」', { name: cardName(active.data.current) })
      },
      onDragCancel: ({ active }) => t('已取消拖动，「{{name}}」回到原位', { name: cardName(active.data.current) }),
    },
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long-press 200 ms before dragging so the board still scrolls natively
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // The skeleton shows on the first load only; refreshes after a save run silently
  const fetchBoard = useCallback(
    () =>
      getItems({ per_page: MAX_CARDS, sort_field: 'board_order', sort_dir: 'asc' })
        .then((res) => {
          setBoard(groupByStatus(res.items))
          setTotal(res.total)
        })
        .catch((err: unknown) => toast.apiError(err, '加载失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  // ── CRUD ─────────────────────────────────────────────────
  const openCreate = (status: Status) => {
    setEditing(null)
    form.reset(emptyValues(status))
    setFormOpen(true)
  }
  const openEdit = (card: Row) => {
    setEditing(card)
    form.reset(toFormValues(card))
    setFormOpen(true)
  }

  const submit = async (values: FormValues) => {
    // A new card, or a card whose status changed in the dialog, goes to the end of its column
    const append = { ...values, board_order: nextBoardOrder(board[values.status]) }
    try {
      if (editing) {
        await updateItem(editing.id, statusOf(editing) === values.status ? values : append)
        toast.success('更新成功')
      } else {
        await createItem(append)
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchBoard()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (card: Row) => {
    try {
      await deleteItem(card.id)
      toast.success('删除成功')
      fetchBoard()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── Drag and drop ────────────────────────────────────────
  const handleDragStart = ({ active }: DragStartEvent) => {
    if (!isCardDragData(active.data.current)) return
    dragSnapshot.current = board
    setActiveCard(active.data.current.card)
  }

  // Across columns: the card joins the hovered column while dragging (above / below the hovered card); within a
  // column SortableContext animates the shift. The collapsed rail takes the card on drop instead (it has no list).
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !isCardDragData(active.data.current)) return
    const cardId = parseCardDndId(active.id)
    setBoard((prev) => {
      const src = columnOf(prev, cardId)
      const overIsCard = isCardDndId(over.id)
      const dst = overIsCard ? columnOf(prev, parseCardDndId(over.id)) : isColumnDropData(over.data.current) ? over.data.current.status : null
      if (!src || !dst || src === dst || (dst === COLLAPSIBLE && !expanded)) return prev
      const card = prev[src].find((c) => c.id === cardId)
      if (!card) return prev
      let insertAt = prev[dst].length
      if (overIsCard) {
        const overIndex = prev[dst].findIndex((c) => c.id === parseCardDndId(over.id))
        const translated = active.rect.current.translated
        const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2
        insertAt = overIndex + (below ? 1 : 0)
      }
      const target = [...prev[dst]]
      target.splice(insertAt, 0, { ...card, status: dst })
      return { ...prev, [src]: prev[src].filter((c) => c.id !== cardId), [dst]: target }
    })
  }

  const handleDragCancel = () => {
    if (dragSnapshot.current) setBoard(dragSnapshot.current)
    dragSnapshot.current = null
    setActiveCard(null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const snapshot = dragSnapshot.current
    dragSnapshot.current = null
    setActiveCard(null)
    if (!snapshot || !isCardDragData(active.data.current)) return
    if (!over) {
      setBoard(snapshot)
      return
    }

    const cardId = parseCardDndId(active.id)
    const current = columnOf(board, cardId)
    if (!current) return
    let next = board
    if (isCardDndId(over.id)) {
      // Within a column: move to the hovered card's slot
      const from = board[current].findIndex((c) => c.id === cardId)
      const to = board[current].findIndex((c) => c.id === parseCardDndId(over.id))
      if (to !== -1 && from !== to) next = { ...board, [current]: arrayMove(board[current], from, to) }
    } else if (isColumnDropData(over.data.current) && over.data.current.status !== current) {
      // Dropped on a column the card has not joined while dragging (the collapsed rail): append to it
      const dst = over.data.current.status
      const card = board[current].find((c) => c.id === cardId)
      if (card) next = { ...board, [current]: board[current].filter((c) => c.id !== cardId), [dst]: [...board[dst], { ...card, status: dst }] }
    }
    if (orderSignature(next) === orderSignature(snapshot)) {
      setBoard(snapshot)
      return
    }

    // Save the columns whose order changed: the card's old column and its new one (the same column for a move within it)
    const changed = new Set<Status>([columnOf(snapshot, cardId) ?? current, columnOf(next, cardId) ?? current])
    const payload: DemoRecordReorderBody = []
    for (const status of changed) {
      next = { ...next, [status]: next[status].map((c, index) => ({ ...c, board_order: index })) }
      payload.push(...next[status].map((c, index) => ({ id: c.id, board_order: index, status })))
    }
    setBoard(next)
    reorder(payload).catch((err: unknown) => {
      toast.apiError(err, '保存顺序失败')
      setBoard(snapshot)
    })
  }

  const activeColumn = activeCard ? columnOf(board, activeCard.id) : null
  const cardCount = COLUMNS.reduce((sum, { status }) => sum + board[status].length, 0)
  const today = formatDate(new Date().toISOString())
  const cardProps = {
    today,
    draggable: canEdit,
    onAdd: canAdd ? openCreate : undefined,
    onEdit: canEdit ? openEdit : undefined,
    onDelete: canDelete ? remove : undefined,
  }

  return (
    <div>
      <PageHeader
        title="看板"
        description={
          loading
            ? undefined
            : total > cardCount
              ? t('显示前 {{shown}} 张卡片，共 {{count}} 张', { shown: cardCount, count: total })
              : t('{{count}} 张卡片', { count: cardCount })
        }
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={() => openCreate('todo')}>
              <Plus />
              {t('新增卡片')}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <BoardSkeleton />
      ) : (
        <DndContext
          accessibility={accessibility}
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
            <div className="flex w-max items-start gap-3">
              {COLUMNS.map((column) =>
                column.status === COLLAPSIBLE && !expanded ? (
                  <CollapsedColumn key={column.status} column={column} count={board[column.status].length} onExpand={() => setExpanded(true)} />
                ) : (
                  <Column
                    key={column.status}
                    column={column}
                    cards={board[column.status]}
                    highlighted={activeColumn === column.status}
                    onCollapse={column.status === COLLAPSIBLE ? () => setExpanded(false) : undefined}
                    {...cardProps}
                  />
                ),
              )}
            </div>
          </div>
          {/* Portal to body: a transform on a content ancestor (the page transition) would misplace the fixed overlay */}
          {createPortal(
            <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
              {activeCard ? (
                <div className="w-[272px]">
                  <CardBody card={activeCard} today={today} lifted />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑卡片' : '新增卡片'} form={form} onSubmit={submit}>
        <FormInput control={form.control} name="name" label="名称" rules={{ required: '此项必填' }} />
        <FormGrid>
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '此项必填' }} />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '此项必填' }} />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormNumber control={form.control} name="priority" label="优先级" step={1} min={0} />
          <FormDate control={form.control} name="end_date" label="截止日期" />
        </FormGrid>
        <FormTags control={form.control} name="tags" label="标签" placeholder="输入后回车添加标签" />
        <FormTextarea control={form.control} name="description" label="描述" rows={3} />
      </FormDialog>
    </div>
  )
}
