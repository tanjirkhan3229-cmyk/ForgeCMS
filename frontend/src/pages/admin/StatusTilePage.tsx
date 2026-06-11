import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import type { ContentItem, Module, Status } from '../../lib/api'
import {
  adminApi,
  formatDate,
  MODULE_LABELS,
  MODULE_SINGULAR,
} from '../../lib/api'
import StatusBadge from '../../components/StatusBadge'

const PAGE_SIZE = 9 // 3 × 3 grid

const COPY: Record<Status, { title: string; subtitle: string }> = {
  draft: { title: 'Drafts', subtitle: 'Work in progress — not visible on the site.' },
  published: { title: 'Published', subtitle: 'Live content visible on the public site.' },
  scheduled: { title: 'Scheduled', subtitle: 'Will be published automatically at the scheduled time.' },
}

export default function StatusTilePage({ status }: { status: Status }) {
  const { module } = useParams() as { module: Module }
  const navigate = useNavigate()
  const [items, setItems] = useState<ContentItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await adminApi.list(module, {
        status,
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
      // If deleting the last item of the last page left us stranded, step back.
      if (res.items.length === 0 && page > 1) setPage((p) => p - 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [module, status, search, page])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    setSearch('')
  }, [module, status])

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

  const copy = COPY[status]

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
            {MODULE_LABELS[module]}
          </div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-zinc-400"
            />
          </div>
          <Link
            to={`/admin/${module}/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <Plus size={16} />
            Create New
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-sm text-zinc-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-20 text-center">
          <p className="text-sm font-medium text-zinc-600">No {copy.title.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            {status === 'draft'
              ? `Create a new ${MODULE_SINGULAR[module].toLowerCase()} to get started.`
              : status === 'scheduled'
                ? 'Schedule an item from the editor and it will show up here.'
                : 'Publish a draft and it will show up here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/admin/${module}/${item.id}/edit`)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md hover:shadow-zinc-100"
              >
                <div className="relative aspect-[16/8] overflow-hidden bg-zinc-100">
                  {item.cover_image ? (
                    <img src={item.cover_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-200 text-3xl font-bold text-zinc-300">
                      {(item.title || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="line-clamp-2 leading-snug font-semibold">
                    {item.title || 'Untitled'}
                  </h2>
                  {item.excerpt && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">{item.excerpt}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="text-xs text-zinc-400">
                      {status === 'scheduled' ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <CalendarClock size={12} />
                          {formatDate(item.publish_at, true)}
                        </span>
                      ) : status === 'published' ? (
                        <>
                          {formatDate(item.published_at)}
                          {module === 'resources' && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Download size={11} />
                              {item.download_count}
                            </span>
                          )}
                        </>
                      ) : (
                        <>Updated {formatDate(item.updated_at)}</>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.status !== 'published' ? (
                        <TileBtn title="Publish now" onClick={() => act(() => adminApi.publish(module, item.id))}>
                          <Upload size={14} />
                        </TileBtn>
                      ) : (
                        <TileBtn title="Unpublish" onClick={() => act(() => adminApi.unpublish(module, item.id))}>
                          <Undo2 size={14} />
                        </TileBtn>
                      )}
                      <Link
                        to={`/admin/${module}/${item.id}/edit`}
                        title="Edit"
                        className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        <Pencil size={14} />
                      </Link>
                      <TileBtn title="Duplicate" onClick={() => act(() => adminApi.duplicate(module, item.id))}>
                        <Copy size={14} />
                      </TileBtn>
                      <TileBtn
                        title="Delete"
                        danger
                        onClick={() => {
                          if (confirm(`Delete “${item.title || 'Untitled'}”? This cannot be undone.`)) {
                            act(() => adminApi.remove(module, item.id))
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </TileBtn>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <PageBtn disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium transition-colors ${
                    n === page ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  {n}
                </button>
              ))}
              <PageBtn disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={15} />
              </PageBtn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TileBtn({
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

function PageBtn({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
