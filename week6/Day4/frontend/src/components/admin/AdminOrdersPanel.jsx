import { useState } from 'react'
import { Package, Search, Store } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { formatDate, formatDateTime, formatPrice } from '../../lib/format'
import {
  ORDER_STATUS,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS,
  PAYMENT_STATUS_TONE,
  nextOrderStatus,
  orderPaymentLabel,
  readableStatus,
} from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'
import Spinner from '../ui/Spinner'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.values(ORDER_STATUS).map((value) => ({ value, label: readableStatus(value) })),
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'All payments' },
  ...Object.values(PAYMENT_STATUS).map((value) => ({ value, label: orderPaymentLabel(value) })),
]

const actionClass = {
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
}

function ActionButton({ tone, children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${actionClass[tone]}`}
      {...props}
    >
      {children}
    </button>
  )
}

function OrderDetailModal({ orderId, onClose }) {
  const { data, loading, error } = useApi(`/admin/orders/${orderId}`, { auth: true })
  const order = data?.order

  const vendors = new Map()
  for (const item of order?.items || []) {
    const key = item.vendor?.id || 'unknown'
    if (!vendors.has(key)) vendors.set(key, { name: item.vendor?.storeName || 'Unknown store', items: [] })
    vendors.get(key).items.push(item)
  }

  return (
    <Modal
      title={order ? `Order #${order.id.slice(-8).toUpperCase()}` : 'Order'}
      description={order && `Placed ${formatDateTime(order.createdAt)}`}
      onClose={onClose}
      size="lg"
    >
      {error && <Alert>{error.message}</Alert>}
      {loading && !order && <Spinner label="Loading order..." />}
      {order && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_STATUS_TONE[order.status]}>{readableStatus(order.status)}</Badge>
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{orderPaymentLabel(order.paymentStatus)}</Badge>
            <span className="text-sm text-slate-500">
              {order.customer?.name} &middot; {order.customer?.email}
            </span>
          </div>

          {Array.from(vendors.values()).map((group) => (
            <section key={group.name} className="rounded-2xl border border-slate-100 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Store aria-hidden="true" className="size-4 text-slate-400" />
                {group.name}
              </p>
              <ul className="divide-y divide-slate-100 text-sm">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">
                      {item.productName} <span className="text-slate-400">x{item.quantity}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={ORDER_STATUS_TONE[item.status]}>{readableStatus(item.status)}</Badge>
                      <span className="w-16 text-right font-medium">{formatPrice(item.subtotal)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div>
            <p className="mb-2 text-sm font-semibold">Payment attempts</p>
            {order.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payment has been started for this order.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="min-w-0 truncate font-mono text-xs text-slate-500">{p.transactionId}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{readableStatus(p.status)}</Badge>
                      <span className="font-medium">{formatPrice(p.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping, tax, discount</dt>
              <dd>{formatPrice(order.shippingAmount + order.taxAmount - order.discountAmount)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(order.totalAmount)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  )
}

function AdminOrdersPanel() {
  const { token } = useAuth()
  const [filters, setFilters] = useState({ search: '', status: '', paymentStatus: '' })
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const { data, loading, error, reload } = useApi(`/admin/orders?${params}`, { auth: true })

  const applyFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const submitSearch = (e) => {
    e.preventDefault()
    applyFilter({ search: searchInput.trim() })
  }

  const setStatus = async (order, status) => {
    setActionError('')
    setBusyId(order.id)
    try {
      await apiRequest(`/admin/orders/${order.id}/status`, { method: 'PATCH', token, body: { status } })
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const orders = data?.orders || []

  return (
    <Panel title="Orders">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <form onSubmit={submitSearch} className="sm:col-span-1">
          <label htmlFor="admin-order-search" className="mb-1.5 block text-sm font-medium text-slate-700">
            Search
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="admin-order-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Customer, email or order #"
              maxLength={100}
              className="block w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-3.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </form>
        <SelectField
          id="admin-order-status"
          label="Order status"
          value={filters.status}
          onChange={(e) => applyFilter({ status: e.target.value })}
          options={STATUS_OPTIONS}
        />
        <SelectField
          id="admin-order-payment"
          label="Payment"
          value={filters.paymentStatus}
          onChange={(e) => applyFilter({ paymentStatus: e.target.value })}
          options={PAYMENT_OPTIONS}
        />
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

      {!data ? (
        loading && <Spinner label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders found" text="Try changing the search or filters." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {orders.map((order) => {
            const busy = busyId === order.id
            const paid = order.paymentStatus === PAYMENT_STATUS.PAID
            const next = paid ? nextOrderStatus(order.status) : null
            const canCancel =
              !paid && order.status !== ORDER_STATUS.CANCELLED && order.status !== ORDER_STATUS.DELIVERED

            return (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    #{order.id.slice(-8).toUpperCase()}
                    <span className="ml-2 text-xs font-normal text-slate-400">{formatDate(order.createdAt)}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {order.customer?.name} &middot; {order.customer?.email} &middot; {order.itemCount} item
                    {order.itemCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ORDER_STATUS_TONE[order.status]}>{readableStatus(order.status)}</Badge>
                  <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>{orderPaymentLabel(order.paymentStatus)}</Badge>
                  <span className="w-20 text-right text-sm font-semibold">{formatPrice(order.totalAmount)}</span>
                  <ActionButton tone="slate" onClick={() => setDetailId(order.id)}>
                    Details
                  </ActionButton>
                  {next && (
                    <ActionButton tone="emerald" disabled={busy} onClick={() => setStatus(order, next)}>
                      Mark as {readableStatus(next)}
                    </ActionButton>
                  )}
                  {canCancel && (
                    <ActionButton tone="rose" disabled={busy} onClick={() => setStatus(order, ORDER_STATUS.CANCELLED)}>
                      Cancel
                    </ActionButton>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {detailId && <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />}
    </Panel>
  )
}

export default AdminOrdersPanel
