import { useState } from 'react'
import { Package } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useAuth } from '../../hooks/useAuth'
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
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'
import Alert from '../ui/Alert'

function VendorOrdersPanel() {
  const { token } = useAuth()
  const { data, loading, error, reload } = useApi('/vendor/orders', { auth: true })
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const setStatus = async (orderId, status) => {
    setActionError('')
    setBusyId(orderId)
    try {
      await apiRequest(`/vendor/orders/${orderId}/status`, { method: 'PATCH', token, body: { status } })
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
        <Spinner label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" text="Orders for your products will show up here." />
      ) : (
        <ul className="space-y-3">
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

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <p className="text-sm font-semibold">Your total: {formatPrice(order.vendorSubtotal)}</p>
                  <div className="flex gap-1.5">
                    {canCancel && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(order.orderId, ORDER_STATUS.CANCELLED)}
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
    </Panel>
  )
}

export default VendorOrdersPanel
