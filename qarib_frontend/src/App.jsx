import { Navigate, Route, Routes } from 'react-router'

import { LoginPage } from './pages/LoginPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminAccountsPage } from './pages/AdminAccountsPage'
import { AdminUserDetailPage } from './pages/AdminUserDetailPage'
import { AdminUserEditPage } from './pages/AdminUserEditPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RepresentativeChangePasswordPage } from './pages/RepresentativeChangePasswordPage'
import { RepresentativeHomePage } from './pages/RepresentativeHomePage'
import { RepresentativeLoginPage } from './pages/RepresentativeLoginPage'
import { CitizenHomePage } from './pages/CitizenHomePage'
import { PortalProfilePage } from './pages/PortalProfilePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/representative/login" element={<RepresentativeLoginPage />} />
      <Route path="/representative/change-password" element={<RepresentativeChangePasswordPage />} />
      <Route path="/representative/home" element={<RepresentativeHomePage />} />
      <Route path="/citizen/home" element={<CitizenHomePage />} />
      <Route path="/portal/profile" element={<PortalProfilePage />} />
      <Route path="/admin/accounts" element={<AdminAccountsPage />} />
      <Route path="/admin/accounts/:userId" element={<AdminUserDetailPage />} />
      <Route path="/admin/accounts/:userId/edit" element={<AdminUserEditPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
