import { ArrowRight, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { PortalLayout } from '../components/portal/PortalLayout'
import { fetchRepresentativeComplaints } from '../services/authApi'
import '../styles/complaints.css'

export function RepresentativeComplaintsPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchRepresentativeComplaints()
      .then((result) => { if (active) setComplaints(result) })
      .catch(() => { if (active) setError('Could not load organization complaints. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <PortalLayout expectedRole="representative"><div className="portal-content complaint-content">
    <header className="complaint-list-header"><div className="complaint-page-heading"><span><ClipboardList size={18} /> Organization complaints</span><h1>Complaints sent to your organization</h1><p>These are the complaints citizens submitted under your organization’s categories.</p></div></header>
    {error ? <p className="complaint-error" role="alert">{error}</p> : null}
    {loading ? <p>Loading complaints…</p> : complaints.length ? <div className="complaint-list">{complaints.map((complaint) => <button className="complaint-list-item" type="button" key={complaint.id} onClick={() => navigate(`/representative/complaints/${complaint.id}`)}><div><span>{complaint.reference}</span><h2>{complaint.title}</h2><p>{complaint.organization_name} · {new Date(complaint.created_at).toLocaleDateString()}</p></div><strong className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</strong><ArrowRight size={19} /></button>)}</div> : <div className="complaint-empty">No complaints have been sent to your organization yet.</div>}
  </div></PortalLayout>
}
