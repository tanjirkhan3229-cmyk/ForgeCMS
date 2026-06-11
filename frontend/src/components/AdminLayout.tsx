import { NavLink, Outlet } from 'react-router-dom'
import { FileText, Newspaper, FolderDown, HelpCircle, Globe, Hexagon } from 'lucide-react'
import type { Module } from '../lib/api'
import { MODULE_LABELS } from '../lib/api'

const NAV: { module: Module; icon: typeof FileText }[] = [
  { module: 'blogs', icon: FileText },
  { module: 'news', icon: Newspaper },
  { module: 'resources', icon: FolderDown },
  { module: 'faqs', icon: HelpCircle },
]

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-zinc-100 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Hexagon size={16} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-sm leading-tight font-semibold">ForgeCMS</div>
            <div className="text-[11px] leading-tight text-zinc-400">Content Studio</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Content
          </div>
          {NAV.map(({ module, icon: Icon }) => (
            <NavLink
              key={module}
              to={`/admin/${module}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`
              }
            >
              <Icon size={16} />
              {MODULE_LABELS[module]}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <Globe size={16} />
            View site
          </a>
        </div>
      </aside>

      <main className="ml-60 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
