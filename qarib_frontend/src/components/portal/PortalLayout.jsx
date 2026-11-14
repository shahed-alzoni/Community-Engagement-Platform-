import { ArrowLeft, ClipboardList, Home, LogOut, Menu, Plus, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { Cityscape } from '../brand/Cityscape'
import { QaribLogo } from '../brand/QaribLogo'
import { ConfirmLogoutDialog } from '../auth/ConfirmLogoutDialog'
import { logoutCurrentSession } from '../../services/authApi'

export function PortalLayout({ children, expectedRole, complaintMobileTitle }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || 'null')
  const accessToken = sessionStorage.getItem('qarib.accessToken')
  const loginPath = expectedRole === 'representative' ? '/representative/login' : '/login'
  const homePath = expectedRole === 'representative' ? '/representative/home' : '/citizen/home'

  if (!accessToken || user?.role !== expectedRole) return <Navigate to={loginPath} replace />

  async function logout() {
    setConfirmLogout(false)
    setLoggingOut(true)
    const serverEnded = await logoutCurrentSession()
    navigate(loginPath, { state: { logoutFailed: !serverEnded }, replace: true })
  }

  return (
    <div className={`portal-app ${complaintMobileTitle ? 'portal-app--complaint' : ''}`}>
      <header className="portal-mobile-header">{complaintMobileTitle ? <><button type="button" aria-label="Back to complaints" onClick={() => navigate('/citizen/complaints')}><ArrowLeft size={22} /></button><strong>{complaintMobileTitle}</strong><QaribLogo /></> : <><QaribLogo /><button type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="portal-sidebar" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button></>}</header>
      {menuOpen ? <button className="portal-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
      <aside id="portal-sidebar" className={`portal-sidebar ${menuOpen ? 'portal-sidebar--open' : ''}`}>
        <QaribLogo />
        <div className="portal-role-label">{expectedRole === 'representative' ? 'Organization portal' : 'Citizen portal'}</div>
        <nav aria-label="Portal navigation">
          <button className={location.pathname === homePath ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => { setMenuOpen(false); navigate(homePath) }}><Home size={20} /> Dashboard</button>
          {expectedRole === 'citizen' ? <><button className={location.pathname === '/citizen/complaints/new' ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => { setMenuOpen(false); navigate('/citizen/complaints/new') }}><Plus size={20} /> New complaint</button><button className={location.pathname.startsWith('/citizen/complaints') && location.pathname !== '/citizen/complaints/new' ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => { setMenuOpen(false); navigate('/citizen/complaints') }}><ClipboardList size={20} /> My complaints</button></> : null}
          {expectedRole === 'representative' ? <button className={location.pathname.startsWith('/representative/complaints') ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => { setMenuOpen(false); navigate('/representative/complaints') }}><ClipboardList size={20} /> Organization complaints</button> : null}
          <button className={location.pathname === '/portal/profile' ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => { setMenuOpen(false); navigate('/portal/profile') }}><UserRound size={20} /> My profile</button>
        </nav>
        <button className="portal-logout" type="button" onClick={() => setConfirmLogout(true)} disabled={loggingOut}><LogOut size={20} /> {loggingOut ? 'Logging out…' : 'Log out'}</button>
        <Cityscape />
      </aside>
      <main className="portal-main">
        <header className="portal-topbar"><div><span><strong>{user.full_name}</strong><small>{expectedRole === 'representative' ? user.organization_name : 'Citizen account'}</small></span><button className="portal-profile-button" type="button" aria-label="Open my profile" onClick={() => navigate('/portal/profile')}><UserRound size={21} /></button></div></header>
        {children}
      </main>
      {complaintMobileTitle ? <nav className="portal-complaint-bottom-nav" aria-label="Citizen pages"><button type="button" onClick={() => navigate('/citizen/home')}><Home size={22} /><span>Home</span></button><button className={location.pathname === '/citizen/complaints/new' ? 'active' : ''} type="button" onClick={() => navigate('/citizen/complaints/new')}><Plus size={22} /><span>New</span></button><button className={location.pathname !== '/citizen/complaints/new' ? 'active' : ''} type="button" onClick={() => navigate('/citizen/complaints')}><ClipboardList size={22} /><span>Compliments</span></button><button type="button" onClick={() => navigate('/portal/profile')}><UserRound size={22} /><span>Profile</span></button></nav> : null}
      {confirmLogout ? <ConfirmLogoutDialog onCancel={() => setConfirmLogout(false)} onConfirm={logout} /> : null}
    </div>
  )
}
