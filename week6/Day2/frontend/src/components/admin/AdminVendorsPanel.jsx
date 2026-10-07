import { useState } from 'react'
import { Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { VENDOR_STATUS, VENDOR_STATUS_TONE, readableStatus } from '../../constants/status'
import { Panel, EmptyState } from '../dashboard/widgets'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'

const TABS = [
  { value: '', label: 'All' },
  { value: VENDOR_STATUS.PENDING, label: 'Pending' },
  { value: VENDOR_STATUS.APPROVED, label: 'Approved' },
  { value: VENDOR_STATUS.SUSPENDED, label: 'Suspended' },
  { value: VENDOR_STATUS.REJECTED, label: 'Rejected' },
]

function ActionButton({ onClick, tone, children, disabled }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
    slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function AdminVendorsPanel() {
  const { token } = useAuth()
  const [tab, setTab] = useState('')
  const { data, loading, error, reload } = useApi(
    `/admin/vendors${tab ? `?status=${tab}` : ''}`,
    { auth: true },
  )
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const setStatus = async (vendor, status) => {
    setActionError('')
    setBusyId(vendor._id)
    try {
      await apiRequest(`/admin/vendors/${vendor._id}/status`, { method: 'PATCH', token, body: { status } })
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const vendors = data?.vendors || []

  return (
    <Panel title="Vendor applications">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="mb-3">
          <Alert>{actionError}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-3">
          <Alert>{error.message}</Alert>
        </div>
      )}

      {loading ? (
        <Spinner label="Loading vendors..." />
      ) : vendors.length === 0 ? (
        <EmptyState icon={Store} title="No vendor applications" text="Applications will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {vendors.map((vendor) => (
            <li key={vendor._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{vendor.storeName}</p>
                  <Badge tone={VENDOR_STATUS_TONE[vendor.status]}>{readableStatus(vendor.status)}</Badge>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {vendor.user?.name} &middot; {vendor.user?.email}
                </p>
              </div>
              <div className="flex gap-1.5">
                {vendor.status !== VENDOR_STATUS.APPROVED && (
                  <ActionButton
                    tone="emerald"
                    disabled={busyId === vendor._id}
                    onClick={() => setStatus(vendor, VENDOR_STATUS.APPROVED)}
                  >
                    Approve
                  </ActionButton>
                )}
                {vendor.status === VENDOR_STATUS.PENDING && (
                  <ActionButton
                    tone="rose"
                    disabled={busyId === vendor._id}
                    onClick={() => setStatus(vendor, VENDOR_STATUS.REJECTED)}
                  >
                    Reject
                  </ActionButton>
                )}
                {vendor.status === VENDOR_STATUS.APPROVED && (
                  <ActionButton
                    tone="slate"
                    disabled={busyId === vendor._id}
                    onClick={() => setStatus(vendor, VENDOR_STATUS.SUSPENDED)}
                  >
                    Suspend
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export default AdminVendorsPanel
