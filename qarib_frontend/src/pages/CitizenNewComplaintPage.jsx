import { ArrowLeft, Camera, Crosshair, MapPin, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { ComplaintMap } from '../components/complaints/ComplaintMap'
import { OrganizationIcon } from '../components/complaints/OrganizationIcon'
import { PortalLayout } from '../components/portal/PortalLayout'
import { ApiError, categoryImageUrl, createComplaint, fetchComplaintOrganizations, organizationImageUrl } from '../services/authApi'
import '../styles/complaints.css'

function PhotoPreview({ file, onRemove }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setSource(reader.result)
    reader.readAsDataURL(file)
    return () => { if (reader.readyState === FileReader.LOADING) reader.abort() }
  }, [file])
  return <div className="complaint-photo-preview">{source ? <img src={source} alt={file.name} /> : <span className="complaint-photo-loading">Loading photo…</span>}<button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}><X size={16} /></button></div>
}

export function CitizenNewComplaintPage() {
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState([])
  const [form, setForm] = useState({ organization: '', category: '', title: '', description: '', location_label: '', latitude: null, longitude: null, photos: [] })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    fetchComplaintOrganizations().then(setOrganizations).catch(() => setMessage('Could not load organizations. Please refresh the page.'))
  }, [])

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function useCurrentLocation() {
    setLocationMessage('')
    if (!window.isSecureContext) {
      setLocationMessage('Your browser blocks current location on this HTTP address. Open Qarib through trusted HTTPS on your phone, or choose a point on the map.')
      return
    }
    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. Choose a point on the map instead.')
      return
    }
    setLocating(true)
    const onSuccess = ({ coords }) => {
      setForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude }))
      setLocating(false)
      setLocationMessage('')
      setMapOpen(true)
      setErrors((current) => ({ ...current, location: undefined, latitude: undefined, longitude: undefined }))
    }
    const onError = (error, preciseAttempt = false) => {
      if (error.code === 1) {
        setLocationMessage('Location permission was denied. Allow location access for Qarib in your browser and phone settings, or choose a point on the map.')
        setLocating(false)
      } else if (preciseAttempt) {
        navigator.geolocation.getCurrentPosition(onSuccess, (fallbackError) => onError(fallbackError), { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 })
      } else {
        setLocationMessage(error.code === 3 ? 'Location timed out. Check that your phone location service is on, then try again or choose a point on the map.' : 'Could not determine your current location. Check your phone location service, or choose a point on the map.')
        setLocating(false)
      }
    }
    navigator.geolocation.getCurrentPosition(onSuccess, (error) => onError(error, true), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 })
  }

  function choosePhotos(event) {
    const files = Array.from(event.target.files || [])
    if (form.photos.length + files.length > 3 || files.some((file) => file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
      setErrors((current) => ({ ...current, photos: 'Choose up to 3 JPEG, PNG, or WebP images, 5 MB each.' }))
      event.target.value = ''
      return
    }
    update('photos', [...form.photos, ...files])
    event.target.value = ''
  }

  async function submit(event) {
    event.preventDefault()
    if (form.latitude == null || form.longitude == null) {
      setMapOpen(true)
      setErrors((current) => ({ ...current, location: 'Choose the complaint location on the map.' }))
      return
    }
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const complaint = await createComplaint(form)
      navigate(`/citizen/complaints/${complaint.id}/submitted`, { replace: true, state: { complaint } })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.errors ?? {})
        setMessage(Object.keys(error.errors ?? {}).some((key) => key !== 'code') ? '' : error.message)
      } else setMessage('Could not submit your complaint. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function errorFor(name) {
    const error = errors[name]
    return Array.isArray(error) ? error[0] : error
  }

  return <PortalLayout expectedRole="citizen" complaintMobileTitle="Submit a complaint"><div className="portal-content complaint-content">
    <button className="complaint-back" type="button" onClick={() => navigate('/citizen/home')}><ArrowLeft size={18} /> Dashboard</button>
    <header className="complaint-page-heading"><h1>Tell us what happened</h1><p>Share the details so we can send your complaint<br className="complaint-mobile-break" /> to the right authority.</p></header>
    <form className="complaint-form complaint-report-form" onSubmit={submit}>
      <section className="complaint-card complaint-report-fields">
        <fieldset className="complaint-organization-field"><legend>Complaint category</legend><div className="complaint-organization-grid">{organizations.map((organization) => <label className="complaint-organization-option" key={`${organization.id}-${organization.category_id ?? 'primary'}`}>
          <input type="radio" name="organization" value={`${organization.id}-${organization.category_id ?? 'primary'}`} checked={String(form.organization) === String(organization.id) && String(form.category || '') === String(organization.category_id || '')} onChange={() => { setForm((current) => ({ ...current, organization: organization.id, category: organization.category_id ?? '' })); setErrors((current) => ({ ...current, organization: undefined, category: undefined })) }} required />
          <span className="complaint-organization-icon">{organization.image_version ? <img src={organization.category_id ? categoryImageUrl(organization.category_id, organization.image_version) : organizationImageUrl(organization.id, organization.image_version)} alt="" /> : <OrganizationIcon name={organization.name} />}</span><span className="complaint-organization-name">{organization.name}</span><span className="complaint-radio-indicator" aria-hidden="true" />
        </label>)}</div>{!organizations.length && !message ? <p>No categories are available yet.</p> : null}{errorFor('organization') || errorFor('category') ? <small>{errorFor('organization') || errorFor('category')}</small> : null}</fieldset>
        <label>Complaint title<div className="complaint-input-wrap"><input value={form.title} maxLength={160} onChange={(event) => update('title', event.target.value)} placeholder="A short title for your complaint" required />{form.title ? <button type="button" aria-label="Clear complaint title" onClick={() => update('title', '')}><X size={17} /></button> : null}</div>{errorFor('title') ? <small>{errorFor('title')}</small> : null}</label>
        <label>Description<div className="complaint-textarea-wrap"><textarea aria-label="Description" value={form.description} maxLength={5000} onChange={(event) => update('description', event.target.value)} placeholder="Describe the issue and any helpful details..." rows={4} required /><span aria-hidden="true">{form.description.length}/5000</span></div>{errorFor('description') ? <small>{errorFor('description')}</small> : null}</label>
      </section>
      <section className="complaint-card complaint-location-section"><h2>Location</h2><div className="complaint-location-summary"><span className="complaint-map-thumb"><MapPin className={form.latitude != null ? 'complaint-preview-pin--selected' : ''} size={26} fill={form.latitude != null ? '#f4774e' : 'none'} /></span><MapPin className="complaint-location-pin" size={19} /><span className="complaint-location-text">{form.latitude != null ? `${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}` : 'Choose a location'}</span><button type="button" onClick={() => setMapOpen((open) => !open)}>{mapOpen ? 'Done' : form.latitude != null ? 'Change' : 'Choose'}</button></div>
        {mapOpen ? <div className="complaint-location-picker"><ComplaintMap latitude={form.latitude} longitude={form.longitude} onPick={(latitude, longitude) => { setForm((current) => ({ ...current, latitude, longitude })); setLocationMessage(''); setErrors((current) => ({ ...current, location: undefined, latitude: undefined, longitude: undefined })) }} /><button className="complaint-current-location" type="button" onClick={useCurrentLocation} disabled={locating}><Crosshair size={17} /> {locating ? 'Locating…' : 'Use my location'}</button>{locationMessage ? <p className="complaint-location-message" role="alert">{locationMessage}</p> : null}</div> : null}
        {errorFor('location') || errorFor('latitude') || errorFor('longitude') ? <small className="complaint-error">{errorFor('location') || errorFor('latitude') || errorFor('longitude')}</small> : null}
      </section>
      <section className="complaint-card complaint-photos-section"><h2>Add photos</h2><div className="complaint-upload-grid">{form.photos.length < 3 ? <label className="complaint-upload"><Camera size={27} /><span>Add up to 3 photos</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={choosePhotos} /></label> : null}{form.photos.map((file, index) => <PhotoPreview key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => update('photos', form.photos.filter((_, photoIndex) => photoIndex !== index))} />)}</div>{errorFor('photos') ? <small className="complaint-error">{errorFor('photos')}</small> : null}</section>
      {message ? <div className="complaint-submit-error" role="alert"><p>{message}</p>{errors.code === 'session_expired' ? <button type="button" onClick={() => navigate('/login')}>Log in again</button> : null}</div> : null}
      <button className="complaint-submit" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Complaint'}</button>
    </form>
  </div></PortalLayout>
}
