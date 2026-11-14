import { ArrowRight, Building2, CalendarDays, MessageSquareText, Plus, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'

import { PortalLayout } from '../components/portal/PortalLayout'
import '../styles/portal.css'
import '../styles/complaints.css'

export function PortalHomePage({ role }) {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')
  const isRepresentative = role === 'representative'

  return (
    <PortalLayout expectedRole={role}>
      <div className="portal-content">
        <section className="portal-welcome">
          <div><span>{isRepresentative ? 'Organization workspace' : 'Community workspace'}</span><h1>Welcome back, {user.full_name?.split(' ')[0]}</h1><p>{isRepresentative ? `Organization: ${user.organization_name}` : 'Stay connected with your community and public services.'}</p></div>
          <button type="button" onClick={() => navigate('/portal/profile')}><UserRound size={19} /> View profile</button>
        </section>
        <section className="portal-overview" aria-label="Portal overview">
          <article><span className="portal-overview-icon portal-overview-icon--blue"><MessageSquareText /></span><div><small>{isRepresentative ? 'Organization complaints' : 'My complaints'}</small><strong><button type="button" className="portal-inline-link" onClick={() => navigate(isRepresentative ? '/representative/complaints' : '/citizen/complaints')}>View complaints</button></strong></div></article>
          <article><span className="portal-overview-icon portal-overview-icon--teal"><CalendarDays /></span><div><small>{isRepresentative ? 'Organization events' : 'Available events'}</small><strong>Coming next</strong></div></article>
          <article><span className="portal-overview-icon portal-overview-icon--violet"><Building2 /></span><div><small>{isRepresentative ? 'Organization' : 'Account type'}</small><strong>{isRepresentative ? user.organization_name : 'Citizen'}</strong></div></article>
        </section>
        <section className="portal-dashboard-grid">
          <article className="portal-action-card"><div><span>Profile & security</span><h2>Keep your information up to date</h2><p>Review and update your name, email address, and mobile number securely.</p></div><button type="button" onClick={() => navigate('/portal/profile')}>Manage profile <ArrowRight size={18} /></button></article>
          <article className="portal-info-card"><span>Qarib workspace</span><h2>{isRepresentative ? 'Review organization complaints' : 'Submit a community compliment'}</h2><p>{isRepresentative ? 'See complaints sent to your organization and the category chosen by the citizen.' : 'Choose the responsible organization, pin the location, and follow your compliment by reference number.'}</p><button type="button" className="portal-complaint-cta" onClick={() => navigate(isRepresentative ? '/representative/complaints' : '/citizen/complaints/new')}>{isRepresentative ? <MessageSquareText size={18} /> : <Plus size={18} />}{isRepresentative ? 'View complaints' : 'Submit a compliment'}</button></article>
        </section>
      </div>
    </PortalLayout>
  )
}
