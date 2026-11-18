import { ArrowLeft, ArrowRightLeft, Camera, MapPin, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { PortalLayout } from '../components/portal/PortalLayout'
import { ComplaintMap } from '../components/complaints/ComplaintMap'
import { ResolutionPhoto } from '../components/complaints/ResolutionPhoto'
import { AdminSelect } from '../components/admin/AdminSelect'
import { ApiError, changeRepresentativeComplaintStatus, fetchRepresentativeComplaint, fetchRepresentativeComplaintPhoto, fetchTransferOrganizations, transferRepresentativeComplaint } from '../services/authApi'
import '../styles/complaints.css'

function ComplaintPhoto({ complaintId, photo }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl
    fetchRepresentativeComplaintPhoto(complaintId, photo.id).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setUrl(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaintId, photo.id])
  return url ? <img src={url} alt="Complaint attachment" /> : null
}

function SolutionPhotoPreview({ file, onRemove }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setSource(reader.result)
    reader.readAsDataURL(file)
    return () => { if (reader.readyState === FileReader.LOADING) reader.abort() }
  }, [file])
  return <div className="complaint-photo-preview">{source ? <img src={source} alt={file.name} /> : <span className="complaint-photo-loading">Loading photo…</span>}<button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}><X size={16} /></button></div>
}

