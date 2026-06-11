import { useEffect, useState } from 'react'
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react'
import type { CmsUser, Role, UserStatus } from '../../lib/api'
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, settingsApi } from '../../lib/api'

const ROLES = Object.keys(ROLE_LABELS) as Role[]

const STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  invited: 'bg-sky-50 text-sky-700',
  suspended: 'bg-red-50 text-red-600',
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
]

export default function UserManagement() {
  const [users, setUsers] = useState<CmsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'author' as Role })

  const load = () =>
    settingsApi
      .listUsers()
      .then(setUsers)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const act = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      setError('Name and email are required')
      return
    }
    setAdding(true)
    setError('')
    try {
      await settingsApi.createUser({ ...newUser, status: 'invited' })
      setNewUser({ name: '', email: '', role: 'author' })
      setShowAdd(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="font-semibold">Users</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {users.length} member{users.length === 1 ? '' : 's'} — manage roles and access.
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {showAdd ? <X size={15} /> : <UserPlus size={15} />}
            {showAdd ? 'Cancel' : 'Add user'}
          </button>
        </div>

        {showAdd && (
          <div className="border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newUser.name}
                onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                placeholder="Full name"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                placeholder="email@company.com"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-zinc-500">Role</span>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as Role }))}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={addUser}
                disabled={adding}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Invite
              </button>
            </div>
          </div>
        )}

        {users.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-zinc-400">
            No users yet — add your first team member.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {users.map((user, i) => (
              <li key={user.id} className="flex items-center gap-4 px-6 py-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(user.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{user.name}</span>
                    {user.role === 'admin' && (
                      <ShieldCheck size={14} className="shrink-0 text-indigo-500" />
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[user.status]}`}
                    >
                      {user.status}
                    </span>
                  </div>
                  <div className="truncate text-sm text-zinc-400">
                    {user.email} · joined {formatDate(user.created_at)}
                  </div>
                </div>

                <select
                  value={user.role}
                  title={ROLE_DESCRIPTIONS[user.role]}
                  onChange={(e) =>
                    act(() => settingsApi.updateUser(user.id, { role: e.target.value as Role }))
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>

                <select
                  value={user.status}
                  onChange={(e) =>
                    act(() =>
                      settingsApi.updateUser(user.id, { status: e.target.value as UserStatus }),
                    )
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm capitalize outline-none focus:border-zinc-400"
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                </select>

                <button
                  title="Remove user"
                  onClick={() => {
                    if (confirm(`Remove ${user.name}? This cannot be undone.`)) {
                      act(() => settingsApi.deleteUser(user.id))
                    }
                  }}
                  className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-lg border border-zinc-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {r === 'admin' && <ShieldCheck size={14} className="text-indigo-500" />}
              {ROLE_LABELS[r]}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">{ROLE_DESCRIPTIONS[r]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
