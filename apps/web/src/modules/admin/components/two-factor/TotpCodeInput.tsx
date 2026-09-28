import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useTranslation } from 'react-i18next'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'

export interface TotpCodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Called with the full code once all 6 digits are typed (or pasted) */
  onComplete?: (value: string) => void
  disabled?: boolean
  /** Marks the slots invalid (red ring) */
  invalid?: boolean
  /** id of the error text, read with the input */
  describedBy?: string
  autoFocus?: boolean
}

/** 6-digit code from an authenticator app; `onComplete` fires once all digits are typed (or pasted) */
export default function TotpCodeInput({ value, onChange, onComplete, disabled, invalid, describedBy, autoFocus = true }: TotpCodeInputProps) {
  const { t } = useTranslation()
  return (
    <InputOTP
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      aria-label={t('6 位验证码')}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      containerClassName="justify-center"
    >
      {[0, 3].map((start, group) => (
        <div key={start} className="flex items-center gap-2">
          {group > 0 ? <InputOTPSeparator className="text-muted-foreground" /> : null}
          <InputOTPGroup>
            {[0, 1, 2].map((i) => (
              <InputOTPSlot key={i} index={start + i} aria-invalid={invalid || undefined} className="size-10 text-base" />
            ))}
          </InputOTPGroup>
        </div>
      ))}
    </InputOTP>
  )
}
