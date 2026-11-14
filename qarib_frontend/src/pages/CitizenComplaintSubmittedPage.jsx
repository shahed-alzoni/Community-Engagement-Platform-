import { CalendarDays, Check, Clipboard, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { OrganizationIcon } from '../components/complaints/OrganizationIcon'
import { PortalLayout } from '../components/portal/PortalLayout'
import { fetchMyComplaint } from '../services/authApi'
import '../styles/complaint-submitted.css'

export function CitizenComplaintSubmittedPage() {
  const { complaintId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(location.state?.complaint?.id === Number(complaintId) ? location.state.complaint : null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (complaint) return
    let active = true
    fetchMyComplaint(complaintId)
      .then((result) => { if (active) setComplaint(result) })
      .catch(() => { if (active) setError('Could not load this complaint.') })
    return () => { active = false }
  }, [complaint, complaintId])

  return <PortalLayout expectedRole="citizen"><div className="portal-content complaint-submitted-page">
    {error ? <p role="alert">{error}</p> : complaint ? <div className="complaint-submitted-content">
      <div className="complaint-submitted-check" aria-hidden="true"><Check size={60} strokeWidth={4} /></div>
      <h1>Compliment submitted!</h1>
      <p className="complaint-submitted-intro">Thank you for helping improve your community.<br />You can follow the progress of your complaint at any time.</p>
      <section className="complaint-submitted-card" aria-label="Submitted complaint summary">
        <div className="complaint-submitted-reference"><div><span>Compliment ID</span><strong>{complaint.reference}</strong></div><button type="button" aria-label="Copy compliment ID" onClick={async () => { try { await navigator.clipboard.writeText(complaint.reference); setCopied(true) } catch { setCopied(false) } }}>{copied ? <Check size={23} /> : <Clipboard size={23} />}</button></div>
        <div className="complaint-submitted-summary"><span className="complaint-submitted-icon"><OrganizationIcon name={complaint.organization_name} size={36} /></span><div><h2>{complaint.title}</h2><p><MapPin size={17} /> {complaint.location_label || `${Number(complaint.latitude).toFixed(5)}, ${Number(complaint.longitude).toFixed(5)}`}</p><p><CalendarDays size={17} /> Submitted on {new Date(complaint.created_at).toLocaleDateString()}</p></div><span className="complaint-submitted-status">Pending</span></div>
        <div className="complaint-submitted-steps" aria-label="Complaint status"><div className="active"><span><Check size={17} /></span><small>Pending</small></div><div><span /><small>In progress</small></div><div><span /><small>Resolved</small></div></div>
      </section>
      <button className="complaint-submitted-track" type="button" onClick={() => navigate(`/citizen/complaints/${complaint.id}`)}>Track Compliment</button>
      <button className="complaint-submitted-home" type="button" onClick={() => navigate('/citizen/home')}>Back to Home</button>
    </div> : <p>Loading complaint…</p>}
  </div></PortalLayout>
}
