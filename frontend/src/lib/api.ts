export type Module = 'blogs' | 'news' | 'resources' | 'faqs'
export type Status = 'draft' | 'scheduled' | 'published'

export interface ContentItem {
  id: number
  module: Module
  title: string
  slug: string
  excerpt: string
  content: Record<string, unknown>
  content_html: string
  cover_image: string
  category: string
  tags: string[]
  author: string
  status: Status
  publish_at: string | null
  published_at: string | null
  file_url: string
  file_name: string
  file_size: number
  file_type: string
  download_count: number
  created_at: string
  updated_at: string
}

export interface ContentList {
  items: ContentItem[]
  total: number
  page: number
  page_size: number
}

export interface ModuleStats {
  drafts: number
  scheduled: number
  published: number
  total: number
}

export const MODULE_LABELS: Record<Module, string> = {
  blogs: 'Blogs',
  news: 'News',
  resources: 'Resources',
  faqs: 'FAQ Articles',
}

export const MODULE_SINGULAR: Record<Module, string> = {
  blogs: 'Blog Post',
  news: 'News Article',
  resources: 'Resource',
  faqs: 'FAQ Article',
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: options?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep statusText */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// Backend stores naive-UTC timestamps. These helpers convert between the
// browser's local time (datetime-local inputs) and the API's UTC strings.
export function localInputToUtc(local: string): string {
  return new Date(local).toISOString().slice(0, 19)
}

export function utcToLocalInput(utc: string): string {
  const d = new Date(utc.endsWith('Z') ? utc : utc + 'Z')
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function formatDate(utc: string | null, withTime = false): string {
  if (!utc) return '—'
  const d = new Date(utc.endsWith('Z') ? utc : utc + 'Z')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let value = bytes
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export const adminApi = {
  list: (module: Module, params: { status?: string; search?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    qs.set('page', String(params.page ?? 1))
    qs.set('page_size', String(params.page_size ?? 50))
    return request<ContentList>(`/api/admin/${module}?${qs}`)
  },
  stats: (module: Module) => request<ModuleStats>(`/api/admin/${module}/stats`),
  get: (module: Module, id: number) => request<ContentItem>(`/api/admin/${module}/${id}`),
  create: (module: Module, data: Partial<ContentItem>) =>
    request<ContentItem>(`/api/admin/${module}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (module: Module, id: number, data: Partial<ContentItem>) =>
    request<ContentItem>(`/api/admin/${module}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (module: Module, id: number) =>
    request<void>(`/api/admin/${module}/${id}`, { method: 'DELETE' }),
  publish: (module: Module, id: number) =>
    request<ContentItem>(`/api/admin/${module}/${id}/publish`, { method: 'POST' }),
  unpublish: (module: Module, id: number) =>
    request<ContentItem>(`/api/admin/${module}/${id}/unpublish`, { method: 'POST' }),
  schedule: (module: Module, id: number, publishAtUtc: string) =>
    request<ContentItem>(`/api/admin/${module}/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ publish_at: publishAtUtc }),
    }),
  duplicate: (module: Module, id: number) =>
    request<ContentItem>(`/api/admin/${module}/${id}/duplicate`, { method: 'POST' }),
}

export const publicApi = {
  list: (module: Module, params: { search?: string; category?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.category) qs.set('category', params.category)
    qs.set('page', String(params.page ?? 1))
    qs.set('page_size', String(params.page_size ?? 12))
    return request<ContentList>(`/api/${module}?${qs}`)
  },
  categories: (module: Module) => request<string[]>(`/api/${module}/categories`),
  bySlug: (module: Module, slug: string) =>
    request<ContentItem>(`/api/${module}/slug/${encodeURIComponent(slug)}`),
}

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<{ url: string; file_name: string; file_size: number; file_type: string }>(
    '/api/uploads',
    { method: 'POST', body: form },
  )
}
