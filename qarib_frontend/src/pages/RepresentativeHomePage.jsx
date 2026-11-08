import { Building2, LogOut } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'

import { AuthLayout } from '../components/auth/AuthLayout'

export function RepresentativeHomePage() {
  const navigate = useNavigate()
  const user = JSON.parse(sessionStorage.getItem('qarib.user') || 'null')
  if (!sessionStorage.getItem('qarib.accessToken') || user?.role !== 'representative') return <Navigate to="/representative/login" replace />

  function logout() {
    sessionStorage.clear()
    navigate('/representative/login', { replace: true })
  }

  return (
    <AuthLayout title={`Welcome, ${user.full_name}`} subtitle="You are signed in successfully">
      <div className="auth-form representative-welcome">
        <div className="role-badge"><Building2 size={18} /> {user.organization_name}</div>
        <p>Your organization workspace will be added when we implement the representative dashboard.</p>
        <button className="secondary-button representative-logout" type="button" onClick={logout}><LogOut size={17} /> Log out</button>
      </div>
    </AuthLayout>
  )
}
