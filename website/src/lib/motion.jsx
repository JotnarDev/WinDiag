import { motion } from 'motion/react'

// Apple-like deceleration: fast start, long soft landing
export const EASE = [0.16, 1, 0.3, 1]

const container = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08 } }
}

const item = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } }
}

/** A group whose <RevealItem> children rise in one after another as it scrolls into view. */
export function Reveal({ as = 'div', className, children, amount = 0.25, ...rest }) {
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      variants={container}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function RevealItem({ as = 'div', className, children, ...rest }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={item} {...rest}>
      {children}
    </Tag>
  )
}
