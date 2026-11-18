import { ArrowRight, Building2, CheckCircle2, ChevronRight, ClipboardList, MessageSquareText, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { Cityscape } from '../components/brand/Cityscape'
import { OrganizationIcon } from '../components/complaints/OrganizationIcon'
import { PortalLayout } from '../components/portal/PortalLayout'
import { categoryImageUrl, fetchRepresentativeComplaintPhoto, fetchRepresentativeComplaints, organizationImageUrl } from '../services/authApi'
import '../styles/portal.css'
import '../styles/complaints.css'
import '../styles/representative-home.css'

function ComplaintThumbnail({ complaint }) {
  const photoId = complaint.photos?.reduce((first, photo) => first === null || photo.id < first ? photo.id : first, null)
  const [source, setSource] = useState('')
  const fallback = complaint.category_image_version && complaint.category
    ? categoryImageUrl(complaint.category, complaint.category_image_version)
    : organizationImageUrl(complaint.organization, complaint.organization_image_version)
  const [failedFallback, setFailedFallback] = useState(false)

  useEffect(() => {
    if (!photoId) return undefined
    let active = true
    let objectUrl
    fetchRepresentativeComplaintPhoto(complaint.id, photoId).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setSource(objectUrl)
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaint.id, photoId])

  return <span className="representative-home-thumbnail">{source ? <img src={source} alt="" />
    : fallback && !failedFallback ? <img className="representative-home-fallback-image" src={fallback} alt="" onError={() => setFailedFallback(true)} />
      : <OrganizationIcon name={complaint.organization_name} size={36} />}</span>
}

function organizationDisplayName(name) {
  const value = name?.trim()
  if (!value) return 'Organization'
  return /\borganization\b/i.test(value) ? value : `${value} Organization`
}

export function RepresentativeHomePage() {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchRepresentativeComplaints().then((result) => { if (active) setComplaints(Array.isArray(result) ? result : result.results ?? []) })
      .catch(() => { if (active) setError('Could not load organization complaints. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const recent = useMemo(() => [...complaints].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3), [complaints])
  const count = (status) => complaints.filter((complaint) => complaint.status === status).length

  return <PortalLayout expectedRole="representative"><div className="portal-content representative-home">
    <header className="representative-home-greeting"><h1>Welcome back, {user.full_name?.split(' ')[0]}</h1><p>Organization Representative</p></header>
    <section className="representative-home-organization"><Building2 size={39} /><div><h2>{organizationDisplayName(user.organization_name)}</h2></div><Cityscape banner /></section>
    <section className="representative-home-stats" aria-label="Organization complaint summary">
      <article><span className="representative-home-stat-icon pending"><ClipboardList size={23} /></span><strong>{count('pending')}</strong><small>Pending</small></article>
      <article><span className="representative-home-stat-icon progress"><RefreshCw size={23} /></span><strong>{count('in_progress')}</strong><small>In progress</small></article>
      <article><span className="representative-home-stat-icon resolved"><CheckCircle2 size={23} /></span><strong>{count('resolved')}</strong><small>Resolved</small></article>
    </section>
    <div className="representative-home-actions"><button type="button" onClick={() => navigate('/representative/complaints')}><MessageSquareText size={28} /><strong>View complaints</strong><ChevronRight size={21} /></button></div>
    <section className="representative-home-recent"><div className="representative-home-section-title"><h2>Recent complaints</h2><button type="button" onClick={() => navigate('/representative/complaints')}>View all <ArrowRight size={18} /></button></div>
      {error ? <p role="alert" className="complaint-error">{error}</p> : loading ? <p className="representative-home-empty">Loading complaints...</p> : recent.length ? <div className="representative-home-list">{recent.map((complaint) => <button type="button" key={complaint.id} className="representative-home-complaint" onClick={() => navigate(`/representative/complaints/${complaint.id}`)} aria-label={`Open complaint ${complaint.reference}: ${complaint.title}`}><ComplaintThumbnail complaint={complaint} /><span className="representative-home-complaint-copy"><strong>{complaint.title}</strong><small>{complaint.reference}{complaint.location_label ? ` · ${complaint.location_label}` : ''}</small><span className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</span></span><ChevronRight size={21} /></button>)}</div> : <p className="representative-home-empty">No complaints have been sent to your organization yet.</p>}
    </section>
  </div></PortalLayout>
}
