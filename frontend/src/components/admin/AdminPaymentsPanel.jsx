import { useState } from 'react'
import { CreditCard, Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { formatDateTime, formatPrice } from '../../lib/format'
import { ORDER_STATUS_TONE, PAYMENT_STATUS, PAYMENT_STATUS_TONE, readableStatus } from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'
import Spinner from '../ui/Spinner'
import TextArea from '../ui/TextArea'
import TextField from '../ui/TextField'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.values(PAYMENT_STATUS).map((value) => ({ value, label: readableStatus(value) })),
]

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}

function PaymentDetailModal({ paymentId, onClose }) {
  const { data, loading, error } = useApi(`/admin/payments/${paymentId}`, { auth: true })
  const payment = data?.payment

  return (
    <Modal title="Payment details" onClose={onClose} size="lg">
      {error && <Alert>{error.message}</Alert>}
      {loading && !payment && <Spinner label="Loading payment..." />}
      {payment && (
        <div className="space-y-4">
          <dl className="divide-y divide-slate-100">
            <Row label="Status">
              <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{readableStatus(payment.status)}</Badge>
            </Row>
            <Row label="Amount">{formatPrice(payment.amount)} {payment.currency}</Row>
            <Row label="Transaction"><span className="font-mono text-xs">{payment.transactionId}</span></Row>
            <Row label="Provider">{payment.provider}</Row>
            <Row label="Customer">
              {payment.customer?.name}
              <span className="block text-xs font-normal text-slate-500">{payment.customer?.email}</span>
            </Row>
            <Row label="Order">
              #{payment.order?.id.slice(-8).toUpperCase()}{' '}
              <Badge tone={ORDER_STATUS_TONE[payment.order?.status]}>{readableStatus(payment.order?.status || 'PENDING')}</Badge>
            </Row>
            <Row label="Created">{formatDateTime(payment.createdAt)}</Row>
            {payment.paidAt && <Row label="Paid">{formatDateTime(payment.paidAt)}</Row>}
            {payment.refund && (
              <Row label="Refunded">
                {formatDateTime(payment.refund.at)}
                {payment.refund.reason && (
                  <span className="block text-xs font-normal text-slate-500">{payment.refund.reason}</span>
                )}
              </Row>
            )}
          </dl>

          <div>
            <p className="mb-2 text-sm font-semibold">Items in this order</p>
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 text-sm">
              {payment.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate">
                    {item.productName} <span className="text-slate-400">x{item.quantity}</span>
                    <span className="block text-xs text-slate-400">{item.vendor?.storeName}</span>
                  </span>
                  <span className="font-medium">{formatPrice(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}

function RefundModal({ payment, onClose, onRefunded }) {
  const { token } = useAuth()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await apiRequest(`/admin/payments/${payment.id}/refund`, {
        method: 'POST',
        token,
        body: reason.trim() ? { reason: reason.trim() } : {},
      })
      onRefunded()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="Refund payment"
      description={`${formatPrice(payment.amount)} will be returned to ${payment.customer?.email}. This can't be undone.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Items that haven't been delivered are cancelled and returned to stock, and the vendors' commission for this
          order is voided.
        </p>
        <TextArea
          id="refund-reason"
          label="Reason (optional)"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <Button type="submit" fullWidth={false} loading={submitting} className="bg-rose-600 shadow-rose-600/20 hover:bg-rose-500">
            Refund {formatPrice(payment.amount)}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AdminPaymentsPanel() {
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' })
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const { data, loading, error, reload } = useApi(`/admin/payments?${params}`, { auth: true })

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const submitSearch = (e) => {
    e.preventDefault()
    applyFilter({ search: searchInput.trim() })
  }

  const payments = data?.payments || []

  return (
    <Panel title="Payments">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <form onSubmit={submitSearch}>
          <label htmlFor="admin-payment-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Transaction ID
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-payment-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="mock_txn_..."
              maxLength={100}
              className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-3.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </form>
        <SelectField
          id="admin-payment-status"
          label="Status"
          value={filters.status}
          onChange={(e) => applyFilter({ status: e.target.value })}
          options={STATUS_OPTIONS}
        />
        <TextField
          id="admin-payment-from"
          label="From"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => applyFilter({ from: e.target.value })}
        />
        <TextField
          id="admin-payment-to"
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
        loading && <Spinner label="Loading payments..." />
      ) : payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments found" text="Try changing the search or filters." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-slate-600">{payment.transactionId}</p>
                <p className="truncate text-xs text-slate-500">
                  {payment.customer?.name} &middot; order #{payment.order?.id.slice(-8).toUpperCase()} &middot;{' '}
                  {formatDateTime(payment.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{readableStatus(payment.status)}</Badge>
                <span className="w-20 text-right text-sm font-semibold">{formatPrice(payment.amount)}</span>
                <button
                  type="button"
                  onClick={() => setDetailId(payment.id)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Details
                </button>
                {payment.status === PAYMENT_STATUS.PAID && (
                  <button
                    type="button"
                    onClick={() => setRefundTarget(payment)}
                    className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Refund
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {detailId && <PaymentDetailModal paymentId={detailId} onClose={() => setDetailId(null)} />}
      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => {
            setRefundTarget(null)
            reload()
          }}
        />
      )}
    </Panel>
  )
}

export default AdminPaymentsPanel
