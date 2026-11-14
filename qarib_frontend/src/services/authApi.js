const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(message, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
  }
}

let refreshPromise

async function refreshAccessToken() {
  const refresh = sessionStorage.getItem('qarib.refreshToken')
  if (!refresh) return null
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    }).then(async (response) => {
      if (!response.ok) return null
      const data = await response.json()
      if (!data.access) return null
      sessionStorage.setItem('qarib.accessToken', data.access)
      if (data.refresh) sessionStorage.setItem('qarib.refreshToken', data.refresh)
      return data.access
    }).catch(() => null).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function authenticatedFetch(url, options) {
  const send = (token) => fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token || ''}` } })
  let response = await send(sessionStorage.getItem('qarib.accessToken'))
  if (response.status !== 401) return response
  const access = await refreshAccessToken()
  if (!access) throw new ApiError('Your session has expired. Please log in again.', { code: 'session_expired' })
  response = await send(access)
  if (response.status === 401) throw new ApiError('Your session has expired. Please log in again.', { code: 'session_expired' })
  return response
}

async function request(path, { method = 'GET', payload, authenticated = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (authenticated) {
    const accessToken = sessionStorage.getItem('qarib.accessToken')
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  }
  const options = {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }
  const response = authenticated ? await authenticatedFetch(`${API_BASE_URL}${path}`, options) : await fetch(`${API_BASE_URL}${path}`, options)
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

export function confirmCitizenRegistration(payload) {
  return post('/auth/register/confirm/', payload)
}

export function resendCitizenRegistrationCode(payload) {
  return post('/auth/register/resend/', payload)
}

export function requestEmailChange(payload) {
  return request('/auth/email-change/request/', { method: 'POST', payload, authenticated: true })
}

export function confirmEmailChange(payload) {
  return request('/auth/email-change/confirm/', { method: 'POST', payload, authenticated: true })
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

export async function logoutCurrentSession() {
  const refresh = sessionStorage.getItem('qarib.refreshToken')
  let serverEnded = false
  try {
    if (refresh) {
      await post('/auth/logout/', { refresh })
      serverEnded = true
    }
  } catch {
    // Local sign-out still completes if the server cannot be reached.
  } finally {
    for (const key of ['qarib.accessToken', 'qarib.refreshToken', 'qarib.user', 'qarib.initialPasswordToken', 'qarib.pendingRepresentative']) {
      sessionStorage.removeItem(key)
    }
  }
  return serverEnded
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

export function changeMyPassword(payload) {
  return request('/auth/password-change/', { method: 'POST', payload, authenticated: true })
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

export function fetchMyProfile() {
  return request('/profile/', { authenticated: true })
}

export function updateMyProfile(payload) {
  return request('/profile/', { method: 'PATCH', payload, authenticated: true })
}

export function organizationImageUrl(id, version) {
  return version ? `${API_BASE_URL}/organizations/${id}/image/?v=${encodeURIComponent(version)}` : null
}

export function categoryImageUrl(id, version) {
  return version ? `${API_BASE_URL}/categories/${id}/image/?v=${encodeURIComponent(version)}` : null
}

export function fetchOrganizationCategories() {
  return request('/profile/categories/', { authenticated: true })
}

export async function saveOrganizationCategory({ id, name, image }) {
  const form = new FormData()
  form.append('name', name)
  if (image) form.append('image', image)
  const response = await authenticatedFetch(`${API_BASE_URL}/profile/categories/${id ? `${id}/` : ''}`, {
    method: id ? 'PATCH' : 'POST', body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.detail ?? 'Could not save the category.', data)
  return data
}

export async function uploadOrganizationImage(image) {
  const form = new FormData()
  form.append('image', image)
  const response = await authenticatedFetch(`${API_BASE_URL}/profile/organization-image/`, { method: 'POST', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.detail ?? 'Could not upload the organization image.', data)
  return data
}

export function fetchComplaintOrganizations() {
  return request('/complaints/organizations/', { authenticated: true })
}

export function fetchMyComplaints(reference = '') {
  const query = reference.trim() ? `?reference=${encodeURIComponent(reference.trim())}` : ''
  return request(`/complaints/${query}`, { authenticated: true })
}

export function fetchMyComplaint(id) {
  return request(`/complaints/${id}/`, { authenticated: true })
}

export function fetchRepresentativeComplaints() {
  return request('/representative/complaints/', { authenticated: true })
}

export function fetchRepresentativeComplaint(id) {
  return request(`/representative/complaints/${id}/`, { authenticated: true })
}

export function changeRepresentativeComplaintStatus(id, payload) {
  if (!payload.resolution_photos?.length) {
    return request(`/representative/complaints/${id}/status/`, { method: 'PATCH', payload: { status: payload.status, note: payload.note }, authenticated: true })
  }
  const form = new FormData()
  form.append('status', payload.status)
  form.append('note', payload.note ?? '')
  payload.resolution_photos.forEach((photo) => form.append('resolution_photos', photo))
  return authenticatedFetch(`${API_BASE_URL}/representative/complaints/${id}/status/`, { method: 'PATCH', body: form })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new ApiError(data.detail ?? 'Could not update this complaint.', data)
      return data
    })
}

export async function fetchResolutionPhoto(complaintId, photoId, representative = false) {
  const prefix = representative ? '/representative' : ''
  const response = await authenticatedFetch(`${API_BASE_URL}${prefix}/complaints/${complaintId}/resolution-photos/${photoId}/`, {})
  if (!response.ok) throw new ApiError('Could not load the solution photo.')
  return response.blob()
}

export async function fetchRepresentativeComplaintPhoto(complaintId, photoId) {
  const response = await authenticatedFetch(`${API_BASE_URL}/representative/complaints/${complaintId}/photos/${photoId}/`, {})
  if (!response.ok) throw new ApiError('Could not load the complaint photo.')
  return response.blob()
}

export async function createComplaint(payload) {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'photos') value.forEach((photo) => form.append('photos', photo))
      else if (key === 'category' && !value) continue
      else if (key === 'latitude' || key === 'longitude') form.append(key, Number(value).toFixed(6))
      else form.append(key, value)
  }
  const response = await authenticatedFetch(`${API_BASE_URL}/complaints/`, {
    method: 'POST',
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(data.detail ?? 'We could not submit your complaint.', data)
  return data
}

export async function fetchComplaintPhoto(complaintId, photoId) {
  const response = await authenticatedFetch(`${API_BASE_URL}/complaints/${complaintId}/photos/${photoId}/`, {})
  if (!response.ok) throw new ApiError('Could not load the complaint photo.')
  return response.blob()
}
