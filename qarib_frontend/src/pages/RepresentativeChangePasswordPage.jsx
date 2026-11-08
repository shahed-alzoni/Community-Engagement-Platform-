import { KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'
import { PasswordField } from '../components/auth/PasswordField'
import { SubmitButton } from '../components/auth/SubmitButton'
import { ApiError, changeRepresentativeInitialPassword } from '../services/authApi'

export function RepresentativeChangePasswordPage() {
  const [form, setForm] = useState({ new_password: '', password_confirm: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const token = sessionStorage.getItem('qarib.initialPasswordToken')

  useEffect(() => {
    if (!sessionStorage.getItem('qarib.initialPasswordToken')) navigate('/representative/login', { replace: true })
  }, [navigate])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (form.new_password.length < 8) nextErrors.new_password = 'Use at least 8 characters.'
    if (form.new_password !== form.password_confirm) nextErrors.password_confirm = 'The two password fields do not match.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)

    setLoading(true)
    try {
      const result = await changeRepresentativeInitialPassword({ token, ...form })
      sessionStorage.removeItem('qarib.initialPasswordToken')
      sessionStorage.removeItem('qarib.pendingRepresentative')
      sessionStorage.setItem('qarib.accessToken', result.access)
      sessionStorage.setItem('qarib.refreshToken', result.refresh)
      sessionStorage.setItem('qarib.user', JSON.stringify(result.user))
      navigate('/representative/home', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors ?? {})
        setMessage(error.errors?.detail ?? error.message)
      } else setMessage('The service is unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create a new password" subtitle="Your temporary password must be changed">
      <form className="auth-form auth-form--login" onSubmit={submit} noValidate>
        <div className="role-badge"><KeyRound size={18} /> First login security</div>
        <PasswordField name="new_password" placeholder="New password" autoComplete="new-password" value={form.new_password} onChange={updateField} error={Array.isArray(errors.new_password) ? errors.new_password[0] : errors.new_password} />
        <PasswordField name="password_confirm" placeholder="Confirm new password" autoComplete="new-password" value={form.password_confirm} onChange={updateField} error={Array.isArray(errors.password_confirm) ? errors.password_confirm[0] : errors.password_confirm} />
        {message ? <div className="form-message form-message--error">{message}</div> : null}
        <SubmitButton loading={loading}>Save password and continue</SubmitButton>
      </form>
    </AuthLayout>
  )
}
