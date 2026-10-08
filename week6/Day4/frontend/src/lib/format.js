const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const formatPrice = (value) => priceFormatter.format(value)

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function stockInfo(stock) {
  if (stock <= 0) return { label: 'Out of stock', tone: 'rose' }
  if (stock <= 5) return { label: `Only ${stock} left`, tone: 'amber' }
  return { label: 'In stock', tone: 'emerald' }
}

export const LOW_STOCK_THRESHOLD = 5

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
