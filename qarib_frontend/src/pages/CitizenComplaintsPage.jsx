import { ArrowRight, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { PortalLayout } from '../components/portal/PortalLayout'
import { fetchMyComplaints } from '../services/authApi'
import '../styles/complaints.css'

export function CitizenComplaintsPage() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(value = '') {
    setLoading(true)
    setError('')
    try { setComplaints(await fetchMyComplaints(value)) }
    catch { setError('Could not load your complaints. Please try again.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    fetchMyComplaints().then((result) => { if (active) setComplaints(result) })
      .catch(() => { if (active) setError('Could not load your complaints. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return <PortalLayout expectedRole="citizen"><div className="portal-content complaint-content">
    <header className="complaint-list-header"><div className="complaint-page-heading"><span>My complaints</span><h1>Track your compliments</h1><p>Only complaints submitted from your account appear here.</p></div><button className="complaint-submit" type="button" onClick={() => navigate('/citizen/complaints/new')}><Plus size={18} /> New complaint</button></header>
    <form className="complaint-search" onSubmit={(event) => { event.preventDefault(); load(reference) }}><Search size={19} /><input aria-label="Search by reference number" placeholder="Search by reference number" value={reference} onChange={(event) => setReference(event.target.value)} /><button type="submit">Search</button></form>
    {error ? <p className="complaint-error" role="alert">{error}</p> : null}
    {loading ? <p>Loading complaints…</p> : complaints.length ? <div className="complaint-list">{complaints.map((complaint) => <button className="complaint-list-item" type="button" key={complaint.id} onClick={() => navigate(`/citizen/complaints/${complaint.id}`)}><div><span>{complaint.reference}</span><h2>{complaint.title}</h2><p>{complaint.organization_name} · {new Date(complaint.created_at).toLocaleDateString()}</p></div><strong className={`complaint-status complaint-status--${complaint.status}`}>{complaint.status.replaceAll('_', ' ')}</strong><ArrowRight size={19} /></button>)}</div> : <div className="complaint-empty">{reference ? 'No complaint with that reference number belongs to your account.' : 'You have not submitted a complaint yet.'}</div>}
  </div></PortalLayout>
}
