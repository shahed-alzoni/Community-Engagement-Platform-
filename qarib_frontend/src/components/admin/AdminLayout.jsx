import { CircleUserRound, LogOut, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Cityscape } from '../brand/Cityscape'
import { QaribLogo } from '../brand/QaribLogo'
import { ConfirmLogoutDialog } from '../auth/ConfirmLogoutDialog'
import { logoutCurrentSession } from '../../services/authApi'

export function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const navigate = useNavigate()
  const storedUser = JSON.parse(sessionStorage.getItem('qarib.user') ?? '{}')

  async function logout() {
    setConfirmLogout(false)
    setLoggingOut(true)
    const serverEnded = await logoutCurrentSession()
    navigate('/admin/login', { state: { logoutFailed: !serverEnded }, replace: true })
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
        <button className="admin-logout" type="button" onClick={() => setConfirmLogout(true)} disabled={loggingOut}><LogOut size={20} /> {loggingOut ? 'Logging out…' : 'Log out'}</button>
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
      {confirmLogout ? <ConfirmLogoutDialog onCancel={() => setConfirmLogout(false)} onConfirm={logout} /> : null}
    </div>
  )
}
