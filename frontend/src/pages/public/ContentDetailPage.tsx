import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { ContentItem, Module } from '../../lib/api'
import { formatDate, publicApi } from '../../lib/api'

const BACK_LABEL: Partial<Record<Module, string>> = {
  blogs: 'blog',
  news: 'news',
  knowledgebase: 'knowledge base',
}

export default function ContentDetailPage({ module }: { module: Module }) {
  const { slug } = useParams() as { slug: string }
  const [item, setItem] = useState<ContentItem | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setItem(null)
    setNotFound(false)
    publicApi
      .bySlug(module, slug)
      .then(setItem)
      .catch(() => setNotFound(true))
    window.scrollTo(0, 0)
  }, [module, slug])

  // Apply the item's SEO fields to the document head.
  useEffect(() => {
    if (!item) return
    const previousTitle = document.title
    document.title = item.meta_title || item.title

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const createdMeta = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    const previousDescription = meta.content
    if (item.meta_description) meta.content = item.meta_description

    let script: HTMLScriptElement | null = null
    if (item.schema_code.trim()) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.text = item.schema_code
      document.head.appendChild(script)
    }

    return () => {
      document.title = previousTitle
      if (createdMeta) meta!.remove()
      else meta!.content = previousDescription
      script?.remove()
    }
  }, [item])

  if (notFound) {
    return (
      <div className="py-32 text-center">
        <p className="text-lg font-semibold">Article not found</p>
        <Link to={`/${module}`} className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
          Back to {BACK_LABEL[module]}
        </Link>
      </div>
    )
  }

  if (!item) {
    return <div className="py-32 text-center text-sm text-zinc-400">Loading…</div>
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      <Link
        to={`/${module}`}
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft size={15} /> Back to {BACK_LABEL[module]}
      </Link>

      {item.category && (
        <div className="mb-3 text-xs font-semibold tracking-wide text-indigo-600 uppercase">
          {item.category}
        </div>
      )}
      <h1 className="text-4xl leading-tight font-bold tracking-tight">{item.title}</h1>
      <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
        {item.author && (
          <>
            <span className="font-medium text-zinc-700">{item.author}</span>
            <span>·</span>
          </>
        )}
        <time>{formatDate(item.published_at)}</time>
      </div>

      {item.cover_image && (
        <img src={item.cover_image} alt="" className="mt-8 w-full rounded-2xl object-cover" />
      )}

      <div
        className="article-body prose prose-zinc mt-10 max-w-none prose-headings:tracking-tight prose-a:text-indigo-600 prose-img:rounded-xl"
        dangerouslySetInnerHTML={{ __html: item.content_html }}
      />

      {item.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2 border-t border-zinc-100 pt-6">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
