import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LANGUAGES, setLanguage } from '@/i18n'

/** UI language switcher (top bar / login page); the choice is stored in localStorage and the Accept-Language request header follows it */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={t('切换语言')}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang.code} lang={lang.code} onSelect={() => setLanguage(lang.code)}>
            <span className="flex-1">{lang.label}</span>
            {i18n.language === lang.code ? <Check className="text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
