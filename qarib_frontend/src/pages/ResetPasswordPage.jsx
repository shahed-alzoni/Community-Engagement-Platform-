import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, confirmPasswordReset } from '../services/authApi'

export function ResetPasswordPage() {
  const { uid, token } = useParams()
  const [form, setForm] = useState({ new_password: '', password_confirm: '' })
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
    if (form.new_password.length < 8) nextErrors.new_password = 'Use at least 8 characters.'
    if (form.new_password !== form.password_confirm) {
      nextErrors.password_confirm = 'Passwords do not match.'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})
    setMessage('')
    try {
      const result = await confirmPasswordReset({
        uid,
        token,
        new_password: form.new_password,
        password_confirm: form.password_confirm,
      })
      setSuccess(true)
      setMessage(result.detail)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setErrors(requestError.errors)
        setMessage(requestError.errors.detail?.[0] ?? requestError.message)
      } else {
        setMessage('The service is unavailable. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create new password" subtitle="Choose a strong password for your Qarib account">
      <form className="auth-form auth-form--login" onSubmit={handleSubmit} noValidate>
        <PasswordField
          name="new_password"
          placeholder="New password"
          autoComplete="new-password"
          value={form.new_password}
          onChange={updateField}
          error={errors.new_password?.[0] ?? errors.new_password}
        />
        <PasswordField
          name="password_confirm"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={form.password_confirm}
          onChange={updateField}
          error={errors.password_confirm?.[0] ?? errors.password_confirm}
        />
        {message ? (
          <div className={`form-message ${success ? 'form-message--success' : 'form-message--error'}`}>
            {message}
          </div>
        ) : null}
        {!success ? <SubmitButton loading={loading}>Reset password</SubmitButton> : null}
        <p className="auth-switch">
          {success ? 'Password updated. ' : ''}<Link to="/login">Back to log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
