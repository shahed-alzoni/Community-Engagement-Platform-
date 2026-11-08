import { CircleUserRound, LogOut, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Cityscape } from '../brand/Cityscape'
import { QaribLogo } from '../brand/QaribLogo'

export function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const storedUser = JSON.parse(sessionStorage.getItem('qarib.user') ?? '{}')

  function logout() {
    sessionStorage.removeItem('qarib.accessToken')
    sessionStorage.removeItem('qarib.refreshToken')
    sessionStorage.removeItem('qarib.user')
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-app">
      <header className="admin-mobile-header">
        <QaribLogo />
        <button type="button" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle navigation">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={`admin-sidebar ${menuOpen ? 'admin-sidebar--open' : ''}`}>
        <QaribLogo />
        <nav aria-label="Admin navigation">
          <span className="admin-nav-item admin-nav-item--active"><Users size={20} /> Manage accounts</span>
        </nav>
        <button className="admin-logout" type="button" onClick={logout}><LogOut size={20} /> Log out</button>
        <Cityscape />
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <span className="admin-avatar">{storedUser.full_name?.charAt(0) || 'A'}</span>
            <strong>{storedUser.full_name || 'System Admin'}</strong>
            <button className="admin-profile-button" type="button" aria-label="View my admin profile" onClick={() => storedUser.id && navigate(`/admin/accounts/${storedUser.id}`)}><CircleUserRound size={21} /></button>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
