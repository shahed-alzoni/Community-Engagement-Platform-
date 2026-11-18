import { LogOut } from 'lucide-react'
import { useEffect, useRef } from 'react'

import '../../styles/logout-confirmation.css'

export function ConfirmLogoutDialog({ onCancel, onConfirm }) {
  const cancelButton = useRef(null)

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  return (
    <div className="logout-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="logout-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="logout-confirmation-title" aria-describedby="logout-confirmation-description" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
        <div className="logout-confirmation-heading">
          <span className="logout-confirmation-icon"><LogOut size={24} /></span>
          <h2 id="logout-confirmation-title">Log out of Qarib?</h2>
        </div>
        <p id="logout-confirmation-description">Are you sure you want to log out of your account?</p>
        <div className="logout-confirmation-actions">
          <button ref={cancelButton} type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onConfirm}>Log out</button>
        </div>
      </section>
    </div>
  )
}
