/**
 * 共享页面样式常量（Semi Design 主题变量）
 *
 * 过去各页面各自复制一份 CARD_STYLE，且存在多种变体（圆角/内边距/阴影不同）。
 * 这里收敛最常用的两种变体；页面若有特殊变体可保留本地定义，但新页面一律复用本文件。
 */

// 标准卡片：圆角 8 / 内边距 16 / 下边距 12
export const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.06)',
}

// 大圆角卡片：圆角 10 / 内边距 16x20（编辑器、AI、数据可视化类页面常用）
export const CARD_STYLE_LG = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 10,
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
}
