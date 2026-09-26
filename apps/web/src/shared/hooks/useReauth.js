import { useCallback, useRef, useState } from 'react'

/**
 * Sensitive API calls (e.g. saving system settings) answer 403 `{ reauth_required: true }` when the user hasn't signed
 * in or confirmed their identity recently. `run(fn)` calls fn; on that answer it opens the identity dialog and, once
 * verified, calls fn again. Cancelling rejects with `{ cancelled: true }` (callers ignore it).
 *   const reauth = useReauth()
 *   await reauth.run(() => saveSettings(changes))
 *   <ReauthDialog {...reauth.dialogProps} />
 */
export function useReauth() {
  const [open, setOpen] = useState(false)
  const waiter = useRef(null)

  const run = useCallback(async (fn) => {
    try {
      return await fn()
    } catch (err) {
      if (!err?.reauth_required) throw err
      await new Promise((resolve, reject) => {
        waiter.current = { resolve, reject }
        setOpen(true)
      })
      return fn()
    }
  }, [])

  const finish = (verified) => {
    setOpen(false)
    const current = waiter.current
    waiter.current = null
    if (verified) current?.resolve()
    else current?.reject({ cancelled: true })
  }

  return { run, dialogProps: { open, onVerified: () => finish(true), onCancel: () => finish(false) } }
}
