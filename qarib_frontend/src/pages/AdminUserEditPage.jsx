import { ArrowLeft, Save, UserRoundPen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { AdminLayout } from '../components/admin/AdminLayout'
import { AdminSelect } from '../components/admin/AdminSelect'
import { ApiError, fetchAdminUser, fetchAvailableOrganizations, updateManagedUser } from '../services/authApi'
import '../styles/admin-dashboard.css'

export function AdminUserEditPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '', organization_id: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([fetchAdminUser(userId), fetchAvailableOrganizations()]).then(([account, available]) => {
      if (!active) return
      setUser(account)
      setOrganizations(available)
      setForm({ full_name: account.full_name, email: account.email, phone_number: account.phone_number, organization_id: account.organization_id ? String(account.organization_id) : '' })
    }).catch((error) => active && setMessage(error instanceof ApiError ? error.message : 'The service is unavailable.'))
    return () => { active = false }
  }, [userId])

  const organizationOptions = useMemo(() => {
    if (!user?.organization_id || organizations.some((item) => item.id === user.organization_id)) return organizations
    return [{ id: user.organization_id, name: user.organization_name }, ...organizations]
  }, [organizations, user])

  function update(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function errorFor(name) {
    const error = fieldErrors[name]
    return Array.isArray(error) ? error[0] : error
  }

  function updateOrganization(value) {
    setForm((current) => ({ ...current, organization_id: value }))
    setFieldErrors((current) => ({ ...current, organization_id: undefined }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setFieldErrors({})
    setMessage('')
    const payload = { full_name: form.full_name.trim(), phone_number: form.phone_number }
    if (user.role === 'system_admin') payload.email = form.email.trim()
    if (user.role === 'representative' && form.organization_id) payload.organization_id = Number(form.organization_id)
    try {
      const updated = await updateManagedUser(user.id, payload)
      if (user.role === 'system_admin') {
        const storedUser = JSON.parse(sessionStorage.getItem('qarib.user') ?? '{}')
        sessionStorage.setItem('qarib.user', JSON.stringify({ ...storedUser, ...updated }))
      }
      navigate('/admin/accounts', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) setFieldErrors(error.errors ?? {})
      else setMessage('The service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-content admin-detail-content edit-page-content">
        <button className="back-button" type="button" onClick={() => navigate('/admin/accounts')}><ArrowLeft size={18} /> Back to manage accounts</button>
        {!user && !message ? <div className="admin-empty">Loading account…</div> : null}
        {message ? <div className="form-message form-message--error">{message}</div> : null}
        {user ? (
          <section className="edit-account-panel edit-account-card">
            <div className="edit-card-heading"><div className="edit-card-icon"><UserRoundPen size={25} /></div><div><span>Account management</span><h1>Edit account</h1><p>{user.role === 'system_admin' ? 'Update your administrator profile. Your role remains protected.' : `Update ${user.full_name}'s editable information. Email and role remain protected.`}</p></div></div>
            <form onSubmit={submit} className="edit-account-form">
              <label>Full name<input name="full_name" value={form.full_name} onChange={update} aria-invalid={Boolean(errorFor('full_name'))} required />{errorFor('full_name') ? <span className="admin-field-error">{errorFor('full_name')}</span> : null}</label>
              <label>Mobile number<input name="phone_number" value={form.phone_number} onChange={update} maxLength={10} inputMode="numeric" aria-invalid={Boolean(errorFor('phone_number'))} required />{errorFor('phone_number') ? <span className="admin-field-error">{errorFor('phone_number')}</span> : null}</label>
              <label>Email address<input name="email" type="email" value={form.email} onChange={update} disabled={user.role !== 'system_admin'} aria-invalid={Boolean(errorFor('email'))} required />{errorFor('email') ? <span className="admin-field-error">{errorFor('email')}</span> : null}</label>
              <label>Role<input value={user.role.replace('_', ' ')} disabled /></label>
              {user.role === 'representative' ? <label className="form-span">Organization<AdminSelect ariaLabel="Organization" value={form.organization_id} onChange={updateOrganization} invalid={Boolean(errorFor('organization_id'))} options={organizationOptions.map((organization) => ({ value: organization.id, label: organization.name }))} />{errorFor('organization_id') ? <span className="admin-field-error">{errorFor('organization_id')}</span> : null}</label> : null}
              <div className="modal-actions form-span"><button className="secondary-button" type="button" onClick={() => navigate('/admin/accounts')}>Cancel</button><button className="add-account-button" type="submit" disabled={loading}><Save size={17} /> {loading ? 'Saving…' : 'Save changes'}</button></div>
            </form>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  )
}
