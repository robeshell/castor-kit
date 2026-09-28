import { useLayoutEffect, useRef } from 'react'

/**
 * A controlled dialog / sheet without a Radix Trigger (FormDialog, ImportDialog …): Radix can't return focus on close,
 * so it lands on <body>. Remember what had focus when `open` turned true (layout effects run before Radix moves focus inside) and
 * return there on close; pass the handler to the content's onCloseAutoFocus.
 */
export function useReturnFocus(open: boolean | undefined): (event: Event) => void {
  const opener = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      opener.current = document.activeElement
    }
  }, [open])
  return (event) => {
    const target = opener.current
    opener.current = null
    // A trigger that went away (its row was deleted) leaves Radix's default
    if (target?.isConnected) {
      event.preventDefault()
      target.focus()
    }
  }
}
