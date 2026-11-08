import { ArrowRight } from 'lucide-react'

export function SubmitButton({ children, loading }) {
  return (
    <button className="primary-button" type="submit" disabled={loading}>
      <span>{loading ? 'Please wait…' : children}</span>
      {!loading ? <ArrowRight aria-hidden="true" size={24} /> : null}
    </button>
  )
}
