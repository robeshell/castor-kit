// Fixture for test/i18n.test.ts: the same problem kinds in a .tsx file with type syntax
interface SampleProps {
  name: string
  t: (key: string) => string
}

const pick = <T,>(items: T[]): T | undefined => items[0]

export function Sample({ name, t }: SampleProps) {
  return (
    <div title={t('这是一句没有译文的中文')} data-first={pick([name]) as string}>
      直接写在 JSX 里的中文
      {`你好 ${name}`}
    </div>
  )
}
