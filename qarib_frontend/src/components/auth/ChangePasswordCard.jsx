import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'

import { ApiError, changeMyPassword } from '../../services/authApi'
import '../../styles/change-password.css'

const emptyForm = { current_password: '', new_password: '', password_confirm: '' }

export function ChangePasswordCard() {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function errorFor(name) {
    const error = errors[name]
    return Array.isArray(error) ? error[0] : error
  }

  async function submit(event) {
    event.preventDefault()
    setErrors({})
    setMessage('')
    if (form.new_password !== form.password_confirm) {
      setErrors({ password_confirm: 'The two password fields do not match.' })
      return
    }
    setLoading(true)
    try {
      await changeMyPassword(form)
      setForm(emptyForm)
      setMessage('Your password was changed successfully.')
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors ?? {})
        if (!Object.keys(error.errors ?? {}).some((key) => key in emptyForm)) setMessage(error.message)
      } else setMessage('The service is unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="change-password-card">
      <div className="change-password-heading"><LockKeyhole size={22} aria-hidden="true" /><div><h2>Change password</h2><p>Enter your current password before choosing a new one.</p></div></div>
      <form onSubmit={submit} className="change-password-form">
        {[
          ['current_password', 'Current password', 'current-password'],
          ['new_password', 'New password', 'new-password'],
          ['password_confirm', 'Confirm new password', 'new-password'],
        ].map(([name, label, autoComplete]) => (
          <label key={name}>{label}
            <input type="password" name={name} autoComplete={autoComplete} value={form[name]} required aria-invalid={Boolean(errorFor(name))} onChange={(event) => { setForm((current) => ({ ...current, [name]: event.target.value })); setErrors((current) => ({ ...current, [name]: undefined })); setMessage('') }} />
            {errorFor(name) ? <small role="alert">{errorFor(name)}</small> : null}
          </label>
        ))}
        {message ? <p className={message.includes('successfully') ? 'change-password-success' : 'change-password-error'} role="status">{message}</p> : null}
        <button className="change-password-submit" type="submit" disabled={loading}>{loading ? 'Changing…' : 'Change password'}</button>
      </form>
    </section>
  )
}
