import { ArrowLeft, Building2, CalendarDays, Mail, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { AdminLayout } from '../components/admin/AdminLayout'
import { ApiError, fetchAdminUser } from '../services/authApi'
import '../styles/admin-dashboard.css'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not available'
}

export function AdminUserDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchAdminUser(userId).then((result) => active && setUser(result)).catch((requestError) => active && setError(requestError instanceof ApiError ? requestError.message : 'The service is unavailable.'))
    return () => { active = false }
  }, [userId])

  return (
    <AdminLayout>
      <div className="admin-content admin-detail-content">
        <button className="back-button" type="button" onClick={() => navigate('/admin/accounts')}><ArrowLeft size={18} /> Back to accounts</button>
        {error ? <div className="form-message form-message--error">{error}</div> : null}
        {!user && !error ? <div className="admin-empty">Loading account details…</div> : null}
        {user ? (
          <>
            <section className="detail-hero">
              <div className="detail-avatar">{user.full_name.charAt(0)}</div>
              <div><span>Account details</span><h1>{user.full_name}</h1><p>{user.email}</p></div>
              <button className="add-account-button" type="button" onClick={() => navigate(`/admin/accounts/${user.id}/edit`)}><Pencil size={17} /> Edit account</button>
            </section>
            <section className="detail-grid">
              <article><UserRound /><span>Full name</span><strong>{user.full_name}</strong></article>
              <article><Mail /><span>Email address</span><strong>{user.email}</strong></article>
              <article><Phone /><span>Mobile number</span><strong>{user.phone_number}</strong></article>
              <article><ShieldCheck /><span>Role</span><strong>{user.role.replace('_', ' ')}</strong></article>
              <article><Building2 /><span>Organization</span><strong>{user.organization_name || 'Not assigned'}</strong></article>
              <article><CalendarDays /><span>Last login</span><strong>{formatDate(user.last_login)}</strong></article>
              <article><CalendarDays /><span>Created at</span><strong>{formatDate(user.created_at)}</strong></article>
              <article><ShieldCheck /><span>Status</span><strong className={user.is_active ? 'detail-active' : 'detail-inactive'}>{user.is_active ? 'Active' : 'Inactive'}</strong></article>
            </section>
            {user.role === 'representative' ? (
              <section className="history-panel"><h2>Organization assignment history</h2>{user.assignment_history.length ? user.assignment_history.map((assignment) => <div className="history-row" key={assignment.id}><div><Building2 size={18} /><strong>{assignment.organization_name}</strong></div><span>{formatDate(assignment.assigned_at)} → {assignment.ended_at ? formatDate(assignment.ended_at) : 'Present'}</span></div>) : <p>No assignments recorded.</p>}</section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
