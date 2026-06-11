import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import type { ContentItem } from '../../lib/api'
import { publicApi } from '../../lib/api'

export default function FaqPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicApi
      .list('faqs', { page_size: 100 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const filtered = search
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(search.toLowerCase()) ||
            i.excerpt.toLowerCase().includes(search.toLowerCase()),
        )
      : items
    const groups = new Map<string, ContentItem[]>()
    for (const item of filtered) {
      const key = item.category || 'General'
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items, search])

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
        <p className="mt-3 text-lg text-zinc-500">
          Everything you need to know. Can't find an answer? Reach out to support.
        </p>
        <div className="relative mx-auto mt-6 max-w-md">
          <Search size={15} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions…"
            className="w-full rounded-full border border-zinc-200 py-2.5 pr-4 pl-10 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-400">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center text-sm text-zinc-400">No questions found.</div>
      ) : (
        grouped.map(([category, faqs]) => (
          <section key={category} className="mb-10">
            <h2 className="mb-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              {category}
            </h2>
            <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
              {faqs.map((faq) => {
                const open = openId === faq.id
                return (
                  <div key={faq.id}>
                    <button
                      onClick={() => setOpenId(open ? null : faq.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="font-medium">{faq.title}</span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {open && (
                      <div
                        className="prose prose-sm prose-zinc max-w-none px-5 pb-5 prose-a:text-indigo-600"
                        dangerouslySetInnerHTML={{ __html: faq.content_html }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
