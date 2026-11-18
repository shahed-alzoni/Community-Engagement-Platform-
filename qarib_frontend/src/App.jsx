import { Navigate, Route, Routes } from 'react-router'

import { LoginPage } from './pages/LoginPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminAccountsPage } from './pages/AdminAccountsPage'
import { AdminUserDetailPage } from './pages/AdminUserDetailPage'
import { AdminUserEditPage } from './pages/AdminUserEditPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RepresentativeChangePasswordPage } from './pages/RepresentativeChangePasswordPage'
import { RepresentativeHomePage } from './pages/RepresentativeHomePage'
import { RepresentativeLoginPage } from './pages/RepresentativeLoginPage'
import { CitizenHomePage } from './pages/CitizenHomePage'
import { PortalProfilePage } from './pages/PortalProfilePage'
import { CitizenNewComplaintPage } from './pages/CitizenNewComplaintPage'
import { CitizenComplaintsPage } from './pages/CitizenComplaintsPage'
import { CitizenComplaintDetailPage } from './pages/CitizenComplaintDetailPage'
import { CitizenComplaintSubmittedPage } from './pages/CitizenComplaintSubmittedPage'
import { RepresentativeComplaintsPage } from './pages/RepresentativeComplaintsPage'
import { RepresentativeComplaintDetailPage } from './pages/RepresentativeComplaintDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/representative/login" element={<RepresentativeLoginPage />} />
      <Route path="/representative/change-password" element={<RepresentativeChangePasswordPage />} />
      <Route path="/representative/home" element={<RepresentativeHomePage />} />
      <Route path="/representative/complaints" element={<RepresentativeComplaintsPage />} />
      <Route path="/representative/complaints/:complaintId" element={<RepresentativeComplaintDetailPage />} />
      <Route path="/citizen/home" element={<CitizenHomePage />} />
      <Route path="/citizen/complaints" element={<CitizenComplaintsPage />} />
      <Route path="/citizen/complaints/new" element={<CitizenNewComplaintPage />} />
      <Route path="/citizen/complaints/:complaintId/submitted" element={<CitizenComplaintSubmittedPage />} />
      <Route path="/citizen/complaints/:complaintId" element={<CitizenComplaintDetailPage />} />
      <Route path="/portal/profile" element={<PortalProfilePage />} />
      <Route path="/admin/accounts" element={<AdminAccountsPage />} />
      <Route path="/admin/accounts/:userId" element={<AdminUserDetailPage />} />
      <Route path="/admin/accounts/:userId/edit" element={<AdminUserEditPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
