import type {
  SavedItem,
  SavedItemsResponse,
  CreateSavedItemRequest,
  UpdateSavedItemRequest,
  SyncStatus,
  SyncTriggerResponse,
  Source,
  ItemStatus,
  SortByField,
  SortOrder,
  TagsResponse,
  DomainsResponse,
  ItemStatsResponse,
  SocialCheckResponse,
} from '@/types'

const API_BASE_URL = 'http://localhost:8001/api/v1'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorDetails: unknown
    try {
      errorDetails = await response.json()
    } catch {
      errorDetails = await response.text()
    }
    throw new ApiError(response.status, `API Error: ${response.statusText}`, errorDetails)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * Items API
 */
export const itemsApi = {
  /**
   * Get all saved items with optional filtering
   */
  async getItems(params?: {
    page?: number
    per_page?: number
    source?: Source
    status?: ItemStatus
    search?: string
    tags?: string[]
    domain?: string  // Filter by URL domain
    // Sorting
    sort_by?: SortByField
    sort_order?: SortOrder
    // Date range
    saved_after?: string  // ISO date string
    saved_before?: string // ISO date string
  }): Promise<SavedItemsResponse> {
    const searchParams = new URLSearchParams()

    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.per_page) searchParams.set('page_size', String(params.per_page))
    if (params?.source) searchParams.set('source', params.source)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    if (params?.domain) searchParams.set('domain', params.domain)
    if (params?.tags?.length) {
      params.tags.forEach((tag) => searchParams.append('tags', tag))
    }
    // Sorting
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by)
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order)
    // Date range
    if (params?.saved_after) searchParams.set('saved_after', params.saved_after)
    if (params?.saved_before) searchParams.set('saved_before', params.saved_before)

    const queryString = searchParams.toString()
    const endpoint = `/items${queryString ? `?${queryString}` : ''}`

    return apiFetch<SavedItemsResponse>(endpoint)
  },

  /**
   * Get a single saved item by ID
   */
  async getItem(id: string): Promise<SavedItem> {
    return apiFetch<SavedItem>(`/items/${id}`)
  },

  /**
   * Create a new saved item
   */
  async createItem(data: CreateSavedItemRequest): Promise<SavedItem> {
    return apiFetch<SavedItem>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Update an existing saved item
   */
  async updateItem(id: string, data: UpdateSavedItemRequest): Promise<SavedItem> {
    return apiFetch<SavedItem>(`/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /**
   * Delete a saved item
   */
  async deleteItem(id: string): Promise<void> {
    return apiFetch<void>(`/items/${id}`, {
      method: 'DELETE',
    })
  },

  /**
   * Mark an item as read/processed
   */
  async markAsRead(id: string): Promise<SavedItem> {
    return apiFetch<SavedItem>(`/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ processed: true }),
    })
  },

  /**
   * Archive an item
   */
  async archiveItem(id: string): Promise<SavedItem> {
    return apiFetch<SavedItem>(`/items/${id}/archive`, {
      method: 'POST',
    })
  },

  /**
   * Get all tags with their counts
   */
  async getTagsWithCounts(): Promise<TagsResponse> {
    return apiFetch<TagsResponse>('/items/tags')
  },

  /**
   * Get all domains with their counts
   */
  async getDomainsWithCounts(): Promise<DomainsResponse> {
    return apiFetch<DomainsResponse>('/items/domains')
  },

  /**
   * Get item statistics including counts per source
   */
  async getStats(): Promise<ItemStatsResponse> {
    return apiFetch<ItemStatsResponse>('/items/stats')
  },
}

/**
 * Sync API
 */
export const syncApi = {
  /**
   * Get sync status for all sources
   */
  async getStatus(): Promise<SyncStatus[]> {
    return apiFetch<SyncStatus[]>('/sync/status')
  },

  /**
   * Get sync status for a specific source
   */
  async getSourceStatus(source: Source): Promise<SyncStatus> {
    return apiFetch<SyncStatus>(`/sync/status/${source}`)
  },

  /**
   * Trigger a sync for a specific source
   */
  async triggerSync(source: 'youtube' | 'reddit'): Promise<SyncTriggerResponse> {
    return apiFetch<SyncTriggerResponse>(`/sync/${source}`, {
      method: 'POST',
      body: JSON.stringify({ force: false }),
    })
  },

  /**
   * Trigger sync for all sources (YouTube + Reddit)
   */
  async triggerSyncAll(): Promise<{ youtube: SyncTriggerResponse; reddit: SyncTriggerResponse }> {
    const [youtube, reddit] = await Promise.all([
      apiFetch<SyncTriggerResponse>('/sync/youtube', { method: 'POST', body: JSON.stringify({ force: false }) }),
      apiFetch<SyncTriggerResponse>('/sync/reddit', { method: 'POST', body: JSON.stringify({ force: false }) }),
    ])
    return { youtube, reddit }
  },
}

/**
 * Tags API
 */
export const tagsApi = {
  /**
   * Get all unique tags
   */
  async getTags(): Promise<string[]> {
    return apiFetch<string[]>('/tags')
  },
}

/**
 * Social Presence API
 */
export const socialApi = {
  /**
   * Check social presence for an item (HN + Reddit)
   */
  async checkSocial(itemId: string, refresh = false): Promise<SocialCheckResponse> {
    const params = new URLSearchParams()
    if (refresh) params.set('refresh', 'true')
    const query = params.toString()
    return apiFetch<SocialCheckResponse>(
      `/items/${itemId}/check-social${query ? `?${query}` : ''}`,
      { method: 'POST' }
    )
  },

  /**
   * Get cached social mentions (no API calls)
   */
  async getSocialMentions(itemId: string): Promise<SocialCheckResponse> {
    return apiFetch<SocialCheckResponse>(`/items/${itemId}/social-mentions`)
  },

  /**
   * Batch check social presence for multiple items
   */
  async batchCheckSocial(itemIds: string[]): Promise<{
    results: Record<string, SocialCheckResponse>
    failed: string[]
    checked_at: string
  }> {
    return apiFetch(`/items/batch/check-social`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    })
  },
}

/**
 * Export all APIs as a single object
 */
export const api = {
  items: itemsApi,
  sync: syncApi,
  tags: tagsApi,
  social: socialApi,
}

export default api
