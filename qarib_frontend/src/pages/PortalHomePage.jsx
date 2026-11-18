import { Camera, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Cityscape } from '../components/brand/Cityscape'
import { PortalLayout } from '../components/portal/PortalLayout'
import '../styles/portal.css'
import '../styles/citizen-home.css'

export function PortalHomePage({ role }) {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || '{}')

  return <PortalLayout expectedRole={role}><div className="portal-content citizen-home">
    <header className="citizen-home-greeting"><h1>Welcome back, {user.full_name?.split(' ')[0]}</h1></header>
    <section className="citizen-home-hero"><div><h2>Make your community better</h2><p>Share an issue and help improve the place you call home.</p></div><Cityscape /></section>
    <section className="citizen-home-actions" aria-label="Get started">
      <button className="citizen-home-action" type="button" onClick={() => navigate('/citizen/complaints/new')}><span className="citizen-home-action-icon"><Camera size={29} /></span><span className="citizen-home-action-copy"><strong>Submit a complaint</strong></span><ChevronRight size={23} aria-hidden="true" /></button>
    </section>
  </div></PortalLayout>
}
