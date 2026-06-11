import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Brain,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import type { KnowledgeDoc } from '../../lib/api'
import { formatBytes, formatDate, knowledgeApi } from '../../lib/api'

export default function KnowledgeBasePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedContent, setExpandedContent] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () =>
    knowledgeApi
      .list()
      .then(setDocs)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        await knowledgeApi.upload(file)
      }
      await load()
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const toggleExpand = async (doc: KnowledgeDoc) => {
    if (expandedId === doc.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(doc.id)
    setExpandedContent('')
    try {
      const detail = await knowledgeApi.get(doc.id)
      setExpandedContent(detail.content)
    } catch (e) {
      setExpandedContent(`Could not load content: ${(e as Error).message}`)
    }
  }

  const reanalyze = async (id: number) => {
    setBusyId(id)
    setError('')
    try {
      await knowledgeApi.reanalyze(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (doc: KnowledgeDoc) => {
    if (!confirm(`Remove ${doc.file_name} from the AI's knowledge? This cannot be undone.`)) return
    setError('')
    try {
      await knowledgeApi.remove(doc.id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Brain size={22} className="text-indigo-500" />
            Knowledge Base
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Upload Markdown or text documents and the AI writer will ground its drafts in them —
            facts, terminology and product details come from here instead of the model's guesswork.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'Uploading & analyzing…' : 'Upload documents'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={(e) => {
            onUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-sm text-zinc-400">Loading…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-20 text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-600">The AI's brain is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">
            Upload .md or .txt files — product docs, style guides, fact sheets — and every AI draft
            will be grounded in them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => {
            const expanded = expandedId === doc.id
            return (
              <div key={doc.id} className="rounded-xl border border-zinc-200 bg-white">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{doc.file_name}</span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatBytes(doc.size)} · {formatDate(doc.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {doc.summary || (
                        <span className="text-zinc-400 italic">
                          Not analyzed yet — use the refresh action to analyze.
                        </span>
                      )}
                    </p>
                    {doc.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {doc.keywords.map((k) => (
                          <span
                            key={k}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      title="Re-run AI analysis"
                      onClick={() => reanalyze(doc.id)}
                      disabled={busyId === doc.id}
                      className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                    >
                      {busyId === doc.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <RefreshCw size={15} />
                      )}
                    </button>
                    <button
                      title={expanded ? 'Hide content' : 'View content'}
                      onClick={() => toggleExpand(doc)}
                      className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <button
                      title="Delete document"
                      onClick={() => remove(doc)}
                      className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
                    <pre className="max-h-80 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-600">
                      {expandedContent || 'Loading…'}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
