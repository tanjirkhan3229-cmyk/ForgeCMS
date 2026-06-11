import { CalendarClock, CheckCircle2, PencilLine } from 'lucide-react'
import type { Status } from '../lib/api'

const STYLES: Record<Status, { className: string; label: string; icon: typeof PencilLine }> = {
  draft: { className: 'bg-zinc-100 text-zinc-600', label: 'Draft', icon: PencilLine },
  scheduled: { className: 'bg-amber-50 text-amber-700', label: 'Scheduled', icon: CalendarClock },
  published: { className: 'bg-emerald-50 text-emerald-700', label: 'Published', icon: CheckCircle2 },
}

export default function StatusBadge({ status }: { status: Status }) {
  const { className, label, icon: Icon } = STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon size={12} />
      {label}
    </span>
  )
}
