import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Store, TriangleAlert } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { formatPrice } from '../../lib/format'
import CartItemRow from '../../components/cart/CartItemRow'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'

function CartPage() {
  const { cart, loading, updateItem, removeItem } = useCart()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  const withBusy = async (id, action) => {
    setActionError('')
    setBusyId(id)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Spinner label="Loading your cart..." />
  if (!cart) return null

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
        <ShoppingBag aria-hidden="true" className="size-10 text-slate-300" />
        <p className="mt-3 text-sm font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-slate-500">Browse the marketplace to find something you like.</p>
        <Link
          to="/products"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>

      {actionError && <Alert>{actionError}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cart.vendorGroups.map((group) => (
            <section
              key={group.vendor?.id || 'unknown'}
              className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Store aria-hidden="true" className="size-4 text-slate-400" />
                  {group.vendor?.storeName || 'Unknown store'}
                </p>
                <p className="text-sm text-slate-500">{formatPrice(group.subtotal)}</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onQuantityChange={(qty) => withBusy(item.id, () => updateItem(item.id, qty))}
                    onRemove={() => withBusy(item.id, () => removeItem(item.id))}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-white bg-white/70 p-5 shadow-sm backdrop-blur-xl">
          <h2 className="text-base font-semibold">Order summary</h2>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})</span>
            <span className="font-semibold text-slate-900">{formatPrice(cart.subtotal)}</span>
          </div>
          {cart.hasIssues && (
            <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-700">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Some items need your attention before you can check out.
            </p>
          )}
          <Button onClick={() => navigate('/checkout')} disabled={cart.hasIssues}>
            Proceed to checkout
          </Button>
        </aside>
      </div>
    </div>
  )
}

export default CartPage
