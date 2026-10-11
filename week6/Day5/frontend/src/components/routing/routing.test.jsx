import { describe, expect, test } from 'vitest'
import { screen } from '@testing-library/react'
import { Route } from 'react-router-dom'
import { renderWithProviders, USERS } from '../../test/render'
import ProtectedRoute from './ProtectedRoute'
import GuestRoute from './GuestRoute'
import { Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../context/authContext'

// Mounts the guard in front of a "secret" page, with the login and role homes as targets.
function renderGuarded(element, { user = null, initializing = false, route = '/secret' } = {}) {
  return render(
    <AuthContext.Provider value={{ user, initializing }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={element}>
            <Route path="/secret" element={<p>secret page</p>} />
          </Route>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/customer" element={<p>customer home</p>} />
          <Route path="/vendor" element={<p>vendor home</p>} />
          <Route path="/admin" element={<p>admin home</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  test('a signed-out visitor is sent to the login page', () => {
    renderGuarded(<ProtectedRoute allowedRoles={['ADMIN']} />)
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })

  test('the right role gets the page', () => {
    renderGuarded(<ProtectedRoute allowedRoles={['ADMIN']} />, { user: USERS.admin })
    expect(screen.getByText('secret page')).toBeInTheDocument()
  })

  test.each([
    ['CUSTOMER', 'customer', 'customer home'],
    ['VENDOR', 'vendor', 'vendor home'],
  ])('a %s on an admin-only page is bounced to their own home', (_role, key, home) => {
    renderGuarded(<ProtectedRoute allowedRoles={['ADMIN']} />, { user: USERS[key] })
    expect(screen.getByText(home)).toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })

  test('nothing is decided while the session is still being restored', () => {
    renderGuarded(<ProtectedRoute allowedRoles={['ADMIN']} />, { initializing: true })
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })
})

describe('GuestRoute', () => {
  test('signed-out visitors see the guest page', () => {
    renderGuarded(<GuestRoute />)
    expect(screen.getByText('secret page')).toBeInTheDocument()
  })

  test.each([
    ['customer', 'customer home'],
    ['vendor', 'vendor home'],
    ['admin', 'admin home'],
  ])('a signed-in %s is sent to their dashboard', (key, home) => {
    renderGuarded(<GuestRoute />, { user: USERS[key], route: '/secret' })
    expect(screen.getByText(home)).toBeInTheDocument()
  })
})

// keeps the helper import used so a future refactor of render.jsx is caught here too
test('renderWithProviders exposes the mocked contexts', () => {
  const { authValue, cartValue } = renderWithProviders(<p>hi</p>, { user: USERS.customer })
  expect(authValue.user.role).toBe('CUSTOMER')
  expect(typeof cartValue.addItem).toBe('function')
})
