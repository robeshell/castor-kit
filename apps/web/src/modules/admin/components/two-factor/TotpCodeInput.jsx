import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useTranslation } from 'react-i18next'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'

/** 6-digit code from an authenticator app; `onComplete` fires once all digits are typed (or pasted) */
export default function TotpCodeInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }) {
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
