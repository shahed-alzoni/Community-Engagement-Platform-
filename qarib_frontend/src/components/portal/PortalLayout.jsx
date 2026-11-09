import { Home, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { Cityscape } from '../brand/Cityscape'
import { QaribLogo } from '../brand/QaribLogo'

export function PortalLayout({ children, expectedRole }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || 'null')
  const accessToken = sessionStorage.getItem('qarib.accessToken')
  const loginPath = expectedRole === 'representative' ? '/representative/login' : '/login'
  const homePath = expectedRole === 'representative' ? '/representative/home' : '/citizen/home'

  if (!accessToken || user?.role !== expectedRole) return <Navigate to={loginPath} replace />

  function logout() {
    sessionStorage.clear()
    navigate(loginPath, { replace: true })
  }

  return (
    <div className="portal-app">
      <header className="portal-mobile-header"><QaribLogo /><button type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button></header>
      <aside className={`portal-sidebar ${menuOpen ? 'portal-sidebar--open' : ''}`}>
        <QaribLogo />
        <div className="portal-role-label">{expectedRole === 'representative' ? 'Organization portal' : 'Citizen portal'}</div>
        <nav aria-label="Portal navigation">
          <button className={location.pathname === homePath ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => navigate(homePath)}><Home size={20} /> Dashboard</button>
          <button className={location.pathname === '/portal/profile' ? 'portal-nav-item portal-nav-item--active' : 'portal-nav-item'} type="button" onClick={() => navigate('/portal/profile')}><UserRound size={20} /> My profile</button>
        </nav>
        <button className="portal-logout" type="button" onClick={logout}><LogOut size={20} /> Log out</button>
        <Cityscape />
      </aside>
      <main className="portal-main">
        <header className="portal-topbar"><div><span><strong>{user.full_name}</strong><small>{expectedRole === 'representative' ? user.organization_name : 'Citizen account'}</small></span><button className="portal-profile-button" type="button" aria-label="Open my profile" onClick={() => navigate('/portal/profile')}><UserRound size={21} /></button></div></header>
        {children}
      </main>
    </div>
  )
}
