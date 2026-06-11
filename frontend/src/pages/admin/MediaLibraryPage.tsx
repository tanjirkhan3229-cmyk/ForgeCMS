import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import type { MediaFile } from '../../lib/api'
import { formatBytes, formatDate, mediaApi, uploadFile } from '../../lib/api'

const PAGE_SIZE = 24
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'file', label: 'Files' },
] as const

export default function MediaLibraryPage() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'' | 'image' | 'file'>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await mediaApi.list({
        search: search || undefined,
        type: filter || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setFiles(res.items)
      setTotal(res.total)
      if (res.items.length === 0 && page > 1) setPage((p) => p - 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search, filter, page])

  useEffect(() => {
    setPage(1)
  }, [filter, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const onUpload = async (picked: FileList | null) => {
    if (!picked?.length) return
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(picked)) {
        await uploadFile(file)
      }
      await load()
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const copyUrl = async (file: MediaFile) => {
    const absolute = `${window.location.origin}${file.url}`
    await navigator.clipboard.writeText(absolute)
    setCopied(file.name)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="px-10 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
          <p className="mt-1 text-sm text-zinc-500">
            All uploaded images and files. {total} item{total === 1 ? '' : 's'}.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          <Upload size={16} />
          {uploading ? 'Uploading…' : 'Upload files'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-sm text-zinc-400">Loading…</div>
      ) : files.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-20 text-center"
        >
          <p className="text-sm font-medium text-zinc-600">No media yet</p>
          <p className="mt-1 text-sm text-zinc-400">
            Upload images and files here, or insert them directly from the editor.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {files.map((file) => (
              <div
                key={file.name}
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md hover:shadow-zinc-100"
              >
                <div className="relative aspect-square bg-zinc-50">
                  {file.is_image ? (
                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-300">
                      <FileText size={32} />
                      <span className="px-2 text-center text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                        {file.name.split('.').pop()}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-zinc-900/0 opacity-0 transition-all group-hover:bg-zinc-900/40 group-hover:opacity-100">
                    <button
                      title="Copy URL"
                      onClick={() => copyUrl(file)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-700 shadow-sm hover:bg-zinc-100"
                    >
                      {copied === file.name ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                    <button
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete ${file.name}? Content referencing it will show a broken link.`)) {
                          mediaApi
                            .remove(file.name)
                            .then(load)
                            .catch((e) => setError((e as Error).message))
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="truncate text-xs font-medium" title={file.name}>
                    {file.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">
                    {formatBytes(file.size)} · {formatDate(file.modified_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
