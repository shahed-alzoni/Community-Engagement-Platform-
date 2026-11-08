import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export function AdminSelect({ ariaLabel, value, options, onChange, invalid = false, disabled = false }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const selected = options.find((option) => String(option.value) === String(value)) ?? options[0]

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') setOpen(false)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const currentIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)))
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + direction + options.length) % options.length
      onChange(String(options[nextIndex].value))
    }
  }

  return (
    <div className={`admin-select${open ? ' admin-select--open' : ''}`} ref={rootRef}>
      <button type="button" className="admin-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-invalid={invalid} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleKeyDown}>
        <span>{selected?.label}</span><ChevronDown size={17} />
      </button>
      {open ? (
        <div className="admin-select-menu" id={listId} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = String(option.value) === String(value)
            return <button type="button" role="option" aria-selected={isSelected} className={isSelected ? 'admin-select-option admin-select-option--selected' : 'admin-select-option'} key={option.value} onClick={() => { onChange(String(option.value)); setOpen(false) }}><span>{option.label}</span>{isSelected ? <Check size={16} /> : null}</button>
          })}
        </div>
      ) : null}
    </div>
  )
}
