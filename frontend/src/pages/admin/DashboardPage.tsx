import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  FolderDown,
  HelpCircle,
  Newspaper,
  PencilLine,
  Plus,
  TrendingUp,
} from 'lucide-react'
import type { ContentItem, Module, OverviewStats } from '../../lib/api'
import { adminApi, formatDate, MODULE_LABELS, MODULE_SINGULAR } from '../../lib/api'
import StatusBadge from '../../components/StatusBadge'

const MODULES: { module: Module; icon: typeof FileText }[] = [
  { module: 'blogs', icon: FileText },
  { module: 'news', icon: Newspaper },
  { module: 'resources', icon: FolderDown },
  { module: 'faqs', icon: HelpCircle },
]

const WEEK_MS = 7 * 24 * 3600 * 1000

function publishedWithinWeek(items: ContentItem[]): number {
  const cutoff = Date.now() - WEEK_MS
  return items.filter((i) => {
    if (!i.published_at) return false
    const ts = new Date(i.published_at.endsWith('Z') ? i.published_at : i.published_at + 'Z').getTime()
    return ts >= cutoff
  }).length
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [recent, setRecent] = useState<ContentItem[]>([])
  const [publishedItems, setPublishedItems] = useState<ContentItem[]>([])
  const [resources, setResources] = useState<ContentItem[]>([])

  useEffect(() => {
    adminApi.overviewStats().then(setStats).catch(() => {})
    // One page per module is enough for weekly counts and the activity feed.
    Promise.all(MODULES.map(({ module }) => adminApi.list(module, { page_size: 50 })))
      .then((lists) => {
        const all = lists.flatMap((l) => l.items)
        setRecent(
          [...all]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .slice(0, 8),
        )
        setPublishedItems(all.filter((i) => i.status === 'published'))
        setResources(all.filter((i) => i.module === 'resources'))
      })
      .catch(() => {})
  }, [])

  const totals = useMemo(() => {
    if (!stats) return { published: 0, drafts: 0, scheduled: 0 }
    return Object.values(stats).reduce(
      (acc, s) => ({
        published: acc.published + s.published,
        drafts: acc.drafts + s.drafts,
        scheduled: acc.scheduled + s.scheduled,
      }),
      { published: 0, drafts: 0, scheduled: 0 },
    )
  }, [stats])

  const weekCount = publishedWithinWeek(publishedItems)
  const downloads = resources.reduce((sum, r) => sum + r.download_count, 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            What's happening across your content workspace
          </p>
        </div>
        <Link
          to="/admin/blogs/new"
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <Plus size={15} />
          New Blog Post
        </Link>
      </div>

      {/* Top stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Published this week"
          value={weekCount}
          sub={weekCount === 1 ? 'item went live' : 'items went live'}
          accent
        />
        <StatCard
          icon={CheckCircle2}
          label="Total published"
          value={totals.published}
          sub="live across all modules"
        />
        <StatCard
          icon={PencilLine}
          label="Drafts in progress"
          value={totals.drafts}
          sub="waiting to be finished"
        />
        <StatCard
          icon={CalendarClock}
          label="Scheduled"
          value={totals.scheduled}
          sub="queued for auto-publish"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Module breakdown */}
        <div className="xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Modules</h2>
          <div className="space-y-3">
            {MODULES.map(({ module, icon: Icon }) => {
              const s = stats?.[module]
              return (
                <Link
                  key={module}
                  to={`/admin/${module}/published`}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <Icon size={16} />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900">{MODULE_LABELS[module]}</div>
                    <div className="text-xs text-zinc-500">
                      {s ? `${s.published} published · ${s.drafts} drafts · ${s.scheduled} scheduled` : '…'}
                    </div>
                  </div>
                  <ArrowUpRight size={15} className="text-zinc-300 transition-colors group-hover:text-zinc-500" />
                </Link>
              )
            })}

            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                <Download size={16} />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-900">Resource downloads</div>
                <div className="text-xs text-zinc-500">all-time, across published resources</div>
              </div>
              <span className="text-lg font-semibold text-zinc-900">{downloads.toLocaleString()}</span>
            </div>
          </div>

          <h2 className="mt-6 mb-3 text-sm font-semibold text-zinc-900">Quick create</h2>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map(({ module, icon: Icon }) => (
              <Link
                key={module}
                to={`/admin/${module}/new`}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900"
              >
                <Icon size={14} />
                {MODULE_SINGULAR[module]}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Recent activity</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {recent.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                Nothing here yet — create your first piece of content.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Module</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={`${item.module}-${item.id}`} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/${item.module}/${item.id}/edit`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {item.title || 'Untitled'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{MODULE_LABELS[item.module]}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(item.updated_at, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof TrendingUp
  label: string
  value: number
  sub: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-500">{label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          <Icon size={15} />
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{sub}</div>
    </div>
  )
}
