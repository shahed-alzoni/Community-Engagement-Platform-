import { Building2, Droplet, Lightbulb, Route, Trash2, Zap } from 'lucide-react'

export function OrganizationIcon({ name = '', size = 24 }) {
  const label = name.toLowerCase()
  if (/water|مياه|ماء/.test(label)) return <Droplet size={size} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
  const Icon = /electric|كهرب/.test(label) ? Zap
    : /light|إنارة|انارة/.test(label) ? Lightbulb
      : /road|طريق|طرق/.test(label) ? Route
        : /waste|نفايات|نظافة/.test(label) ? Trash2 : Building2
  return <Icon size={size} aria-hidden="true" />
}
