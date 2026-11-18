import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { SubmitButton } from '../components/auth/SubmitButton'
import {
  ApiError, confirmCitizenRegistration, confirmEmailChange,
  requestEmailChange, resendCitizenRegistrationCode,
} from '../services/authApi'

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem('qarib.pendingVerification') || 'null')
  } catch {
    return null
  }
}

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [pending] = useState(readPending)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef([])

  function fillCode(index, value) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - index)
    if (!digits) return
    setCode((current) => {
      const next = current.padEnd(6, ' ').split('')
      for (let offset = 0; offset < digits.length; offset += 1) next[index + offset] = digits[offset]
      return next.join('').trimEnd()
    })
    setError('')
    inputRefs.current[Math.min(index + digits.length, 5)]?.focus()
  }

  function handleCodeKeyDown(event, index) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      setCode((current) => {
        const next = current.padEnd(6, ' ').split('')
        const target = next[index] === ' ' && index > 0 ? index - 1 : index
        next[target] = ' '
        inputRefs.current[target]?.focus()
        return next.join('').trimEnd()
      })
      setError('')
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  if (!pending?.email || !['registration', 'email_change'].includes(pending.purpose)) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (pending.purpose === 'registration') {
        const result = await confirmCitizenRegistration({ email: pending.email, code })
        sessionStorage.setItem('qarib.accessToken', result.access)
        sessionStorage.setItem('qarib.refreshToken', result.refresh)
        sessionStorage.setItem('qarib.user', JSON.stringify(result.user))
        sessionStorage.removeItem('qarib.pendingVerification')
        navigate('/citizen/home', { replace: true })
      } else {
        const result = await confirmEmailChange({ code })
        const user = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')
        sessionStorage.setItem('qarib.user', JSON.stringify({ ...user, email: result.email }))
        sessionStorage.removeItem('qarib.pendingVerification')
        navigate(pending.returnTo || '/portal/profile', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.errors.code?.[0] || caught.message) : 'The service is unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (pending.purpose === 'registration') {
        await resendCitizenRegistrationCode({ email: pending.email })
      } else {
        await requestEmailChange({ new_email: pending.email })
      }
      setMessage('A new code has been sent. Check your inbox.')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The service is unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle={`Enter the code sent to ${pending.email}`} variant="register">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="verification-code-field">
          <div className="verification-code-boxes" role="group" aria-label="Verification code">
            {Array.from({ length: 6 }, (_, index) => (
              <input
                key={index}
                ref={(element) => { inputRefs.current[index] = element }}
                className={`verification-code-box ${error ? 'verification-code-box--error' : ''}`}
                aria-label={`Verification code digit ${index + 1}`}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                value={code[index] === ' ' ? '' : (code[index] || '')}
                onChange={(event) => fillCode(index, event.target.value)}
                onKeyDown={(event) => handleCodeKeyDown(event, index)}
                onPaste={(event) => { event.preventDefault(); fillCode(index, event.clipboardData.getData('text')) }}
              />
            ))}
          </div>
          {error ? <span className="field-error" role="alert">{error}</span> : null}
        </div>
        {message ? <div className="form-message">{message}</div> : null}
        <SubmitButton loading={loading}>Verify email</SubmitButton>
        <button className="auth-text-button" type="button" onClick={handleResend} disabled={loading}>Resend code</button>
        <button className="auth-text-button" type="button" onClick={() => navigate(pending.purpose === 'registration' ? '/register' : (pending.returnTo || '/portal/profile'))}>Back</button>
      </form>
    </AuthLayout>
  )
}
