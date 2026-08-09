import { useEffect, useState } from 'react'

export default function PWAInstallPrompt() {
  const [prompt, setPrompt]   = useState(null)
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Capture install prompt
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Hide if already installed
    window.addEventListener('appinstalled', () => {
      setVisible(false)
      setInstalled(true)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
  }

  if (!visible || installed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--color-surface, #fff)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      borderRadius: 16, padding: '14px 20px',
      border: '1.5px solid rgba(212,168,0,0.3)',
      minWidth: 320, maxWidth: 420,
      animation: 'slideUp 0.3s ease',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: '#D4A800', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff',
      }}>V</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary, #1a1a1a)' }}>
          Install Vaultly
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary, #666)' }}>
          Add to home screen for quick access
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setVisible(false)}
          style={{
            padding: '7px 14px', border: 'none', borderRadius: 99,
            background: 'transparent', color: '#999', fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          style={{
            padding: '7px 16px', border: 'none', borderRadius: 99,
            background: '#D4A800', color: '#fff', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Install
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
