import { ArrowLeft, Save, UserRoundPen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { AdminLayout } from '../components/admin/AdminLayout'
import { ChangePasswordCard } from '../components/auth/ChangePasswordCard'
import { ApiError, fetchAdminUser, updateManagedUser } from '../services/authApi'
import '../styles/admin-dashboard.css'

export function AdminUserEditPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    fetchAdminUser(userId).then((account) => {
      if (!active) return
      setUser(account)
      setForm({ full_name: account.full_name, email: account.email, phone_number: account.phone_number })
    }).catch((error) => active && setMessage(error instanceof ApiError ? error.message : 'The service is unavailable.'))
    return () => { active = false }
  }, [userId])

  if (user && user.role !== 'system_admin') return <Navigate to={`/admin/accounts/${user.id}`} state={{ openEdit: true }} replace />

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

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setFieldErrors({})
    setMessage('')
    const payload = { full_name: form.full_name.trim(), email: form.email.trim(), phone_number: form.phone_number }
    try {
      const updated = await updateManagedUser(user.id, payload)
      const storedUser = JSON.parse(sessionStorage.getItem('qarib.user') ?? '{}')
      sessionStorage.setItem('qarib.user', JSON.stringify({ ...storedUser, ...updated }))
      if (updated.verification_required) {
        sessionStorage.setItem('qarib.pendingVerification', JSON.stringify({ purpose: 'email_change', email: updated.pending_email, returnTo: `/admin/accounts/${user.id}` }))
        navigate('/verify-email', { replace: true })
        return
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
            <div className="edit-card-heading"><div className="edit-card-icon"><UserRoundPen size={25} /></div><div><span>Account management</span><h1>Edit account</h1><p>Update your administrator profile. Your role remains protected.</p></div></div>
            <form onSubmit={submit} className="edit-account-form">
              <label>Full name<input name="full_name" value={form.full_name} onChange={update} aria-invalid={Boolean(errorFor('full_name'))} required />{errorFor('full_name') ? <span className="admin-field-error">{errorFor('full_name')}</span> : null}</label>
              <label>Mobile number<input name="phone_number" value={form.phone_number} onChange={update} maxLength={10} inputMode="numeric" aria-invalid={Boolean(errorFor('phone_number'))} required />{errorFor('phone_number') ? <span className="admin-field-error">{errorFor('phone_number')}</span> : null}</label>
              <label>Email address<input name="email" type="email" value={form.email} onChange={update} aria-invalid={Boolean(errorFor('email'))} required />{errorFor('email') ? <span className="admin-field-error">{errorFor('email')}</span> : null}</label>
              <label>Role<input value={user.role.replace('_', ' ')} disabled /></label>
              <div className="modal-actions form-span"><button className="secondary-button" type="button" onClick={() => navigate('/admin/accounts')}>Cancel</button><button className="add-account-button" type="submit" disabled={loading}><Save size={17} /> {loading ? 'Saving…' : 'Save changes'}</button></div>
            </form>
          </section>
        ) : null}
        {user ? <ChangePasswordCard /> : null}
      </div>
    </AdminLayout>
  )
}
