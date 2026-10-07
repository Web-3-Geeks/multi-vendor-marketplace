import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageSearch } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import ProductCard from '../../components/marketplace/ProductCard'
import ProductFilters from '../../components/marketplace/ProductFilters'
import Pagination from '../../components/marketplace/Pagination'
import Spinner from '../../components/ui/Spinner'
import Alert from '../../components/ui/Alert'

const DEFAULTS = { search: '', category: '', minPrice: '', maxPrice: '', sort: 'newest', page: '1' }

function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')

  const filters = {
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: searchParams.get('sort') || DEFAULTS.sort,
    page: searchParams.get('page') || DEFAULTS.page,
  }

  const updateFilters = (changes) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setSearchParams(next)
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filters.search) updateFilters({ search: searchInput })
    }, 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const resetFilters = () => {
    setSearchInput('')
    setSearchParams({})
  }

  const hasActiveFilters = Boolean(
    filters.search || filters.category || filters.minPrice || filters.maxPrice || filters.sort !== 'newest',
  )

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.category) params.set('category', filters.category)
    if (filters.minPrice) params.set('minPrice', filters.minPrice)
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
    if (filters.sort) params.set('sort', filters.sort)
    params.set('page', filters.page)
    params.set('limit', '12')
    return `/products?${params.toString()}`
  }, [filters.search, filters.category, filters.minPrice, filters.maxPrice, filters.sort, filters.page])

  const { data, error, loading } = useApi(query)
  const { data: categoryData } = useApi('/categories')
  const categories = categoryData?.categories || []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Browse products</h1>
        <p className="mt-1 text-sm text-slate-500">Shop from every approved vendor in one place.</p>
      </div>

      <ProductFilters
        filters={{ ...filters, search: searchInput }}
        categories={categories}
        onChange={(changes) => {
          if ('search' in changes) setSearchInput(changes.search)
          else updateFilters(changes)
        }}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && <Alert>{error.message}</Alert>}

      {loading && !data ? (
        <Spinner label="Loading products..." />
      ) : data && data.products.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-16 text-center">
          <PackageSearch aria-hidden="true" className="size-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold">No products found</p>
          <p className="mt-1 text-sm text-slate-500">Try adjusting your search or filters.</p>
        </div>
      ) : (
        data && (
          <>
            <p className="text-sm text-slate-500">{data.pagination.total} products found</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onChange={(page) => updateFilters({ page: String(page) })}
            />
          </>
        )
      )}
    </div>
  )
}

export default ProductsPage
