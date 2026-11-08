const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(message, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
  }
}

async function post(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.detail ?? 'We could not complete your request.'
    throw new ApiError(message, data)
  }

  return data
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

export function requestPasswordReset(payload) {
  return post('/auth/password-reset/request/', payload)
}

export function confirmPasswordReset(payload) {
  return post('/auth/password-reset/confirm/', payload)
}
