import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clipboard, Clock3, FileText, MapPin, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { ComplaintMap } from '../components/complaints/ComplaintMap'
import { ResolutionPhoto } from '../components/complaints/ResolutionPhoto'
import { PortalLayout } from '../components/portal/PortalLayout'
import { fetchComplaintPhoto, fetchMyComplaint } from '../services/authApi'
import '../styles/complaints.css'
import '../styles/citizen-complaint-detail.css'

function progressSteps(complaint) {
  if (complaint.status === 'rejected') return complaint.status_events.some((event) => event.status === 'in_progress')
    ? ['Pending', 'In progress', 'Rejected'] : ['Pending', 'Rejected']
  return ['Pending', 'In progress', 'Resolved']
}

function ComplaintPhoto({ complaintId, photoId }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl
    fetchComplaintPhoto(complaintId, photoId).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setSource(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaintId, photoId])
  return source ? <img src={source} alt="Complaint evidence" /> : <span className="citizen-detail-photo-loading">Loading photo...</span>
}

function PhotoGroup({ label, children }) {
  return <div className="citizen-detail-photo-group"><span className="citizen-detail-photo-label">{label}</span><div className="citizen-detail-photo-grid">{children}</div></div>
}

export function CitizenComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [complaint, setComplaint] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function copyReference() {
    if (!complaint) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(complaint.reference)
      else {
        const input = document.createElement('textarea')
        input.value = complaint.reference
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        try {
          if (!document.execCommand('copy')) throw new Error('Copy failed')
        } finally { input.remove() }
      }
      setCopied(true)
    } catch { setCopied(false) }
  }

  useEffect(() => {
    let active = true
    fetchMyComplaint(complaintId).then((result) => { if (active) setComplaint(result) })
      .catch(() => { if (active) setError('Could not load this complaint, or it does not belong to your account.') })
    return () => { active = false }
  }, [complaintId])

  const steps = complaint ? progressSteps(complaint) : []
  const stepIndex = complaint ? Math.max(0, steps.findIndex((step) => step.toLowerCase().replaceAll(' ', '_') === complaint.status)) : 0
  const resolution = complaint?.status === 'resolved' ? complaint.status_events.findLast((event) => event.status === 'resolved') : null
  const rejection = complaint?.status === 'rejected' ? complaint.status_events.findLast((event) => event.status === 'rejected') : null
  const progressNote = complaint?.status === 'pending' ? 'Your complaint was received and is waiting for review.'
    : complaint?.status === 'in_progress' ? 'The organization is working on your complaint.'
      : complaint?.status === 'resolved' ? 'This complaint has been resolved.' : 'This complaint was rejected. See the reason below.'

  return <PortalLayout expectedRole="citizen" complaintMobileTitle="Complaint details"><div className="portal-content complaint-content citizen-detail">
    <button className="complaint-back" type="button" onClick={() => navigate('/citizen/complaints')}><ArrowLeft size={18} /> My complaints</button>
    {error ? <p className="complaint-error" role="alert">{error}</p> : null}
    {!complaint && !error ? <p>Loading complaint...</p> : null}
    {complaint ? <>
      {location.state?.justSubmitted ? <div className="complaint-confirmation"><CheckCircle2 size={22} /> Your complaint was submitted successfully. Keep this reference number to follow its progress.</div> : null}
      <section className="complaint-card citizen-detail-summary">
        <div><div className="complaint-reference"><span>Complaint ID</span><div><strong>{complaint.reference}</strong><button type="button" aria-label={copied ? 'Complaint ID copied' : 'Copy complaint ID'} onClick={copyReference}>{copied ? <Check size={17} /> : <Clipboard size={17} />}</button></div></div><h1>{complaint.title}</h1></div>
        <strong className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status === 'resolved' ? <CheckCircle2 size={17} /> : complaint.status === 'rejected' ? <XCircle size={17} /> : null}{complaint.status.replaceAll('_', ' ')}</strong>
      </section>
      <section className="complaint-card citizen-detail-progress" aria-label="Complaint progress"><div className="complaint-timeline" style={{ '--step-count': steps.length }}>{steps.map((step, index) => {
        const done = index < stepIndex || (index === stepIndex && ['resolved', 'rejected'].includes(complaint.status))
        return <div key={step} className={`complaint-timeline-step ${done ? 'complaint-timeline-step--done' : ''} ${index === stepIndex ? 'complaint-timeline-step--current' : ''}`}><span>{done ? <Check size={17} /> : index + 1}</span><strong>{step}</strong></div>
      })}</div><p className="complaint-progress-note">{progressNote}</p></section>
      <section className={`complaint-card citizen-detail-info ${complaint.status === 'pending' ? 'citizen-detail-info--pending' : ''}`}><h2>Complaint information</h2><div className="citizen-detail-info-layout"><div className="citizen-detail-info-text"><div className="complaint-info-row"><MapPin size={20} /><span>{complaint.location_label || `${Number(complaint.latitude).toFixed(5)}, ${Number(complaint.longitude).toFixed(5)}`}</span></div><div className="complaint-info-row"><CalendarDays size={20} /><span>Submitted on {new Date(complaint.created_at).toLocaleDateString()}</span></div><div className="complaint-info-row"><FileText size={20} /><p className="complaint-description">{complaint.description}</p></div></div>{complaint.status === 'pending' ? <div className="citizen-detail-preview" aria-label="Complaint location and photos"><div className="citizen-detail-map-preview"><ComplaintMap latitude={complaint.latitude} longitude={complaint.longitude} readOnly /></div>{complaint.photos.length ? <div className="citizen-detail-preview-photos">{complaint.photos.map((photo) => <ComplaintPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</div> : null}</div> : null}</div></section>
      {resolution ? <section className="complaint-card citizen-detail-resolution"><h2><CheckCircle2 size={24} /> Resolution</h2>{resolution.note ? <p>{resolution.note}</p> : null}<div className="citizen-detail-date"><CalendarDays size={17} /> Resolved on {new Date(resolution.created_at).toLocaleDateString()}</div>{complaint.photos.length || resolution.resolution_photos?.length ? <div className="citizen-detail-before-after">{complaint.photos.length ? <PhotoGroup label="Before">{complaint.photos.map((photo) => <ComplaintPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</PhotoGroup> : null}{resolution.resolution_photos?.length ? <PhotoGroup label="After">{resolution.resolution_photos.map((photo) => <ResolutionPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</PhotoGroup> : null}</div> : null}</section> : null}
      {rejection ? <section className="complaint-card citizen-detail-rejection"><h2><XCircle size={23} /> Rejection reason</h2><p>{rejection.note}</p><div className="citizen-detail-date"><CalendarDays size={17} /> Rejected on {new Date(rejection.created_at).toLocaleDateString()}</div></section> : null}
      {complaint.status !== 'pending' ? <section className="complaint-card citizen-detail-location"><h2><MapPin size={21} /> Complaint location</h2><div className="complaint-detail-map"><ComplaintMap latitude={complaint.latitude} longitude={complaint.longitude} readOnly /></div></section> : null}
      {!resolution && complaint.status !== 'pending' && complaint.photos.length ? <section className="complaint-card citizen-detail-evidence"><h2>Photos you added</h2><div className="citizen-detail-photo-grid">{complaint.photos.map((photo) => <ComplaintPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</div></section> : null}
      <section className="complaint-card citizen-detail-updates"><h2><Clock3 size={20} /> Updates</h2>{complaint.status_events.length ? <div className="complaint-history">{complaint.status_events.map((event, index) => <div key={`${event.created_at}-${index}`}><span className="complaint-history-icon"><Check size={15} /></span><strong>{event.status === 'pending' ? 'Complaint submitted' : event.status.replaceAll('_', ' ')}</strong><time>{new Date(event.created_at).toLocaleString()}</time>{event.note && event !== resolution && event !== rejection ? <p>{event.note}</p> : null}</div>)}</div> : <p>No status updates yet.</p>}</section>
    </> : null}
  </div></PortalLayout>
}
