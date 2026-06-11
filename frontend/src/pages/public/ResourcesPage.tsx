import { useEffect, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'
import type { ContentItem } from '../../lib/api'
import { formatBytes, formatDate, publicApi } from '../../lib/api'

export default function ResourcesPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicApi.categories('resources').then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      publicApi
        .list('resources', { search: search || undefined, category: category || undefined, page_size: 50 })
        .then((r) => setItems(r.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [search, category])

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Resources</h1>
        <p className="mt-3 text-lg text-zinc-500">
          Whitepapers, templates and guides — free to download.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              !category ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                category === c ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="w-full rounded-full border border-zinc-200 py-2 pr-4 pl-9 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-zinc-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center text-sm text-zinc-400">No resources published yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col rounded-2xl border border-zinc-100 p-6 transition-shadow hover:shadow-lg hover:shadow-zinc-100"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <FileText size={20} />
              </div>
              {item.category && (
                <span className="mb-1 text-xs font-semibold tracking-wide text-indigo-600 uppercase">
                  {item.category}
                </span>
              )}
              <h2 className="text-lg leading-snug font-semibold">{item.title}</h2>
              {item.excerpt && <p className="mt-2 line-clamp-3 text-sm text-zinc-500">{item.excerpt}</p>}
              <div className="mt-auto pt-5">
                <div className="mb-3 text-xs text-zinc-400">
                  {item.file_name && (
                    <>
                      {item.file_name} · {formatBytes(item.file_size)} ·{' '}
                    </>
                  )}
                  {formatDate(item.published_at)} · {item.download_count} downloads
                </div>
                <a
                  href={`/api/resources/${item.id}/download`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  <Download size={15} />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
