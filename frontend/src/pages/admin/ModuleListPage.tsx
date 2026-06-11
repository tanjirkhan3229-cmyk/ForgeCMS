import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarClock,
  Copy,
  Download,
  Globe,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import type { ContentItem, Module, ModuleStats } from '../../lib/api'
import {
  adminApi,
  formatDate,
  MODULE_LABELS,
  MODULE_SINGULAR,
} from '../../lib/api'
import StatusBadge from '../../components/StatusBadge'

const TABS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
] as const

export default function ModuleListPage() {
  const { module } = useParams() as { module: Module }
  const [tab, setTab] = useState<string>('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ContentItem[]>([])
  const [stats, setStats] = useState<ModuleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [list, s] = await Promise.all([
        adminApi.list(module, { status: tab || undefined, search: search || undefined }),
        adminApi.stats(module),
      ])
      setItems(list.items)
      setStats(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [module, tab, search])

  useEffect(() => {
    setLoading(true)
    setTab('')
    setSearch('')
  }, [module])

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const tabCount = (key: string): number | null => {
    if (!stats) return null
    const map: Record<string, number> = {
      '': stats.total,
      draft: stats.drafts,
      scheduled: stats.scheduled,
      published: stats.published,
    }
    return map[key] ?? null
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{MODULE_LABELS[module]}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage drafts, scheduled posts and published content.
          </p>
        </div>
        <Link
          to={`/admin/${module}/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          <Plus size={16} />
          Create New
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t.label}
              {tabCount(t.key) !== null && (
                <span className="ml-1.5 text-xs text-zinc-400">{tabCount(t.key)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-72">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${MODULE_LABELS[module].toLowerCase()}…`}
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-zinc-600">Nothing here yet</p>
            <p className="mt-1 text-sm text-zinc-400">
              Create your first {MODULE_SINGULAR[module].toLowerCase()} to get started.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium tracking-wide text-zinc-400 uppercase">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Category</th>
                {module === 'resources' && <th className="px-5 py-3">Downloads</th>}
                <th className="px-5 py-3">Publish date</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="group border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                  <td className="max-w-md px-5 py-3.5">
                    <Link
                      to={`/admin/${module}/${item.id}/edit`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {item.title || 'Untitled'}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-zinc-400">/{item.slug}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">{item.category || '—'}</td>
                  {module === 'resources' && (
                    <td className="px-5 py-3.5 text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Download size={13} className="text-zinc-400" />
                        {item.download_count}
                      </span>
                    </td>
                  )}
                  <td className="px-5 py-3.5 text-zinc-500">
                    {item.status === 'scheduled' ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <CalendarClock size={13} />
                        {formatDate(item.publish_at, true)}
                      </span>
                    ) : (
                      formatDate(item.published_at, true)
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500">{formatDate(item.updated_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {item.status !== 'published' ? (
                        <IconButton
                          title="Publish now"
                          onClick={() => act(() => adminApi.publish(module, item.id))}
                        >
                          <Upload size={15} />
                        </IconButton>
                      ) : (
                        <IconButton
                          title="Unpublish (back to draft)"
                          onClick={() => act(() => adminApi.unpublish(module, item.id))}
                        >
                          <Globe size={15} />
                        </IconButton>
                      )}
                      <Link
                        to={`/admin/${module}/${item.id}/edit`}
                        title="Edit"
                        className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Pencil size={15} />
                      </Link>
                      <IconButton
                        title="Duplicate"
                        onClick={() => act(() => adminApi.duplicate(module, item.id))}
                      >
                        <Copy size={15} />
                      </IconButton>
                      <IconButton
                        title="Delete"
                        danger
                        onClick={() => {
                          if (confirm(`Delete “${item.title || 'Untitled'}”? This cannot be undone.`)) {
                            act(() => adminApi.remove(module, item.id))
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function IconButton({
  title,
  danger,
  onClick,
  children,
}: {
  title: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        danger
          ? 'text-zinc-400 hover:bg-red-50 hover:text-red-600'
          : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'
      }`}
    >
      {children}
    </button>
  )
}
