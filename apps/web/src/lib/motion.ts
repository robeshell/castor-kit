import type { BezierDefinition, MotionProps, Transition, Variants } from 'motion/react'

/**
 * Motion presets (motion). Durations 150–350ms; easing curves are the --ease-* vars in index.css.
 * Usage: <motion.div {...fadeUp}> / <motion.ul variants={stagger.container} initial="hidden" animate="show">
 */
export const EASE_OUT: BezierDefinition = [0.2, 0.8, 0.2, 1]
export const EASE_SPRING: BezierDefinition = [0.32, 0.72, 0, 1]

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: EASE_OUT },
} satisfies MotionProps

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.28, ease: EASE_OUT },
} satisfies MotionProps

export const stagger: { container: Variants; item: Variants } = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
  },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  },
}

/** Spring for layout animations such as sliding indicators */
export const layoutSpring: Transition = { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 }
