import { Building2, Mail, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PortalLayout } from '../components/portal/PortalLayout'
import { ApiError, fetchMyProfile, updateMyProfile } from '../services/authApi'
import '../styles/portal.css'

export function PortalProfilePage() {
  const storedUser = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone_number: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    fetchMyProfile().then((result) => {
      if (!active) return
      setProfile(result)
      setForm({ full_name: result.full_name, email: result.email, phone_number: result.phone_number })
    }).catch((error) => active && setMessage(error instanceof ApiError ? error.message : 'The service is unavailable.'))
    return () => { active = false }
  }, [])

  function update(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setMessage('')
  }

  function errorFor(name) {
    const error = errors[name]
    return Array.isArray(error) ? error[0] : error
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setErrors({})
    setMessage('')
    try {
      const updated = await updateMyProfile({ ...form, full_name: form.full_name.trim(), email: form.email.trim() })
      setProfile(updated)
      sessionStorage.setItem('qarib.user', JSON.stringify({ ...storedUser, ...updated }))
      setMessage('Your profile was updated successfully.')
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors ?? {})
      else setMessage('The service is unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PortalLayout expectedRole={storedUser.role}>
      <div className="portal-content portal-profile-content">
        <section className="portal-page-title"><span>Account settings</span><h1>My profile</h1><p>Manage your personal information and review protected account details.</p></section>
        {!profile && !message ? <div className="portal-loading">Loading profile…</div> : null}
        {profile ? <section className="portal-profile-card">
          <header><div className="portal-profile-avatar">{profile.full_name.charAt(0)}</div><div><h2>{profile.full_name}</h2><p>{profile.email}</p></div><span className="portal-profile-role"><ShieldCheck size={16} /> {profile.role === 'representative' ? 'Organization representative' : 'Citizen'}</span></header>
          <form onSubmit={submit} className="portal-profile-form">
            <label><span><UserRound size={17} /> Full name</span><input name="full_name" value={form.full_name} onChange={update} aria-invalid={Boolean(errorFor('full_name'))} required />{errorFor('full_name') ? <small>{errorFor('full_name')}</small> : null}</label>
            <label><span><Mail size={17} /> Email address</span><input name="email" type="email" value={form.email} onChange={update} aria-invalid={Boolean(errorFor('email'))} required />{errorFor('email') ? <small>{errorFor('email')}</small> : null}</label>
            <label><span><Phone size={17} /> Mobile number</span><input name="phone_number" inputMode="numeric" maxLength={10} value={form.phone_number} onChange={update} aria-invalid={Boolean(errorFor('phone_number'))} required />{errorFor('phone_number') ? <small>{errorFor('phone_number')}</small> : null}</label>
            <label><span><ShieldCheck size={17} /> Account role</span><input value={profile.role === 'representative' ? 'Organization representative' : 'Citizen'} disabled /></label>
            {profile.role === 'representative' ? <label className="portal-form-span"><span><Building2 size={17} /> Organization</span><input value={profile.organization_name} disabled /><small className="portal-readonly-note">Organization assignment can only be changed by the System Admin.</small></label> : null}
            {message ? <div className={message.includes('successfully') ? 'form-message form-message--success portal-form-span' : 'form-message form-message--error portal-form-span'}>{message}</div> : null}
            <div className="portal-profile-actions portal-form-span"><button type="submit" disabled={loading}><Save size={18} /> {loading ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        </section> : null}
      </div>
    </PortalLayout>
  )
}
