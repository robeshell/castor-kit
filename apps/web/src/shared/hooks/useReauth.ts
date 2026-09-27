import { useCallback, useRef, useState } from 'react'

/**
 * Sensitive API calls (e.g. saving system settings) answer 403 `{ reauth_required: true }` when the user hasn't signed
 * in or confirmed their identity recently. `run(fn)` calls fn; on that answer it opens the identity dialog and, once
 * verified, calls fn again. Cancelling rejects with `{ cancelled: true }` (callers ignore it).
 *   const reauth = useReauth()
 *   await reauth.run(() => saveSettings(changes))
 *   <ReauthDialog {...reauth.dialogProps} />
 */
/** Props for <ReauthDialog> */
export interface ReauthDialogProps {
  open: boolean
  onVerified: () => void
  onCancel: () => void
}

export interface Reauth {
  /** Call fn; if the API asks for re-verification, verify and call it once more */
  run: <T>(fn: () => T | Promise<T>) => Promise<T>
  dialogProps: ReauthDialogProps
}

/** What `run` rejects with when the user cancels the identity dialog */
export interface ReauthCancelled {
  cancelled: true
}

const needsReauth = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'reauth_required' in err && Boolean(err.reauth_required)

export function useReauth(): Reauth {
  const [open, setOpen] = useState(false)
  const waiter = useRef<{ resolve: () => void; reject: (reason: ReauthCancelled) => void } | null>(null)

  const run = useCallback(async <T>(fn: () => T | Promise<T>): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      if (!needsReauth(err)) throw err
      await new Promise<void>((resolve, reject) => {
        waiter.current = { resolve, reject }
        setOpen(true)
      })
      return fn()
    }
  }, [])

  const finish = (verified: boolean) => {
    setOpen(false)
    const current = waiter.current
    waiter.current = null
    if (verified) current?.resolve()
    else current?.reject({ cancelled: true })
  }

  return { run, dialogProps: { open, onVerified: () => finish(true), onCancel: () => finish(false) } }
}
