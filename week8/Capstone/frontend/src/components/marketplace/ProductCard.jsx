import { Link } from 'react-router-dom'
import { ImageOff, Store, Tag } from 'lucide-react'
import { formatPrice, stockInfo } from '../../lib/format'
import Badge from '../ui/Badge'

function ProductCard({ product }) {
  const stock = stockInfo(product.stock)
  const image = product.images?.[0]

  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white bg-white/70 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-slate-300">
            <ImageOff aria-hidden="true" className="size-10" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{product.name}</p>

        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Store aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{product.vendor?.storeName}</span>
        </div>

        {product.category && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Tag aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{product.category.name}</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <p className="text-base font-semibold text-slate-900">{formatPrice(product.price)}</p>
          <Badge tone={stock.tone}>{stock.label}</Badge>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
