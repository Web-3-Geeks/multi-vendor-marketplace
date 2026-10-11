import { LoaderCircle } from 'lucide-react'

const SIZES = {
  md: 'px-4 py-2.5 text-sm gap-2',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
}

function Button({ children, loading = false, disabled, fullWidth = true, size = 'md', className = '', ...props }) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70 ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && (
        <LoaderCircle aria-hidden="true" className={`animate-spin ${size === 'sm' ? 'size-3.5' : 'size-4'}`} />
      )}
      {children}
    </button>
  )
}

export default Button
