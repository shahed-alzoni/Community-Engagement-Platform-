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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.includes('/admin/users/list/')) {
        return {
          ok: true,
          json: async () => ({
            count: 1,
            next: null,
            previous: null,
            summary: { total: 1, active: 1, citizens: 0, representatives: 0, admins: 1 },
            results: [{ id: 1, full_name: 'System Admin', email: 'admin@qarib.local', phone_number: '0990000001', role: 'system_admin', organization_name: null, is_active: true }],
          }),
        }
      }
      if (url.includes('/admin/organizations/available/')) {
        return { ok: true, json: async () => [] }
      }
      return {
        ok: true,
        json: async () => ({
          access: 'admin-access-token',
          refresh: 'admin-refresh-token',
          user: { full_name: 'System Admin', role: 'system_admin' },
        }),
      }
    })
    renderAt('/admin/login')

    await userEvent.type(screen.getByPlaceholderText('Admin email address'), 'admin@qarib.local')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'StrongAdminPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Log in as admin' }))

    expect(await screen.findByRole('heading', { name: 'Manage accounts' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'View my admin profile' })).toBeInTheDocument()
    expect(screen.queryByText('admin@qarib.local')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/admin/login/',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('admin-access-token')
  })

  it('requires an organization representative to change the temporary password', async () => {
    const representative = { id: 7, full_name: 'Water Representative', email: 'water@example.com', role: 'representative', organization_name: 'Ministry of Water' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ password_change_required: true, password_change_token: 'temporary-token', user: representative }),
    })
    renderAt('/representative/login')

    await userEvent.type(screen.getByPlaceholderText('Representative email address'), representative.email)
    await userEvent.type(screen.getByPlaceholderText('Password'), 'TemporaryPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Log in as representative' }))

    expect(await screen.findByRole('heading', { name: 'Create a new password' })).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.initialPasswordToken')).toBe('temporary-token')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/representative/login/', expect.objectContaining({ method: 'POST' }))
  })

  it('stores normal tokens after the representative changes the temporary password', async () => {
    sessionStorage.setItem('qarib.initialPasswordToken', 'temporary-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        password_change_required: false,
        access: 'representative-access',
        refresh: 'representative-refresh',
        user: { id: 7, full_name: 'Water Representative', role: 'representative', organization_name: 'Ministry of Water' },
      }),
    })
    renderAt('/representative/change-password')

    await userEvent.type(screen.getByPlaceholderText('New password'), 'NewStrongPass!2026')
    await userEvent.type(screen.getByPlaceholderText('Confirm new password'), 'NewStrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Save password and continue' }))

    expect(await screen.findByText('Ministry of Water')).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('representative-access')
    expect(sessionStorage.getItem('qarib.initialPasswordToken')).toBeNull()
  })

  it('opens the admin account creation form from the dashboard', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ full_name: 'System Admin' }))
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.includes('/organizations/') ? [{ id: 3, name: 'Ministry of Water' }] : {
        count: 0,
        next: null,
        previous: null,
        summary: { total: 0, active: 0, citizens: 0, representatives: 0, admins: 0 },
        results: [],
      },
    }))
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('button', { name: 'Add new account' }))

    expect(screen.getByRole('heading', { name: 'Add new account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Account role')).toBeInTheDocument()
  })

  it('shows account creation API errors beside the responsible field', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      if (url.endsWith('/admin/users/') && options.method === 'POST') {
        return { ok: false, json: async () => ({ email: ['This field must be unique.'] }) }
      }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return {
        ok: true,
        json: async () => ({ count: 0, next: null, previous: null, summary: {}, results: [] }),
      }
    })
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('button', { name: 'Add new account' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Existing Citizen')
    await userEvent.type(screen.getByLabelText('Email address'), 'existing@example.com')
    await userEvent.type(screen.getByLabelText('Mobile number'), '0991234567')
    await userEvent.type(screen.getByLabelText('Temporary password'), 'StrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('This field must be unique.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email address/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('toggles an account status from the admin switch', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    const citizen = { id: 2, full_name: 'Toggle Citizen', email: 'toggle@example.com', phone_number: '0991234567', role: 'citizen', organization_name: null, is_active: true }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      if (url.includes('/status/') && options.method === 'PATCH') {
        return { ok: true, json: async () => ({ ...citizen, is_active: false }) }
      }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 1, next: null, previous: null, summary: { total: 1, active: 1, citizens: 1 }, results: [citizen] }) }
    })
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('switch', { name: 'Deactivate Toggle Citizen' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/users/2/status/',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_active: false }) }),
    )
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByText('Loading accounts…')).not.toBeInTheDocument()
  })

  it('opens account editing as a modal over the accounts dashboard', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    const citizen = { id: 4, full_name: 'Edit Citizen', email: 'edit@example.com', phone_number: '0991234567', role: 'citizen', organization_name: null, organization_id: null, is_active: true }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.endsWith('/admin/users/4/')) return { ok: true, json: async () => citizen }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 1, next: null, previous: null, summary: {}, results: [citizen] }) }
    })
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Edit Citizen' }))

    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Manage accounts' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Edit Citizen')).toBeInTheDocument()
  })

  it('opens account details in a standalone admin page', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    const citizen = { id: 2, full_name: 'Detail Citizen', email: 'detail@example.com', phone_number: '0991234567', role: 'citizen', organization_name: null, organization_id: null, is_active: true, created_at: '2026-11-09T00:00:00Z', last_login: null, assignment_history: [] }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.endsWith('/admin/users/2/')) return { ok: true, json: async () => citizen }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 1, next: null, previous: null, summary: {}, results: [citizen] }) }
    })
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('button', { name: 'View Detail Citizen details' }))

    expect(await screen.findByText('Account details')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detail Citizen' })).toBeInTheDocument()
  })
})
