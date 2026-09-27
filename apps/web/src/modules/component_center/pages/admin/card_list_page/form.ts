/**
 * Card list page: the create / edit form values and how a record becomes them.
 */

import type { CardListPageItem as Row } from '@/modules/component_center/api/card_list_page'

/** What the form holds (and submits): the card's editable fields only, nullable where the API accepts null */
export interface FormValues {
  title: string
  card_code: string
  subtitle: string | null
  category: string | null
  status: Row['status']
  tag: string | null
  owner: string | null
  /** Cleared input → null, which the API saves as 0 */
  priority: number | null
  cover_url: string | null
  is_active: boolean
  description: string | null
}

export const DEFAULT_FORM_VALUES: FormValues = {
  title: '',
  card_code: '',
  subtitle: '',
  category: 'general',
  status: 'draft',
  tag: '',
  owner: '',
  priority: 0,
  cover_url: '',
  is_active: true,
  description: '',
}

/**
 * The edit form for a record: only the fields the form submits (no id / timestamps in the PUT body), and a null the
 * API would replace with its default shows that default, so saving an untouched form keeps what the user saw
 */
export function toFormValues(record: Row): FormValues {
  return {
    title: record.title,
    card_code: record.card_code,
    subtitle: record.subtitle,
    category: record.category ?? DEFAULT_FORM_VALUES.category,
    status: record.status,
    tag: record.tag,
    owner: record.owner,
    priority: record.priority,
    cover_url: record.cover_url,
    is_active: record.is_active ?? DEFAULT_FORM_VALUES.is_active,
    description: record.description,
  }
}
