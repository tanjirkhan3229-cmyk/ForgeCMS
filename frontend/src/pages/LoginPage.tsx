import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hexagon, Loader2, Lock, Mail } from 'lucide-react'
import { authApi } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // On success the backend sets the httpOnly session cookie; nothing to store here.
      await authApi.login(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4">
      {/* Decorative geometric backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* soft gradient blobs */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />

        {/* outlined hexagons echoing the logo */}
        <Hexagon
          size={300}
          strokeWidth={0.5}
          className="absolute -top-16 right-[12%] rotate-12 text-indigo-500/10"
        />
        <Hexagon
          size={180}
          strokeWidth={0.7}
          className="absolute bottom-[8%] left-[10%] -rotate-12 text-zinc-500/10"
        />
        <Hexagon
          size={90}
          strokeWidth={1}
          className="absolute top-[18%] left-[22%] rotate-45 text-emerald-500/15"
        />

        {/* rings and rotated squares */}
        <div className="absolute top-[12%] right-[28%] h-24 w-24 rounded-full border border-zinc-400/15" />
        <div className="absolute bottom-[20%] right-[14%] h-32 w-32 rounded-full border-2 border-indigo-400/10" />
        <div className="absolute top-[60%] left-[16%] h-16 w-16 rotate-45 rounded-lg border border-amber-500/15" />
        <div className="absolute top-[8%] left-[45%] h-10 w-10 rotate-12 rounded-md border border-indigo-400/20" />
        <div className="absolute right-[8%] bottom-[42%] h-3 w-3 rotate-45 bg-indigo-400/15" />
        <div className="absolute bottom-[12%] left-[38%] h-2.5 w-2.5 rounded-full bg-emerald-500/20" />
        <div className="absolute top-[30%] left-[8%] h-2 w-2 rounded-full bg-zinc-500/20" />

        {/* faint dot grid, masked toward the center */}
        <div
          className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_85%)]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgb(161 161 170 / 0.35) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
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
          className="rounded-2xl border border-zinc-200/80 bg-white/80 p-6 shadow-xl shadow-zinc-200/50 backdrop-blur-md"
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
