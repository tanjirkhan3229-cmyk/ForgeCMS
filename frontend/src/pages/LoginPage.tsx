import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Hexagon, Loader2, Lock, Mail } from 'lucide-react'
import { authApi, getToken, setToken } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in — straight to the dashboard.
  if (getToken()) return <Navigate to="/admin" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await authApi.login(email.trim(), password)
      setToken(token)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Hexagon size={22} strokeWidth={2.5} />
          </span>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-zinc-900">ForgeCMS</h1>
            <p className="text-sm text-zinc-500">Sign in to the content studio</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        >
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-700">Email</label>
          <div className="relative mb-4">
            <Mail size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@forgesop.com"
              className="w-full rounded-lg border border-zinc-200 py-2 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 focus:outline-none"
            />
          </div>

          <label className="mb-1.5 block text-[13px] font-medium text-zinc-700">Password</label>
          <div className="relative mb-5">
            <Lock size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-200 py-2 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 focus:outline-none"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          ForgeCMS — Content Studio for ForgeSOP
        </p>
      </div>
    </div>
  )
}
