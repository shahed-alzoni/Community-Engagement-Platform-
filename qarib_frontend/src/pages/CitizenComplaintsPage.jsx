import { CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardList, Clock3, Image as ImageIcon, MapPin, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { OrganizationIcon } from '../components/complaints/OrganizationIcon'
import { PortalLayout } from '../components/portal/PortalLayout'
import { categoryImageUrl, fetchComplaintPhoto, fetchMyComplaints, fetchResolutionPhoto, organizationImageUrl } from '../services/authApi'
import '../styles/complaints.css'
import '../styles/citizen-complaints.css'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

function ComplaintThumbnail({ complaint }) {
  const firstPhotoId = (photos) => photos?.reduce((first, photo) => first === null || photo.id < first ? photo.id : first, null)
  const solutionPhotoId = complaint.status === 'resolved'
    ? firstPhotoId(complaint.status_events?.findLast((event) => event.status === 'resolved' && event.resolution_photos?.length)?.resolution_photos)
    : null
  const complaintPhotoId = firstPhotoId(complaint.photos)
  const photoId = solutionPhotoId || complaintPhotoId
  const photoKind = solutionPhotoId ? 'solution' : 'complaint'
  const photoKey = `${photoKind}-${complaint.id}-${photoId}`
  const [photo, setPhoto] = useState(null)
  const organizationImage = complaint.category_image_version && complaint.category
    ? categoryImageUrl(complaint.category, complaint.category_image_version)
    : organizationImageUrl(complaint.organization, complaint.organization_image_version)
  const [failedOrganizationImage, setFailedOrganizationImage] = useState(null)

  useEffect(() => {
    if (!photoId) return undefined
    let active = true
    let objectUrl
    const fetchPhoto = solutionPhotoId ? fetchResolutionPhoto : fetchComplaintPhoto
    fetchPhoto(complaint.id, photoId).then((blob) => {
      objectUrl = URL.createObjectURL(blob)
      if (active) setPhoto({ key: photoKey, url: objectUrl })
      else URL.revokeObjectURL(objectUrl)
    }).catch(() => {})
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [complaint.id, photoId, photoKey, solutionPhotoId])

  const photoSource = photo?.key === photoKey && photoId ? photo.url : null
  return <span className="citizen-complaint-thumbnail">{photoSource
    ? <img src={photoSource} alt={solutionPhotoId ? 'Solution photo' : 'Complaint photo'} />
    : organizationImage && failedOrganizationImage !== organizationImage
      ? <img className="citizen-complaint-organization-image" src={organizationImage} alt="" onError={() => setFailedOrganizationImage(organizationImage)} />
      : <OrganizationIcon name={complaint.organization_name} size={37} />}</span>
}

function ComplaintProgress({ status }) {
  const steps = ['pending', 'in_progress', 'resolved']
  const activeIndex = steps.indexOf(status)
  if (activeIndex < 0) return null
  return <span className="citizen-complaint-progress" aria-label="Complaint progress">{steps.map((step, index) => <span className={index < activeIndex ? 'done' : index === activeIndex ? 'current' : ''} key={step}><span>{index <= activeIndex ? <Check size={13} strokeWidth={3} /> : null}</span><small>{step.replaceAll('_', ' ')}</small></span>)}</span>
}

function ComplaintListCard({ complaint, onOpen }) {
  const resolutionPhoto = complaint.status_events?.some((event) => event.resolution_photos?.length)
  const latestNote = complaint.status_events?.at(-1)?.note
  const location = complaint.location_label || `${Number(complaint.latitude).toFixed(5)}, ${Number(complaint.longitude).toFixed(5)}`
  return <button className="citizen-complaint-card" type="button" onClick={onOpen} aria-label={`Open complaint ${complaint.reference}: ${complaint.title}`}>
    <ComplaintThumbnail complaint={complaint} />
    <span className="citizen-complaint-card-body">
      <span className="citizen-complaint-card-top"><strong>{complaint.title}</strong><span className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</span></span>
      <span className="citizen-complaint-reference">{complaint.reference}</span>
      <span className="citizen-complaint-meta"><span><MapPin size={15} /> {location}</span><span><CalendarDays size={15} /> {new Date(complaint.created_at).toLocaleDateString()}</span></span>
      {complaint.status === 'rejected' ? <span className="citizen-complaint-update citizen-complaint-update--rejected"><Clock3 size={16} /> {latestNote || 'See the reason in complaint details'}</span>
        : resolutionPhoto ? <span className="citizen-complaint-update"><ImageIcon size={16} /> Solution photo available</span>
          : <ComplaintProgress status={complaint.status} />}
    </span>
    <ChevronRight className="citizen-complaint-chevron" size={21} aria-hidden="true" />
  </button>
}

export function CitizenComplaintsPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [sortOpen, setSortOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchMyComplaints().then((result) => { if (active) setComplaints(result) })
      .catch(() => { if (active) setError('Could not load your complaints. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleComplaints = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    return complaints.filter((complaint) => (statusFilter === 'all' || complaint.status === statusFilter)
      && (!search || complaint.reference.toLocaleLowerCase().includes(search) || complaint.title.toLocaleLowerCase().includes(search)))
      .sort((first, second) => (new Date(second.created_at) - new Date(first.created_at)) * (newestFirst ? 1 : -1))
  }, [complaints, query, statusFilter, newestFirst])

  const resolvedCount = complaints.filter((complaint) => complaint.status === 'resolved').length
  const activeCount = complaints.filter((complaint) => ['pending', 'in_progress'].includes(complaint.status)).length

  return <PortalLayout expectedRole="citizen"><div className="portal-content citizen-complaints-page">
    <header className="citizen-complaints-heading"><h1>My Complaints</h1><p>Follow every complaint you have submitted.</p></header>
    <div className="citizen-complaints-search-row"><label className="citizen-complaints-search"><Search size={21} /><input type="search" aria-label="Search complaints by ID or title" placeholder="Search by complaint ID or title" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="citizen-complaints-sort"><button type="button" aria-label="Sort complaints" aria-expanded={sortOpen} onClick={() => setSortOpen((open) => !open)}><SlidersHorizontal size={22} /></button>{sortOpen ? <div className="citizen-complaints-sort-menu"><button type="button" onClick={() => { setNewestFirst(true); setSortOpen(false) }}>Newest first</button><button type="button" onClick={() => { setNewestFirst(false); setSortOpen(false) }}>Oldest first</button></div> : null}</div></div>
    <div className="citizen-complaints-filters" role="group" aria-label="Filter complaints by status">{FILTERS.map((filter) => <button type="button" key={filter.value} className={statusFilter === filter.value ? 'active' : ''} aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)}>{filter.label}</button>)}</div>
    <section className="citizen-complaints-stats" aria-label="Complaint summary"><div><span className="stat-icon stat-icon--total"><ClipboardList size={24} /></span><strong>{complaints.length}</strong><small>Total</small></div><div><span className="stat-icon stat-icon--active"><Clock3 size={24} /></span><strong>{activeCount}</strong><small>Active</small></div><div><span className="stat-icon stat-icon--resolved"><CheckCircle2 size={24} /></span><strong>{resolvedCount}</strong><small>Resolved</small></div></section>
    <div className="citizen-complaints-list-heading"><h2>Recent complaints</h2><button type="button" onClick={() => navigate('/citizen/complaints/new')}><Plus size={19} /> New complaint</button></div>
    {error ? <p className="complaint-error" role="alert">{error}</p> : loading ? <p className="citizen-complaints-feedback">Loading complaints…</p> : visibleComplaints.length ? <div className="citizen-complaints-list">{visibleComplaints.map((complaint) => <ComplaintListCard key={complaint.id} complaint={complaint} onOpen={() => navigate(`/citizen/complaints/${complaint.id}`)} />)}</div> : <p className="citizen-complaints-feedback">{complaints.length ? 'No complaints match your search or filter.' : 'You have not submitted a complaint yet.'}</p>}
  </div></PortalLayout>
}
