import { Building2, UserCheck, Users } from 'lucide-react'

const cards = [
  ['total', 'Total accounts', Users, 'blue'],
  ['active', 'Active accounts', UserCheck, 'green'],
  ['citizens', 'Citizens', Users, 'cyan'],
  ['representatives', 'Representatives', Building2, 'violet'],
]

export function AccountSummary({ summary }) {
  return (
    <section className="summary-grid" aria-label="Account summary">
      {cards.map(([key, label, Icon, color]) => (
        <article className="summary-card" key={key}>
          <span className={`summary-icon summary-icon--${color}`}><Icon size={21} /></span>
          <div><span>{label}</span><strong>{summary[key] ?? 0}</strong></div>
        </article>
      ))}
    </section>
  )
}
