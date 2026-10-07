import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Store } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'

function CheckoutPage() {
  const { cart, loading, refresh } = useCart()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  const [formError, setFormError] = useState('')
  const [itemErrors, setItemErrors] = useState([])

  const handlePlaceOrder = async () => {
    setFormError('')
    setItemErrors([])
    setPlacing(true)
    try {
      const data = await apiRequest('/checkout', { method: 'POST', token })
      await refresh()
      navigate(`/orders/${data.order.id}`, { replace: true })
    } catch (err) {
      setItemErrors(err.errors || [])
      setFormError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  if (loading) return <Spinner label="Loading your cart..." />
  if (!cart) return null

  if (cart.items.length === 0 && !formError) {
    return (
      <div className="space-y-4">
        <Alert>Your cart is empty. Add something before checking out.</Alert>
        <Link to="/products" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      {formError && (
        <Alert>
          {formError}
          {itemErrors.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              {itemErrors.map((e, i) => (
                <li key={e.productId || i}>{e.message}</li>
              ))}
            </ul>
          )}
          {itemErrors.length > 0 && (
            <Link to="/cart" className="mt-2 inline-block font-semibold underline">
              Go back to your cart
            </Link>
          )}
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cart.vendorGroups.map((group) => (
            <section
              key={group.vendor?.id || 'unknown'}
              className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Store aria-hidden="true" className="size-4 text-slate-400" />
                  {group.vendor?.storeName || 'Unknown store'}
                </p>
                <p className="text-sm text-slate-500">{formatPrice(group.subtotal)}</p>
              </div>
              <ul className="space-y-2.5">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">
                      {item.product?.name} <span className="text-slate-400">x{item.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium text-slate-900">{formatPrice(item.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
          <h2 className="text-base font-semibold">Order total</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-slate-900">{formatPrice(cart.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="font-medium text-slate-900">{formatPrice(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Discount</dt>
              <dd className="font-medium text-slate-900">{formatPrice(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="font-medium text-slate-900">{formatPrice(0)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
              <dt className="font-semibold">Grand total</dt>
              <dd className="font-semibold text-slate-900">{formatPrice(cart.subtotal)}</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <Banknote aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span>
              Payment method: <span className="font-medium text-slate-900">Cash on Delivery</span>
            </span>
          </div>

          <Button onClick={handlePlaceOrder} loading={placing} disabled={cart.hasIssues}>
            Place order
          </Button>
        </aside>
      </div>
    </div>
  )
}

export default CheckoutPage
