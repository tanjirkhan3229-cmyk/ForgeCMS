import { NavLink, Outlet, Link } from 'react-router-dom'
import { Hexagon } from 'lucide-react'

const LINKS = [
  { to: '/blogs', label: 'Blog' },
  { to: '/news', label: 'News' },
  { to: '/resources', label: 'Resources' },
  { to: '/faqs', label: 'FAQ' },
]

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Hexagon size={16} strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Forge</span>
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/admin"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Admin
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-100 py-10">
        <div className="mx-auto max-w-6xl px-6 text-sm text-zinc-400">
          © {new Date().getFullYear()} Forge — powered by ForgeCMS
        </div>
      </footer>
    </div>
  )
}