export function RepresentativeComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [error, setError] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('')
  const [note, setNote] = useState('')
  const [statusError, setStatusError] = useState('')
  const [saving, setSaving] = useState(false)
  const [resolutionPhotos, setResolutionPhotos] = useState([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [destination, setDestination] = useState('')
  const [transferError, setTransferError] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    if (!mapOpen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMapOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mapOpen])

  const availableStatuses = complaint?.status === 'pending' ? ['in_progress', 'rejected']
    : complaint?.status === 'in_progress' ? ['resolved', 'rejected'] : []

  useEffect(() => {
    if (!transferOpen) return undefined
    let active = true
    fetchTransferOrganizations().then((result) => { if (active) setOrganizations(result) })
      .catch(() => { if (active) setTransferError('Could not load organizations. Please try again.') })
      .finally(() => { if (active) setTransferLoading(false) })
    return () => { active = false }
  }, [transferOpen])

  async function submitTransfer(event) {
    event.preventDefault()
    if (!destination) { setTransferError('Select an organization.'); return }
    setTransferring(true)
    setTransferError('')
    try {
      await transferRepresentativeComplaint(complaint.id, Number(destination))
      navigate('/representative/complaints', { replace: true, state: { notice: 'Complaint transferred successfully.' } })
    } catch (requestError) {
      const organizationError = requestError instanceof ApiError ? requestError.errors?.organization : null
      setTransferError(Array.isArray(organizationError) ? organizationError[0] : requestError.message || 'Could not transfer this complaint.')
    } finally { setTransferring(false) }
  }

  function chooseResolutionPhotos(event) {
    const files = Array.from(event.target.files || [])
    if (resolutionPhotos.length + files.length > 3 || files.some((file) => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setStatusError('Choose up to 3 JPEG, PNG, or WebP photos, 5 MB each.')
    } else {
      setResolutionPhotos((current) => [...current, ...files])
      setStatusError('')
    }
    event.target.value = ''
  }

  async function submitStatus(event) {
    event.preventDefault()
    setStatusError('')
    if (!nextStatus || nextStatus === complaint.status) {
      setStatusError('Select a different status to update this complaint.')
      return
    }
    if (nextStatus === 'rejected' && !note.trim()) {
      setStatusError('Please explain why the complaint is rejected.')
      return
    }
    setSaving(true)
    try {
      const updated = await changeRepresentativeComplaintStatus(complaint.id, { status: nextStatus, note: note.trim(), resolution_photos: resolutionPhotos })
      setComplaint(updated)
      setNextStatus(updated.status)
      setNote('')
      setResolutionPhotos([])
    } catch (requestError) {
      const serverNote = requestError instanceof ApiError ? requestError.errors?.note : null
      const serverStatus = requestError instanceof ApiError ? requestError.errors?.status : null
      const serverPhotos = requestError instanceof ApiError ? requestError.errors?.resolution_photos : null
      setStatusError(Array.isArray(serverPhotos) ? serverPhotos[0] : Array.isArray(serverNote) ? serverNote[0] : Array.isArray(serverStatus) ? serverStatus[0] : requestError.message || 'Could not update this complaint.')
    } finally { setSaving(false) }
  }

  useEffect(() => {
    let active = true
    fetchRepresentativeComplaint(complaintId)
      .then((result) => { if (active) { setComplaint(result); setNextStatus(result.status) } })
      .catch(() => { if (active) setError('This complaint is not available to your organization.') })
    return () => { active = false }
  }, [complaintId])

  return <PortalLayout expectedRole="representative"><div className="portal-content complaint-content">
    <button className="complaint-back" type="button" onClick={() => navigate('/representative/complaints')}><ArrowLeft size={18} /> Organization complaints</button>
    {error ? <p className="complaint-error" role="alert">{error}</p> : complaint ? <div className="representative-complaint-detail">
      <section className="representative-complaint-card"><span className="representative-complaint-reference">{complaint.reference}</span><h1>{complaint.title}</h1><p>{complaint.organization_name}</p><strong className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</strong></section>
      <section className="representative-complaint-card"><h2>Complaint details</h2><p>{complaint.description}</p><button className="representative-location-button" type="button" aria-haspopup="dialog" onClick={() => setMapOpen(true)}><MapPin size={19} /> View complaint location<span>{complaint.latitude}, {complaint.longitude}</span></button><small>Submitted {new Date(complaint.created_at).toLocaleString()}</small></section>
      {mapOpen ? <div className="representative-map-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setMapOpen(false) }}><div className="representative-map-dialog" role="dialog" aria-modal="true" aria-label="Complaint location"><header><div><MapPin size={21} /><strong>Complaint location</strong></div><button type="button" aria-label="Close map" onClick={() => setMapOpen(false)}><X size={22} /></button></header><ComplaintMap latitude={complaint.latitude} longitude={complaint.longitude} readOnly explore directions /></div></div> : null}
{availableStatuses.length ? <section className="representative-complaint-card representative-transfer-card"><div><h2>Wrong organization?</h2><p>Send this complaint to the organization responsible for it.</p></div><button type="button" onClick={() => { setTransferError(''); setDestination(''); setTransferLoading(true); setTransferOpen(true) }}><ArrowRightLeft size={19} /> Transfer complaint</button></section> : null}
      {transferOpen ? <div className="representative-map-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !transferring) setTransferOpen(false) }}><div className="representative-transfer-dialog" role="dialog" aria-modal="true" aria-label="Transfer complaint"><header><div><ArrowRightLeft size={21} /><strong>Transfer complaint</strong></div><button type="button" aria-label="Close transfer" disabled={transferring} onClick={() => setTransferOpen(false)}><X size={21} /></button></header><form onSubmit={submitTransfer}><p>Select the organization that should handle this complaint. It will appear for its representative once one is assigned.</p><label>Destination organization</label>{transferLoading ? <p>Loading organizations...</p> : organizations.length ? <AdminSelect ariaLabel="Destination organization" value={destination} displayLabel="Select an organization" options={organizations.map((organization) => ({ value: organization.id, label: organization.name }))} onChange={(value) => { setDestination(value); setTransferError('') }} /> : <p>No other organizations are available.</p>}{transferError ? <p className="complaint-error" role="alert">{transferError}</p> : null}<div className="representative-transfer-actions"><button type="button" disabled={transferring} onClick={() => setTransferOpen(false)}>Cancel</button><button type="submit" disabled={transferring || transferLoading || !organizations.length}>{transferring ? 'Transferring...' : 'Transfer complaint'}</button></div></form></div></div> : null}
      {availableStatuses.length ? <section className="representative-complaint-card"><h2>Update complaint status</h2><form className="representative-status-form" onSubmit={submitStatus}><label id="next-complaint-status-label">New status</label><AdminSelect ariaLabel="New status" value={nextStatus} displayLabel={complaint.status.replaceAll('_', ' ')} onChange={(value) => { setNextStatus(value); setResolutionPhotos([]); setStatusError('') }} invalid={Boolean(statusError && nextStatus === complaint.status)} options={availableStatuses.map((option) => ({ value: option, label: option.replaceAll('_', ' ') }))} /><label htmlFor="complaint-status-note">{nextStatus === 'rejected' ? 'Reason for rejection' : 'Note (optional)'}</label><textarea id="complaint-status-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} required={nextStatus === 'rejected'} rows={3} placeholder={nextStatus === 'rejected' ? 'Explain the reason to the citizen' : 'Add an update for the citizen'} />{nextStatus === 'resolved' ? <div className="representative-resolution-upload"><span className="representative-resolution-title">Solution photos</span><div className="complaint-upload-grid">{resolutionPhotos.length < 3 ? <label className="complaint-upload"><Camera size={27} /><span>Add up to 3 photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Add solution photos" onChange={chooseResolutionPhotos} /></label> : null}{resolutionPhotos.map((file, index) => <SolutionPhotoPreview key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => setResolutionPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />)}</div></div> : null}{statusError ? <p className="complaint-error" role="alert">{statusError}</p> : null}<button className="representative-status-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save status'}</button></form></section> : null}
      {complaint.status_events?.length ? <section className="representative-complaint-card"><h2>Status history</h2><div className="representative-status-history">{complaint.status_events.map((event, index) => <div key={`${event.created_at}-${index}`}><strong>{event.status.replaceAll('_', ' ')}</strong><time>{new Date(event.created_at).toLocaleString()}</time>{event.note ? <p>{event.note}</p> : null}{event.resolution_photos?.length ? <div className="complaint-solution-photos">{event.resolution_photos.map((photo) => <ResolutionPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} representative />)}</div> : null}</div>)}</div></section> : null}
      {complaint.photos?.length ? <section className="representative-complaint-card"><h2>Photos</h2><div className="representative-complaint-photos">{complaint.photos.map((photo) => <ComplaintPhoto key={photo.id} complaintId={complaint.id} photo={photo} />)}</div></section> : null}
    </div> : <p>Loading complaint…</p>}
  </div></PortalLayout>
}
