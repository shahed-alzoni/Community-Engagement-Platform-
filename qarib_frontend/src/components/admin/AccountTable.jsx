import { Building2, Info, Pencil, ShieldCheck, UserRound } from 'lucide-react'

const roleLabels = {
  citizen: 'Citizen', representative: 'Organization representative', system_admin: 'System admin',
}

function RoleIcon({ role }) {
  if (role === 'representative') return <Building2 size={16} />
  if (role === 'system_admin') return <ShieldCheck size={16} />
  return <UserRound size={16} />
}

export function AccountTable({ users, onStatusChange, onView, onEdit, busyUserId, showOrganization = true }) {
  if (!users.length) return <div className="admin-empty">No accounts match these filters.</div>

  return (
    <div className="account-table-wrap">
      <table className="account-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th>{showOrganization ? <th>Organization</th> : null}<th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="Name"><strong>{user.full_name}</strong><small>{user.phone_number}</small></td>
              <td data-label="Email">{user.email}</td>
              <td data-label="Role"><span className={`role-pill role-pill--${user.role}`}><RoleIcon role={user.role} />{roleLabels[user.role]}</span></td>
              {showOrganization ? <td data-label="Organization">{user.organization_name || '—'}</td> : null}
              <td data-label="Status"><span className={`status-pill ${user.is_active ? 'status-pill--active' : 'status-pill--inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
              <td data-label="Actions">
                <div className="account-actions">
                  <button className="row-action-button" type="button" onClick={() => onView(user)} aria-label={`View ${user.full_name} details`}><Info size={17} /></button>
                  <button className="row-action-button" type="button" onClick={() => onEdit(user)} aria-label={`Edit ${user.full_name}`}><Pencil size={16} /></button>
                  {user.role !== 'system_admin' ? (
                    <button className={`status-switch ${user.is_active ? 'status-switch--on' : ''}`} type="button" role="switch" aria-checked={user.is_active} aria-label={`${user.is_active ? 'Deactivate' : 'Activate'} ${user.full_name}`} disabled={busyUserId === user.id} onClick={() => onStatusChange(user, !user.is_active)}><span /></button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
