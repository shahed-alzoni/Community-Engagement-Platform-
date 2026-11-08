import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('authentication pages', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders all registration fields required by the API', () => {
    renderAt('/register')

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Mobile number/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument()
    expect(screen.queryByText(/I agree to the/i)).not.toBeInTheDocument()
  })

  it('validates the login form before calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderAt('/login')

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores tokens in session storage after a successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access: 'access-token',
        refresh: 'refresh-token',
        user: { full_name: 'Test Citizen' },
      }),
    })
    renderAt('/login')

    await userEvent.type(screen.getByPlaceholderText('Email address'), 'citizen@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'StrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Welcome back, Test Citizen.')).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('access-token')
    expect(sessionStorage.getItem('qarib.refreshToken')).toBe('refresh-token')
  })

  it('requests a password reset without exposing whether the account exists', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        detail: 'If an active account exists for this email address, a password reset link has been sent.',
      }),
    })
    renderAt('/forgot-password')

    await userEvent.type(screen.getByPlaceholderText('Email address'), 'citizen@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/If an active account exists/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/password-reset/request/',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('submits the token and matching new passwords from the reset link', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ detail: 'Your password has been reset successfully.' }),
    })
    renderAt('/reset-password/test-uid/test-token')

    await userEvent.type(screen.getByPlaceholderText('New password'), 'NewStrongPass!2026')
    await userEvent.type(screen.getByPlaceholderText('Confirm new password'), 'NewStrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Your password has been reset successfully.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/password-reset/confirm/',
      expect.objectContaining({
        body: JSON.stringify({
          uid: 'test-uid',
          token: 'test-token',
          new_password: 'NewStrongPass!2026',
          password_confirm: 'NewStrongPass!2026',
        }),
      }),
    )
  })

  it('uses the dedicated endpoint for system admin login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access: 'admin-access-token',
        refresh: 'admin-refresh-token',
        user: { full_name: 'System Admin', role: 'system_admin' },
      }),
    })
    renderAt('/admin/login')

    await userEvent.type(screen.getByPlaceholderText('Admin email address'), 'admin@qarib.local')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'StrongAdminPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Log in as admin' }))

    expect(await screen.findByText('Welcome, System Admin.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/admin/login/',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('admin-access-token')
  })
})
