import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, MapPin, Store } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { apiRequest } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import {
  EMPTY_ADDRESS,
  addressErrorsFromApi,
  toShippingPayload,
  validateAddress,
} from '../../lib/address'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import TextField from '../../components/ui/TextField'

function CheckoutPage() {
  const { cart, loading, refresh } = useCart()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  const [formError, setFormError] = useState('')
  const [itemErrors, setItemErrors] = useState([])
  const [address, setAddress] = useState(() => ({ ...EMPTY_ADDRESS, fullName: user?.name || '' }))
  const [fieldErrors, setFieldErrors] = useState({})

  const setField = (name) => (e) => {
    setAddress((prev) => ({ ...prev, [name]: e.target.value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const focusFirstError = (errors) => {
    const first = Object.keys(EMPTY_ADDRESS).find((key) => errors[key])
    if (first) document.getElementById(`ship-${first}`)?.focus()
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    setFormError('')
    setItemErrors([])

    const errors = validateAddress(address)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setFormError('Please fix the highlighted fields.')
      focusFirstError(errors)
      return
    }

    setPlacing(true)
    try {
      const data = await apiRequest('/checkout', {
        method: 'POST',
        token,
        body: { shippingAddress: toShippingPayload(address) },
      })
      await refresh()
      navigate(`/pay/${data.order.id}`, { replace: true })
    } catch (err) {
      const apiFieldErrors = addressErrorsFromApi(err.errors)
      if (Object.keys(apiFieldErrors).length > 0) {
        setFieldErrors(apiFieldErrors)
        setFormError('Please fix the highlighted fields.')
        focusFirstError(apiFieldErrors)
      } else {
        setItemErrors((err.errors || []).filter((item) => !item.field))
        setFormError(err.message)
      }
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

      <form id="checkout-form" onSubmit={handlePlaceOrder} noValidate className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section
            aria-labelledby="shipping-heading"
            className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5"
          >
            <h2 id="shipping-heading" className="mb-4 flex items-center gap-1.5 text-base font-semibold">
              <MapPin aria-hidden="true" className="size-4 text-slate-400" />
              Shipping address
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="ship-fullName"
                label="Full name"
                autoComplete="name"
                value={address.fullName}
                onChange={setField('fullName')}
                error={fieldErrors.fullName}
                maxLength={100}
              />
              <TextField
                id="ship-phone"
                label="Phone number"
                type="tel"
                autoComplete="tel"
                placeholder="+92 300 1234567"
                value={address.phone}
                onChange={setField('phone')}
                error={fieldErrors.phone}
                maxLength={20}
              />
              <div className="sm:col-span-2">
              <TextField
                id="ship-line1"
                label="Address"
                autoComplete="address-line1"
                placeholder="House, street, area"
                value={address.line1}
                onChange={setField('line1')}
                error={fieldErrors.line1}
                maxLength={200}
              />
              </div>
              <div className="sm:col-span-2">
              <TextField
                id="ship-line2"
                label="Apartment, suite, etc. (optional)"
                autoComplete="address-line2"
                value={address.line2}
                onChange={setField('line2')}
                error={fieldErrors.line2}
                maxLength={200}
              />
              </div>
              <TextField
                id="ship-city"
                label="City"
                autoComplete="address-level2"
                value={address.city}
                onChange={setField('city')}
                error={fieldErrors.city}
                maxLength={100}
              />
              <TextField
                id="ship-state"
                label="State or region (optional)"
                autoComplete="address-level1"
                value={address.state}
                onChange={setField('state')}
                error={fieldErrors.state}
                maxLength={100}
              />
              <TextField
                id="ship-postalCode"
                label="Postal code"
                autoComplete="postal-code"
                value={address.postalCode}
                onChange={setField('postalCode')}
                error={fieldErrors.postalCode}
                maxLength={12}
              />
              <TextField
                id="ship-country"
                label="Country"
                autoComplete="country-name"
                value={address.country}
                onChange={setField('country')}
                error={fieldErrors.country}
                maxLength={100}
              />
            </div>
          </section>

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
            <CreditCard aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span>
              Payment method: <span className="font-medium text-slate-900">Card</span>
              <span className="block text-xs text-slate-500">You'll pay securely on the next step.</span>
            </span>
          </div>

          <Button type="submit" loading={placing} disabled={cart.hasIssues}>
            Place order &amp; continue to payment
          </Button>
        </aside>
      </form>
    </div>
  )
}

export default CheckoutPage
