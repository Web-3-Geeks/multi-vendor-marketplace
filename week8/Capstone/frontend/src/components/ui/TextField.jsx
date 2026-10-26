import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function TextField({ id, label, type = 'text', error, hint, icon: Icon, ...inputProps }) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
        )}
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`block w-full rounded-xl border bg-white/80 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${isPassword ? 'pr-11' : 'pr-3.5'} ${
            error
              ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
              : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
          }`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export default TextField
