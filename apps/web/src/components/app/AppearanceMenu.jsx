import { Check, Palette, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTheme } from '@/context/ThemeContext'
import { ACCENTS, CONTENT_WIDTHS, DEFAULT_APPEARANCE, NAV_MODES, SIDEBAR_VARIANTS } from '@/lib/appearance'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

function Section({ title, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium">{title}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** Wireframe thumbnail of a nav mode: the bars are the navigation, the rest is content */
function NavPreview({ mode }) {
  const bar = 'bg-muted-foreground/30 rounded-[2px]'
  return (
    <span className="bg-background flex h-11 w-full gap-1 overflow-hidden rounded-md p-1 shadow-[0_0_0_1px_var(--border)]">
      {mode !== 'top' ? <span className={cn(bar, mode === 'mixed' ? 'w-2.5' : 'w-3.5')} /> : null}
      <span className="flex flex-1 flex-col gap-1">
        {mode !== 'sidebar' ? <span className={cn(bar, 'flex h-2 items-center gap-0.5 px-0.5')}>
          <span className="bg-primary h-1 w-2 rounded-full" />
        </span> : <span className="bg-muted-foreground/15 h-2 rounded-[2px]" />}
        <span className="bg-muted-foreground/10 flex-1 rounded-[2px]" />
      </span>
    </span>
  )
}

function OptionGroup({ value, options, onChange, disabled }) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      disabled={disabled}
      onValueChange={(next) => next && onChange(next)}
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.id} value={o.id} className="data-[state=on]:text-foreground flex-1 text-[13px]">
          {t(o.label)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Top-bar popover for accent color and layout; choices apply instantly and persist in this browser */
export default function AppearanceMenu() {
  const { t } = useTranslation()
  const { accent, navMode, sidebarVariant, contentWidth, setAppearance } = useTheme()
  const current = ACCENTS.find((a) => a.id === accent)
  const isDefault =
    accent === DEFAULT_APPEARANCE.accent &&
    navMode === DEFAULT_APPEARANCE.navMode &&
    sidebarVariant === DEFAULT_APPEARANCE.sidebarVariant &&
    contentWidth === DEFAULT_APPEARANCE.contentWidth

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={t('外观设置')}>
          <Palette className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 space-y-5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t('外观设置')}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-xs"
            disabled={isDefault}
            onClick={() => setAppearance(DEFAULT_APPEARANCE)}
          >
            <RotateCcw className="size-3.5" />
            {t('恢复默认')}
          </Button>
        </div>

        <Section title={t('强调色')} hint={current ? t(current.label) : null}>
          <div className="grid grid-cols-6 gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                data-accent={a.id}
                title={t(a.label)}
                aria-label={t(a.label)}
                aria-pressed={accent === a.id}
                onClick={() => setAppearance({ accent: a.id })}
                className={cn(
                  'focus-visible:ring-ring flex aspect-square items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-from),var(--brand-via)_55%,var(--brand-to))] text-white outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2',
                  accent === a.id && 'ring-foreground/70 ring-offset-popover ring-2 ring-offset-2',
                )}
              >
                {accent === a.id ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('导航模式')}>
          <div className="grid grid-cols-3 gap-2">
            {NAV_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={navMode === m.id}
                onClick={() => setAppearance({ navMode: m.id })}
                className={cn(
                  'focus-visible:ring-ring flex flex-col items-center gap-1.5 rounded-lg p-1.5 text-xs outline-none transition-colors focus-visible:ring-2',
                  navMode === m.id ? 'bg-brand-soft text-foreground font-medium' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <NavPreview mode={m.id} />
                {t(m.label)}
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('侧边栏样式')} hint={navMode === 'top' ? t('顶部导航下不显示侧边栏') : null}>
          <OptionGroup
            value={sidebarVariant}
            options={SIDEBAR_VARIANTS}
            disabled={navMode === 'top'}
            onChange={(next) => setAppearance({ sidebarVariant: next })}
          />
        </Section>

        <Section title={t('内容宽度')}>
          <OptionGroup value={contentWidth} options={CONTENT_WIDTHS} onChange={(next) => setAppearance({ contentWidth: next })} />
        </Section>
      </PopoverContent>
    </Popover>
  )
}
