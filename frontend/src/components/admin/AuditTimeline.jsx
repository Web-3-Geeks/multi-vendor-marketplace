import { describeActor, describeAudit } from '../../lib/audit'
import { formatDateTime } from '../../lib/format'

function AuditTimeline({ logs }) {
  return (
    <ol className="space-y-3 border-l border-slate-200 pl-4">
      {logs.map((log) => (
        <li key={log.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-indigo-400 ring-4 ring-white" />
          <p className="text-sm text-slate-800">{describeAudit(log)}</p>
          <p className="text-xs text-slate-500">
            {describeActor(log)} &middot; {formatDateTime(log.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  )
}

export default AuditTimeline
