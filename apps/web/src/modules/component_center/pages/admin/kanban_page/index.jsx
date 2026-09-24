import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Typography,
  Button,
  Modal,
  Form,
  Toast,
  Tag,
  Dropdown,
  Spin,
  Empty,
} from '@douyinfe/semi-ui'
import {
  IconPlus,
  IconMore,
  IconDelete,
  IconEdit,
  IconUser,
  IconCalendar,
  IconAlertTriangle,
} from '@douyinfe/semi-icons'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  getKanbanBoards,
  createKanbanBoard,
  updateKanbanBoard,
  deleteKanbanBoard,
  createKanbanCard,
  updateKanbanCard,
  deleteKanbanCard,
  reorderKanbanCards,
} from '@/modules/component_center/api/kanban_page'

const { Title, Paragraph, Text } = Typography

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
}

const PRIORITY_META = {
  urgent: { label: '紧急', color: 'red' },
  high:   { label: '高',   color: 'orange' },
  medium: { label: '中',   color: 'blue' },
  low:    { label: '低',   color: 'grey' },
}

const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#9254DE', '#FF4D4F', '#8c8c8c']

// ─── helpers ──────────────────────────────────────────────────────────
function cardDndId(id) { return `card-${id}` }
function boardDndId(id) { return `board-${id}` }
function parseCardDndId(dndId) { return Number(String(dndId).replace('card-', '')) }
function parseBoardDndId(dndId) { return Number(String(dndId).replace('board-', '')) }

function formatDate(str) {
  if (!str) return null
  return str.slice(0, 10)
}

function splitTags(str) {
  if (!str) return []
  return str.split(',').map((s) => s.trim()).filter(Boolean)
}

function tagsToString(arr) {
  if (!arr) return ''
  if (Array.isArray(arr)) return arr.join(',')
  return arr
}

