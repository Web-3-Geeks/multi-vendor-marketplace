import { Minus, Plus } from 'lucide-react'

function QuantityStepper({ value, onChange, min = 1, max, disabled, size = 'md' }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)

  const handleInput = (e) => {
    const next = Number(e.target.value)
    if (!Number.isFinite(next)) return
    const clamped = Math.max(min, max !== undefined ? Math.min(max, next) : next)
    onChange(clamped)
  }

  const pad = size === 'sm' ? 'p-1' : 'p-1.5'
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'
  const inputWidth = size === 'sm' ? 'w-8' : 'w-10'

  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={`${pad} text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Minus aria-hidden="true" className={iconSize} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={handleInput}
        disabled={disabled}
        aria-label="Quantity"
        className={`${inputWidth} border-0 bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (max !== undefined && value >= max)}
        aria-label="Increase quantity"
        className={`${pad} text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <Plus aria-hidden="true" className={iconSize} />
      </button>
    </div>
  )
}

export default QuantityStepper
