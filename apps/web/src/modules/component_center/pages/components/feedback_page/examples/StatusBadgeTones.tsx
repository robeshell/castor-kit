import StatusBadge, { type StatusTone } from '@/shared/components/StatusBadge'

// Pick the tone by what the status means, not by the color you want
const TONES: { tone: StatusTone; label: string }[] = [
  { tone: 'neutral', label: '草稿' },
  { tone: 'brand', label: '推荐' },
  { tone: 'info', label: '进行中' },
  { tone: 'success', label: '已完成' },
  { tone: 'warning', label: '待审核' },
  { tone: 'danger', label: '失败' },
]

export default function StatusBadgeTones() {
  return (
    <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
      {TONES.map(({ tone, label }) => (
        <div key={tone} className="flex flex-wrap items-center gap-3">
          <code className="text-muted-foreground w-16 font-mono text-xs">{tone}</code>
          {/* soft (default): a tinted pill; the Chinese label is translated by StatusBadge */}
          <StatusBadge tone={tone}>{label}</StatusBadge>
          {/* dot: a leading dot in the tone's color */}
          <StatusBadge tone={tone} dot>
            {label}
          </StatusBadge>
          {/* plain: dot + muted text, always with the dot; for dense rows and secondary states */}
          <StatusBadge tone={tone} variant="plain">
            {label}
          </StatusBadge>
        </div>
      ))}
    </div>
  )
}
