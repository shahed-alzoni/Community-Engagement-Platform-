import { Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { FormField } from '../components/auth/FormField'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, registerCitizen } from '../services/authApi'

const initialForm = {
  full_name: '',
  email: '',
  phone_number: '',
  password: '',
  password_confirm: '',
}

function validate(form) {
  const errors = {}
  if (!form.full_name.trim()) errors.full_name = 'Full name is required.'
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Enter a valid email address.'
  if (!/^\d{10}$/.test(form.phone_number)) {
    errors.phone_number = 'Enter a valid 10-digit mobile number.'
  }
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (form.password !== form.password_confirm) {
    errors.password_confirm = 'Passwords do not match.'
  }
  return errors
}

export function RegisterPage() {
  const [form, setForm] = useState(initialForm)
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

  async function handleSubmit(event) {
    event.preventDefault()
    const clientErrors = validate(form)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setLoading(true)
    setErrors({})
    setMessage('')
    try {
      await registerCitizen({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
      })
      navigate('/login', { state: { registered: true }, replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors)
        setMessage(error.message)
      } else {
        setMessage('The service is unavailable. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join your community and make a difference"
      variant="register"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          icon={UserRound}
          name="full_name"
          placeholder="Full name"
          autoComplete="name"
          value={form.full_name}
          onChange={updateField}
          error={errors.full_name}
        />
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
        <FormField
          icon={Phone}
          name="phone_number"
          type="tel"
          placeholder="Mobile number (10 digits)"
          autoComplete="tel"
          inputMode="numeric"
          maxLength={10}
          value={form.phone_number}
          onChange={updateField}
          error={errors.phone_number}
        />
        <PasswordField
          name="password"
          placeholder="Password"
          autoComplete="new-password"
          value={form.password}
          onChange={updateField}
          error={errors.password}
        />
        <PasswordField
          name="password_confirm"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={form.password_confirm}
          onChange={updateField}
          error={errors.password_confirm}
        />

        {message ? <div className="form-message form-message--error">{message}</div> : null}

        <SubmitButton loading={loading}>Create account</SubmitButton>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
