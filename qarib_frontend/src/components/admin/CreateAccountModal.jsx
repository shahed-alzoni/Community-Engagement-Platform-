import { X } from 'lucide-react'
import { useState } from 'react'

import { ApiError, createManagedUser } from '../../services/authApi'
import { AdminSelect } from './AdminSelect'

const initialForm = {
  full_name: '', email: '', phone_number: '', password: '', role: 'citizen',
  organizationChoice: 'new', organization_name: '',
}

export function CreateAccountModal({ organizations, onClose, onCreated }) {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function fieldError(name) {
    const error = fieldErrors[name]
    return Array.isArray(error) ? error[0] : error
  }

  function update(event) {
    const { name, value } = event.target
    updateValue(name, value)
  }

  function updateValue(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(name === 'organizationChoice' || name === 'role'
        ? { organization_id: undefined, organization_name: undefined }
        : {}),
    }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setFieldErrors({})
    setMessage('')
    const payload = {
      full_name: form.full_name.trim(), email: form.email.trim(),
      phone_number: form.phone_number, password: form.password, role: form.role,
    }
    if (form.role === 'representative') {
      if (form.organizationChoice === 'new') payload.organization_name = form.organization_name.trim()
      else payload.organization_id = Number(form.organizationChoice)
    }

    try {
      await createManagedUser(payload)
      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.errors ?? {})
        const generalError = error.errors?.detail ?? error.errors?.non_field_errors
        setMessage(Array.isArray(generalError) ? generalError[0] : generalError || '')
      } else {
        setMessage('The service is unavailable.')
      }
    } finally {
      setLoading(false)
    }
  }

  function field(name, label, input) {
    const error = fieldError(name)
    return <label>{label}{input(error)}{error ? <span className="admin-field-error">{error}</span> : null}</label>
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
        <div className="modal-header">
          <div><span>Create securely</span><h2 id="create-account-title">Add new account</h2></div>
          <button type="button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form onSubmit={submit} className="admin-account-form">
          {field('full_name', 'Full name', (error) => <input name="full_name" value={form.full_name} onChange={update} aria-invalid={Boolean(error)} required />)}
          {field('email', 'Email address', (error) => <input name="email" type="email" value={form.email} onChange={update} aria-invalid={Boolean(error)} required />)}
          {field('phone_number', 'Mobile number', (error) => <input name="phone_number" inputMode="numeric" maxLength={10} value={form.phone_number} onChange={update} placeholder="10 digits" aria-invalid={Boolean(error)} required />)}
          {field('password', 'Temporary password', (error) => <input name="password" type="password" value={form.password} onChange={update} aria-invalid={Boolean(error)} required />)}
          {field('role', 'Account role', (error) => <AdminSelect ariaLabel="Account role" value={form.role} onChange={(value) => updateValue('role', value)} invalid={Boolean(error)} options={[{ value: 'citizen', label: 'Citizen' }, { value: 'representative', label: 'Organization representative' }]} />)}
          {form.role === 'representative' ? (
            <>
              {field('organization_id', 'Organization', (error) => <AdminSelect ariaLabel="Organization" value={form.organizationChoice} onChange={(value) => updateValue('organizationChoice', value)} invalid={Boolean(error)} options={[{ value: 'new', label: 'Create a new organization' }, ...organizations.map((organization) => ({ value: organization.id, label: organization.name }))]} />)}
              {form.organizationChoice === 'new' ? <div className="form-span">{field('organization_name', 'New organization name', (error) => <input name="organization_name" value={form.organization_name} onChange={update} aria-invalid={Boolean(error)} required />)}</div> : null}
              <p className="form-note form-span">The representative will be required to change this password when representative login is implemented.</p>
            </>
          ) : null}
          {message ? <div className="form-message form-message--error form-span">{message}</div> : null}
          <div className="modal-actions form-span">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
