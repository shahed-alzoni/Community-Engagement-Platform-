import { Plus, Search, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { AccountSummary } from '../components/admin/AccountSummary'
import { AccountTable } from '../components/admin/AccountTable'
import { AdminLayout } from '../components/admin/AdminLayout'
import { AdminSelect } from '../components/admin/AdminSelect'
import { CreateAccountModal } from '../components/admin/CreateAccountModal'
import { EditAccountModal } from '../components/admin/EditAccountModal'
import { ApiError, fetchAdminUsers, fetchAvailableOrganizations, setManagedUserStatus } from '../services/authApi'
import '../styles/admin-dashboard.css'

const emptySummary = { total: 0, active: 0, citizens: 0, representatives: 0, admins: 0 }

export function AdminAccountsPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [organizations, setOrganizations] = useState([])
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState({ search: '', role: '', status: '', page: 1 })
  const [pagination, setPagination] = useState({ next: null, previous: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [busyUserId, setBusyUserId] = useState(null)

  const handleApiError = useCallback((requestError) => {
    if (requestError instanceof ApiError && /token|credentials|authentication/i.test(requestError.message)) {
      sessionStorage.clear()
      navigate('/admin/login', { replace: true })
      return
    }
    setError(requestError instanceof ApiError ? requestError.message : 'The service is unavailable.')
  }, [navigate])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [accounts, availableOrganizations] = await Promise.all([
        fetchAdminUsers(filters),
        fetchAvailableOrganizations(),
      ])
      setUsers((accounts.results ?? []).filter((user) => user.role !== 'system_admin'))
      setSummary(accounts.summary ?? emptySummary)
      setPagination({ next: accounts.next, previous: accounts.previous, count: accounts.count ?? 0 })
      setOrganizations(availableOrganizations ?? [])
    } catch (requestError) {
      handleApiError(requestError)
    } finally {
      setLoading(false)
    }
  }, [filters, handleApiError])

  useEffect(() => {
    if (!sessionStorage.getItem('qarib.accessToken')) {
      navigate('/admin/login', { replace: true })
      return
    }
    const loadTimer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadData, navigate])

  async function changeStatus(user, isActive) {
    setBusyUserId(user.id)
    setError('')
    try {
      const updatedUser = await setManagedUserStatus(user.id, isActive)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, ...updatedUser } : item))
      setSummary((current) => ({ ...current, active: Math.max(0, current.active + (isActive ? 1 : -1)) }))
      fetchAvailableOrganizations().then(setOrganizations).catch(() => {})
    } catch (requestError) {
      handleApiError(requestError)
    } finally {
      setBusyUserId(null)
    }
  }

  function applySearch(event) {
    event.preventDefault()
    setFilters((current) => ({ ...current, search: searchText.trim(), page: 1 }))
  }

  return (
    <AdminLayout>
      <div className="admin-content">
        <section className="admin-title-row"><div><p><ShieldCheck size={17} /> System administration</p><h1>Manage accounts</h1><span>Create accounts, review access, and deactivate users.</span></div><button className="add-account-button" type="button" onClick={() => setModalOpen(true)}><Plus size={20} /> Add new account</button></section>
        <section className="account-hero"><div><h2>Account summary</h2><p>Overview of platform accounts by type and status.</p></div></section>
        <AccountSummary summary={summary} />
        <section className="accounts-panel">
          <div className="account-filters">
            <form onSubmit={applySearch}><Search size={18} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search by name or email" /></form>
            <AdminSelect ariaLabel="Filter by role" value={filters.role} onChange={(role) => setFilters((current) => ({ ...current, role, page: 1 }))} options={[{ value: '', label: 'All roles' }, { value: 'citizen', label: 'Citizens' }, { value: 'representative', label: 'Representatives' }]} />
            <AdminSelect ariaLabel="Filter by status" value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status, page: 1 }))} options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </div>
          {error ? <div className="form-message form-message--error">{error}</div> : null}
          {loading ? <div className="admin-empty">Loading accounts…</div> : <AccountTable users={users} onStatusChange={changeStatus} onView={(user) => navigate(`/admin/accounts/${user.id}`)} onEdit={setEditingUser} busyUserId={busyUserId} />}
          <div className="pagination-row"><span>{pagination.count} accounts</span><div><button type="button" disabled={!pagination.previous} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Previous</button><button type="button" disabled={!pagination.next} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></div>
        </section>
      </div>
      {modalOpen ? <CreateAccountModal organizations={organizations} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); loadData() }} /> : null}
      {editingUser ? <EditAccountModal account={editingUser} organizations={organizations} onClose={() => setEditingUser(null)} onUpdated={(updated) => { setUsers((current) => current.map((user) => user.id === updated.id ? { ...user, ...updated } : user)); setEditingUser(null); fetchAvailableOrganizations().then(setOrganizations).catch(() => {}) }} /> : null}
    </AdminLayout>
  )
}
