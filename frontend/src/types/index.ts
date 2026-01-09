/**
 * Core types for UnifiedSaved - Save For Later Dashboard
 */

export type Source = 'youtube' | 'reddit' | 'instagram' | 'raindrop' | 'facebook' | 'telegram' | 'manual'

export type ItemStatus = 'unprocessed' | 'read' | 'archived'

export interface SavedItem {
  id: string
  source: Source
  source_id: string
  url: string | null
  title: string
  description: string | null
  thumbnail_url: string | null
  tags: string[]
  processed: boolean
  created_at: string
  synced_at: string
}

export interface SavedItemsResponse {
  items: SavedItem[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

export interface CreateSavedItemRequest {
  source: Source
  source_id: string
  url?: string
  title: string
  description?: string
  thumbnail_url?: string
  tags?: string[]
}

export interface UpdateSavedItemRequest {
  title?: string
  description?: string
  tags?: string[]
  processed?: boolean
}

export interface SyncStatus {
  source: Source
  last_sync: string | null
  status: 'idle' | 'syncing' | 'error'
  error_message: string | null
  items_synced: number
}

export interface SyncTriggerRequest {
  source: Source
}

export interface SyncTriggerResponse {
  message: string
  job_id: string
}

/**
 * UI-specific types
 */
export type SortByField = 'saved_at' | 'synced_at' | 'created_at' | 'title' | 'priority'
export type SortOrder = 'asc' | 'desc'
export type GroupByOption = 'none' | 'date' | 'source' | 'tags' | 'website'
export type ViewMode = 'grid' | 'list'

export interface FilterState {
  sources: Source[]
  status: ItemStatus | null
  search: string
  tags: string[]
  // Sorting
  sortBy: SortByField
  sortOrder: SortOrder
  // Date range
  savedAfter: string | null  // ISO date string
  savedBefore: string | null // ISO date string
  // Grouping
  groupBy: GroupByOption
  // Grouping drill-down fields
  groupYear: number | null    // For date grouping: e.g., 2025
  groupMonth: number | null   // For date grouping: 1-12
  groupTag: string | null     // For tag grouping: selected tag
  groupDomain: string | null  // For website grouping: selected domain
}

export interface SortState {
  field: 'created_at' | 'synced_at' | 'title'
  direction: 'asc' | 'desc'
}

/**
 * Source metadata for UI display
 */
export const SOURCE_METADATA: Record<
  Source,
  { label: string; color: string; bgClass: string }
> = {
  youtube: {
    label: 'YouTube',
    color: '#ff0000',
    bgClass: 'source-youtube',
  },
  reddit: {
    label: 'Reddit',
    color: '#ff4500',
    bgClass: 'source-reddit',
  },
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    bgClass: 'source-instagram',
  },
  raindrop: {
    label: 'Raindrop',
    color: '#0093e0',
    bgClass: 'source-raindrop',
  },
  facebook: {
    label: 'Facebook',
    color: '#1877f2',
    bgClass: 'source-facebook',
  },
  telegram: {
    label: 'Telegram',
    color: '#26a5e4',
    bgClass: 'source-telegram',
  },
  manual: {
    label: 'Manual',
    color: '#6366f1',
    bgClass: 'source-manual',
  },
}

export const STATUS_METADATA: Record<
  ItemStatus,
  { label: string; color: string; bgClass: string }
> = {
  unprocessed: {
    label: 'Unprocessed',
    color: '#fbbf24',
    bgClass: 'status-unprocessed',
  },
  read: {
    label: 'Read',
    color: '#22c55e',
    bgClass: 'status-read',
  },
  archived: {
    label: 'Archived',
    color: '#94a3b8',
    bgClass: 'status-archived',
  },
}

/**
 * Tags and Domains API response types
 */
export interface TagWithCount {
  tag: string
  count: number
}

export interface DomainWithCount {
  domain: string
  count: number
}

export interface TagsResponse {
  tags: TagWithCount[]
  total: number
}

export interface DomainsResponse {
  domains: DomainWithCount[]
  total: number
}
