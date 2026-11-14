import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clipboard, Clock3, FileText, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { ComplaintMap } from '../components/complaints/ComplaintMap'
import { ResolutionPhoto } from '../components/complaints/ResolutionPhoto'
import { PortalLayout } from '../components/portal/PortalLayout'
import { fetchComplaintPhoto, fetchMyComplaint } from '../services/authApi'
import '../styles/complaints.css'

function progressSteps(complaint) {
  if (complaint.status === 'rejected') {
    return complaint.status_events.some((event) => event.status === 'in_progress')
      ? ['Pending', 'In progress', 'Rejected'] : ['Pending', 'Rejected']
  }
  return ['Pending', 'In progress', 'Resolved']
}

function ComplaintPhoto({ complaintId, photoId }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl
    fetchComplaintPhoto(complaintId, photoId).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaintId, photoId])
  return source ? <img src={source} alt="Complaint evidence" /> : <span>Loading photo…</span>
}

export function CitizenComplaintDetailPage() {
  const { complaintId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [complaint, setComplaint] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchMyComplaint(complaintId).then(setComplaint).catch(() => setError('Could not load this complaint, or it does not belong to your account.'))
  }, [complaintId])

  const steps = complaint ? progressSteps(complaint) : []
  const stepIndex = complaint ? Math.max(0, steps.findIndex((step) => step.toLowerCase().replaceAll(' ', '_') === complaint.status)) : 0
  const progressNote = complaint?.status === 'pending' ? 'Your complaint was received and is waiting for review.'
    : complaint?.status === 'in_progress' ? 'The organization is working on your complaint.'
      : complaint?.status === 'resolved' ? 'This complaint has been resolved.' : 'This complaint was rejected. See the reason below.'

  return <PortalLayout expectedRole="citizen" complaintMobileTitle="Compliment details"><div className="portal-content complaint-content">
    <button className="complaint-back" type="button" onClick={() => navigate('/citizen/complaints')}><ArrowLeft size={18} /> My complaints</button>
    {error ? <p className="complaint-error" role="alert">{error}</p> : null}
    {!complaint && !error ? <p>Loading complaint…</p> : null}
    {complaint ? <>
      {location.state?.justSubmitted ? <div className="complaint-confirmation"><CheckCircle2 size={22} /> Your complaint was submitted successfully. Keep this reference number to follow its progress.</div> : null}
      <section className="complaint-card complaint-summary">
        <div className="complaint-reference"><span>Compliment ID</span><div><strong>{complaint.reference}</strong><button type="button" aria-label="Copy compliment ID" onClick={async () => { try { await navigator.clipboard.writeText(complaint.reference); setCopied(true) } catch { setCopied(false) } }}>{copied ? <Check size={17} /> : <Clipboard size={17} />}</button></div></div>
        <div className="complaint-summary-title"><div><h1>{complaint.title}</h1></div><strong className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</strong></div>
        <div className="complaint-timeline" aria-label="Complaint progress">{steps.map((step, index) => {
          const done = index < stepIndex || (index === stepIndex && ['resolved', 'rejected'].includes(complaint.status))
          return <div key={step} className={`complaint-timeline-step ${done ? 'complaint-timeline-step--done' : ''} ${index === stepIndex ? 'complaint-timeline-step--current' : ''}`}><span>{done ? <Check size={18} /> : index + 1}</span><strong>{step}</strong></div>
        })}</div><p className="complaint-progress-note">{progressNote}</p>
      </section>
      <div className="complaint-detail-grid"><section className="complaint-card complaint-report-info"><h2>Compliment information</h2><div className="complaint-info-row"><MapPin size={19} /><span>{complaint.location_label || 'Location selected on map'}</span></div><div className="complaint-info-row"><CalendarDays size={19} /><span>Submitted {new Date(complaint.created_at).toLocaleString()}</span></div><div className="complaint-info-row"><FileText size={19} /><p className="complaint-description">{complaint.description}</p></div></section><section className="complaint-card complaint-evidence"><h2>Location & photos</h2><div className="complaint-detail-map"><ComplaintMap latitude={complaint.latitude} longitude={complaint.longitude} readOnly /></div>{complaint.photos.length ? <div className="complaint-photo-grid">{complaint.photos.map((photo) => <ComplaintPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</div> : <p>No photos added.</p>}</section></div>
      <section className="complaint-card"><h2><Clock3 size={20} /> Updates</h2>{complaint.status_events.length ? <div className="complaint-history">{complaint.status_events.map((event, index) => <div key={index}><span className="complaint-history-icon"><Check size={15} /></span><strong>{event.status.replaceAll('_', ' ')}</strong><time>{new Date(event.created_at).toLocaleString()}</time>{event.note ? <p>{event.note}</p> : null}{event.resolution_photos?.length ? <div className="complaint-solution-photos">{event.resolution_photos.map((photo) => <ResolutionPhoto key={photo.id} complaintId={complaint.id} photoId={photo.id} />)}</div> : null}</div>)}</div> : <p>No status updates yet.</p>}</section>
    </> : null}
  </div></PortalLayout>
}
