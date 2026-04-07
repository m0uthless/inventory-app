import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In produzione sostituire con Sentry o logging service
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleBack = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'Inter, sans-serif',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              textAlign: 'center',
              background: '#fff',
              borderRadius: 12,
              padding: '2.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '1.25rem' }}>
              Errore imprevisto
            </h2>
            <p
              style={{
                margin: '0 0 1.5rem',
                color: '#64748b',
                fontSize: '0.925rem',
                lineHeight: 1.6,
              }}
            >
              Si è verificato un errore nell&apos;interfaccia. Puoi tornare alla dashboard o
              ricaricare la pagina.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre
                style={{
                  textAlign: 'left',
                  background: '#f1f5f9',
                  borderRadius: 6,
                  padding: '0.75rem 1rem',
                  fontSize: '0.78rem',
                  color: '#dc2626',
                  overflow: 'auto',
                  marginBottom: '1.5rem',
                  maxHeight: 160,
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleBack}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 6,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0f766e, #0ea5a4)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                Ricarica
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
