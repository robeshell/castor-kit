import type { UIMessage } from 'ai'

/** Plain text of a UI message (its text parts joined) */
export const textOf = (message: Pick<UIMessage, 'parts'>): string =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
