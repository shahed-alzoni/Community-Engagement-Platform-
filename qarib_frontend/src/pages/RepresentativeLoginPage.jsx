import { Building2, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { FormField } from '../components/auth/FormField'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, loginRepresentative } from '../services/authApi'

export function RepresentativeLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.password) nextErrors.password = 'Password is required.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)

    setLoading(true)
    setMessage('')
    try {
      const result = await loginRepresentative({ email: form.email.trim(), password: form.password })
      if (result.password_change_required) {
        sessionStorage.setItem('qarib.initialPasswordToken', result.password_change_token)
        sessionStorage.setItem('qarib.pendingRepresentative', JSON.stringify(result.user))
        navigate('/representative/change-password', { replace: true })
      } else {
        sessionStorage.setItem('qarib.accessToken', result.access)
        sessionStorage.setItem('qarib.refreshToken', result.refresh)
        sessionStorage.setItem('qarib.user', JSON.stringify(result.user))
        navigate('/representative/home', { replace: true })
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'The service is unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Representative portal" subtitle="Access your organization workspace">
      <form className="auth-form auth-form--login" onSubmit={submit} noValidate>
        <div className="role-badge"><Building2 size={18} /> Organization Representative</div>
        <FormField icon={Mail} name="email" type="email" placeholder="Representative email address" autoComplete="email" value={form.email} onChange={updateField} error={errors.email} />
        <PasswordField name="password" placeholder="Password" autoComplete="current-password" value={form.password} onChange={updateField} error={errors.password} />
        <div className="forgot-row"><Link className="text-link" to="/forgot-password">Forgot password?</Link></div>
        {message ? <div className="form-message form-message--error">{message}</div> : null}
        <SubmitButton loading={loading}>Log in as representative</SubmitButton>
        <p className="auth-switch"><Link to="/login">Back to citizen login</Link></p>
      </form>
    </AuthLayout>
  )
}
