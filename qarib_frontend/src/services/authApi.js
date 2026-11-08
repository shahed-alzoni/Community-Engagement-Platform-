const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(message, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
  }
}

async function request(path, { method = 'GET', payload, authenticated = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (authenticated) {
    const accessToken = sessionStorage.getItem('qarib.accessToken')
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.detail ?? 'We could not complete your request.'
    throw new ApiError(message, data)
  }

  return data
}

function post(path, payload) {
  return request(path, { method: 'POST', payload })
}

export function registerCitizen(payload) {
  return post('/auth/register/', payload)
}

export function loginCitizen(payload) {
  return post('/auth/login/', payload)
}

export function loginAdmin(payload) {
  return post('/auth/admin/login/', payload)
}

export function loginRepresentative(payload) {
  return post('/auth/representative/login/', payload)
}

export function changeRepresentativeInitialPassword(payload) {
  return post('/auth/representative/change-initial-password/', payload)
}

export function requestPasswordReset(payload) {
  return post('/auth/password-reset/request/', payload)
}

export function confirmPasswordReset(payload) {
  return post('/auth/password-reset/confirm/', payload)
}

export function fetchAdminUsers(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return request(`/admin/users/list/${query ? `?${query}` : ''}`, { authenticated: true })
}

export function fetchAvailableOrganizations() {
  return request('/admin/organizations/available/', { authenticated: true })
}

export function createManagedUser(payload) {
  return request('/admin/users/', { method: 'POST', payload, authenticated: true })
}

export function deactivateManagedUser(userId) {
  return request(`/admin/users/${userId}/deactivate/`, {
    method: 'PATCH',
    authenticated: true,
  })
}

export function fetchAdminUser(userId) {
  return request(`/admin/users/${userId}/`, { authenticated: true })
}

export function updateManagedUser(userId, payload) {
  return request(`/admin/users/${userId}/`, {
    method: 'PATCH', payload, authenticated: true,
  })
}

export function setManagedUserStatus(userId, isActive) {
  return request(`/admin/users/${userId}/status/`, {
    method: 'PATCH', payload: { is_active: isActive }, authenticated: true,
  })
}
