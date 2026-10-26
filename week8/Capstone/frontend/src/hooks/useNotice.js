import { useCallback, useEffect, useRef, useState } from 'react'

// A short success message that clears itself, for "Order marked as Shipped"-style feedback.
export function useNotice(duration = 4000) {
  const [notice, setNotice] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const showNotice = useCallback(
    (message) => {
      clearTimeout(timer.current)
      setNotice(message)
      timer.current = setTimeout(() => setNotice(''), duration)
    },
    [duration],
  )

  return [notice, showNotice]
}
