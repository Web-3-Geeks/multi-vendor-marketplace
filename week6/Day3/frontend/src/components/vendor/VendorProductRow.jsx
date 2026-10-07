import { useState } from 'react'
import { Archive, ImageOff, Pencil } from 'lucide-react'
import { formatPrice } from '../../lib/format'
import { PRODUCT_STATUS, PRODUCT_STATUS_TONE, readableStatus } from '../../constants/status'
import Badge from '../ui/Badge'

function VendorProductRow({ product, onEdit, onArchive, onStockChange, busy }) {
  const [stockDraft, setStockDraft] = useState(String(product.stock))

  const commitStock = () => {
    const value = Number(stockDraft)
    if (Number.isInteger(value) && value >= 0 && value !== product.stock) {
      onStockChange(product, value)
    } else {
      setStockDraft(String(product.stock))
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="truncate text-xs text-slate-500">{product.category?.name || 'Uncategorized'}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap py-3 pr-3 text-sm">{formatPrice(product.price)}</td>
      <td className="whitespace-nowrap py-3 pr-3">
        <input
          type="number"
          min="0"
          value={stockDraft}
          onChange={(e) => setStockDraft(e.target.value)}
          onBlur={commitStock}
          disabled={busy || product.status === PRODUCT_STATUS.ARCHIVED}
          aria-label={`Stock for ${product.name}`}
          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
        />
      </td>
      <td className="whitespace-nowrap py-3 pr-3">
        <Badge tone={PRODUCT_STATUS_TONE[product.status]}>{readableStatus(product.status)}</Badge>
      </td>
      <td className="whitespace-nowrap py-3 text-right">
        <button
          type="button"
          onClick={() => onEdit(product)}
          aria-label={`Edit ${product.name}`}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Pencil className="size-4" />
        </button>
        {product.status !== PRODUCT_STATUS.ARCHIVED && (
          <button
            type="button"
            onClick={() => onArchive(product)}
            aria-label={`Archive ${product.name}`}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          >
            <Archive className="size-4" />
          </button>
        )}
      </td>
    </tr>
  )
}

export default VendorProductRow
