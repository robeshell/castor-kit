import { useCallback, useEffect, useRef, useState } from 'react'
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
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, CalendarDays, Columns3, MoreHorizontal, Pencil, Plus, Trash2, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import {
  createKanbanBoard,
  createKanbanCard,
  deleteKanbanBoard,
  deleteKanbanCard,
  getKanbanBoards,
  reorderKanbanCards,
  updateKanbanBoard,
  updateKanbanCard,
} from '@/modules/component_center/api/kanban_page'
import EmptyState from '@/shared/components/EmptyState'
import { FormDialog } from '@/shared/components/FormDialog'
import {
  FormCustom,
  FormDate,
  FormGrid,
  FormInput,
  FormNumber,
  FormSelect,
  FormSwitch,
  FormTags,
  FormTextarea,
} from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'

const PRIORITY_META = {
  urgent: { label: '紧急', tone: 'danger' },
  high: { label: '高', tone: 'warning' },
  medium: { label: '中', tone: 'brand' },
  low: { label: '低', tone: 'neutral' },
}
const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

// Column colors are business data persisted to the database (backend default #4080FF), not page styling
const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#06B6D4', '#FF4D4F', '#8C8C8C']
const DEFAULT_COLOR = COLOR_PALETTE[0]

// On drop: the card settles from its "lifted" state back into the placeholder (same spring curve as overlays)
const DROP_EASING = 'cubic-bezier(.32,.72,0,1)'
const dropAnimation = {
  duration: 240,
  easing: DROP_EASING,
  sideEffects: ({ active, dragOverlay }) => {
    active.node.style.opacity = '0'
    const lifted = dragOverlay.node.querySelector('[data-lift]')
    lifted?.setAttribute('data-dropping', '')
    return () => {
      active.node.style.opacity = ''
    }
  },
}

// ─── helpers ──────────────────────────────────────────────────────────
const cardDndId = (id) => `card-${id}`
const boardDndId = (id) => `board-${id}`
const parseCardDndId = (dndId) => Number(String(dndId).replace('card-', ''))
const isCardDndId = (dndId) => String(dndId).startsWith('card-')