// ─── KanbanCard ───────────────────────────────────────────────────────
function KanbanCardItem({ card, onEdit, onDelete, isDragOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardDndId(card.id),
    data: { type: 'card', card },
    disabled: isDragOverlay,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const pm = PRIORITY_META[card.priority] || PRIORITY_META.medium
  const tags = splitTags(card.tags)

  const inner = (
    <div
      style={{
        background: 'var(--semi-color-bg-0)',
        border: '1px solid var(--semi-color-border)',
        borderRadius: 6,
        padding: '10px 12px',
        cursor: 'default',
        userSelect: 'none',
        boxShadow: isDragOverlay
          ? '0 8px 24px rgba(0,0,0,.18)'
          : '0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      {/* title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
        {/* drag handle – only bind dnd listeners here, not on the whole card */}
        {!isDragOverlay && (
          <span
            {...listeners}
            style={{
              cursor: 'grab',
              flexShrink: 0,
              paddingTop: 2,
              fontSize: 14,
              lineHeight: '20px',
              color: 'var(--semi-color-text-3)',
              touchAction: 'none',
            }}
            title="拖拽"
          >
            ⠿
          </span>
        )}
        <Text strong style={{ fontSize: 13, lineHeight: '20px', flex: 1 }}>
          {card.title}
        </Text>
        {!isDragOverlay && (
          <Dropdown
            trigger="click"
            position="bottomRight"
            clickToHide
            render={
              <Dropdown.Menu>
                <Dropdown.Item
                  icon={<IconEdit />}
                  onClick={() => {
                    setTimeout(() => onEdit(card), 0)
                  }}
                >
                  编辑
                </Dropdown.Item>
                <Dropdown.Item
                  icon={<IconDelete />}
                  type="danger"
                  onClick={() => {
                    setTimeout(() => onDelete(card), 0)
                  }}
                >
                  删除
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <Button
              icon={<IconMore />}
              size="small"
              theme="borderless"
              type="tertiary"
              style={{ flexShrink: 0, marginTop: -2 }}
            />
          </Dropdown>
        )}
      </div>

      {/* priority + tags */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Tag size="small" color={pm.color}>{pm.label}</Tag>
        {tags.map((t) => (
          <Tag
            key={t}
            size="small"
            color="white"
            style={{ border: '1px solid var(--semi-color-border)' }}
          >
            {t}
          </Tag>
        ))}
      </div>

      {/* assignee / due_date */}
      {(card.assignee || card.due_date) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
          {card.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconUser size="small" style={{ color: 'var(--semi-color-text-2)' }} />
              <Text type="tertiary" size="small">{card.assignee}</Text>
            </div>
          )}
          {card.due_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconCalendar size="small" style={{ color: 'var(--semi-color-text-2)' }} />
              <Text type="tertiary" size="small">{formatDate(card.due_date)}</Text>
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (isDragOverlay) return inner

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {inner}
    </div>
  )
}

// ─── DroppableArea (inner card area of a column) ──────────────────────
function DroppableArea({ boardId, cards, onEditCard, onDeleteCard }) {
  const { setNodeRef, isOver } = useDroppable({
    id: boardDndId(boardId),
    data: { type: 'board', boardId },
  })

  const sortableIds = cards.map((c) => cardDndId(c.id))

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        padding: '0 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 64,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 280px)',
        background: isOver ? 'var(--semi-color-primary-light-default)' : 'transparent',
        borderRadius: 4,
        transition: 'background .15s',
      }}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        {cards.map((card) => (
          <KanbanCardItem
            key={card.id}
            card={card}
            onEdit={onEditCard}
            onDelete={onDeleteCard}
          />
        ))}
      </SortableContext>

      {cards.length === 0 && (
        <div
          style={{
            border: `2px dashed ${isOver ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
            borderRadius: 6,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color .15s',
          }}
        >
          <Text type="quaternary" size="small">拖拽卡片到此处</Text>
        </div>
      )}
    </div>
  )
}

// ─── KanbanColumn ─────────────────────────────────────────────────────
function KanbanColumn({ board, onEditBoard, onDeleteBoard, onAddCard, onEditCard, onDeleteCard }) {
  const cards = board.cards || []
  const wip = board.wip_limit || 0
  const warnWip = wip > 0 && cards.length >= wip

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--semi-color-fill-0)',
        borderRadius: 8,
        paddingBottom: 4,
      }}
    >
      {/* column header */}
      <div style={{ padding: '12px 12px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: board.color || '#4080FF',
            flexShrink: 0,
          }}
        />
        <Text strong style={{ flex: 1, fontSize: 14 }}>{board.title}</Text>
        <Tag
          size="small"
          color="white"
          style={{ border: '1px solid var(--semi-color-border)', fontWeight: 500 }}
        >
          {cards.length}{wip > 0 ? `/${wip}` : ''}
        </Tag>
        <Dropdown
          trigger="click"
          position="bottomRight"
          clickToHide
          render={
            <Dropdown.Menu>
              <Dropdown.Item
                icon={<IconEdit />}
                onClick={() => {
                  setTimeout(() => onEditBoard(board), 0)
                }}
              >
                编辑列
              </Dropdown.Item>
              <Dropdown.Item
                icon={<IconDelete />}
                type="danger"
                onClick={() => {
                  setTimeout(() => onDeleteBoard(board), 0)
                }}
              >
                删除列
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Button icon={<IconMore />} size="small" theme="borderless" type="tertiary" />
        </Dropdown>
      </div>

      {/* WIP warning */}
      {warnWip && (
        <div style={{ margin: '0 12px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconAlertTriangle size="small" style={{ color: '#FA8C16' }} />
          <Text size="small" style={{ color: '#FA8C16' }}>已达 WIP 限制（{wip}）</Text>
        </div>
      )}

      {/* droppable card area */}
      <DroppableArea
        boardId={board.id}
        cards={cards}
        onEditCard={onEditCard}
        onDeleteCard={onDeleteCard}
      />

      {/* add card button */}
      <div style={{ padding: '6px 8px 4px' }}>
        <Button
          icon={<IconPlus />}
          theme="borderless"
          type="tertiary"
          size="small"
          style={{ width: '100%', justifyContent: 'flex-start' }}
          onClick={() => onAddCard(board.id)}
        >
          添加卡片
        </Button>
      </div>
    </div>
  )
}

// ─── ColorPicker ──────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const sel = (value || COLOR_PALETTE[0]).toUpperCase()

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {COLOR_PALETTE.map((c) => {
        const cUp = c.toUpperCase()
        const isSelected = sel === cUp
        return (
          <div
            key={c}
            onClick={() => onChange(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: c,
              cursor: 'pointer',
              boxSizing: 'border-box',
              border: isSelected ? '2px solid #fff' : '2px solid transparent',
              outline: isSelected ? `2px solid ${c}` : 'none',
              transition: 'outline .12s',
            }}
          />
        )
      })}
      <Text size="small" type="tertiary" style={{ marginLeft: 4 }}>{value || COLOR_PALETTE[0]}</Text>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function KanbanPage() {
  const isMobile = useIsMobile()
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCard, setActiveCard] = useState(null) // card object being dragged

  // board modal
  const [boardVisible, setBoardVisible] = useState(false)
  const [boardEditing, setBoardEditing] = useState(null)
  const [boardSubmitting, setBoardSubmitting] = useState(false)
  const [boardColor, setBoardColor] = useState(COLOR_PALETTE[0])
  const boardFormApi = useRef(null)

  // card modal
  const [cardVisible, setCardVisible] = useState(false)
  const [cardEditing, setCardEditing] = useState(null)
  const [cardDefaultBoardId, setCardDefaultBoardId] = useState(null)
  const [cardSubmitting, setCardSubmitting] = useState(false)
  const cardFormApi = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ── data ───────────────────────────────────────────────
  const fetchBoards = useCallback(() => {
    setLoading(true)
    getKanbanBoards()
      .then((res) => setBoards(res || []))
      .catch(() => Toast.error('加载看板失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchBoards() }, [fetchBoards])

  // ── find helpers ───────────────────────────────────────
  const findCardInBoards = useCallback((cardId, fromBoards) => {
    const src = fromBoards || boards
    for (const b of src) {
      const card = b.cards?.find((c) => c.id === cardId)
      if (card) return { board: b, card }
    }
    return null
  }, [boards])

  // ── board CRUD ─────────────────────────────────────────
  const openCreateBoard = () => {
    setBoardEditing(null)
    setBoardColor(COLOR_PALETTE[0])
    setBoardVisible(true)
  }
  const openEditBoard = (board) => {
    setBoardEditing(board)
    setBoardColor(board?.color || COLOR_PALETTE[0])
    setBoardVisible(true)
  }

  const handleBoardOk = () => {
    boardFormApi.current.validate().then((values) => {
      setBoardSubmitting(true)
      const payload = {
        title: (values.title || '').trim(),
        board_code: (values.board_code || '').trim(),
        color: boardColor || values.color || '#4080FF',
        wip_limit: Number(values.wip_limit) || 0,
        is_active: values.is_active !== false,
      }
      const req = boardEditing
        ? updateKanbanBoard(boardEditing.id, payload)
        : createKanbanBoard(payload)
      req
        .then(() => { Toast.success(boardEditing ? '列已更新' : '列已创建'); setBoardVisible(false); fetchBoards() })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setBoardSubmitting(false))
    })
  }

  const handleDeleteBoard = (board) => {
    Modal.confirm({
      title: `确定删除列「${board.title}」？`,
      content: '该列下所有卡片将同步删除，此操作不可恢复。',
      type: 'warning',
      onOk: () =>
        deleteKanbanBoard(board.id)
          .then(() => { Toast.success('列已删除'); fetchBoards() })
          .catch((err) => Toast.error(err?.error || '删除失败')),
    })
  }

  // ── card CRUD ──────────────────────────────────────────
  const openCreateCard = (boardId) => { setCardEditing(null); setCardDefaultBoardId(boardId); setCardVisible(true) }
  const openEditCard = (card) => { setCardEditing(card); setCardDefaultBoardId(null); setCardVisible(true) }

  const handleCardOk = () => {
    cardFormApi.current.validate().then((values) => {
      setCardSubmitting(true)
      let dueDate = null
      if (values.due_date) {
        if (typeof values.due_date === 'string') {
          dueDate = values.due_date
        } else if (values.due_date instanceof Date) {
          dueDate = values.due_date.toISOString().slice(0, 10)
        } else if (values.due_date?.format) {
          dueDate = values.due_date.format('YYYY-MM-DD')
        }
      }
      const payload = {
        title: (values.title || '').trim(),
        board_id: values.board_id,
        card_code: (values.card_code || '').trim(),
        priority: values.priority || 'medium',
        assignee: (values.assignee || '').trim(),
        due_date: dueDate,
        tags: tagsToString(values.tags),
        description: (values.description || '').trim(),
      }
      if (cardEditing) {
        delete payload.card_code
      }
      const req = cardEditing
        ? updateKanbanCard(cardEditing.id, payload)
        : createKanbanCard(payload)
      req
        .then(() => { Toast.success(cardEditing ? '卡片已更新' : '卡片已创建'); setCardVisible(false); fetchBoards() })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setCardSubmitting(false))
    })
  }

  const handleDeleteCard = (card) => {
    Modal.confirm({
      title: `确定删除卡片「${card.title}」？`,
      type: 'warning',
      onOk: () =>
        deleteKanbanCard(card.id)
          .then(() => { Toast.success('卡片已删除'); fetchBoards() })
          .catch((err) => Toast.error(err?.error || '删除失败')),
    })
  }

  // ── dnd handlers ───────────────────────────────────────
  const handleDragStart = ({ active }) => {
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card)
    }
  }

  const handleDragOver = ({ active, over }) => {
    if (!over || active.data.current?.type !== 'card') return

    const activeCardId = parseCardDndId(active.id)

    // determine destination board id
    let destBoardId
    if (over.data.current?.type === 'board') {
      destBoardId = over.data.current.boardId
    } else if (over.data.current?.type === 'card') {
      const overCardId = parseCardDndId(over.id)
      for (const b of boards) {
        if (b.cards?.find((c) => c.id === overCardId)) {
          destBoardId = b.id
          break
        }
      }
    }
    if (!destBoardId) return

    // find source board
    let srcBoardId
    for (const b of boards) {
      if (b.cards?.find((c) => c.id === activeCardId)) {
        srcBoardId = b.id
        break
      }
    }
    if (!srcBoardId || srcBoardId === destBoardId) return

    // optimistically move card across columns
    setBoards((prev) => {
      const next = prev.map((b) => ({ ...b, cards: [...(b.cards || [])] }))
      const src = next.find((b) => b.id === srcBoardId)
      const dst = next.find((b) => b.id === destBoardId)
      if (!src || !dst) return prev
      const idx = src.cards.findIndex((c) => c.id === activeCardId)
      if (idx === -1) return prev
      const [moved] = src.cards.splice(idx, 1)
      moved.board_id = destBoardId
      dst.cards.push(moved)
      return next
    })
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveCard(null)
    if (!over || active.data.current?.type !== 'card') return

    const activeCardId = parseCardDndId(active.id)

    // find current board of active card (after DragOver mutations)
    let srcBoard = null
    for (const b of boards) {
      if (b.cards?.find((c) => c.id === activeCardId)) {
        srcBoard = b
        break
      }
    }
    if (!srcBoard) return

    // reorder within same column
    let nextBoards = boards
    if (over.data.current?.type === 'card') {
      const overCardId = parseCardDndId(over.id)
      const activeIdx = srcBoard.cards.findIndex((c) => c.id === activeCardId)
      const overIdx = srcBoard.cards.findIndex((c) => c.id === overCardId)
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        nextBoards = boards.map((b) => {
          if (b.id !== srcBoard.id) return b
          return { ...b, cards: arrayMove([...b.cards], activeIdx, overIdx) }
        })
        setBoards(nextBoards)
      }
    }

    // persist reorder
    const payload = []
    nextBoards.forEach((b) => {
      ;(b.cards || []).forEach((c, idx) => {
        payload.push({ id: c.id, board_id: b.id, sort_order: idx })
      })
    })
    reorderKanbanCards(payload).catch(() => Toast.error('保存顺序失败'))
  }

  // ── render ─────────────────────────────────────────────
  const boardOptions = boards.map((b) => ({ value: b.id, label: b.title }))

  return (
    <div style={{ padding: 0 }}>
      {/* 标题栏 */}
      <div style={{ ...CARD_STYLE, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title heading={5} style={{ marginBottom: 4 }}>拖拽看板页</Title>
            <Paragraph type="tertiary" size="small" style={{ margin: 0 }}>
              支持跨列拖拽排序，适用于任务 / 工单 / 需求的状态流转管理场景。
            </Paragraph>
          </div>
          <Button icon={<IconPlus />} theme="solid" onClick={openCreateBoard}>
            新建列
          </Button>
        </div>
      </div>

      {/* 看板区 */}
      <div style={{ ...CARD_STYLE, padding: 16, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : boards.length === 0 ? (
          <Empty description="暂无看板列，点击「新建列」开始" style={{ padding: 60 }} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 'max-content' }}>
              {boards.map((board) => (
                <KanbanColumn
                  key={board.id}
                  board={board}
                  onEditBoard={openEditBoard}
                  onDeleteBoard={handleDeleteBoard}
                  onAddCard={openCreateCard}
                  onEditCard={openEditCard}
                  onDeleteCard={handleDeleteCard}
                />
              ))}
            </div>

            <DragOverlay>
              {activeCard ? (
                <KanbanCardItem
                  card={activeCard}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  isDragOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* 新建/编辑列 Modal */}
      <Modal
        title={boardEditing ? '编辑列' : '新建列'}
        visible={boardVisible}
        onOk={handleBoardOk}
        onCancel={() => setBoardVisible(false)}
        okButtonProps={{ loading: boardSubmitting }}
        afterClose={() => boardFormApi.current?.reset()}
        width={isMobile ? '95vw' : 460}
        keepDOM={false}
      >
        <Form
          key={boardEditing ? `eb-${boardEditing.id}` : 'nb'}
          initValues={
            boardEditing
              ? {
                  title: boardEditing.title,
                  board_code: boardEditing.board_code,
                  color: boardColor || boardEditing.color || '#4080FF',
                  wip_limit: boardEditing.wip_limit || 0,
                  is_active: boardEditing.is_active !== false,
                }
              : { color: boardColor, wip_limit: 0, is_active: true }
          }
          getFormApi={(api) => { boardFormApi.current = api }}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input
            field="title"
            label="列标题"
            placeholder="请输入列标题"
            rules={[{ required: true, message: '请输入列标题' }]}
          />
          <Form.Input
            field="board_code"
            label="列编码"
            placeholder="如 todo / in_progress"
            rules={[{ required: true, message: '请输入列编码' }]}
          />
          <Form.Input
            field="wip_limit"
            label="WIP 限制"
            type="number"
            placeholder="0 表示不限制"
          />
          <Form.Switch field="is_active" label="启用" />
          <Form.Input field="color" style={{ display: 'none' }} />
          <Form.Slot label="列颜色">
            <ColorPicker
              value={boardColor}
              onChange={(c) => {
                setBoardColor(c)
                boardFormApi.current?.setValue('color', c)
              }}
            />
          </Form.Slot>
        </Form>
      </Modal>

      {/* 新建/编辑卡片 Modal */}
      <Modal
        title={cardEditing ? '编辑卡片' : '新建卡片'}
        visible={cardVisible}
        onOk={handleCardOk}
        onCancel={() => setCardVisible(false)}
        okButtonProps={{ loading: cardSubmitting }}
        afterClose={() => cardFormApi.current?.reset()}
        width={isMobile ? '95vw' : 520}
        keepDOM={false}
      >
        <Form
          key={cardEditing ? `ec-${cardEditing.id}` : `nc-${cardDefaultBoardId}`}
          initValues={
            cardEditing
              ? {
                  title: cardEditing.title,
                  card_code: cardEditing.card_code,
                  board_id: cardEditing.board_id,
                  priority: cardEditing.priority || 'medium',
                  assignee: cardEditing.assignee || '',
                  due_date: cardEditing.due_date ? cardEditing.due_date.slice(0, 10) : undefined,
                  tags: splitTags(cardEditing.tags),
                  description: cardEditing.description || '',
                }
              : { board_id: cardDefaultBoardId, priority: 'medium' }
          }
          getFormApi={(api) => { cardFormApi.current = api }}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input
            field="title"
            label="卡片标题"
            placeholder="请输入卡片标题"
            rules={[{ required: true, message: '请输入卡片标题' }]}
          />
          <Form.Input
            field="card_code"
            label="卡片编码"
            placeholder="留空则自动生成"
            disabled={Boolean(cardEditing)}
          />
          <Form.Select
            field="board_id"
            label="所属列"
            optionList={boardOptions}
            placeholder="请选择所属列"
            rules={[{ required: true, message: '请选择所属列' }]}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="priority"
            label="优先级"
            optionList={[
              { value: 'urgent', label: '紧急' },
              { value: 'high',   label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low',    label: '低' },
            ]}
            style={{ width: '100%' }}
          />
          <Form.Input
            field="assignee"
            label="负责人"
            placeholder="请输入负责人姓名"
          />
          <Form.DatePicker
            field="due_date"
            label="截止日期"
            style={{ width: '100%' }}
            placeholder="请选择截止日期"
            format="yyyy-MM-dd"
            type="date"
          />
          <Form.TagInput
            field="tags"
            label="标签"
            placeholder="输入后回车添加标签"
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="description"
            label="描述"
            placeholder="请输入卡片描述（选填）"
            rows={3}
          />
        </Form>
      </Modal>
    </div>
  )
}
