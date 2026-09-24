/**
 * 动效预设（motion）。时长 150–350ms，曲线见 index.css 的 --ease-*。
 * 用法：<motion.div {...fadeUp}> / <motion.ul variants={stagger.container} initial="hidden" animate="show">
 */
export const EASE_OUT = [0.2, 0.8, 0.2, 1]
export const EASE_SPRING = [0.32, 0.72, 0, 1]

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: EASE_OUT },
}

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.28, ease: EASE_OUT },
}

export const stagger = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  },
}

/** 滑动指示条等 layout 动画用的弹簧 */
export const layoutSpring = { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 }