function splitTags(str) {
  if (!str) return []
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
function tagsToString(arr) {
  if (!arr) return ''
  if (Array.isArray(arr)) return arr.join(',')
  return arr
}
function boardIdOfCard(boards, cardId) {
  for (const b of boards) {
    if (b.cards?.some((c) => c.id === cardId)) return b.id
  }
  return null
}
function orderSignature(boards) {
  return boards.map((b) => `${b.id}:${(b.cards || []).map((c) => c.id).join(',')}`).join('|')
}
function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Pointer over a card → the card; over empty column space → the column; no pointer (e.g. keyboard drag) → closest corners */
function collisionDetection(args) {
  const hits = pointerWithin(args)
  if (hits.length) {
    const cardHits = hits.filter((h) => isCardDndId(h.id))
    return cardHits.length ? cardHits : hits
  }
  return closestCorners(args)
}

// ─── Card ─────────────────────────────────────────────────────────────
function CardBody({ card, menu, lifted = false }) {
  const pm = PRIORITY_META[card.priority] || PRIORITY_META.medium
  const tags = splitTags(card.tags)
  const due = card.due_date ? card.due_date.slice(0, 10) : ''
  const overdue = due && due < todayStr()
  return (
    <div
      data-lift={lifted ? '' : undefined}
      className={cn(
        'bg-card rounded-lg p-3 text-left shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(15,23,42,0.04)]',
        'transition-[scale,rotate,box-shadow] duration-200 ease-[cubic-bezier(.32,.72,0,1)]',
        lifted &&
          'rotate-[1.2deg] scale-[1.03] cursor-grabbing shadow-[0_0_0_1px_var(--border),0_18px_40px_-12px_rgba(15,23,42,0.35),0_6px_14px_-6px_rgba(15,23,42,0.18)] data-[dropping]:scale-100 data-[dropping]:rotate-0 data-[dropping]:shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(15,23,42,0.04)]',
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[13px] leading-5 font-medium break-words">{card.title}</p>
        {menu}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <StatusBadge tone={pm.tone} dot>
          {pm.label}
        </StatusBadge>
        {tags.map((t) => (
          <span key={t} className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-[11px]">
            {t}
          </span>
        ))}
      </div>
      {card.assignee || due ? (
        <div className="text-muted-foreground mt-2.5 flex items-center gap-3 text-xs">
          {card.assignee ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{card.assignee}</span>
            </span>
          ) : null}
          {due ? (
            <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'text-danger')}>
              <CalendarDays className="size-3.5" />
              {due}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function CardMenu({ card, onEdit, onDelete }) {
  const { t } = useTranslation()
  return (
    <div onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground data-[state=open]:bg-accent -mt-1 -mr-1.5 size-6 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
            aria-label={t('卡片操作')}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuItem onSelect={() => onEdit(card)}>
            <Pencil />
            {t('编辑')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(card)}>
            <Trash2 />
            {t('删除')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SortableCard({ card, onEdit, onDelete }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
    data: { type: 'card', card },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription={t('可拖拽卡片')}
      className={cn(
        'group/card relative cursor-grab touch-manipulation rounded-lg outline-none select-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        isDragging && 'z-10',
      )}
    >
      <div className={cn(isDragging && 'invisible')}>
        <CardBody card={card} menu={<CardMenu card={card} onEdit={onEdit} onDelete={onDelete} />} />
      </div>
      {isDragging ? (
        <div className="border-primary/35 bg-brand-soft absolute inset-0 rounded-lg border border-dashed" />
      ) : null}
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────
function KanbanColumn({ board, highlighted, onEditBoard, onDeleteBoard, onAddCard, onEditCard, onDeleteCard }) {
  const { t } = useTranslation()
  const cards = board.cards || []
  const wip = board.wip_limit || 0
  const warnWip = wip > 0 && cards.length >= wip
  const { setNodeRef, isOver } = useDroppable({ id: boardDndId(board.id), data: { type: 'board', boardId: board.id } })
  const active = highlighted || isOver

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-muted/55 dark:bg-muted/35 flex w-[288px] shrink-0 flex-col rounded-xl transition-[background-color,box-shadow] duration-200',
        active && 'bg-brand-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent)]',
        board.is_active === false && 'opacity-70',
      )}
    >
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: board.color || DEFAULT_COLOR }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{board.title}</span>
          {board.is_active === false ? <StatusBadge>{t('停用')}</StatusBadge> : null}
          <span
            className={cn(
              'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium tabular-nums',
              warnWip ? 'bg-warning-soft text-warning' : 'bg-background text-muted-foreground shadow-[0_0_0_1px_var(--border)]',
            )}
          >
            {cards.length}
            {wip > 0 ? `/${wip}` : ''}
          </span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground -mr-1 size-6" aria-label={t('列操作')}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              <DropdownMenuItem onSelect={() => onEditBoard(board)}>
                <Pencil />
                {t('编辑列')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDeleteBoard(board)}>
                <Trash2 />
                {t('删除列')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {wip > 0 ? (
          <div className="bg-background/80 mt-2.5 h-1 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full transition-[width] duration-300 ease-out', warnWip ? 'bg-warning' : 'bg-brand-gradient')}
              style={{ width: `${Math.min(100, (cards.length / wip) * 100)}%` }}
            />
          </div>
        ) : null}
        {warnWip ? (
          <p className="text-warning mt-2 flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3.5" />
            {t('已达 WIP 限制（{{wip}}）', { wip })}
          </p>
        ) : null}
      </div>

      <div className="flex max-h-[calc(100dvh-300px)] min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-0.5 pb-1">
        <SortableContext items={cards.map((c) => cardDndId(c.id))} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onEdit={onEditCard} onDelete={onDeleteCard} />
          ))}
        </SortableContext>
        {cards.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground flex h-16 items-center justify-center rounded-lg border border-dashed text-xs transition-colors',
              active && 'border-primary/50 text-primary',
            )}
          >
            {t('拖拽卡片到此处')}
          </div>
        ) : null}
      </div>

      <div className="p-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-8 w-full justify-start"
          onClick={() => onAddCard(board.id)}
        >
          <Plus />
          {t('添加卡片')}
        </Button>
      </div>
    </div>
  )
}

// ─── ColorPicker ──────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const { t } = useTranslation()
  const sel = (value || DEFAULT_COLOR).toUpperCase()
  return (
    <div className="flex items-center gap-2.5">
      {COLOR_PALETTE.map((c) => {
        const selected = sel === c.toUpperCase()
        return (
          <button
            key={c}
            type="button"
            aria-label={t('颜色 {{color}}', { color: c })}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            className={cn(
              'ring-offset-background size-6 rounded-full transition-[box-shadow,transform] duration-150 hover:scale-110',
              selected && 'ring-foreground/70 ring-2 ring-offset-2',
            )}
            style={{ background: c }}
          />
        )
      })}
      <span className="text-muted-foreground ml-1 font-mono text-xs">{value || DEFAULT_COLOR}</span>
    </div>
  )
}

