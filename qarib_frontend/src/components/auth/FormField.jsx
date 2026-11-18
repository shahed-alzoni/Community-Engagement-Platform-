export function FormField({ icon: Icon, error, ...inputProps }) {
  return (
    <div className="field-group">
      <label className={`input-shell ${error ? 'input-shell--error' : ''}`}>
        <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
        <input aria-invalid={Boolean(error)} {...inputProps} />
      </label>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
