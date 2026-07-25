import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 32,
          background: 'var(--color-bg)', color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)'
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: 400, textAlign: 'center' }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(135deg, #D4A800, #F5C518)',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
