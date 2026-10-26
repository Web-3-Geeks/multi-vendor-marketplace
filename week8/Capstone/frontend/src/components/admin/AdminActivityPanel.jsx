import { useState } from 'react'
import { History } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { formatDateTime } from '../../lib/format'
import { AUDIT_ACTIONS, describeActor, describeAudit } from '../../lib/audit'
import { readableStatus } from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import SelectField from '../ui/SelectField'
import Spinner from '../ui/Spinner'
import TextField from '../ui/TextField'

const PAGE_SIZE = 10

const ACTION_OPTIONS = [
  { value: '', label: 'All activity' },
  ...AUDIT_ACTIONS.map((value) => ({ value, label: readableStatus(value) })),
]

const ENTITY_TONE = { ORDER: 'indigo', PAYMENT: 'emerald', VENDOR: 'amber', PRODUCT: 'slate', CATEGORY: 'slate' }

function AdminActivityPanel() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '' })
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const { data, loading, error } = useApi(`/admin/audit-logs?${params}`, { auth: true })

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const logs = data?.logs || []

  return (
    <Panel title="Activity log">
      <p className="-mt-2 mb-4 text-xs text-slate-500">
        A permanent record of payments, refunds, order status changes and admin actions. Entries can't be edited or
        deleted.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SelectField
          id="admin-activity-action"
          label="Activity"
          value={filters.action}
          onChange={(e) => applyFilter({ action: e.target.value })}
          options={ACTION_OPTIONS}
        />
        <TextField
          id="admin-activity-from"
          label="From"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => applyFilter({ from: e.target.value })}
        />
        <TextField
          id="admin-activity-to"
          label="To"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => applyFilter({ to: e.target.value })}
        />
      </div>

      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {!data ? (
        loading && <Spinner label="Loading activity..." />
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="No activity found" text="Try a different filter or date range." />
      ) : (
        <ul aria-busy={loading} className={`divide-y divide-slate-100 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{describeAudit(log)}</p>
                <p className="text-xs text-slate-500">
                  {describeActor(log)}
                  {log.orderId && <> &middot; order #{String(log.orderId).slice(-8).toUpperCase()}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={ENTITY_TONE[log.entityType]}>{readableStatus(log.entityType)}</Badge>
                <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}
    </Panel>
  )
}

export default AdminActivityPanel
