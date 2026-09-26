/** Plain text of a UI message (its text parts joined) */
export const textOf = (message) =>
  (message.parts || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
