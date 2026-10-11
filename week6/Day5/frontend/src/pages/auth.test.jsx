import { describe, expect, test, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, apiError, USERS } from '../test/render'
import Login from './Login'
import Register from './Register'

describe('Login', () => {
  test('logs in and goes to the dashboard for the user role', async () => {
    const login = vi.fn().mockResolvedValue(USERS.vendor)
    renderWithProviders(<Login />, { route: '/login', path: '/login', auth: { login } })
    await userEvent.type(screen.getByLabelText('Email'), 'vendor@test.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(login).toHaveBeenCalledWith('vendor@test.com', 'Secret123')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/vendor'))
  })

  test('wrong credentials show the server message and keep the user on the page', async () => {
    const login = vi.fn().mockRejectedValue(apiError('Invalid email or password', 401))
    renderWithProviders(<Login />, { route: '/login', path: '/login', auth: { login } })
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  test('field errors from the server appear under the right input', async () => {
    const login = vi.fn().mockRejectedValue(apiError('Validation Failed', 400, [{ field: 'email', message: 'Invalid email' }]))
    renderWithProviders(<Login />, { route: '/login', path: '/login', auth: { login } })
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('Invalid email')).toBeInTheDocument()
  })

  test('links to registration', () => {
    renderWithProviders(<Login />, { route: '/login', path: '/login' })
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })
})

describe('Register', () => {
  test('creates the account and sends the user to log in with their email', async () => {
    const register = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<Register />, { route: '/register', path: '/register', auth: { register } })
    await userEvent.type(screen.getByLabelText('Full name'), 'Ayesha Khan')
    await userEvent.type(screen.getByLabelText('Email'), 'ayesha@test.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Secret123')
    await userEvent.click(screen.getByRole('button', { name: /create account|sign up|register/i }))
    expect(register).toHaveBeenCalledWith('Ayesha Khan', 'ayesha@test.com', 'Secret123')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'))
  })

  test('shows every field error the server returns', async () => {
    const register = vi.fn().mockRejectedValue(
      apiError('Validation Failed', 400, [
        { field: 'name', message: 'Name is required' },
        { field: 'password', message: 'Password must be at least 8 characters' },
      ]),
    )
    renderWithProviders(<Register />, { route: '/register', path: '/register', auth: { register } })
    await userEvent.click(screen.getByRole('button', { name: /create account|sign up|register/i }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  test('a duplicate email is shown as a form-level error', async () => {
    const register = vi.fn().mockRejectedValue(apiError('Email already registered', 409))
    renderWithProviders(<Register />, { route: '/register', path: '/register', auth: { register } })
    await userEvent.click(screen.getByRole('button', { name: /create account|sign up|register/i }))
    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})
