import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Camera, Check, Loader2, RotateCcw, User, Users, Wand2 } from 'lucide-react'
import type { Profile } from '../../lib/api'
import { formatDate, settingsApi, uploadFile } from '../../lib/api'
import UserManagement from './UserManagement'

const EMPTY: Omit<Profile, 'updated_at'> = {
  display_name: '',
  email: '',
  title: '',
  bio: '',
  avatar_url: '',
}

const TABS = [
  { key: 'profile', label: 'Profile Settings', icon: User },
  { key: 'style', label: 'Writing Style', icon: Wand2 },
  { key: 'users', label: 'User Management', icon: Users },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabKey = requested === 'users' || requested === 'style' ? requested : 'profile'
  const setTab = (key: TabKey) =>
    setParams(key === 'profile' ? {} : { tab: key }, { replace: true })

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your profile and your team's access.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1" style={{ width: 'fit-content' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? <ProfileSettings /> : tab === 'style' ? <WritingStyleSettings /> : <UserManagement />}
    </div>
  )
}

function WritingStyleSettings() {
  const [value, setValue] = useState('')
  const [initial, setInitial] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    settingsApi
      .getToneGuide()
      .then((g) => {
        setValue(g.value)
        setInitial(g.value)
        setUpdatedAt(g.updated_at)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const g = await settingsApi.updateToneGuide(value)
      setValue(g.value)
      setInitial(g.value)
      setUpdatedAt(g.updated_at)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  const dirty = value !== initial

  return (
    <div>
      {error && (
        <div className="mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-3xl rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-semibold">House writing style</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            A style guide the AI writer follows for voice, structure and formatting on every
            draft when “Match house tone” is on. It shapes <em>how</em> articles read — facts still
            come from the knowledge base. Edit it freely to fine-tune the voice.
          </p>
        </div>

        <div className="px-6 py-6">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={22}
            placeholder="Describe the voice, structure and formatting the AI should follow…"
            className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-zinc-400"
          />
          {!value.trim() && (
            <p className="mt-2 text-xs text-zinc-400">
              Empty — the AI writer will fall back to the basic tone selector only.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          <span className="flex items-center gap-3 text-xs text-zinc-400">
            {updatedAt ? `Last updated ${formatDate(updatedAt, true)}` : ''}
            {dirty && (
              <button
                onClick={() => setValue(initial)}
                className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-900"
              >
                <RotateCcw size={12} /> Revert
              </button>
            )}
          </span>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileSettings() {
  const [form, setForm] = useState(EMPTY)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    settingsApi
      .getProfile()
      .then((p) => {
        setForm({
          display_name: p.display_name,
          email: p.email,
          title: p.title,
          bio: p.bio,
          avatar_url: p.avatar_url,
        })
        setUpdatedAt(p.updated_at)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const p = await settingsApi.updateProfile(form)
      setUpdatedAt(p.updated_at)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onAvatarPicked = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await uploadFile(file, 'image')
      setForm((f) => ({ ...f, avatar_url: res.url }))
    } catch (e) {
      setError(`Avatar upload failed: ${(e as Error).message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-zinc-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-2xl rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Shown as the default author identity for your content.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-zinc-300">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={32} />
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                title="Change avatar"
                className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm hover:text-zinc-900"
              >
                <Camera size={13} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onAvatarPicked(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
            <div>
              <div className="font-medium">{form.display_name || 'Your name'}</div>
              <div className="text-sm text-zinc-400">{form.title || 'Your role'}</div>
              {form.avatar_url && (
                <button
                  onClick={() => setForm((f) => ({ ...f, avatar_url: '' }))}
                  className="mt-1 text-xs font-medium text-red-600 hover:underline"
                >
                  Remove avatar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Display name">
              <input
                value={form.display_name}
                onChange={set('display_name')}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </Field>
          </div>

          <Field label="Title / role">
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="Content Manager"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </Field>

          <Field label="Bio">
            <textarea
              value={form.bio}
              onChange={set('bio')}
              rows={4}
              placeholder="A short bio shown alongside your author profile."
              className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          <span className="text-xs text-zinc-400">
            {updatedAt ? `Last updated ${formatDate(updatedAt, true)}` : ''}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} />
            ) : null}
            {saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  )
}
