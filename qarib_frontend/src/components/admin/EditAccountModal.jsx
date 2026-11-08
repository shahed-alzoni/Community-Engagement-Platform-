import { Save, UserRoundPen, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ApiError, fetchAdminUser, updateManagedUser } from '../../services/authApi'
import { AdminSelect } from './AdminSelect'

export function EditAccountModal({ account, organizations, onClose, onUpdated }) {
  const [user, setUser] = useState(account)
  const [form, setForm] = useState({ full_name: account.full_name, phone_number: account.phone_number, organization_id: account.organization_id ? String(account.organization_id) : '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    fetchAdminUser(account.id).then((details) => {
      if (!active) return
      setUser(details)
      setForm({ full_name: details.full_name, phone_number: details.phone_number, organization_id: details.organization_id ? String(details.organization_id) : '' })
    }).catch((error) => active && setMessage(error instanceof ApiError ? error.message : 'The service is unavailable.'))
    return () => { active = false }
  }, [account.id])

  const organizationOptions = useMemo(() => {
    const options = organizations.map((organization) => ({ value: organization.id, label: organization.name }))
    if (user.organization_id && !organizations.some((organization) => organization.id === user.organization_id)) options.unshift({ value: user.organization_id, label: user.organization_name })
    return options
  }, [organizations, user])

  function updateValue(name, value) {
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
    const payload = { full_name: form.full_name.trim(), phone_number: form.phone_number }
    if (user.role === 'representative' && form.organization_id) payload.organization_id = Number(form.organization_id)
    try {
      onUpdated(await updateManagedUser(user.id, payload))
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.errors ?? {})
        const generalError = error.errors?.detail ?? error.errors?.non_field_errors
        setMessage(Array.isArray(generalError) ? generalError[0] : generalError || '')
      } else setMessage('The service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-modal edit-account-modal" role="dialog" aria-modal="true" aria-labelledby="edit-account-title">
        <div className="modal-header edit-modal-header">
          <div className="edit-card-heading"><div className="edit-card-icon"><UserRoundPen size={24} /></div><div><span>Account management</span><h2 id="edit-account-title">Edit account</h2><p>Update account information without leaving this page.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close edit account"><X /></button>
        </div>
        <form onSubmit={submit} className="edit-account-form">
          <label>Full name<input value={form.full_name} onChange={(event) => updateValue('full_name', event.target.value)} aria-invalid={Boolean(errorFor('full_name'))} required />{errorFor('full_name') ? <span className="admin-field-error">{errorFor('full_name')}</span> : null}</label>
          <label>Mobile number<input value={form.phone_number} onChange={(event) => updateValue('phone_number', event.target.value)} maxLength={10} inputMode="numeric" aria-invalid={Boolean(errorFor('phone_number'))} required />{errorFor('phone_number') ? <span className="admin-field-error">{errorFor('phone_number')}</span> : null}</label>
          <label>Email address<input value={user.email} disabled /></label>
          <label>Role<input value={user.role.replace('_', ' ')} disabled /></label>
          {user.role === 'representative' ? <label className="form-span">Organization<AdminSelect ariaLabel="Organization" value={form.organization_id} onChange={(value) => updateValue('organization_id', value)} invalid={Boolean(errorFor('organization_id'))} options={organizationOptions} />{errorFor('organization_id') ? <span className="admin-field-error">{errorFor('organization_id')}</span> : null}</label> : null}
          {message ? <div className="form-message form-message--error form-span">{message}</div> : null}
          <div className="modal-actions form-span"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="add-account-button" type="submit" disabled={loading}><Save size={17} /> {loading ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </section>
    </div>
  )
}
