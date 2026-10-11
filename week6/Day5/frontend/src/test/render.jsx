import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext } from '../context/authContext'
import { CartContext } from '../context/cartContext'

export const USERS = {
  customer: { id: 'user-1', name: 'Ayesha Khan', email: 'ayesha@test.com', role: 'CUSTOMER' },
  vendor: { id: 'user-2', name: 'Vendor Demo', email: 'vendor@test.com', role: 'VENDOR' },
  admin: { id: 'user-3', name: 'Admin Demo', email: 'admin@test.com', role: 'ADMIN' },
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</p>
}

// Renders `ui` at `route` with the auth and cart contexts the app normally provides.
// `path` is the route pattern the page is mounted on (for pages that read :params).
export function renderWithProviders(ui, { route = '/', path = '*', user = null, auth = {}, cart = {} } = {}) {
  const authValue = {
    user,
    token: user ? 'test-token' : null,
    initializing: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...auth,
  }
  const cartValue = {
    cart: null,
    loading: false,
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    ...cart,
  }

  const result = render(
    <AuthContext.Provider value={authValue}>
      <CartContext.Provider value={cartValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={null} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>,
  )

  return { ...result, authValue, cartValue }
}

// Makes the mocked apiRequest answer by "METHOD /path". A value is returned as is; a
// function is called with the request options; an Error is thrown. Anything not listed
// fails loudly so a test can't silently depend on a call it didn't plan for.
export function mockApi(apiRequest, routes) {
  apiRequest.mockImplementation(async (path, options = {}) => {
    const key = `${options.method || 'GET'} ${path}`
    const match =
      key in routes ? key : Object.keys(routes).find((pattern) => pattern.endsWith('*') && key.startsWith(pattern.slice(0, -1)))
    if (!match) throw new Error(`Unmocked API call: ${key}`)
    const handler = routes[match]
    const result = typeof handler === 'function' ? handler(options, path) : handler
    if (result instanceof Error) throw result
    return result
  })
}

export const apiError = (message, status = 400, errors = []) => Object.assign(new Error(message), { status, errors })
