import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderDown,
  Globe,
  HelpCircle,
  Hexagon,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Newspaper,
  PencilLine,
  Plus,
  Settings,
} from 'lucide-react'
import type { AuthUser, Module, OverviewStats } from '../lib/api'
import { adminApi, authApi, clearToken, MODULE_LABELS } from '../lib/api'

const MODULES: { module: Module; icon: typeof FileText }[] = [
  { module: 'blogs', icon: FileText },
  { module: 'news', icon: Newspaper },
  { module: 'resources', icon: FolderDown },
  { module: 'faqs', icon: HelpCircle },
]

export default function AdminLayout() {
  const location = useLocation()
  const activeModule = MODULES.find((m) =>
    location.pathname.startsWith(`/admin/${m.module}`),
  )?.module
  const [open, setOpen] = useState<Record<string, boolean>>(
    activeModule ? { [activeModule]: true } : { blogs: true },
  )
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const navigate = useNavigate()

  // Refresh sidebar counts whenever the route changes (e.g. after saving).
  useEffect(() => {
    adminApi.overviewStats().then(setStats).catch(() => {})
  }, [location.pathname])

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {})
  }, [])

  function logout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (activeModule) setOpen((o) => ({ ...o, [activeModule]: true }))
  }, [activeModule])

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-zinc-200 bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-zinc-100 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Hexagon size={16} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-sm leading-tight font-semibold">ForgeCMS</div>
            <div className="text-[11px] leading-tight text-zinc-400">Content Studio</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>

          <div className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Content
          </div>
          {MODULES.map(({ module, icon: Icon }) => {
            const expanded = open[module]
            const moduleStats = stats?.[module]
            return (
              <div key={module} className="mb-0.5">
                <button
                  onClick={() => setOpen((o) => ({ ...o, [module]: !o[module] }))}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    activeModule === module
                      ? 'text-zinc-900'
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1 text-left">{MODULE_LABELS[module]}</span>
                  <ChevronRight
                    size={14}
                    className={`text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  />
                </button>
                {expanded && (
                  <div className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-zinc-100 pl-3">
                    <SubLink to={`/admin/${module}/new`} icon={Plus} label="Create New" />
                    <SubLink
                      to={`/admin/${module}/drafts`}
                      icon={PencilLine}
                      label="Drafts"
                      count={moduleStats?.drafts}
                    />
                    <SubLink
                      to={`/admin/${module}/published`}
                      icon={CheckCircle2}
                      label="Published"
                      count={moduleStats?.published}
                    />
                    <SubLink
                      to={`/admin/${module}/scheduled`}
                      icon={CalendarClock}
                      label="Scheduled"
                      count={moduleStats?.scheduled}
                      accent
                    />
                  </div>
                )}
              </div>
            )
          })}

          <div className="mt-6 px-2 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Workspace
          </div>
          <NavLink
            to="/admin/knowledge"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`
            }
          >
            <BookOpen size={16} />
            Knowledge Base
          </NavLink>
          <NavLink
            to="/admin/media"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`
            }
          >
            <ImageIcon size={16} />
            Media Library
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              }`
            }
          >
            <Settings size={16} />
            Settings
          </NavLink>
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <a
            href="/blogs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <Globe size={16} />
            View site
          </a>
          <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
              {(user?.name || 'A').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] leading-tight font-medium text-zinc-900">
                {user?.name || '—'}
              </div>
              <div className="truncate text-[11px] leading-tight text-zinc-400">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

function SubLink({
  to,
  icon: Icon,
  label,
  count,
  accent,
}: {
  to: string
  icon: typeof Plus
  label: string
  count?: number
  accent?: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${
          isActive
            ? 'bg-zinc-100 text-zinc-900'
            : accent
              ? 'text-amber-700 hover:bg-amber-50'
              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
        }`
      }
    >
      <Icon size={13} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && <span className="text-xs text-zinc-400">{count}</span>}
    </NavLink>
  )
}
