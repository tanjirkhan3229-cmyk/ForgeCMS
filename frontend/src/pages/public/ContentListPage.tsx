import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { ContentItem, Module } from '../../lib/api'
import { formatDate, publicApi } from '../../lib/api'

const COPY: Partial<Record<Module, { title: string; subtitle: string }>> = {
  blogs: {
    title: 'Blog',
    subtitle: 'Deep dives, guides and ideas from the team.',
  },
  news: {
    title: 'News',
    subtitle: 'Product announcements and company updates.',
  },
}

export default function ContentListPage({ module }: { module: Module }) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCategory('')
    setSearch('')
    publicApi.categories(module).then(setCategories).catch(() => setCategories([]))
  }, [module])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      publicApi
        .list(module, { search: search || undefined, category: category || undefined, page_size: 50 })
        .then((r) => setItems(r.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [module, search, category])

  const copy = COPY[module]!

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-lg text-zinc-500">{copy.subtitle}</p>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <CategoryPill active={!category} onClick={() => setCategory('')}>
            All
          </CategoryPill>
          {categories.map((c) => (
            <CategoryPill key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </CategoryPill>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-full border border-zinc-200 py-2 pr-4 pl-9 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-zinc-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center text-sm text-zinc-400">No articles published yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/${module}/${item.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-100 transition-shadow hover:shadow-lg hover:shadow-zinc-100"
            >
              <div className="aspect-[16/9] overflow-hidden bg-zinc-100">
                {item.cover_image ? (
                  <img
                    src={item.cover_image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-200 text-3xl font-bold text-zinc-300">
                    {item.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                {item.category && (
                  <span className="mb-2 text-xs font-semibold tracking-wide text-indigo-600 uppercase">
                    {item.category}
                  </span>
                )}
                <h2 className="text-lg leading-snug font-semibold group-hover:underline">
                  {item.title}
                </h2>
                {item.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{item.excerpt}</p>
                )}
                <div className="mt-auto pt-4 text-xs text-zinc-400">
                  {item.author && <span>{item.author} · </span>}
                  {formatDate(item.published_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
