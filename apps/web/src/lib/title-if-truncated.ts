import type { MouseEvent } from 'react'

/**
 * onMouseEnter handler for text cut off with `truncate` / `line-clamp-*` whose content is built by a render prop
 * (so there is no plain string to put in `title`): shows the full text as a native tooltip, only while it is clipped.
 * Don't combine it with a `title` of your own.
 */
export function titleIfTruncated(e: MouseEvent<HTMLElement>): void {
  const el = e.currentTarget
  const clipped = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
  if (clipped) el.title = el.textContent?.trim() ?? ''
  else el.removeAttribute('title')
}
