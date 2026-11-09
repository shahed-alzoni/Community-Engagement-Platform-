import { ArrowRight, Building2, CalendarDays, MessageSquareText, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'

import { PortalLayout } from '../components/portal/PortalLayout'
import '../styles/portal.css'

export function PortalHomePage({ role }) {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')
  const isRepresentative = role === 'representative'

  return (
    <PortalLayout expectedRole={role}>
      <div className="portal-content">
        <section className="portal-welcome">
          <div><span>{isRepresentative ? 'Organization workspace' : 'Community workspace'}</span><h1>Welcome back, {user.full_name?.split(' ')[0]}</h1><p>{isRepresentative ? `Representing ${user.organization_name}` : 'Stay connected with your community and public services.'}</p></div>
          <button type="button" onClick={() => navigate('/portal/profile')}><UserRound size={19} /> View profile</button>
        </section>
        <section className="portal-overview" aria-label="Portal overview">
          <article><span className="portal-overview-icon portal-overview-icon--blue"><MessageSquareText /></span><div><small>{isRepresentative ? 'Assigned complaints' : 'My complaints'}</small><strong>Coming next</strong></div></article>
          <article><span className="portal-overview-icon portal-overview-icon--teal"><CalendarDays /></span><div><small>{isRepresentative ? 'Organization events' : 'Available events'}</small><strong>Coming next</strong></div></article>
          <article><span className="portal-overview-icon portal-overview-icon--violet"><Building2 /></span><div><small>{isRepresentative ? 'Organization' : 'Account type'}</small><strong>{isRepresentative ? user.organization_name : 'Citizen'}</strong></div></article>
        </section>
        <section className="portal-dashboard-grid">
          <article className="portal-action-card"><div><span>Profile & security</span><h2>Keep your information up to date</h2><p>Review and update your name, email address, and mobile number securely.</p></div><button type="button" onClick={() => navigate('/portal/profile')}>Manage profile <ArrowRight size={18} /></button></article>
          <article className="portal-info-card"><span>Qarib workspace</span><h2>{isRepresentative ? 'Ready for organization services' : 'Ready for community services'}</h2><p>{isRepresentative ? 'Complaint management and event tools will appear here as their requirements are implemented.' : 'Complaint tracking, events, and feedback will appear here as their requirements are implemented.'}</p></article>
        </section>
      </div>
    </PortalLayout>
  )
}
