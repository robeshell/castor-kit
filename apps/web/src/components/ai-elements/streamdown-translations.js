import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Labels of Streamdown's own buttons (code block copy / download, tables, links) in the current language */
export function useStreamdownTranslations() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () => ({
      close: t('关闭'),
      copied: t('已复制'),
      copyCode: t('复制代码'),
      copyLink: t('复制链接'),
      copyTable: t('复制表格'),
      copyTableAsCsv: t('复制为 CSV'),
      copyTableAsMarkdown: t('复制为 Markdown'),
      copyTableAsTsv: t('复制为 TSV'),
      downloadFile: t('下载文件'),
      downloadImage: t('下载图片'),
      downloadTable: t('下载表格'),
      downloadTableAsCsv: t('下载为 CSV'),
      downloadTableAsMarkdown: t('下载为 Markdown'),
      exitFullscreen: t('退出全屏'),
      externalLinkWarning: t('即将打开外部链接，请确认链接可信'),
      imageNotAvailable: t('图片无法显示'),
      openExternalLink: t('打开外部链接'),
      openLink: t('打开链接'),
      viewFullscreen: t('全屏查看'),
    }),
    // i18n.language: recompute when the language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  )
}
