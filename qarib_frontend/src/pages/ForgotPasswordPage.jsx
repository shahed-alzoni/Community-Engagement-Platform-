import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { FormField } from '../components/auth/FormField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, requestPasswordReset } from '../services/authApi'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await requestPasswordReset({ email: email.trim() })
      setMessage(result.detail)
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.errors.email?.[0] ?? requestError.message)
      } else {
        setError('The service is unavailable. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="Enter your email to receive a secure reset link">
      <form className="auth-form auth-form--login" onSubmit={handleSubmit} noValidate>
        <FormField
          icon={Mail}
          name="email"
          type="email"
          placeholder="Email address"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError('')
            setMessage('')
          }}
          error={error}
        />
        {message ? <div className="form-message form-message--success">{message}</div> : null}
        <SubmitButton loading={loading}>Send reset link</SubmitButton>
        <p className="auth-switch">
          Remembered your password? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
