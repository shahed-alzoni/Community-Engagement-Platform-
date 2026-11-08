import { Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { FormField } from '../components/auth/FormField'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, loginAdmin } from '../services/authApi'

export function AdminLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.'
    if (!form.password) nextErrors.password = 'Password is required.'
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})
    setMessage('')
    try {
      const result = await loginAdmin({ email: form.email.trim(), password: form.password })
      sessionStorage.setItem('qarib.accessToken', result.access)
      sessionStorage.setItem('qarib.refreshToken', result.refresh)
      setSuccess(true)
      setMessage(`Welcome, ${result.user.full_name}.`)
    } catch (error) {
      setSuccess(false)
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'The service is unavailable. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Admin portal" subtitle="System administrator access only">
      <form className="auth-form auth-form--login" onSubmit={handleSubmit} noValidate>
        <div className="role-badge"><ShieldCheck aria-hidden="true" size={18} /> System Admin</div>
        <FormField
          icon={Mail}
          name="email"
          type="email"
          placeholder="Admin email address"
          autoComplete="email"
          value={form.email}
          onChange={updateField}
          error={errors.email}
        />
        <PasswordField
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={updateField}
          error={errors.password}
        />
        <div className="forgot-row">
          <Link className="text-link" to="/forgot-password">Forgot password?</Link>
        </div>
        {message ? (
          <div className={`form-message ${success ? 'form-message--success' : 'form-message--error'}`}>
            {message}
          </div>
        ) : null}
        <SubmitButton loading={loading}>Log in as admin</SubmitButton>
        <p className="auth-switch"><Link to="/login">Back to citizen login</Link></p>
      </form>
    </AuthLayout>
  )
}
