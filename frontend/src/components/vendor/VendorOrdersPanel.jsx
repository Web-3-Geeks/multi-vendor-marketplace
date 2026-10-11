import { useState } from 'react'
import { Package } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
import { useNotice } from '../../hooks/useNotice'
import { apiRequest } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'
import {
  ORDER_STATUS,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS,
  nextOrderStatus,
  readableStatus,
} from '../../constants/status'
import { EmptyState, Panel } from '../dashboard/widgets'
import Pagination from '../marketplace/Pagination'
import Badge from '../ui/Badge'
import ConfirmDialog from '../ui/ConfirmDialog'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'
import { AddressLines } from '../orders/ShippingAddress'

const PAGE_SIZE = 10

function VendorOrdersPanel() {
  const { token } = useAuth()
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useApi(`/vendor/orders?page=${page}&limit=${PAGE_SIZE}`, { auth: true })
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [notice, showNotice] = useNotice()
  const [cancelTarget, setCancelTarget] = useState(null)

  const setStatus = async (orderId, status) => {
    setActionError('')
    setBusyId(orderId)
    try {
      await apiRequest(`/vendor/orders/${orderId}/status`, { method: 'PATCH', token, body: { status } })
      showNotice(`Order #${orderId.slice(-8).toUpperCase()} marked as ${readableStatus(status)}.`)
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
        loading && <Spinner label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" text="Orders for your products will show up here." />
      ) : (
        <ul aria-busy={loading} className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {orders.map((order) => {
            const segmentStatus = order.items[0]?.status
            const paid = order.paymentStatus === PAYMENT_STATUS.PAID
            const next = paid ? nextOrderStatus(segmentStatus) : null
            const canCancel = segmentStatus !== ORDER_STATUS.DELIVERED && segmentStatus !== ORDER_STATUS.CANCELLED
            const busy = busyId === order.orderId

            return (
              <li key={order.orderId} className="rounded-2xl border border-slate-100 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">#{order.orderId.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{formatDate(order.orderCreatedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!paid && segmentStatus !== ORDER_STATUS.CANCELLED && <Badge tone="amber">Awaiting payment</Badge>}
                    <Badge tone={ORDER_STATUS_TONE[segmentStatus]}>{readableStatus(segmentStatus)}</Badge>
                  </div>
                </div>

                <ul className="mb-3 space-y-1 text-sm text-slate-600">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {item.productName} <span className="text-slate-400">x{item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium text-slate-900">{formatPrice(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                {order.shippingAddress ? (
                  <div className="mb-3 rounded-xl bg-slate-50 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Ship to</p>
                    <AddressLines address={order.shippingAddress} />
                  </div>
                ) : (
                  !paid &&
                  segmentStatus !== ORDER_STATUS.CANCELLED && (
                    <p className="mb-3 text-xs text-slate-500">
                      The customer's shipping address is shared with you once the order is paid.
                    </p>
                  )
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold">Your total: {formatPrice(order.vendorSubtotal)}</p>
                  <div className="flex gap-1.5">
                    {canCancel && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setCancelTarget(order)}
                        className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(order.orderId, next)}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark as {readableStatus(next)}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel your part of this order?"
          confirmLabel="Cancel items"
          message={
            <p>
              Your items in order #{cancelTarget.orderId.slice(-8).toUpperCase()} will be cancelled and returned to
              stock, and the earnings for them are voided. This can't be undone.
            </p>
          }
          onCancel={() => setCancelTarget(null)}
          onConfirm={async () => {
            await apiRequest(`/vendor/orders/${cancelTarget.orderId}/status`, {
              method: 'PATCH',
              token,
              body: { status: ORDER_STATUS.CANCELLED },
            })
            showNotice(`Your items in order #${cancelTarget.orderId.slice(-8).toUpperCase()} were cancelled.`)
            setCancelTarget(null)
            reload()
          }}
        />
      )}
    </Panel>
  )
}

export default VendorOrdersPanel
