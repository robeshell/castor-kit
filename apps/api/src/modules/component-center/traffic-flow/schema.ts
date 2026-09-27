/**
 * Traffic flow mock data: daily visits from each source to a landing page, what those visits end in, and the
 * conversion funnel. Node ids are stable keys; the web page labels them.
 */

export type SourceId = 'search' | 'social' | 'direct' | 'ads' | 'email'
export type PageId = 'home' | 'product' | 'campaign'
export type OutcomeId = 'signup' | 'order' | 'exit'

/** Visits from a source to a landing page (base values before the per-request jitter) */
export const SOURCE_LINKS: readonly { source: SourceId; target: PageId; value: number }[] = [
  { source: 'search', target: 'home', value: 3200 },
  { source: 'search', target: 'product', value: 2400 },
  { source: 'social', target: 'home', value: 1500 },
  { source: 'social', target: 'campaign', value: 1800 },
  { source: 'direct', target: 'home', value: 2600 },
  { source: 'direct', target: 'product', value: 900 },
  { source: 'ads', target: 'campaign', value: 2200 },
  { source: 'ads', target: 'product', value: 1300 },
  { source: 'email', target: 'campaign', value: 700 },
  { source: 'email', target: 'product', value: 500 },
]

/** Share of each landing page's visits that end in each outcome (each row sums to 1) */
export const OUTCOME_SHARES: Readonly<Record<PageId, Readonly<Record<OutcomeId, number>>>> = {
  home: { signup: 0.19, order: 0.12, exit: 0.69 },
  product: { signup: 0.14, order: 0.41, exit: 0.45 },
  campaign: { signup: 0.34, order: 0.23, exit: 0.43 },
}

/** Funnel stages as a share of all visits (decreasing) */
export const FUNNEL_SHARES: readonly { stage: 'visit' | 'view' | 'cart' | 'order' | 'pay'; share: number }[] = [
  { stage: 'visit', share: 1 },
  { stage: 'view', share: 0.56 },
  { stage: 'cart', share: 0.31 },
  { stage: 'order', share: 0.24 },
  { stage: 'pay', share: 0.2 },
]
