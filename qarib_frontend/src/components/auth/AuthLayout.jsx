import { Cityscape } from '../brand/Cityscape'
import { QaribLogo } from '../brand/QaribLogo'

export function AuthLayout({ title, subtitle, children, variant = 'login' }) {
  return (
    <main className="auth-shell">
      <section className={`auth-card auth-card--${variant}`}>
        <header className="auth-header">
          <QaribLogo />
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
        <Cityscape />
      </section>
    </main>
  )
}
