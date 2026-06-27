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
  meta_title: string
  meta_description: string
  schema_code: string
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

export type OverviewStats = Record<Module, ModuleStats>

export interface DashboardStats {
  published_this_week: number
  resource_downloads: number
}

export interface MediaFile {
  name: string
  url: string
  size: number
  content_type: string
  is_image: boolean
  modified_at: string
}

export interface MediaList {
  items: MediaFile[]
  total: number
  page: number
  page_size: number
}

export interface Profile {
  display_name: string
  email: string
  title: string
  bio: string
  avatar_url: string
  updated_at: string | null
}

export type Role = 'admin' | 'editor' | 'author' | 'viewer'
export type UserStatus = 'active' | 'invited' | 'suspended'

export interface CmsUser {
  id: number
  name: string
  email: string
  role: Role
  status: UserStatus
  avatar_url: string
  created_at: string
  updated_at: string
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  author: 'Author',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access — content, media, users and settings',
  editor: 'Create, edit, publish, schedule and delete content; manage media and knowledge',
  author: 'Create and edit content — cannot publish, schedule, duplicate or delete',
  viewer: 'Read-only access to the studio',
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

// ---------- session ----------
//
// The session lives in an httpOnly cookie set by the backend on login, so it is
// never readable by JavaScript (and so can't be stolen via XSS). We just send
// credentials with every request; there is no token to store client-side.

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  // Auth endpoints (/api/auth/*) report 401s to their callers, which handle the
  // routing themselves (e.g. the RequireAuth gate). For everything else a 401
  // means the session expired mid-use, so bounce to login.
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new Error('Not authenticated')
  }
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

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
  status: UserStatus
  avatar_url: string
}

export const authApi = {
  // The backend sets the session as an httpOnly cookie and returns the user.
  login: (email: string, password: string) =>
    request<AuthUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<AuthUser>('/api/auth/me'),
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
  overviewStats: () => request<OverviewStats>('/api/admin/stats'),
  dashboard: () => request<DashboardStats>('/api/admin/dashboard'),
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

export const mediaApi = {
  list: (params: { search?: string; type?: 'image' | 'file'; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.type) qs.set('type', params.type)
    qs.set('page', String(params.page ?? 1))
    qs.set('page_size', String(params.page_size ?? 24))
    return request<MediaList>(`/api/admin/media?${qs}`)
  },
  remove: (name: string) =>
    request<void>(`/api/admin/media/${encodeURIComponent(name)}`, { method: 'DELETE' }),
}

export const settingsApi = {
  getProfile: () => request<Profile>('/api/admin/settings/profile'),
  updateProfile: (data: Omit<Profile, 'updated_at'>) =>
    request<Profile>('/api/admin/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),
  listUsers: () => request<CmsUser[]>('/api/admin/settings/users'),
  createUser: (data: { name: string; email: string; role: Role; status?: UserStatus }) =>
    request<CmsUser>('/api/admin/settings/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: Partial<Pick<CmsUser, 'name' | 'email' | 'role' | 'status' | 'avatar_url'>>) =>
    request<CmsUser>(`/api/admin/settings/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: number) =>
    request<void>(`/api/admin/settings/users/${id}`, { method: 'DELETE' }),
  getToneGuide: () => request<ToneGuide>('/api/admin/settings/tone-guide'),
  updateToneGuide: (value: string) =>
    request<ToneGuide>('/api/admin/settings/tone-guide', { method: 'PUT', body: JSON.stringify({ value }) }),
}

export interface ToneGuide {
  value: string
  updated_at: string | null
}

export interface AiDraft {
  title: string
  excerpt: string
  content_html: string
  meta_title: string
  meta_description: string
  tags: string[]
  sources: string[]
  model: string
}

export const aiApi = {
  generate: (data: {
    prompt: string
    module: Module
    tone: string
    length: string
    use_knowledge: boolean
    use_house_tone: boolean
  }) => request<AiDraft>('/api/ai/generate', { method: 'POST', body: JSON.stringify(data) }),
}

export interface KnowledgeDoc {
  id: number
  file_name: string
  summary: string
  keywords: string[]
  size: number
  created_at: string
}

export const knowledgeApi = {
  list: () => request<KnowledgeDoc[]>('/api/admin/knowledge'),
  get: (id: number) => request<KnowledgeDoc & { content: string }>(`/api/admin/knowledge/${id}`),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<KnowledgeDoc>('/api/admin/knowledge', { method: 'POST', body: form })
  },
  reanalyze: (id: number) =>
    request<KnowledgeDoc>(`/api/admin/knowledge/${id}/reanalyze`, { method: 'POST' }),
  remove: (id: number) => request<void>(`/api/admin/knowledge/${id}`, { method: 'DELETE' }),
}

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<{ url: string; file_name: string; file_size: number; file_type: string }>(
    '/api/uploads',
    { method: 'POST', body: form },
  )
}
