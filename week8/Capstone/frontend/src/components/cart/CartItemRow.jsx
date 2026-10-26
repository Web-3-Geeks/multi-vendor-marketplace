import { Link } from 'react-router-dom'
import { ImageOff, Store, TriangleAlert, X } from 'lucide-react'
import { formatPrice } from '../../lib/format'
import QuantityStepper from '../ui/QuantityStepper'

function CartItemRow({ item, onQuantityChange, onRemove, busy }) {
  const { product, vendor } = item
  const unavailable = !product || Boolean(item.issue)

  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
      <Link
        to={product ? `/products/${product.id}` : '#'}
        className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300 sm:size-20"
      >
        {product?.image ? (
          <img src={product.image} alt="" className="size-full object-cover" />
        ) : (
          <ImageOff className="size-5" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={product ? `/products/${product.id}` : '#'}
              className="truncate text-sm font-semibold text-slate-900 hover:text-indigo-600"
            >
              {product?.name || 'Unknown product'}
            </Link>
            {vendor && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <Store aria-hidden="true" className="size-3" />
                {vendor.storeName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${product?.name || 'item'} from cart`}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {item.issue && (
          <p className="flex items-center gap-1 text-xs font-medium text-amber-600">
            <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            {item.issue}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            value={item.quantity}
            onChange={onQuantityChange}
            min={1}
            max={product?.stock}
            disabled={busy || unavailable}
            size="sm"
          />
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{formatPrice(item.subtotal)}</p>
            <p className="text-xs text-slate-400">{formatPrice(item.unitPrice)} each</p>
          </div>
        </div>
      </div>
    </li>
  )
}

export default CartItemRow
