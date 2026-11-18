import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../App'

vi.mock('../components/complaints/ComplaintMap', () => ({
  ComplaintMap: ({ onPick, readOnly }) => readOnly ? <div>Map preview</div> : <button type="button" onClick={() => onPick?.(33.5138, 36.2765)}>Choose map point</button>,
}))

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('authentication pages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('renders all registration fields required by the API', () => {
    renderAt('/register')

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Mobile number/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument()
    expect(screen.queryByText(/I agree to the/i)).not.toBeInTheDocument()
  })

  it('changes the signed-in citizen password after checking the current one', async () => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/profile/')
        ? { id: 3, role: 'citizen', full_name: 'Test Citizen', email: 'test@example.com', phone_number: '0991234567' }
        : { detail: 'Your password was changed successfully.' },
    }))
    renderAt('/portal/profile')

    expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Current password'), 'ExistingStrongPass!2026')
    await userEvent.type(screen.getByLabelText('New password', { exact: true }), 'DifferentStrongPass!2026')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'DifferentStrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Your password was changed successfully.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/password-change/', expect.objectContaining({ method: 'POST' }))
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('submits a citizen complaint and opens its tracking page', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaint = {
      id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe beside the school',
      organization_name: 'Water Organization', status: 'pending', latitude: '33.513800', longitude: '36.276500',
      location_label: 'Near school', created_at: '2026-11-13T00:00:00Z', photos: [], status_events: [{ status: 'pending', note: '', created_at: '2026-11-13T00:00:00Z' }],
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/complaints/organizations/') ? [{ id: 4, name: 'Water Organization' }] : complaint,
    }))
    renderAt('/citizen/complaints/new')

    await userEvent.click(await screen.findByRole('radio', { name: 'Water Organization' }))
    expect(screen.queryByRole('button', { name: 'Choose map point' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Complaint title'), complaint.title)
    await userEvent.type(screen.getByLabelText('Description'), complaint.description)
    await userEvent.click(screen.getByRole('button', { name: 'Choose', exact: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose map point' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit Complaint' }))

    expect(await screen.findByRole('heading', { name: 'Complaint submitted!' })).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
    expect(screen.getByText('QAR-ABC123ABC123', { exact: false })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/complaints/', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }))
    const submitted = fetchMock.mock.calls.find(([url, options]) => url === '/api/v1/complaints/' && options?.method === 'POST')[1].body
    expect(submitted.get('latitude')).toBe('33.513800')
    expect(submitted.get('longitude')).toBe('36.276500')
    await userEvent.click(screen.getByRole('button', { name: 'Track Complaint' }))
    expect(await screen.findByLabelText('Complaint progress')).toBeInTheDocument()
  })

  it('shows the citizen complaints list with search, status filters, and bottom navigation', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaints = [
      { id: 12, reference: 'QAR-ABC123', title: 'Water leak', organization_name: 'Water', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-13T00:00:00Z', photos: [], status_events: [] },
      { id: 13, reference: 'QAR-DEF456', title: 'Broken pipe', organization_name: 'Water', status: 'resolved', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T00:00:00Z', photos: [], status_events: [] },
    ]
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => complaints })
    renderAt('/citizen/complaints')

    expect(await screen.findByRole('heading', { name: 'My Complaints' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Open complaint QAR-ABC123/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open complaint QAR-DEF456/ })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Citizen pages' })).getByRole('button', { name: 'Complaints' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Resolved', pressed: false }))
    expect(screen.queryByRole('button', { name: /Open complaint QAR-ABC123/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open complaint QAR-DEF456/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search complaints by ID or title' }), 'ABC123')
    expect(screen.getByRole('button', { name: /Open complaint QAR-ABC123/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open complaint QAR-DEF456/ })).not.toBeInTheDocument()
  })

  it('shows the solution photo first, otherwise the first complaint photo, otherwise the organization image', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const base = { organization: 4, organization_name: 'Water', organization_image_version: '2026-11-14T10:00:00Z', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z' }
    const complaints = [
      { ...base, id: 12, reference: 'QAR-ORG', title: 'No photos', status: 'pending', photos: [], status_events: [] },
      { ...base, id: 13, reference: 'QAR-USER', title: 'Citizen photos', status: 'pending', photos: [{ id: 32 }, { id: 31 }], status_events: [] },
      { ...base, id: 14, reference: 'QAR-SOLVED', title: 'Solved issue', status: 'resolved', photos: [{ id: 41 }], status_events: [{ status: 'resolved', resolution_photos: [{ id: 52 }, { id: 51 }] }] },
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => url === '/api/v1/complaints/'
      ? { ok: true, json: async () => complaints }
      : { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) })
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => `blob:photo-${blob.size}-${Math.random()}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    renderAt('/citizen/complaints')

    const organizationCard = await screen.findByRole('button', { name: /Open complaint QAR-ORG/ })
    expect(organizationCard.querySelector('img')?.getAttribute('src')).toContain('/organizations/4/image/')
    const citizenCard = screen.getByRole('button', { name: /Open complaint QAR-USER/ })
    const solvedCard = screen.getByRole('button', { name: /Open complaint QAR-SOLVED/ })
    await waitFor(() => {
      expect(within(citizenCard).getByRole('img', { name: 'Complaint photo' })).toBeInTheDocument()
      expect(within(solvedCard).getByRole('img', { name: 'Solution photo' })).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/complaints/13/photos/31/', expect.any(Object))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/complaints/14/resolution-photos/51/', expect.any(Object))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/complaints/14/photos/41/', expect.any(Object))
  })

  it('copies the complaint reference from its details', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaint = { id: 12, reference: 'QAR-ABC123', title: 'Water leak', description: 'Leaking pipe', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-13T00:00:00Z', photos: [], status_events: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => complaint })
    const writeText = vi.fn().mockResolvedValue(undefined)
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      renderAt('/citizen/complaints/12')
      await screen.findByRole('heading', { name: 'Water leak' })
      await userEvent.click(screen.getByRole('button', { name: 'Copy complaint ID' }))
      expect(writeText).toHaveBeenCalledWith('QAR-ABC123')
      expect(await screen.findByRole('button', { name: 'Complaint ID copied' })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
      else delete navigator.clipboard
    }
  })

  it('shows the real resolution and before/after photos without adding unsupported sections', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaint = {
      id: 12, reference: 'QAR-ABC123', title: 'Water leak', description: 'A pipe was leaking',
      status: 'resolved', latitude: '33.513800', longitude: '36.276500', location_label: 'Damascus',
      created_at: '2026-11-13T00:00:00Z', photos: [{ id: 31 }],
      status_events: [
        { status: 'pending', note: '', created_at: '2026-11-13T00:00:00Z', resolution_photos: [] },
        { status: 'in_progress', note: 'Repair started', created_at: '2026-11-14T00:00:00Z', resolution_photos: [] },
        { status: 'resolved', note: 'Pipe repaired', created_at: '2026-11-15T00:00:00Z', resolution_photos: [{ id: 41 }] },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => url.endsWith('/complaints/12/')
      ? { ok: true, json: async () => complaint }
      : { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    renderAt('/citizen/complaints/12')

    expect(await screen.findByRole('heading', { name: 'Resolution' })).toBeInTheDocument()
    expect(screen.getByText('Pipe repaired')).toBeInTheDocument()
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
    expect(await screen.findByAltText('Complaint evidence')).toBeInTheDocument()
    expect(await screen.findByAltText('Solution provided by the organization')).toBeInTheDocument()
    expect(screen.getByLabelText('Complaint progress')).toHaveTextContent('PendingIn progressResolved')
    expect(screen.queryByText('Responsible authority')).not.toBeInTheDocument()
    expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
  })

  it('groups the map preview and all citizen photos inside pending complaint information', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaint = {
      id: 12, reference: 'QAR-PENDING', title: 'Water leak', description: 'A pipe was leaking',
      status: 'pending', latitude: '33.513800', longitude: '36.276500', location_label: 'Damascus',
      created_at: '2026-11-13T00:00:00Z', photos: [{ id: 31 }, { id: 32 }, { id: 33 }],
      status_events: [{ status: 'pending', note: '', created_at: '2026-11-13T00:00:00Z', resolution_photos: [] }],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => url.endsWith('/complaints/12/')
      ? { ok: true, json: async () => complaint }
      : { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    renderAt('/citizen/complaints/12')

    const information = await screen.findByRole('heading', { name: 'Complaint information' })
    const card = information.closest('section')
    expect(within(card).getByLabelText('Complaint location and photos')).toBeInTheDocument()
    expect(within(card).getByText('Map preview')).toBeInTheDocument()
    await waitFor(() => expect(within(card).getAllByAltText('Complaint evidence')).toHaveLength(3))
    expect(screen.queryByRole('heading', { name: 'Photos you added' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Complaint location' })).not.toBeInTheDocument()
  })

  it('sends the selected extra category with its organization', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/complaints/organizations/')
        ? [{ id: 4, name: 'Water', category_id: null }, { id: 4, name: 'Water leak', category_id: 9, image_version: '2026-11-14T10:00:00Z' }]
        : { id: 12, reference: 'QAR-ABC123ABC123', title: 'Leak', description: 'A pipe is leaking', organization_name: 'Water leak', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z', photos: [], status_events: [] },
    }))
    renderAt('/citizen/complaints/new')

    await userEvent.click(await screen.findByRole('radio', { name: 'Water leak' }))
    await userEvent.type(screen.getByLabelText('Complaint title'), 'Leak')
    await userEvent.type(screen.getByLabelText('Description'), 'A pipe is leaking')
    await userEvent.click(screen.getByRole('button', { name: 'Choose', exact: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose map point' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit Complaint' }))

    expect(await screen.findByText('QAR-ABC123ABC123', { exact: false })).toBeInTheDocument()
    const submitted = fetchMock.mock.calls.find(([url, options]) => url === '/api/v1/complaints/' && options?.method === 'POST')[1].body
    expect(submitted.get('organization')).toBe('4')
    expect(submitted.get('category')).toBe('9')
  })

  it('shows why current location is unavailable over insecure mobile HTTP', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    vi.stubGlobal('isSecureContext', false)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [{ id: 4, name: 'Water Organization' }] })
    renderAt('/citizen/complaints/new')
    await userEvent.click(screen.getByRole('button', { name: 'Choose', exact: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(screen.getByRole('alert')).toHaveTextContent('trusted HTTPS')
  })

  it('lets the representative open the citizen-selected complaint location', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, role: 'representative', full_name: 'Water Representative', organization_name: 'Water' }))
    const complaint = { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z', photos: [], status_events: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => complaint })
    renderAt('/representative/complaints/12')
    const locationButton = await screen.findByRole('button', { name: /View complaint location/ })
    await userEvent.click(locationButton)
    expect(screen.getByText('Map preview')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Complaint location' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close map' }))
    expect(screen.queryByRole('dialog', { name: 'Complaint location' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/representative/complaints/12/', expect.any(Object))
  })

  it('requires a rejection reason and updates the representative complaint status', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, role: 'representative', full_name: 'Water Representative', organization_name: 'Water' }))
    const complaint = { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z', photos: [], status_events: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => ({ ok: true, json: async () => options?.method === 'PATCH' ? { ...complaint, status: 'rejected', status_events: [{ status: 'rejected', note: 'Not our responsibility', created_at: '2026-11-14T11:00:00Z' }] } : complaint }))
    renderAt('/representative/complaints/12')
    await screen.findByRole('heading', { name: 'Update complaint status' })
    expect(screen.getByRole('combobox', { name: 'New status' })).toHaveTextContent('pending')
    await userEvent.click(screen.getByRole('combobox', { name: 'New status' }))
    expect(screen.queryByRole('option', { name: 'Choose status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'pending' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'rejected' }))
    await userEvent.type(screen.getByLabelText('Reason for rejection'), 'Not our responsibility')
    await userEvent.click(screen.getByRole('button', { name: 'Save status' }))
    expect(await screen.findByText('Not our responsibility')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'New status' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/representative/complaints/12/status/', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'rejected', note: 'Not our responsibility' }) }))
  })

  it('transfers an open complaint to another organization', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, role: 'representative', full_name: 'Water Representative', organization_name: 'Water' }))
    const complaint = { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z', photos: [], status_events: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/transfer-organizations/') ? [{ id: 4, name: 'Roads' }]
        : url.endsWith('/transfer/') ? { ...complaint, organization: 4 } : url.endsWith('/representative/complaints/') ? [] : complaint,
    }))
    renderAt('/representative/complaints/12')
    await userEvent.click(await screen.findByRole('button', { name: 'Transfer complaint' }))
    await userEvent.click(await screen.findByRole('combobox', { name: 'Destination organization' }))
    await userEvent.click(screen.getByRole('option', { name: 'Roads' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Transfer complaint' })).getByRole('button', { name: 'Transfer complaint' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Complaint transferred successfully.')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/representative/complaints/12/transfer/', expect.objectContaining({ method: 'POST', body: JSON.stringify({ organization: 4 }) }))
  })

  it('uploads optional solution photos only when resolving a complaint', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, role: 'representative', full_name: 'Water Representative', organization_name: 'Water' }))
    const complaint = { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water', status: 'in_progress', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-14T10:00:00Z', photos: [], status_events: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => ({ ok: true, json: async () => options?.method === 'PATCH' ? { ...complaint, status: 'resolved', status_events: [{ status: 'resolved', note: 'Fixed', created_at: '2026-11-14T11:00:00Z', resolution_photos: [] }] } : complaint }))
    renderAt('/representative/complaints/12')
    await screen.findByRole('heading', { name: 'Update complaint status' })
    expect(screen.getByRole('combobox', { name: 'New status' })).toHaveTextContent('in progress')
    expect(screen.queryByLabelText('Add solution photos')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'New status' }))
    expect(screen.queryByRole('option', { name: 'in progress' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'rejected' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'resolved' }))
    const image = new File(['\x89PNG\r\n\x1a\n'], 'solution.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Add solution photos'), image)
    expect(await screen.findByAltText('solution.png')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Fixed')
    await userEvent.click(screen.getByRole('button', { name: 'Save status' }))
    expect(await screen.findByText('Fixed')).toBeInTheDocument()
    const upload = fetchMock.mock.calls.find(([url, options]) => url === '/api/v1/representative/complaints/12/status/' && options?.method === 'PATCH')[1].body
    expect(upload).toBeInstanceOf(FormData)
    expect(upload.get('status')).toBe('resolved')
    expect(upload.getAll('resolution_photos')).toHaveLength(1)
  })

  it('places the current-location coordinates into the complaint form', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    vi.stubGlobal('isSecureContext', true)
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success) => success({ coords: { latitude: 33.5138, longitude: 36.2765 } }) } })
    try {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({ ok: true, json: async () => url.endsWith('/complaints/organizations/') ? [{ id: 4, name: 'Water Organization' }] : { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water Organization', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-13T00:00:00Z', photos: [], status_events: [] } }))
      renderAt('/citizen/complaints/new')
      await userEvent.click(await screen.findByRole('radio', { name: 'Water Organization' }))
      await userEvent.type(screen.getByLabelText('Complaint title'), 'Water leak')
      await userEvent.type(screen.getByLabelText('Description'), 'Leaking pipe')
      await userEvent.click(screen.getByRole('button', { name: 'Choose', exact: true }))
      await userEvent.click(screen.getByRole('button', { name: 'Use my location' }))
      expect(await screen.findByText('33.51380, 36.27650')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Submit Complaint' }))
      const submitted = fetchMock.mock.calls.find(([url, options]) => url === '/api/v1/complaints/' && options?.method === 'POST')[1].body
      expect(submitted.get('latitude')).toBe('33.513800')
      expect(submitted.get('longitude')).toBe('36.276500')
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation)
      else delete navigator.geolocation
    }
  })

  it('refreshes an expired session before submitting the complaint', async () => {
    sessionStorage.setItem('qarib.accessToken', 'expired-access')
    sessionStorage.setItem('qarib.refreshToken', 'valid-refresh')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    const complaint = { id: 12, reference: 'QAR-ABC123ABC123', title: 'Water leak', description: 'Leaking pipe', organization_name: 'Water Organization', status: 'pending', latitude: '33.513800', longitude: '36.276500', created_at: '2026-11-13T00:00:00Z', photos: [], status_events: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (url.endsWith('/complaints/organizations/')) return { ok: true, json: async () => [{ id: 4, name: 'Water Organization' }] }
      if (url.endsWith('/auth/token/refresh/')) return { ok: true, json: async () => ({ access: 'new-access' }) }
      if (url.endsWith('/complaints/') && options?.method === 'POST' && options.headers.Authorization === 'Bearer expired-access') return { ok: false, status: 401, json: async () => ({ detail: 'Given token not valid for any token type' }) }
      return { ok: true, json: async () => complaint }
    })
    renderAt('/citizen/complaints/new')
    await userEvent.click(await screen.findByRole('radio', { name: 'Water Organization' }))
    await userEvent.type(screen.getByLabelText('Complaint title'), 'Water leak')
    await userEvent.type(screen.getByLabelText('Description'), 'Leaking pipe')
    await userEvent.click(screen.getByRole('button', { name: 'Choose', exact: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose map point' }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit Complaint' }))
    expect(await screen.findByText('QAR-ABC123ABC123', { exact: false })).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('new-access')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/token/refresh/', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/complaints/', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer new-access' }) }))
  })

  it('previews optional photos and limits selection to three', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 3, role: 'citizen', full_name: 'Test Citizen' }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [{ id: 4, name: 'Water Organization' }] })
    renderAt('/citizen/complaints/new')
    const photos = ['one.png', 'two.png', 'three.png', 'four.png'].map((name) => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: 'image/png' }))
    await userEvent.upload(screen.getByLabelText('Add up to 3 photos'), photos.slice(0, 2))
    expect(await screen.findByAltText('one.png')).toBeInTheDocument()
    expect(await screen.findByAltText('two.png')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Add up to 3 photos'), photos.slice(2))
    expect(screen.getByText('Choose up to 3 JPEG, PNG, or WebP images, 5 MB each.')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Add up to 3 photos'), [photos[2]])
    expect(await screen.findByAltText('three.png')).toBeInTheDocument()
    expect(screen.queryByLabelText('Add up to 3 photos')).not.toBeInTheDocument()
  })

  it('requires email verification before creating a citizen session', async () => {
    const citizen = { id: 9, full_name: 'New Citizen', email: 'new@example.com', role: 'citizen' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/auth/register/')
        ? { email: citizen.email }
        : { access: 'new-access', refresh: 'new-refresh', user: citizen },
    }))
    renderAt('/register')

    await userEvent.type(screen.getByPlaceholderText('Full name'), citizen.full_name)
    await userEvent.type(screen.getByPlaceholderText('Email address'), citizen.email)
    await userEvent.type(screen.getByPlaceholderText(/Mobile number/), '0991234567')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'StrongPass!2026')
    await userEvent.type(screen.getByPlaceholderText('Confirm password'), 'StrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBeNull()
    await userEvent.type(screen.getByRole('textbox', { name: 'Verification code digit 1' }), '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back, New' })).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('new-access')
    expect(sessionStorage.getItem('qarib.refreshToken')).toBe('new-refresh')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/register/', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/register/confirm/', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/auth/login/', expect.anything())
  })

  it.each([
    ['citizen', '/citizen/home', 'Welcome back'],
    ['representative', '/representative/home', 'Representative portal'],
    ['system_admin', '/admin/accounts', 'Admin portal'],
  ])('revokes the %s refresh token and leaves the portal', async (role, homePath, loginTitle) => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.refreshToken', 'refresh-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test User', role, organization_name: 'Water' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url.endsWith('/auth/logout/')) return { ok: true, json: async () => ({}) }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 0, results: [], summary: {} }) }
    })
    renderAt(homePath)

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('alertdialog', { name: 'Log out of Qarib?' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/auth/logout/', expect.anything())
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Log out of Qarib?' })).getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: loginTitle, exact: role !== 'citizen' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/logout/', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ refresh: 'refresh-token' }),
    }))
    expect(sessionStorage.getItem('qarib.accessToken')).toBeNull()
    expect(sessionStorage.getItem('qarib.refreshToken')).toBeNull()
  })

  it('clears the local session and warns if server logout fails', async () => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.refreshToken', 'refresh-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test Citizen', role: 'citizen' }))
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'))
    renderAt('/citizen/home')

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Log out of Qarib?' })).getByRole('button', { name: 'Log out' }))

    expect(await screen.findByText('Signed out on this device, but server sign-out could not be confirmed.')).toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.accessToken')).toBeNull()
    expect(sessionStorage.getItem('qarib.refreshToken')).toBeNull()
  })

  it('keeps the citizen signed in when logout confirmation is cancelled', async () => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.refreshToken', 'refresh-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test Citizen', role: 'citizen' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderAt('/citizen/home')

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog', { name: 'Log out of Qarib?' })).not.toBeInTheDocument()
    expect(sessionStorage.getItem('qarib.refreshToken')).toBe('refresh-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the citizen home focused on submitting a complaint', async () => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test Citizen', role: 'citizen' }))
    renderAt('/citizen/home')

    expect(screen.getByRole('heading', { name: 'Make your community better' })).toBeInTheDocument()
    expect(screen.queryByText('Coming next')).not.toBeInTheDocument()
    expect(screen.queryByText('Account type')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View complaints' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage profile' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Submit a complaint/ }))
    expect(await screen.findByRole('heading', { name: 'Tell us what happened' })).toBeInTheDocument()
  })

  it('shows the representative organization, real complaint counts, and recent complaints', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, role: 'representative', full_name: 'Omar Khaled', organization_name: 'Water Organization' }))
    const base = { organization_name: 'Water Organization', latitude: '33.513800', longitude: '36.276500', photos: [], status_events: [], created_at: '2026-11-14T10:00:00Z' }
    const complaints = [
      { ...base, id: 1, reference: 'QAR-1', title: 'Water leak', status: 'pending' },
      { ...base, id: 2, reference: 'QAR-2', title: 'Broken pipe', status: 'in_progress' },
      { ...base, id: 3, reference: 'QAR-3', title: 'Fixed pipe', status: 'resolved' },
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => complaints })
    renderAt('/representative/home')

    expect(screen.getByRole('heading', { name: 'Welcome back, Omar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Water Organization' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Open complaint QAR-1/ })).toBeInTheDocument()
    const summary = screen.getByLabelText('Organization complaint summary')
    expect(within(summary).getByText('Pending').closest('article')).toHaveTextContent('1')
    expect(within(summary).getByText('In progress').closest('article')).toHaveTextContent('1')
    expect(within(summary).getByText('Resolved').closest('article')).toHaveTextContent('1')
    expect(screen.getByRole('navigation', { name: 'Representative pages' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/representative/complaints/', expect.any(Object))
  })

  it('closes the portal navigation when the mobile backdrop is tapped', async () => {
    sessionStorage.setItem('qarib.accessToken', 'access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test Citizen', role: 'citizen' }))
    renderAt('/citizen/home')

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getAllByRole('button', { name: 'Close navigation' })[0]).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(document.querySelector('.portal-menu-backdrop'))
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')
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
        user: { id: 2, full_name: 'Test Citizen', role: 'citizen' },
      }),
    })
    renderAt('/login')

    await userEvent.type(screen.getByPlaceholderText('Email address'), 'citizen@example.com')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'StrongPass!2026')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('heading', { name: 'Welcome back, Test' })).toBeInTheDocument()
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

    expect((await screen.findAllByText('Ministry of Water')).length).toBeGreaterThan(0)
    expect(sessionStorage.getItem('qarib.accessToken')).toBe('representative-access')
    expect(sessionStorage.getItem('qarib.initialPasswordToken')).toBeNull()
  })

  it('lets a citizen open and update the shared portal profile', async () => {
    sessionStorage.setItem('qarib.accessToken', 'citizen-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 2, full_name: 'Test Citizen', role: 'citizen' }))
    const profile = { id: 2, full_name: 'Test Citizen', email: 'citizen@example.com', phone_number: '0991234567', role: 'citizen', organization_name: null }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => ({
      ok: true,
      json: async () => options.method === 'PATCH' ? { ...profile, full_name: 'Updated Citizen' } : profile,
    }))
    renderAt('/portal/profile')

    const nameInput = await screen.findByLabelText(/Full name/)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Updated Citizen')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Your profile was updated successfully.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Account role')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Organization/)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/profile/', expect.objectContaining({ method: 'PATCH' }))
  })

  it('lets a representative upload an organization image from the profile', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, full_name: 'Water Representative', role: 'representative' }))
    const profile = { id: 7, full_name: 'Water Representative', email: 'water@example.com', phone_number: '0991234567', role: 'representative', organization_id: 4, organization_name: 'Water' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.endsWith('/profile/organization-image/') ? { organization_id: 4, image_version: '2026-11-14T10:00:00Z' } : profile,
    }))
    renderAt('/portal/profile')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Water' }))
    const image = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'water.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Replace image (optional)'), image)
    await userEvent.click(screen.getByRole('button', { name: 'Save category' }))

    expect(await screen.findByRole('button', { name: 'Edit Water' })).toBeInTheDocument()
    const upload = fetchMock.mock.calls.find(([url]) => url.endsWith('/profile/organization-image/'))
    expect(upload[1].body.get('image')).toEqual(image)
    expect(screen.getByRole('button', { name: 'Edit Water' }).closest('.portal-category-item').querySelector('img')).toHaveAttribute('src', expect.stringContaining('/organizations/4/image/'))
  })

  it('lets a representative edit the citizen-facing organization name', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, full_name: 'Water Representative', role: 'representative' }))
    const profile = { id: 7, full_name: 'Water Representative', email: 'water@example.com', phone_number: '0991234567', role: 'representative', organization_id: 4, organization_name: 'Ministry of Water', organization_display_name: 'Ministry of Water' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options = {}) => ({
      ok: true,
      json: async () => options.method === 'PATCH' ? { ...profile, organization_display_name: 'Water Services' } : profile,
    }))
    renderAt('/portal/profile')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Ministry of Water' }))
    const displayName = screen.getByLabelText('Category name')
    expect(displayName).toHaveValue('Ministry of Water')
    await userEvent.clear(displayName)
    await userEvent.type(displayName, 'Water Services')
    await userEvent.click(screen.getByRole('button', { name: 'Save category' }))

    const request = fetchMock.mock.calls.find(([url, options]) => url.endsWith('/profile/') && options?.method === 'PATCH')
    expect(JSON.parse(request[1].body).organization_display_name).toBe('Water Services')
  })

  it('adds an extra image-backed category from the representative profile', async () => {
    sessionStorage.setItem('qarib.accessToken', 'representative-access')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 7, full_name: 'Water Representative', role: 'representative' }))
    const profile = { id: 7, full_name: 'Water Representative', email: 'water@example.com', phone_number: '0991234567', role: 'representative', organization_id: 4, organization_name: 'Water', organization_display_name: 'Water' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => ({
      ok: true,
      json: async () => url.endsWith('/profile/categories/')
        ? options.method === 'POST' ? { id: 9, name: 'Water leak', image_version: '2026-11-14T10:00:00Z' } : []
        : profile,
    }))
    renderAt('/portal/profile')

    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }))
    await userEvent.type(screen.getByLabelText('Category name'), 'Water leak')
    expect(screen.getByLabelText('Category name')).toHaveValue('Water leak')
    const image = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'water.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Category image'), image)
    expect(screen.getByLabelText('Category image').files).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Save category' }))

    expect(fetchMock.mock.calls.some(([url, options]) => url.endsWith('/profile/categories/') && options?.method === 'POST')).toBe(true)
    expect(await screen.findByText('Water leak')).toBeInTheDocument()
    const request = fetchMock.mock.calls.find(([url, options]) => url.endsWith('/profile/categories/') && options?.method === 'POST')
    expect(request[1].body.get('name')).toBe('Water leak')
    expect(request[1].body.get('image')).toEqual(image)
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
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: 'Account role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Organization representative' }))
    expect(screen.getByLabelText('Temporary password')).toBeInTheDocument()
  })

  it('keeps account actions visible and hides organization for the citizens filter', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 1, full_name: 'System Admin', role: 'system_admin' }))
    const citizen = { id: 5, full_name: 'Visible Citizen', email: 'visible@example.com', phone_number: '0995555555', role: 'citizen', organization_name: null, is_active: true }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => url.includes('/organizations/') ? [] : { count: 1, next: null, previous: null, summary: {}, results: [citizen] },
    }))
    renderAt('/admin/accounts')

    expect(await screen.findByRole('switch', { name: 'Deactivate Visible Citizen' })).toBeVisible()
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter by role' }))
    await userEvent.click(screen.getByRole('option', { name: 'Citizens' }))

    expect(await screen.findByRole('switch', { name: 'Deactivate Visible Citizen' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: 'Organization' })).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('Temporary password')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'StrongPass!2026')
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
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      if (url.endsWith('/admin/users/4/') && options.method === 'PATCH') return { ok: true, json: async () => ({ ...citizen, email: 'new-edit@example.com' }) }
      if (url.endsWith('/admin/users/4/')) return { ok: true, json: async () => citizen }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 1, next: null, previous: null, summary: {}, results: [citizen] }) }
    })
    renderAt('/admin/accounts')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Edit Citizen' }))

    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Manage accounts' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Edit Citizen')).toBeInTheDocument()
    const emailInput = screen.getByRole('textbox', { name: 'Email address' })
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'new-edit@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/users/4/', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('"email":"new-edit@example.com"'),
    }))
  })

  it.each([
    ['citizen', null],
    ['representative', 'Water Organization'],
  ])('uses the shared edit modal from a %s detail page', async (role, organizationName) => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 1, full_name: 'System Admin', role: 'system_admin' }))
    const account = { id: 4, full_name: 'Managed User', email: 'old@example.com', phone_number: '0991234567', role, organization_name: organizationName, organization_id: role === 'representative' ? 3 : null, is_active: true, assignment_history: [] }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      if (url.endsWith('/admin/users/4/') && options.method === 'PATCH') return { ok: true, json: async () => ({ ...account, email: 'new@example.com' }) }
      if (url.endsWith('/admin/users/4/')) return { ok: true, json: async () => account }
      if (url.includes('/organizations/')) return { ok: true, json: async () => [] }
      return { ok: true, json: async () => ({ count: 1, next: null, previous: null, summary: {}, results: [account] }) }
    })
    renderAt('/admin/accounts/4')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit account' }))
    expect(screen.getByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    const emailInput = await screen.findByRole('textbox', { name: 'Email address' })
    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'new@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/users/4/', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('"email":"new@example.com"'),
    }))
    expect(await screen.findByRole('heading', { name: 'Managed User' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Edit account' })).not.toBeInTheDocument()
  })

  it('keeps the standalone edit page for the system admin', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 1, full_name: 'System Admin', role: 'system_admin' }))
    const admin = { id: 1, full_name: 'System Admin', email: 'admin@example.com', phone_number: '0991234567', role: 'system_admin' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => admin })
    renderAt('/admin/accounts/1')

    await userEvent.click(await screen.findByRole('button', { name: 'Edit account' }))

    expect(await screen.findByText('Update your administrator profile. Your role remains protected.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Edit account' })).not.toBeInTheDocument()
  })

  it('opens the shared modal when visiting an old user edit link', async () => {
    sessionStorage.setItem('qarib.accessToken', 'admin-access-token')
    sessionStorage.setItem('qarib.user', JSON.stringify({ id: 1, full_name: 'System Admin', role: 'system_admin' }))
    const citizen = { id: 4, full_name: 'Managed Citizen', email: 'old@example.com', phone_number: '0991234567', role: 'citizen', organization_name: null, organization_id: null, assignment_history: [] }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => citizen })
    renderAt('/admin/accounts/4/edit')

    expect(await screen.findByRole('dialog', { name: 'Edit account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Managed Citizen' })).toBeInTheDocument()
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
