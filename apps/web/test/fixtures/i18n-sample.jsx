// Fixture for test/i18n.test.js: one example of each problem kind the scanner reports
export function Sample({ name, t }) {
  return (
    <div title={t('这是一句没有译文的中文')}>
      直接写在 JSX 里的中文
      {`你好 ${name}`}
    </div>
  )
}
