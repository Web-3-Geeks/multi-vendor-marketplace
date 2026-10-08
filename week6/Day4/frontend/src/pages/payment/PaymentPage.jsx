import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, ChevronLeft, CircleCheck, CircleX, Clock, CreditCard, ShieldCheck, Store } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { formatDateTime, formatPrice } from '../../lib/format'
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_TONE,
  orderPaymentLabel,
  readableStatus,
} from '../../constants/status'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

const RESULT_TONES = {
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-500',
}

function Result({ icon: Icon, tone, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <span className={`grid size-12 place-items-center rounded-full ${RESULT_TONES[tone]}`}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm text-slate-500">{children}</div>
    </div>
  )
}

function groupByVendor(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.vendor?.id || 'unknown'
    if (!groups.has(key)) groups.set(key, { vendor: item.vendor, items: [] })
    groups.get(key).items.push(item)
  }
  return Array.from(groups.values())
}

function PaymentPage() {
  const { orderId } = useParams()
  const { token } = useAuth()
  const [state, setState] = useState({ order: null, payment: null, loading: true, error: null })
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    try {
      const [orderRes, paymentRes] = await Promise.all([
        apiRequest(`/orders/${orderId}`, { token }),
        apiRequest(`/payments/order/${orderId}`, { token }),
      ])
      setState({ order: orderRes.order, payment: paymentRes.payment, loading: false, error: null })
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error }))
    }
  }, [orderId, token])

  useEffect(() => {
    load()
  }, [load])

  const { order, payment } = state

  const run = async (kind, task) => {
    setActionError('')
    setBusy(kind)
    try {
      await task()
    } catch (err) {
      setActionError(err.message)
    }
    await load()
    setBusy('')
  }

  const startPayment = () =>
    run('create', () => apiRequest('/payments/create', { method: 'POST', token, body: { orderId } }))

  const verify = (transactionId) =>
    apiRequest('/payments/verify', { method: 'POST', token, body: { transactionId } })

  // The page only ever trusts what the backend says afterwards (order.paymentStatus
  // and the verified payment) -- never the fact that this request itself succeeded.
  const completeMockPayment = (outcome) =>
    run('pay', async () => {
      await apiRequest('/payments/mock/pay', {
        method: 'POST',
        token,
        body: { transactionId: payment.transactionId, outcome },
      })
      await verify(payment.transactionId)
    })

  const checkStatus = () => run('check', () => verify(payment.transactionId))

  if (state.loading) return <Spinner label="Loading payment..." />

  if (state.error && !order) {
    return (
      <div className="space-y-4">
        <Alert>{state.error.status === 404 ? 'This order could not be found.' : state.error.message}</Alert>
        <Link to="/orders" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Back to orders
        </Link>
      </div>
    )
  }

  const paid = order.paymentStatus === PAYMENT_STATUS.PAID
  const refunded = order.paymentStatus === PAYMENT_STATUS.REFUNDED
  const orderCancelled = order.status === ORDER_STATUS.CANCELLED && !paid
  const open = payment && [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING].includes(payment.status)
  const processing = busy === 'pay' || busy === 'check' || (open && payment.status === PAYMENT_STATUS.PROCESSING)

  let badgeLabel = orderPaymentLabel(order.paymentStatus)
  let badgeTone = PAYMENT_STATUS_TONE[order.paymentStatus]
  if (!paid && !refunded && payment) {
    badgeLabel = readableStatus(payment.status)
    badgeTone = PAYMENT_STATUS_TONE[payment.status]
  }

  const groups = groupByVendor(order.items)

  let panel
  if (paid) {
    panel = (
      <Result icon={CircleCheck} tone="emerald" title="Payment successful">
        <p>Your payment was confirmed by our payment provider and your order is now being prepared.</p>
        <div className="flex flex-col gap-2">
          <Link
            to={`/orders/${order.id}`}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            View order
          </Link>
          <Link to="/products" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Continue shopping
          </Link>
        </div>
      </Result>
    )
  } else if (refunded) {
    panel = (
      <Result icon={CircleCheck} tone="slate" title="Payment refunded">
        <p>This payment has been refunded to your original payment method.</p>
      </Result>
    )
  } else if (orderCancelled) {
    panel = (
      <Result icon={Ban} tone="slate" title="Order cancelled">
        <p>This order was cancelled, so it can no longer be paid.</p>
        <Link to="/products" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Browse products
        </Link>
      </Result>
    )
  } else if (processing) {
    panel = <Spinner label="Processing your payment..." />
  } else if (payment?.status === PAYMENT_STATUS.FAILED) {
    panel = (
      <Result icon={CircleX} tone="rose" title="Payment failed">
        <p>Your payment didn't go through and you have not been charged. Your order is still saved.</p>
        <Button onClick={startPayment} loading={busy === 'create'}>
          Try again
        </Button>
      </Result>
    )
  } else if (payment?.status === PAYMENT_STATUS.CANCELLED) {
    panel = (
      <Result icon={Clock} tone="slate" title="Payment session expired">
        <p>This payment session is no longer valid. Start a new one to pay for your order.</p>
        <Button onClick={startPayment} loading={busy === 'create'}>
          Start a new payment
        </Button>
      </Result>
    )
  } else if (open) {
    panel = (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Waiting for payment. This session is valid until {formatDateTime(payment.expiresAt)}.
        </p>
        {payment.provider === 'mock' ? (
          <div className="space-y-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Test mode
            </p>
            <p className="text-sm text-amber-800">
              This simulates the payment provider's page. No card details are entered and no real money moves.
            </p>
            <Button onClick={() => completeMockPayment('success')}>Pay {formatPrice(payment.amount)}</Button>
            <button
              type="button"
              onClick={() => completeMockPayment('failure')}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white"
            >
              Simulate a declined payment
            </button>
          </div>
        ) : (
          <Alert>Online card payment is not available in this environment.</Alert>
        )}
        <button
          type="button"
          onClick={checkStatus}
          className="w-full text-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          I've already paid, check status
        </button>
      </div>
    )
  } else {
    panel = (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Review your order, then continue to pay securely.</p>
        <Button onClick={startPayment} loading={busy === 'create'}>
          Continue to payment
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Link
        to={`/orders/${order.id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to order
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment</h1>
          <p className="mt-1 text-sm text-slate-500">Order #{order.id.slice(-8).toUpperCase()}</p>
        </div>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.map((group) => (
            <section
              key={group.vendor?.id || 'unknown'}
              className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            >
              <p className="mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-3 text-sm font-semibold">
                <Store aria-hidden="true" className="size-4 text-slate-400" />
                {group.vendor?.storeName || 'Unknown store'}
              </p>
              <ul className="space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {item.productName} <span className="text-slate-400">x{item.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium text-slate-900">{formatPrice(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
          <h2 className="text-base font-semibold">Amount payable</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.shippingAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="font-medium text-slate-900">{formatPrice(order.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-semibold text-slate-900">{formatPrice(order.totalAmount)}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <CreditCard aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span>
              Payment method: <span className="font-medium text-slate-900">Card</span>
            </span>
          </div>

          {panel}
        </aside>
      </div>
    </div>
  )
}

export default PaymentPage
