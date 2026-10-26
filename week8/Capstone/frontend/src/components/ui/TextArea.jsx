function TextArea({ id, label, error, hint, rows = 4, ...props }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
        }`}
        {...props}
      />
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

export default TextArea
