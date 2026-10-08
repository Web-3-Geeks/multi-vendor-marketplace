import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Dashboard sidebar links point at #anchors on a single page. React Router only
// updates the URL for those, so scroll to the element by hand whenever the hash changes.
export function useScrollToHash(ready = true) {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash || !ready) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, ready])
}
