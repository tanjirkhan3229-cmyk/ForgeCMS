import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  FileUp,
  ImagePlus,
  Loader2,
  Save,
  Send,
  Undo2,
  X,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import type { AiDraft, CmsUser, ContentItem, Module, Status } from '../../lib/api'
import {
  adminApi,
  formatBytes,
  formatDate,
  localInputToUtc,
  MODULE_SINGULAR,
  settingsApi,
  uploadFile,
  utcToLocalInput,
} from '../../lib/api'
import AiWriterPanel from '../../components/AiWriterPanel'
import StatusBadge from '../../components/StatusBadge'
import TiptapEditor from '../../components/TiptapEditor'

interface FormState {
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string
  author: string
  cover_image: string
  meta_title: string
  meta_description: string
  schema_code: string
  file_url: string
  file_name: string
  file_size: number
  file_type: string
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  category: '',
  tags: '',
  author: '',
  cover_image: '',
  meta_title: '',
  meta_description: '',
  schema_code: '',
  file_url: '',
  file_name: '',
  file_size: 0,
  file_type: '',
}

export default function EditorPage() {
  const { module, id } = useParams() as { module: Module; id?: string }
  const navigate = useNavigate()
  const isNew = !id

  const [form, setForm] = useState<FormState>(EMPTY)
  const [status, setStatus] = useState<Status>('draft')
  const [publishAtLocal, setPublishAtLocal] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [initialContent, setInitialContent] = useState<Record<string, unknown> | null>(null)
  const [editorReady, setEditorReady] = useState(isNew)
  const [sideTab, setSideTab] = useState<'details' | 'seo' | 'ai'>('details')

  const contentRef = useRef<{ json: Record<string, unknown>; html: string }>({ json: {}, html: '' })
  const coverInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [users, setUsers] = useState<CmsUser[]>([])

  useEffect(() => {
    settingsApi.listUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY)
      setStatus('draft')
      setInitialContent(null)
      setEditorReady(true)
      return
    }
    setLoading(true)
    setEditorReady(false)
    adminApi
      .get(module, Number(id))
      .then((item) => {
        setForm({
          title: item.title,
          slug: item.slug,
          excerpt: item.excerpt,
          category: item.category,
          tags: item.tags.join(', '),
          author: item.author,
          cover_image: item.cover_image,
          meta_title: item.meta_title,
          meta_description: item.meta_description,
          schema_code: item.schema_code,
          file_url: item.file_url,
          file_name: item.file_name,
          file_size: item.file_size,
          file_type: item.file_type,
        })
        setStatus(item.status)
        if (item.publish_at) setPublishAtLocal(utcToLocalInput(item.publish_at))
        contentRef.current = { json: item.content, html: item.content_html }
        setInitialContent(item.content)
        setEditorReady(true)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [module, id, isNew])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const buildPayload = (): Partial<ContentItem> => ({
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    category: form.category,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    author: form.author,
    cover_image: form.cover_image,
    meta_title: form.meta_title,
    meta_description: form.meta_description,
    schema_code: form.schema_code,
    content: contentRef.current.json,
    content_html: contentRef.current.html,
    file_url: form.file_url,
    file_name: form.file_name,
    file_size: form.file_size,
    file_type: form.file_type,
  })

  const save = async (nextStatus: Status, publishAtUtc: string | null = null) => {
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (nextStatus === 'scheduled' && !publishAtUtc) {
      setError('Pick a date and time to schedule')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...buildPayload(), status: nextStatus, publish_at: publishAtUtc }
      const saved = isNew
        ? await adminApi.create(module, payload)
        : await adminApi.update(module, Number(id), payload)
      setStatus(saved.status)
      setForm((f) => ({ ...f, slug: saved.slug }))
      setSavedAt(new Date().toLocaleTimeString())
      setShowSchedule(false)
      if (isNew) navigate(`/admin/${module}/${saved.id}/edit`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onCoverPicked = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await uploadFile(file)
      setForm((f) => ({ ...f, cover_image: res.url }))
    } catch (e) {
      setError(`Cover upload failed: ${(e as Error).message}`)
    }
  }

  const applyDraft = (draft: AiDraft) => {
    const editor = editorRef.current
    if (editor) {
      const hasContent = editor.getText().trim().length > 0
      if (hasContent && !confirm('Replace the current article body with the AI draft?')) return
      editor.commands.setContent(draft.content_html, true)
    } else {
      contentRef.current = { json: {}, html: draft.content_html }
    }
    setForm((f) => ({
      ...f,
      title: f.title || draft.title,
      excerpt: f.excerpt || draft.excerpt,
      meta_title: f.meta_title || draft.meta_title,
      meta_description: f.meta_description || draft.meta_description,
      tags: f.tags || draft.tags.join(', '),
    }))
  }

  const onResourcePicked = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await uploadFile(file)
      setForm((f) => ({
        ...f,
        file_url: res.url,
        file_name: res.file_name,
        file_size: res.file_size,
        file_type: res.file_type,
      }))
    } catch (e) {
      setError(`File upload failed: ${(e as Error).message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  const isFaq = module === 'faqs'

  return (
    <div className="px-10 py-6">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/admin/${module}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">
                {isNew ? `New ${MODULE_SINGULAR[module]}` : `Edit ${MODULE_SINGULAR[module]}`}
              </h1>
              <StatusBadge status={status} />
            </div>
            {savedAt && <p className="text-xs text-zinc-400">Saved at {savedAt}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'published' && !isNew && (
            <button
              onClick={() => save('draft')}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
            >
              <Undo2 size={14} /> Unpublish
            </button>
          )}
          <button
            onClick={() =>
              save(status, status === 'scheduled' && publishAtLocal ? localInputToUtc(publishAtLocal) : null)
            }
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
          >
            <Save size={14} />
            {status === 'draft' ? 'Save draft' : 'Save changes'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSchedule((s) => !s)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
            >
              <CalendarClock size={14} />
              {status === 'scheduled' ? 'Reschedule' : 'Schedule'}
            </button>
            {showSchedule && (
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Schedule publish</span>
                  <button onClick={() => setShowSchedule(false)} className="text-zinc-400 hover:text-zinc-700">
                    <X size={14} />
                  </button>
                </div>
                <input
                  type="datetime-local"
                  value={publishAtLocal}
                  onChange={(e) => setPublishAtLocal(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <button
                  onClick={() => save('scheduled', publishAtLocal ? localInputToUtc(publishAtLocal) : null)}
                  disabled={saving || !publishAtLocal}
                  className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  Confirm schedule
                </button>
                {status === 'scheduled' && publishAtLocal && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Currently scheduled for {formatDate(localInputToUtc(publishAtLocal), true)}
                  </p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => save('published')}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {status === 'published' ? 'Update & publish' : 'Publish now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex h-[calc(100vh-8.5rem)] items-stretch gap-6">
        {/* Main column: title + editor in one card */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <input
            value={form.title}
            onChange={set('title')}
            placeholder={isFaq ? 'Question, e.g. “How do I reset my password?”' : 'Title'}
            className="w-full shrink-0 border-b border-zinc-100 bg-transparent px-6 py-5 text-2xl font-bold tracking-tight outline-none placeholder:text-zinc-300"
          />
          {editorReady && (
            <TiptapEditor
              key={id ?? 'new'}
              embedded
              initialContent={initialContent}
              onUpdate={(json, html) => {
                contentRef.current = { json, html }
              }}
              onReady={(editor) => {
                editorRef.current = editor
              }}
              placeholder={isFaq ? 'Write the answer…' : 'Start writing…'}
            />
          )}
        </div>

        {/* Side rail: one card, three tabs */}
        <aside className="flex min-h-0 w-80 shrink-0 flex-col self-stretch overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="shrink-0 border-b border-zinc-100 p-2">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
              {(
                [
                  { key: 'details', label: 'Details' },
                  { key: 'seo', label: 'SEO' },
                  { key: 'ai', label: 'AI Writer' },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSideTab(t.key)}
                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    sideTab === t.key
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {sideTab === 'details' && (
              <>
                {module === 'resources' && (
                  <Field label="Downloadable file">
                    {form.file_url ? (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                        <div className="truncate text-sm font-medium">{form.file_name}</div>
                        <div className="mt-0.5 text-xs text-zinc-400">
                          {formatBytes(form.file_size)} · {form.file_type}
                        </div>
                        <button
                          onClick={() =>
                            setForm((f) => ({ ...f, file_url: '', file_name: '', file_size: 0, file_type: '' }))
                          }
                          className="mt-2 text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      >
                        <FileUp size={16} /> Upload file
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        onResourcePicked(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </Field>
                )}

                {!isFaq && (
                  <Field label="Cover image">
                    {form.cover_image ? (
                      <div>
                        <img
                          src={form.cover_image}
                          alt="Cover"
                          className="aspect-[16/9] w-full rounded-lg object-cover"
                        />
                        <button
                          onClick={() => setForm((f) => ({ ...f, cover_image: '' }))}
                          className="mt-2 text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove image
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
                      >
                        <ImagePlus size={16} /> Upload cover
                      </button>
                    )}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        onCoverPicked(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </Field>
                )}

                <Field label="Slug">
                  <input
                    value={form.slug}
                    onChange={set('slug')}
                    placeholder="auto-generated-from-title"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label={isFaq ? 'Short answer (shown in lists)' : 'Excerpt'}>
                  <textarea
                    value={form.excerpt}
                    onChange={set('excerpt')}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label="Category">
                  <input
                    value={form.category}
                    onChange={set('category')}
                    placeholder={isFaq ? 'e.g. Billing' : 'e.g. Product'}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label="Tags (comma separated)">
                  <input
                    value={form.tags}
                    onChange={set('tags')}
                    placeholder="react, fastapi"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label="Author">
                  <select
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  >
                    <option value="">— No author —</option>
                    {form.author && !users.some((u) => u.name === form.author) && (
                      <option value={form.author}>{form.author}</option>
                    )}
                    {users.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {sideTab === 'seo' && (
              <>
                <Field label={`Meta title (${form.meta_title.length}/60)`}>
                  <input
                    value={form.meta_title}
                    onChange={set('meta_title')}
                    placeholder={form.title || 'Defaults to the title'}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label={`Meta description (${form.meta_description.length}/160)`}>
                  <textarea
                    value={form.meta_description}
                    onChange={set('meta_description')}
                    rows={3}
                    placeholder="A short summary shown in search results."
                    className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  />
                </Field>
                <Field label="Schema code (JSON-LD)">
                  <textarea
                    value={form.schema_code}
                    onChange={set('schema_code')}
                    rows={6}
                    spellCheck={false}
                    placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}'}
                    className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-400"
                  />
                  {schemaInvalid(form.schema_code) && (
                    <p className="mt-1 text-xs text-amber-600">
                      Heads up: this is not valid JSON — it will be embedded as-is.
                    </p>
                  )}
                </Field>
              </>
            )}

            {sideTab === 'ai' && <AiWriterPanel module={module} onDraft={applyDraft} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

function schemaInvalid(code: string): boolean {
  if (!code.trim()) return false
  try {
    JSON.parse(code)
    return false
  } catch {
    return true
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  )
}