// ─── Confirm (controlled) ─────────────────────────────────────────────
function ConfirmDialog({ target, onOpenChange }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const handle = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      await target?.onConfirm()
      onOpenChange(false)
    } catch {
      /* already toasted; keep the dialog open */
    } finally {
      setLoading(false)
    }
  }
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{target?.title}</AlertDialogTitle>
          {target?.description ? <AlertDialogDescription>{target.description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('取消')}</AlertDialogCancel>
          <AlertDialogAction onClick={handle} disabled={loading} className={buttonVariants({ variant: 'destructive' })}>
            {loading ? <Spinner /> : null}
            {t('删除')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

// ─── Main Page ────────────────────────────────────────────────────────
export default function KanbanPage() {
  const { t } = useTranslation()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(null)
  const dragSnapshot = useRef(null)

  const [boardOpen, setBoardOpen] = useState(false)
  const [boardEditing, setBoardEditing] = useState(null)
  const [cardOpen, setCardOpen] = useState(false)
  const [cardEditing, setCardEditing] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const boardForm = useForm({ defaultValues: { title: '', board_code: '', wip_limit: 0, is_active: true, color: DEFAULT_COLOR } })
  const cardForm = useForm({
    defaultValues: { title: '', card_code: '', board_id: null, priority: 'medium', assignee: '', due_date: '', tags: [], description: '' },
  })

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long-press 200 ms before dragging so native list / board scrolling still works
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── data ───────────────────────────────────────────────
  // Show the skeleton on first load only; later refreshes (CRUD, rollback after a failed drag) run silently to avoid flicker
  const fetchBoards = useCallback(() => {
    return getKanbanBoards()
      .then((res) => setBoards(res || []))
      .catch(() => toast.error('加载看板失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  // ── board CRUD ─────────────────────────────────────────
  const openCreateBoard = () => {
    setBoardEditing(null)
    boardForm.reset({ title: '', board_code: '', wip_limit: 0, is_active: true, color: DEFAULT_COLOR })
    setBoardOpen(true)
  }
  const openEditBoard = (board) => {
    setBoardEditing(board)
    boardForm.reset({
      title: board.title,
      board_code: board.board_code,
      wip_limit: board.wip_limit || 0,
      is_active: board.is_active !== false,
      color: board.color || DEFAULT_COLOR,
    })
    setBoardOpen(true)
  }
  const submitBoard = async (values) => {
    const payload = {
      title: (values.title || '').trim(),
      board_code: (values.board_code || '').trim(),
      color: values.color || DEFAULT_COLOR,
      wip_limit: Number(values.wip_limit) || 0,
      is_active: values.is_active !== false,
    }
    try {
      if (boardEditing) await updateKanbanBoard(boardEditing.id, payload)
      else await createKanbanBoard(payload)
      toast.success(boardEditing ? '列已更新' : '列已创建')
      setBoardOpen(false)
      fetchBoards()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }
  const askDeleteBoard = (board) =>
    setConfirmTarget({
      title: t('确定删除列「{{title}}」？', { title: board.title }),
      description: t('该列下所有卡片将同步删除，此操作不可恢复。'),
      onConfirm: async () => {
        try {
          await deleteKanbanBoard(board.id)
          toast.success('列已删除')
          fetchBoards()
        } catch (err) {
          toast.apiError(err, '删除失败')
          throw err
        }
      },
    })

  // ── card CRUD ──────────────────────────────────────────
  const openCreateCard = (boardId) => {
    setCardEditing(null)
    cardForm.reset({ title: '', card_code: '', board_id: boardId, priority: 'medium', assignee: '', due_date: '', tags: [], description: '' })
    setCardOpen(true)
  }
  const openEditCard = (card) => {
    setCardEditing(card)
    cardForm.reset({
      title: card.title,
      card_code: card.card_code || '',
      board_id: card.board_id,
      priority: card.priority || 'medium',
      assignee: card.assignee || '',
      due_date: card.due_date ? card.due_date.slice(0, 10) : '',
      tags: splitTags(card.tags),
      description: card.description || '',
    })
    setCardOpen(true)
  }
  const submitCard = async (values) => {
    const payload = {
      title: (values.title || '').trim(),
      board_id: values.board_id,
      card_code: (values.card_code || '').trim(),
      priority: values.priority || 'medium',
      assignee: (values.assignee || '').trim(),
      due_date: values.due_date || null,
      tags: tagsToString(values.tags),
      description: (values.description || '').trim(),
    }
    if (cardEditing) delete payload.card_code
    try {
      if (cardEditing) await updateKanbanCard(cardEditing.id, payload)
      else await createKanbanCard(payload)
      toast.success(cardEditing ? '卡片已更新' : '卡片已创建')
      setCardOpen(false)
      fetchBoards()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }
  const askDeleteCard = (card) =>
    setConfirmTarget({
      title: t('确定删除卡片「{{title}}」？', { title: card.title }),
      onConfirm: async () => {
        try {
          await deleteKanbanCard(card.id)
          toast.success('卡片已删除')
          fetchBoards()
        } catch (err) {
          toast.apiError(err, '删除失败')
          throw err
        }
      },
    })

  // ── dnd ────────────────────────────────────────────────
  const handleDragStart = ({ active }) => {
    if (active.data.current?.type !== 'card') return
    dragSnapshot.current = boards
    setActiveCard(active.data.current.card)
  }

  // Across columns: move the card into the target column while dragging (above / below the hovered card); within a column SortableContext animates the shift
  const handleDragOver = ({ active, over }) => {
    if (!over || active.data.current?.type !== 'card') return
    const activeId = parseCardDndId(active.id)
    setBoards((prev) => {
      const srcId = boardIdOfCard(prev, activeId)
      const overIsCard = isCardDndId(over.id)
      const dstId = overIsCard ? boardIdOfCard(prev, parseCardDndId(over.id)) : over.data.current?.boardId
      if (srcId == null || dstId == null || srcId === dstId) return prev
      const next = prev.map((b) => ({ ...b, cards: [...(b.cards || [])] }))
      const src = next.find((b) => b.id === srcId)
      const dst = next.find((b) => b.id === dstId)
      const idx = src.cards.findIndex((c) => c.id === activeId)
      const [moved] = src.cards.splice(idx, 1)
      let insertAt = dst.cards.length
      if (overIsCard) {
        const overIdx = dst.cards.findIndex((c) => c.id === parseCardDndId(over.id))
        const translated = active.rect.current.translated
        const below = translated && translated.top > over.rect.top + over.rect.height / 2
        insertAt = overIdx + (below ? 1 : 0)
      }
      dst.cards.splice(insertAt, 0, { ...moved, board_id: dstId })
      return next
    })
  }

  const handleDragCancel = () => {
    if (dragSnapshot.current) setBoards(dragSnapshot.current)
    dragSnapshot.current = null
    setActiveCard(null)
  }

  const handleDragEnd = ({ active, over }) => {
    const snapshot = dragSnapshot.current
    dragSnapshot.current = null
    setActiveCard(null)
    if (active.data.current?.type !== 'card') return
    if (!over) {
      if (snapshot) setBoards(snapshot)
      return
    }

    const activeId = parseCardDndId(active.id)
    let nextBoards = boards
    if (isCardDndId(over.id)) {
      const boardId = boardIdOfCard(boards, activeId)
      const board = boards.find((b) => b.id === boardId)
      const from = board?.cards.findIndex((c) => c.id === activeId) ?? -1
      const to = board?.cards.findIndex((c) => c.id === parseCardDndId(over.id)) ?? -1
      if (from !== -1 && to !== -1 && from !== to) {
        nextBoards = boards.map((b) => (b.id === boardId ? { ...b, cards: arrayMove(b.cards, from, to) } : b))
        setBoards(nextBoards)
      }
    }
    if (snapshot && orderSignature(snapshot) === orderSignature(nextBoards)) return

    const payload = []
    nextBoards.forEach((b) => {
      ;(b.cards || []).forEach((c, idx) => payload.push({ id: c.id, board_id: b.id, sort_order: idx }))
    })
    reorderKanbanCards(payload).catch((err) => {
      toast.apiError(err, '保存顺序失败')
      fetchBoards()
    })
  }

  const boardOptions = boards.map((b) => ({ value: b.id, label: b.title }))
  const activeBoardId = activeCard ? boardIdOfCard(boards, activeCard.id) : null
  const totalCards = boards.reduce((sum, b) => sum + (b.cards?.length || 0), 0)

  return (
    <div>
      <PageHeader
        title="拖拽看板页"
        actions={
          <Button size="sm" variant="brand" onClick={openCreateBoard}>
            <Plus />
            {t('新建列')}
          </Button>
        }
      >
        {!loading && boards.length ? (
          <p className="text-muted-foreground pt-1 text-xs tabular-nums">
            {t('{{boards}} 列 · {{cards}} 张卡片', { boards: boards.length, cards: totalCards })}
          </p>
        ) : null}
      </PageHeader>

      {loading ? (
        <BoardSkeleton />
      ) : boards.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            icon={Columns3}
            title="暂无看板列"
            description="点击「新建列」开始"
            action={
              <Button size="sm" variant="outline" onClick={openCreateBoard}>
                <Plus />
                {t('新建列')}
              </Button>
            }
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-8 md:px-8">
            <div className="flex w-max items-start gap-3">
              {boards.map((board) => (
                <KanbanColumn
                  key={board.id}
                  board={board}
                  highlighted={activeBoardId === board.id}
                  onEditBoard={openEditBoard}
                  onDeleteBoard={askDeleteBoard}
                  onAddCard={openCreateCard}
                  onEditCard={openEditCard}
                  onDeleteCard={askDeleteCard}
                />
              ))}
            </div>
          </div>
          {/* Portal to body: a transform on a content ancestor (page transition) would misplace the fixed-position overlay */}
          {createPortal(
            <DragOverlay dropAnimation={dropAnimation} zIndex={60}>
              {activeCard ? (
                <div className="w-[272px]">
                  <CardBody card={activeCard} lifted />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      )}

      <FormDialog
        open={boardOpen}
        onOpenChange={setBoardOpen}
        title={boardEditing ? '编辑列' : '新建列'}
        form={boardForm}
        onSubmit={submitBoard}
        size="sm"
      >
        <FormInput control={boardForm.control} name="title" label="列标题" placeholder="请输入列标题" rules={{ required: '请输入列标题' }} />
        <FormInput
          control={boardForm.control}
          name="board_code"
          label="列编码"
          placeholder="如 todo / in_progress"
          rules={{ required: '请输入列编码' }}
        />
        <FormNumber control={boardForm.control} name="wip_limit" label="WIP 限制" placeholder="0 表示不限制" min={0} />
        <FormCustom
          control={boardForm.control}
          name="color"
          label="列颜色"
          render={({ value, onChange }) => <ColorPicker value={value} onChange={onChange} />}
        />
        <FormSwitch control={boardForm.control} name="is_active" label="启用" />
      </FormDialog>

      <FormDialog
        open={cardOpen}
        onOpenChange={setCardOpen}
        title={cardEditing ? '编辑卡片' : '新建卡片'}
        form={cardForm}
        onSubmit={submitCard}
      >
        <FormInput control={cardForm.control} name="title" label="卡片标题" placeholder="请输入卡片标题" rules={{ required: '请输入卡片标题' }} />
        <FormGrid>
          <FormInput
            control={cardForm.control}
            name="card_code"
            label="卡片编码"
            placeholder="留空则自动生成"
            disabled={Boolean(cardEditing)}
          />
          <FormSelect
            control={cardForm.control}
            name="board_id"
            label="所属列"
            options={boardOptions}
            placeholder="请选择所属列"
            rules={{ required: '请选择所属列' }}
          />
          <FormSelect control={cardForm.control} name="priority" label="优先级" options={PRIORITY_OPTIONS} />
          <FormInput control={cardForm.control} name="assignee" label="负责人" placeholder="请输入负责人姓名" />
        </FormGrid>
        <FormDate control={cardForm.control} name="due_date" label="截止日期" placeholder="请选择截止日期" />
        <FormTags control={cardForm.control} name="tags" label="标签" placeholder="输入后回车添加标签" />
        <FormTextarea control={cardForm.control} name="description" label="描述" placeholder="请输入卡片描述（选填）" rows={3} />
      </FormDialog>

      <ConfirmDialog target={confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)} />
    </div>
  )
}
