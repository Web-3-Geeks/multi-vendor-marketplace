import { Search, X } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

function ProductFilters({ filters, categories, onChange, onReset, hasActiveFilters }) {
  const set = (key) => (e) => onChange({ [key]: e.target.value })

  return (
    <div className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={set('search')}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <select
          value={filters.category}
          onChange={set('category')}
          aria-label="Filter by category"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={set('minPrice')}
            placeholder="Min price"
            aria-label="Minimum price"
            className="w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
          <input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={set('maxPrice')}
            placeholder="Max price"
            aria-label="Maximum price"
            className="w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <select
          value={filters.sort}
          onChange={set('sort')}
          aria-label="Sort products"
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <X aria-hidden="true" className="size-3.5" />
          Clear filters
        </button>
      )}
    </div>
  )
}

export default ProductFilters
