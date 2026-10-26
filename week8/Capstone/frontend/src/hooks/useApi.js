import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { useAuth } from './useAuth'

export function useApi(path, { auth = false } = {}) {
  const { token } = useAuth()
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })

  const requestToken = auth ? token : null
  const key = path ? `${path}|${requestToken}|${reloadCount}` : null

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const requestKey = `${path}|${requestToken}|${reloadCount}`

    apiRequest(path, { token: requestToken || undefined })
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev.data, error }))
      })

    return () => {
      cancelled = true
    }
  }, [path, requestToken, reloadCount])

  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  return {
    data: result.data,
    error: result.key === key ? result.error : null,
    loading: key !== null && result.key !== key,
    reload,
  }
}
