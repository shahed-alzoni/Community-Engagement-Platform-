import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useState } from 'react'

export function PasswordField({ error, ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="field-group">
      <label className={`input-shell ${error ? 'input-shell--error' : ''}`}>
        <LockKeyhole aria-hidden="true" size={22} strokeWidth={1.8} />
        <input
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          {...inputProps}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <Eye size={21} /> : <EyeOff size={21} />}
        </button>
      </label>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
