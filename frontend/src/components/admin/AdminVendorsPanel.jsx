import { useState } from 'react'
import { Search, Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { useNotice } from '../../hooks/useNotice'
import { apiRequest } from '../../lib/api'
import { VENDOR_STATUS, VENDOR_STATUS_TONE, readableStatus } from '../../constants/status'
import { Panel, EmptyState } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Badge from '../ui/Badge'
import ConfirmDialog from '../ui/ConfirmDialog'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'

const TABS = [
  { value: '', label: 'All' },
  { value: VENDOR_STATUS.PENDING, label: 'Pending' },
  { value: VENDOR_STATUS.APPROVED, label: 'Approved' },
  { value: VENDOR_STATUS.SUSPENDED, label: 'Suspended' },
  { value: VENDOR_STATUS.REJECTED, label: 'Rejected' },
]

const PAGE_SIZE = 10

const CONFIRM_COPY = {
  [VENDOR_STATUS.REJECTED]: (name) => ({
    title: 'Reject this application?',
    confirmLabel: 'Reject',
    message: `${name}'s application will be rejected and the applicant stays a regular customer.`,
  }),
  [VENDOR_STATUS.SUSPENDED]: (name) => ({
    title: 'Suspend this store?',
    confirmLabel: 'Suspend',
    message: `${name} will be hidden from the marketplace and the vendor can't manage products or orders until you approve the store again.`,
  }),
}

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
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (tab) params.set('status', tab)
  if (search) params.set('search', search)
  const { data, loading, error, reload } = useApi(`/admin/vendors?${params}`, { auth: true })

  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [notice, showNotice] = useNotice()
  const [confirm, setConfirm] = useState(null)

  const changeTab = (value) => {
    setTab(value)
    setPage(1)
  }

  const submitSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const applyStatus = async (vendor, status) => {
    await apiRequest(`/admin/vendors/${vendor._id}/status`, { method: 'PATCH', token, body: { status } })
    showNotice(`${vendor.storeName} is now ${readableStatus(status).toLowerCase()}.`)
    reload()
  }

  const setStatus = async (vendor, status) => {
    if (CONFIRM_COPY[status]) {
      setConfirm({ vendor, status })
      return
    }
    setActionError('')
    setBusyId(vendor._id)
    try {
      await applyStatus(vendor, status)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const vendors = data?.vendors || []
  const copy = confirm && CONFIRM_COPY[confirm.status](confirm.vendor.storeName)

  return (
    <Panel title="Vendor applications">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => changeTab(t.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="relative w-full sm:w-56">
          <label htmlFor="admin-vendor-search" className="sr-only">
            Search stores
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="admin-vendor-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search store name"
            maxLength={100}
            className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </form>
      </div>

      {notice && (
        <div className="mb-3">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
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

      {!data ? (
        loading && <Spinner label="Loading vendors..." />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No vendor applications"
          text={search || tab ? 'Nothing matches this search or filter.' : 'Applications will appear here.'}
        />
      ) : (
        <ul aria-busy={loading} className={`divide-y divide-slate-100 transition-opacity ${loading ? 'opacity-60' : ''}`}>
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

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {confirm && (
        <ConfirmDialog
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            await applyStatus(confirm.vendor, confirm.status)
            setConfirm(null)
          }}
        />
      )}
    </Panel>
  )
}

export default AdminVendorsPanel
