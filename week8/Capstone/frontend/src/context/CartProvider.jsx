import { useEffect, useState } from 'react'
import { CartContext } from './cartContext'
import { apiRequest } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export function CartProvider({ children }) {
  const { token } = useAuth()
  const [cart, setCart] = useState(null)

  // Mirrors AuthProvider's pattern: the effect only kicks off the fetch and
  // reacts in a .then, it never calls setState synchronously in its own body.
  // "Still loading" isn't separate state either -- it's just "logged in, but
  // we don't have cart data back yet" (see `loading` in the context value).
  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    apiRequest('/cart', { token })
      .then((data) => {
        if (!cancelled) setCart(data.cart)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token])

  // Exposed so components can pull a fresh cart after something outside this
  // provider changed it (e.g. the checkout page clearing the cart server-side).
  const refresh = () => {
    if (!token) return Promise.resolve()
    return apiRequest('/cart', { token }).then((data) => setCart(data.cart))
  }

  const addItem = async (productId, quantity) => {
    const data = await apiRequest('/cart/items', { method: 'POST', token, body: { productId, quantity } })
    setCart(data.cart)
    return data.cart
  }

  const updateItem = async (itemId, quantity) => {
    const data = await apiRequest(`/cart/items/${itemId}`, { method: 'PATCH', token, body: { quantity } })
    setCart(data.cart)
    return data.cart
  }

  const removeItem = async (itemId) => {
    const data = await apiRequest(`/cart/items/${itemId}`, { method: 'DELETE', token })
    setCart(data.cart)
    return data.cart
  }

  const value = {
    cart: token ? cart : null,
    loading: Boolean(token) && cart === null,
    addItem,
    updateItem,
    removeItem,
    refresh,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
