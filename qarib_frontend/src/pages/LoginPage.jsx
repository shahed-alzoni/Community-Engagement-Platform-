import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { FormField } from '../components/auth/FormField'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, loginCitizen } from '../services/authApi'

export function LoginPage() {
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
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
      const result = await loginCitizen({ email: form.email.trim(), password: form.password })
      sessionStorage.setItem('qarib.accessToken', result.access)
      sessionStorage.setItem('qarib.refreshToken', result.refresh)
      setLoggedIn(true)
      setMessage(`Welcome back, ${result.user.full_name}.`)
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message)
      } else {
        setMessage('The service is unavailable. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue">
      <form className="auth-form auth-form--login" onSubmit={handleSubmit} noValidate>
        {location.state?.registered ? (
          <div className="form-message form-message--success">Account created. You can log in now.</div>
        ) : null}
        <FormField
          icon={Mail}
          name="email"
          type="email"
          placeholder="Email address"
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
          <div className={`form-message ${loggedIn ? 'form-message--success' : 'form-message--error'}`}>
            {message}
          </div>
        ) : null}
        <SubmitButton loading={loading}>Log in</SubmitButton>
        <p className="auth-switch">
          New to Qarib? <Link to="/register">Create account</Link>
        </p>
        <p className="auth-switch"><Link to="/representative/login">Organization representative login</Link></p>
      </form>
    </AuthLayout>
  )
}
