import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export default function Landing() {
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const go   = (e) => { e.preventDefault(); navigate('/signin') }
  const goUp = (e) => { e.preventDefault(); navigate('/signup') }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W, H, pts = [], animId
    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }
    resize(); window.addEventListener('resize', resize)

    const dark = document.documentElement.getAttribute('data-theme') === 'dark'

    class Dot {
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * W; this.y = Math.random() * H
        this.r = Math.random() * 1.6 + 0.4
        this.vx = (Math.random() - .5) * .3; this.vy = (Math.random() - .5) * .3
        this.a = Math.random() * .4 + .08
      }
      tick() {
        this.x += this.vx; this.y += this.vy
        if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset()
      }
      draw() {
        const isDk = document.documentElement.getAttribute('data-theme') === 'dark'
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx.fillStyle = isDk ? `rgba(139,92,246,${this.a})` : `rgba(212,168,0,${this.a * 0.7})`
        ctx.fill()
      }
    }
    for (let i = 0; i < 100; i++) pts.push(new Dot())

    let mx = -999, my = -999
    const onMove = e => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)

    const render = () => {
      ctx.clearRect(0, 0, W, H)
      const isDk = document.documentElement.getAttribute('data-theme') === 'dark'
      const lineCol = isDk ? '139,92,246' : '212,168,0'
      const mouseCol = isDk ? '167,139,250' : '245,197,24'

      for (let i = 0; i < pts.length; i++) {
        pts[i].tick(); pts[i].draw()
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
          if (d < 80) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `rgba(${lineCol},${(1 - d / 80) * .1})`
            ctx.lineWidth = .5; ctx.stroke()
          }
        }
        const dm = Math.hypot(pts[i].x - mx, pts[i].y - my)
        if (dm < 90) {
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(mx, my)
          ctx.strokeStyle = `rgba(${mouseCol},${(1 - dm / 90) * .25})`
          ctx.lineWidth = .5; ctx.stroke()
        }
      }
      animId = requestAnimationFrame(render)
    }
    render()

    /* Count-up */
    const cio = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return
        const el = en.target
        const to = parseFloat(el.dataset.to)
        const pre = el.dataset.pre || '', suf = el.dataset.suf || ''
        let v = 0, step = to / 60
        const tick = () => {
          v = Math.min(v + step, to)
          el.textContent = pre + Math.floor(v).toLocaleString('en-US') + suf
          if (v < to) requestAnimationFrame(tick)
        }; tick(); cio.unobserve(el)
      })
    }, { threshold: .5 })
    document.querySelectorAll('[data-to]').forEach(el => cio.observe(el))

    /* Scroll reveal */
    const rio = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('lp-sr-in') })
    }, { threshold: .07 })
    document.querySelectorAll('.lp-sr').forEach(el => rio.observe(el))

    /* Sparkline */
    const vals = [31000,33600,36200,38800,41400,44000,46600,49200]
    const spts = vals.map((v, i) => [i * (320 / 7), 50 - ((v - 31000) / 18200) * 44])
    let pd = `M ${spts[0][0]} ${spts[0][1]}`
    for (let i = 1; i < spts.length; i++) {
      const cx = (spts[i-1][0] + spts[i][0]) / 2
      pd += ` C ${cx} ${spts[i-1][1]}, ${cx} ${spts[i][1]}, ${spts[i][0]} ${spts[i][1]}`
    }
    const el1 = document.getElementById('lp-sp'), el2 = document.getElementById('lp-spa')
    if (el1) el1.setAttribute('d', pd)
    if (el2) el2.setAttribute('d', pd + ` L ${spts[7][0]} 50 L 0 50 Z`)

    /* Plan card 3D tilt */
    document.querySelectorAll('.lp-plan-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left - r.width / 2) / r.width
        const y = (e.clientY - r.top - r.height / 2) / r.height
        card.style.transform = `translateY(-8px) rotateX(${-y*5}deg) rotateY(${x*5}deg) scale(1.02)`
      })
      card.addEventListener('mouseleave', () => { card.style.transform = '' })
    })

    /* Typing */
    const words = ['simple', 'audited', 'powerful', 'scalable']
    let wi = 0, ci = 0, del = false
    const typed = document.getElementById('lp-typed')
    const typo = () => {
      if (!typed) return
      const w = words[wi]
      if (!del) {
        typed.textContent = w.slice(0, ++ci)
        if (ci === w.length) { del = true; setTimeout(typo, 1800); return }
        setTimeout(typo, 90)
      } else {
        typed.textContent = w.slice(0, --ci)
        if (ci === 0) { del = false; wi = (wi + 1) % words.length; setTimeout(typo, 300); return }
        setTimeout(typo, 55)
      }
    }
    typo()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(animId)
      cio.disconnect(); rio.disconnect()
    }
  }, [])

  /* ─── INLINE STYLES scoped to .lp ─── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    /* ══ LIGHT TOKENS ══ */
    .lp {
      --lp-bg:       #F0F2F8;
      --lp-bg2:      #F6F7FB;
      --lp-bg3:      #EBEEF6;
      --lp-gold:     #D4A800;
      --lp-gold2:    #F5C518;
      --lp-gold3:    #B8900A;
      --lp-coral:    #F05A5A;
      --lp-mint:     #10B981;
      --lp-sky:      #3B82F6;
      --lp-violet:   #7C3AED;
      --lp-ink:      #1B2430;
      --lp-ink2:     #2D3A4A;
      --lp-muted:    #6B7280;
      --lp-muted2:   #9CA3AF;
      --lp-border:   rgba(27,36,48,0.08);
      --lp-border2:  rgba(212,168,0,0.25);
      --lp-sh-l:     #FFFFFF;
      --lp-sh-d:     #A3B1C6;
      --lp-nm:       8px 8px 18px #A3B1C6, -8px -8px 18px #FFFFFF;
      --lp-nm-sm:    4px 4px 10px #A3B1C6, -4px -4px 10px #FFFFFF;
      --lp-nm-in:    inset 4px 4px 10px #A3B1C6, inset -4px -4px 10px #FFFFFF;
      --lp-glass:    rgba(255,255,255,0.55);
      --lp-glass2:   rgba(255,255,255,0.75);
      --lp-canvas-o: 0.35;
      --lp-accent:   #D4A800;
      --lp-accent-t: rgba(212,168,0,0.1);
      --lp-accent-b: rgba(212,168,0,0.3);
      --lp-hi1:      #D4A800;
      --lp-hi2:      #F05A5A;
      --lp-hi3:      #3B82F6;
      --lp-txt:      #1B2430;
      --lp-txt2:     #6B7280;
      --lp-card:     rgba(255,255,255,0.7);
      --lp-card-b:   rgba(255,255,255,0.9);
    }

    /* ══ DARK TOKENS — override everything ══ */
    [data-theme='dark'] .lp {
      --lp-bg:       #0D0B1A;
      --lp-bg2:      #13102A;
      --lp-bg3:      #1A1735;
      --lp-gold:     #8B5CF6;
      --lp-gold2:    #A78BFA;
      --lp-gold3:    #7C3AED;
      --lp-coral:    #EF4444;
      --lp-mint:     #10B981;
      --lp-sky:      #60A5FA;
      --lp-violet:   #A78BFA;
      --lp-ink:      #F3F4F6;
      --lp-ink2:     #E5E7EB;
      --lp-muted:    #6B7280;
      --lp-muted2:   #9CA3AF;
      --lp-border:   rgba(139,92,246,0.12);
      --lp-border2:  rgba(139,92,246,0.3);
      --lp-sh-l:     #22252F;
      --lp-sh-d:     #0D0F14;
      --lp-nm:       8px 8px 18px #0D0F14, -8px -8px 18px #22252F;
      --lp-nm-sm:    4px 4px 10px #0D0F14, -4px -4px 10px #22252F;
      --lp-nm-in:    inset 4px 4px 10px #0D0F14, inset -4px -4px 10px #22252F;
      --lp-glass:    rgba(255,255,255,0.03);
      --lp-glass2:   rgba(255,255,255,0.05);
      --lp-canvas-o: 0.7;
      --lp-accent:   #8B5CF6;
      --lp-accent-t: rgba(139,92,246,0.1);
      --lp-accent-b: rgba(139,92,246,0.3);
      --lp-hi1:      #A78BFA;
      --lp-hi2:      #60A5FA;
      --lp-hi3:      #34D399;
      --lp-txt:      #F3F4F6;
      --lp-txt2:     #9CA3AF;
      --lp-card:     rgba(255,255,255,0.03);
      --lp-card-b:   rgba(255,255,255,0.06);
    }

    .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
    .lp {
      font-family: 'Inter', sans-serif;
      background: var(--lp-bg);
      color: var(--lp-txt);
      overflow-x: hidden;
      line-height: 1.6;
      min-height: 100vh;
      transition: background 0.4s, color 0.4s;
    }
    .lp canvas {
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none; z-index: 0;
      opacity: var(--lp-canvas-o);
      transition: opacity 0.4s;
    }
    .lp > * { position: relative; z-index: 1; }
    .lpw { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
    .lp h1, .lp h2, .lp h3, .lp h4 {
      font-family: 'Manrope', sans-serif;
      letter-spacing: -0.03em; margin: 0;
      color: var(--lp-ink);
      transition: color 0.4s;
    }
    .lp p { margin: 0; }
    .lp a { color: inherit; text-decoration: none; }

    /* ══ NAV ══ */
    .lp-nav {
      position: sticky; top: 0; z-index: 100;
      backdrop-filter: blur(24px) saturate(1.6);
      background: var(--lp-glass2);
      border-bottom: 1px solid var(--lp-border);
      transition: background 0.4s, border-color 0.4s;
    }
    [data-theme='dark'] .lp-nav {
      background: rgba(13,11,26,0.82);
    }
    .lp-nav .lpw { display: flex; align-items: center; justify-content: space-between; height: 72px; }
    .lp-brand { display: flex; align-items: center; gap: 12px; }
    .lp-brand-icon {
      width: 38px; height: 38px; border-radius: 11px;
      background: linear-gradient(135deg, var(--lp-gold3), var(--lp-gold2));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(212,168,0,0.4);
      transition: background 0.4s, box-shadow 0.4s;
    }
    [data-theme='dark'] .lp-brand-icon {
      background: linear-gradient(135deg, #7C3AED, #A78BFA);
      box-shadow: 0 4px 16px rgba(139,92,246,0.45);
    }
    .lp-brand-icon svg { width: 20px; height: 20px; }
    .lp-brand-name {
      font-family: 'Manrope', sans-serif; font-weight: 800; font-size: 20px;
      background: linear-gradient(135deg, var(--lp-gold3), var(--lp-gold2), var(--lp-coral));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      transition: background 0.4s;
    }
    [data-theme='dark'] .lp-brand-name {
      background: linear-gradient(135deg, #E9D5FF, #A78BFA);
      -webkit-background-clip: text; background-clip: text;
    }
    .lp-navlinks { display: flex; gap: 32px; }
    .lp-navlinks a { font-size: 13.5px; color: var(--lp-muted); transition: color .2s; font-weight: 500; }
    .lp-navlinks a:hover { color: var(--lp-ink); }
    .lp-navcta { display: flex; gap: 10px; align-items: center; }

    /* ══ BUTTONS ══ */
    .lpbtn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 22px; border-radius: 12px;
      font-size: 13.5px; font-weight: 700; cursor: pointer;
      border: none; font-family: 'Manrope', sans-serif;
      transition: all .3s cubic-bezier(.2,.8,.2,1);
    }
    .lpbtn-ghost {
      background: var(--lp-card);
      border: 1px solid var(--lp-border2);
      color: var(--lp-muted);
      box-shadow: var(--lp-nm-sm);
    }
    .lpbtn-ghost:hover {
      border-color: var(--lp-accent);
      color: var(--lp-accent);
      transform: translateY(-1px);
    }
    .lpbtn-primary {
      background: linear-gradient(135deg, var(--lp-gold3), var(--lp-gold2));
      color: #fff;
      box-shadow: 0 4px 18px rgba(212,168,0,0.4);
    }
    [data-theme='dark'] .lpbtn-primary {
      background: linear-gradient(135deg, #7C3AED, #A78BFA);
      box-shadow: 0 4px 18px rgba(139,92,246,0.4);
    }
    .lpbtn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(212,168,0,0.55); }
    [data-theme='dark'] .lpbtn-primary:hover { box-shadow: 0 8px 28px rgba(139,92,246,0.55); }
    .lpbtn-lg { padding: 13px 30px; font-size: 15px; border-radius: 14px; }
    .lpbtn-icon {
      width: 38px; height: 38px; padding: 0;
      border-radius: 10px; justify-content: center;
      background: var(--lp-card); border: 1px solid var(--lp-border);
      box-shadow: var(--lp-nm-sm); color: var(--lp-muted);
      font-size: 16px;
    }
    .lpbtn-icon:hover { color: var(--lp-accent); border-color: var(--lp-accent-b); }

    /* ══ HERO ══ */
    .lp-hero { padding: 110px 0 80px; }
    .lp-hero .lpw { display: grid; grid-template-columns: 1fr 500px; gap: 64px; align-items: center; }
    .lp-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px; border-radius: 999px;
      background: var(--lp-accent-t); border: 1px solid var(--lp-accent-b);
      font-size: 11.5px; font-weight: 700; color: var(--lp-gold3);
      letter-spacing: .06em; text-transform: uppercase;
      margin-bottom: 28px; animation: lpFadeUp .8s ease both;
      transition: background 0.4s, border-color 0.4s, color 0.4s;
    }
    [data-theme='dark'] .lp-badge { color: var(--lp-gold2); }
    .lp-pulse {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--lp-mint); animation: lpPulse 2s infinite;
    }
    @keyframes lpPulse { 0%{box-shadow:0 0 0 0 rgba(16,185,129,.5)} 70%{box-shadow:0 0 0 8px transparent} 100%{box-shadow:0 0 0 0 transparent} }
    .lp-hero h1 {
      font-size: clamp(38px, 4.5vw, 62px); font-weight: 800;
      line-height: 1.05; color: var(--lp-ink);
      animation: lpFadeUp .9s ease .1s both;
    }
    .lp-hi {
      background: linear-gradient(135deg, var(--lp-gold3), var(--lp-coral), var(--lp-sky));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
    [data-theme='dark'] .lp-hi {
      background: linear-gradient(135deg, #A78BFA, #60A5FA, #34D399);
      -webkit-background-clip: text; background-clip: text;
    }
    .lp-typed-wrap {
      display: inline-block; min-width: 140px;
      border-right: 3px solid var(--lp-gold);
      padding-right: 3px; animation: lpBlink 1s step-end infinite;
    }
    @keyframes lpBlink { 0%,100%{border-color:var(--lp-gold)} 50%{border-color:transparent} }
    .lp-sub {
      font-size: 17px; color: var(--lp-muted); margin-top: 22px;
      max-width: 500px; line-height: 1.75;
      animation: lpFadeUp .9s ease .25s both;
    }
    .lp-actions { display: flex; gap: 14px; margin-top: 36px; animation: lpFadeUp .9s ease .4s both; flex-wrap: wrap; }
    .lp-trust { display: flex; gap: 20px; margin-top: 24px; animation: lpFadeUp .9s ease .55s both; flex-wrap: wrap; }
    .lp-chip { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--lp-muted); }
    .lp-chip .lp-chk { color: var(--lp-mint); font-weight: 800; }
    @keyframes lpFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

    /* ══ MOCKUP ══ */
    .lp-mock {
      border-radius: 22px; overflow: hidden;
      border: 1px solid var(--lp-border2);
      box-shadow: var(--lp-nm), 0 0 0 1px var(--lp-border2);
      background: var(--lp-bg2);
      animation: lpFadeUp .9s ease .3s both;
      transform-style: preserve-3d;
      transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
    }
    [data-theme='dark'] .lp-mock {
      background: #1A1735;
      box-shadow: 0 40px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(139,92,246,.2);
    }
    .lp-mock-bar {
      background: var(--lp-glass); padding: 12px 16px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--lp-border);
      backdrop-filter: blur(10px);
    }
    .lp-wdots { display: flex; gap: 6px; }
    .lp-wd { width: 10px; height: 10px; border-radius: 50%; }
    .lp-mock-title { flex: 1; text-align: center; font-size: 11px; color: var(--lp-muted); font-family: 'JetBrains Mono', monospace; }
    .lp-mock-body { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .lp-mc {
      background: var(--lp-card); border: 1px solid var(--lp-border);
      border-radius: 14px; padding: 14px;
      box-shadow: var(--lp-nm-sm);
      transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
    }
    .lp-mc-wide { grid-column: 1 / -1; }
    .lp-ml { font-size: 10px; color: var(--lp-muted); text-transform: uppercase; letter-spacing: .07em; }
    .lp-mv { font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-top: 4px; color: var(--lp-gold3); }
    [data-theme='dark'] .lp-mv { color: #A78BFA; }
    .lp-ms { font-size: 11px; margin-top: 2px; color: var(--lp-mint); }
    .lp-chart { height: 50px; margin-top: 10px; }
    .lp-chart svg { width: 100%; height: 100%; }
    .lp-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--lp-border); font-size: 11.5px; color: var(--lp-ink2); }
    .lp-row:last-child { border: none; }

    /* chips */
    .lpc { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .lpc-g { background: rgba(16,185,129,.12); color: #059669; }
    [data-theme='dark'] .lpc-g { color: #34D399; }
    .lpc-a { background: rgba(245,158,11,.12); color: #B45309; }
    [data-theme='dark'] .lpc-a { color: #FCD34D; }
    .lpc-r { background: rgba(239,68,68,.12); color: #DC2626; }
    [data-theme='dark'] .lpc-r { color: #FCA5A5; }
    .lpc-v { background: rgba(124,58,237,.1); color: #6D28D9; }
    [data-theme='dark'] .lpc-v { color: #A78BFA; }
    .lpc-b { background: rgba(59,130,246,.1); color: #1D4ED8; }
    [data-theme='dark'] .lpc-b { color: #60A5FA; }

    /* ══ STATS BAND ══ */
    .lp-stats {
      border-top: 1px solid var(--lp-border);
      border-bottom: 1px solid var(--lp-border);
      background: var(--lp-card);
      padding: 56px 0;
      transition: background 0.4s;
    }
    .lp-stats .lpw { display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; text-align: center; }
    .lp-snum {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(28px,3.2vw,42px); font-weight: 500;
      color: var(--lp-gold3); line-height: 1;
      transition: color 0.4s;
    }
    [data-theme='dark'] .lp-snum { color: #A78BFA; }
    .lp-sbar { height: 3px; width: 40px; border-radius: 2px; margin: 10px auto; }
    .lp-sdesc { font-size: 13px; color: var(--lp-muted); margin-top: 4px; }

    /* ══ SECTION HEAD ══ */
    .lp-sh { text-align: center; margin-bottom: 72px; }
    .lp-ey {
      display: inline-flex; align-items: center; gap: 7px;
      font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
      color: var(--lp-gold3); background: var(--lp-accent-t);
      border: 1px solid var(--lp-accent-b);
      padding: 5px 14px; border-radius: 999px; margin-bottom: 18px;
      transition: all 0.4s;
    }
    [data-theme='dark'] .lp-ey { color: #A78BFA; }
    .lp-sh h2 { font-size: clamp(28px,3.2vw,44px); font-weight: 800; color: var(--lp-ink); line-height: 1.1; }
    .lp-sh h2 em { font-style: normal; color: var(--lp-gold3); }
    [data-theme='dark'] .lp-sh h2 em { color: #A78BFA; }
    .lp-sh p { color: var(--lp-muted); margin-top: 14px; font-size: 16px; max-width: 520px; margin-left: auto; margin-right: auto; }

    /* ══ BENTO ══ */
    .lp-bento { padding: 120px 0; }
    .lp-bg { display: grid; grid-template-columns: repeat(12,1fr); gap: 16px; }
    .lp-bc {
      background: var(--lp-card); border: 1px solid var(--lp-border);
      border-radius: 20px; padding: 28px;
      position: relative; overflow: hidden;
      box-shadow: var(--lp-nm-sm);
      transition: all .35s cubic-bezier(.2,.8,.2,1);
    }
    .lp-bc::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--lp-accent-b), transparent);
      opacity: 0; transition: opacity .4s;
    }
    .lp-bc:hover { transform: translateY(-5px); border-color: var(--lp-accent-b); box-shadow: var(--lp-nm), 0 0 0 1px var(--lp-accent-b); }
    .lp-bc:hover::after { opacity: 1; }
    .bs4{grid-column:span 4} .bs5{grid-column:span 5} .bs6{grid-column:span 6}
    .bs7{grid-column:span 7} .bs8{grid-column:span 8} .bs12{grid-column:span 12}
    .lp-btag { font-size: 10.5px; color: var(--lp-gold3); letter-spacing: .08em; text-transform: uppercase; font-weight: 700; margin-bottom: 14px; }
    [data-theme='dark'] .lp-btag { color: #A78BFA; }
    .lp-bicon {
      width: 46px; height: 46px; border-radius: 13px;
      background: linear-gradient(135deg, var(--lp-accent-t), rgba(212,168,0,0.05));
      border: 1px solid var(--lp-accent-b);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; margin-bottom: 16px;
      box-shadow: var(--lp-nm-sm);
      transition: all 0.4s;
    }
    .lp-bc h3 { font-size: 17px; font-weight: 700; margin-bottom: 10px; color: var(--lp-ink); line-height: 1.3; }
    .lp-bc p { font-size: 13.5px; color: var(--lp-muted); line-height: 1.7; }
    .lp-vr { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--lp-border); font-size: 12px; color: var(--lp-ink2); }
    .lp-vr:last-child { border: none; }
    .lp-kgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
    .lp-kbox {
      background: var(--lp-bg3); border: 1px solid var(--lp-border);
      border-radius: 12px; padding: 10px 12px;
      box-shadow: var(--lp-nm-sm);
      transition: background 0.4s;
    }
    .lp-klbl { font-size: 10px; color: var(--lp-muted); text-transform: uppercase; letter-spacing: .05em; }
    .lp-kval { font-size: 18px; font-weight: 700; font-family: 'JetBrains Mono', monospace; margin-top: 4px; }
    .lp-code {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      background: var(--lp-bg3); border: 1px solid var(--lp-border);
      padding: 1px 6px; border-radius: 5px; color: var(--lp-gold3);
      transition: background 0.4s;
    }
    [data-theme='dark'] .lp-code { color: #A78BFA; background: rgba(255,255,255,0.06); }

    /* ══ HOW IT WORKS ══ */
    .lp-flow { padding: 120px 0; border-top: 1px solid var(--lp-border); }
    .lp-flow .lpw { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
    .lp-fstep { display: flex; gap: 18px; padding: 20px 0; position: relative; }
    .lp-fstep:not(:last-child)::after {
      content: ''; position: absolute; left: 18px; top: 58px; bottom: 0;
      width: 1px; background: linear-gradient(to bottom, var(--lp-accent-b), transparent);
    }
    .lp-fnum {
      width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
      background: var(--lp-accent-t); border: 1px solid var(--lp-accent-b);
      box-shadow: var(--lp-nm-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; color: var(--lp-gold3);
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.4s;
    }
    [data-theme='dark'] .lp-fnum { color: #A78BFA; }
    .lp-ftext h4 { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--lp-ink); }
    .lp-ftext p { font-size: 13.5px; color: var(--lp-muted); }

    /* Hub */
    .lp-hub {
      background: var(--lp-card); border: 1px solid var(--lp-border2);
      border-radius: 22px; padding: 28px 20px 16px;
      box-shadow: var(--lp-nm); position: sticky; top: 100px;
      transition: all 0.4s;
    }
    .lp-hub-inner { position: relative; height: 360px; }
    .lp-hub-inner svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .lp-hub-core {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 86px; height: 86px; border-radius: 22px;
      background: linear-gradient(135deg, var(--lp-gold3), var(--lp-gold2));
      display: flex; align-items: center; justify-content: center; font-size: 34px;
      box-shadow: 0 0 36px rgba(212,168,0,0.5);
      animation: lpGlow 3s ease-in-out infinite;
      transition: background 0.4s, box-shadow 0.4s;
    }
    [data-theme='dark'] .lp-hub-core {
      background: linear-gradient(135deg, #7C3AED, #A78BFA);
      box-shadow: 0 0 40px rgba(139,92,246,0.6);
    }
    @keyframes lpGlow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.2)} }
    .lp-hnode {
      position: absolute; background: var(--lp-bg2); border: 1px solid var(--lp-border2);
      border-radius: 14px; padding: 12px 14px; width: 134px;
      box-shadow: var(--lp-nm-sm); transition: all 0.4s;
    }
    .lp-hni { font-size: 18px; margin-bottom: 6px; }
    .lp-hnl { font-size: 12px; font-weight: 700; color: var(--lp-ink); }
    .lp-hns { font-size: 10.5px; color: var(--lp-muted); margin-top: 1px; }
    .lp-hline { stroke: var(--lp-accent-b); stroke-width: 1.5; stroke-dasharray: 5 4; fill: none; animation: lpDash 4s linear infinite; }
    @keyframes lpDash { to { stroke-dashoffset: -100; } }
    .lp-hub-cap { text-align: center; font-size: 12px; color: var(--lp-muted); padding: 14px 0 6px; border-top: 1px solid var(--lp-border); margin-top: 8px; }

    /* ══ MODULES ══ */
    .lp-mods { padding: 120px 0; border-top: 1px solid var(--lp-border); }
    .lp-mgrid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
    .lp-mcard {
      background: var(--lp-card); border: 1px solid var(--lp-border);
      border-radius: 20px; padding: 28px;
      box-shadow: var(--lp-nm-sm);
      transition: all .35s cubic-bezier(.2,.8,.2,1);
      position: relative; overflow: hidden;
    }
    .lp-mcard::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      opacity: 0; transition: opacity 0.3s;
    }
    .lp-mcard:hover { transform: translateY(-5px); border-color: var(--lp-accent-b); box-shadow: var(--lp-nm); }
    .lp-mcard:hover::before { opacity: 1; }
    .lp-mcard:nth-child(1)::before { background: linear-gradient(90deg, #D4A800, #F5C518); }
    .lp-mcard:nth-child(2)::before { background: linear-gradient(90deg, #F05A5A, #F59E0B); }
    .lp-mcard:nth-child(3)::before { background: linear-gradient(90deg, #3B82F6, #06B6D4); }
    .lp-mcard:nth-child(4)::before { background: linear-gradient(90deg, #10B981, #34D399); }
    .lp-mcard:nth-child(5)::before { background: linear-gradient(90deg, #7C3AED, #A78BFA); }
    .lp-mcard:nth-child(6)::before { background: linear-gradient(90deg, #F59E0B, #D4A800); }
    .lp-mico { font-size: 28px; margin-bottom: 14px; }
    .lp-mcard h4 { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--lp-ink); }
    .lp-mcard p { font-size: 13.5px; color: var(--lp-muted); line-height: 1.65; }
    .lp-mtag {
      display: inline-block; font-size: 10px; font-weight: 700;
      color: var(--lp-gold3); background: var(--lp-accent-t);
      padding: 3px 10px; border-radius: 999px; margin-top: 14px;
      border: 1px solid var(--lp-accent-b);
      transition: all 0.4s;
    }
    [data-theme='dark'] .lp-mtag { color: #A78BFA; }

    /* ══ PLANS ══ */
    .lp-plans { padding: 120px 0; border-top: 1px solid var(--lp-border); }
    .lp-pgrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-top: 56px; }
    .lp-pcard {
      background: var(--lp-card); border: 1px solid var(--lp-border);
      border-radius: 22px; padding: 28px 22px;
      box-shadow: var(--lp-nm-sm);
      transition: all .4s cubic-bezier(.2,.8,.2,1);
      transform-style: preserve-3d;
    }
    .lp-pcard:hover { border-color: var(--lp-accent-b); }
    .lp-pcard.lp-feat {
      background: linear-gradient(160deg, rgba(212,168,0,0.08), rgba(245,197,24,0.04));
      border-color: rgba(212,168,0,0.4);
      position: relative; overflow: hidden;
      box-shadow: var(--lp-nm), 0 0 40px rgba(212,168,0,0.12);
    }
    [data-theme='dark'] .lp-pcard.lp-feat {
      background: linear-gradient(160deg, rgba(109,40,217,0.2), rgba(139,92,246,0.06));
      border-color: rgba(139,92,246,0.4);
      box-shadow: var(--lp-nm), 0 0 40px rgba(139,92,246,0.12);
    }
    .lp-pcard.lp-feat::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--lp-gold3), var(--lp-gold2), var(--lp-coral));
    }
    [data-theme='dark'] .lp-pcard.lp-feat::before {
      background: linear-gradient(90deg, #7C3AED, #A78BFA, #60A5FA);
    }
    .lp-pbadge {
      display: inline-block; padding: 3px 12px; border-radius: 999px;
      font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em;
      background: var(--lp-accent-t); color: var(--lp-gold3);
      border: 1px solid var(--lp-accent-b); margin-bottom: 14px;
      transition: all 0.4s;
    }
    [data-theme='dark'] .lp-pbadge { color: #A78BFA; }
    .lp-pname { font-size: 18px; font-weight: 800; color: var(--lp-ink); }
    .lp-pprice { font-size: 32px; font-weight: 700; color: var(--lp-gold3); font-family: 'JetBrains Mono', monospace; margin: 12px 0 4px; }
    [data-theme='dark'] .lp-pprice { color: #A78BFA; }
    .lp-pprice span { font-size: 13px; color: var(--lp-muted); font-family: 'Inter', sans-serif; font-weight: 400; }
    .lp-pdesc { font-size: 12.5px; color: var(--lp-muted); margin-bottom: 6px; }
    .lp-psubs { font-size: 11px; color: var(--lp-gold3); font-weight: 700; margin-bottom: 16px; }
    [data-theme='dark'] .lp-psubs { color: #A78BFA; }
    .lp-pf { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--lp-border); padding-top: 18px; }
    .lp-pf li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--lp-ink2); padding: 6px 0; }
    .lp-ck { color: var(--lp-mint); font-weight: 800; font-size: 13px; flex-shrink: 0; margin-top: 1px; }

    /* ══ TAX ══ */
    .lp-tax { padding: 80px 0; border-top: 1px solid var(--lp-border); }
    .lp-taxgrid { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; margin-top: 40px; }
    .lp-taxcard {
      background: var(--lp-card); border: 1px solid var(--lp-border);
      border-radius: 16px; padding: 16px; text-align: center;
      box-shadow: var(--lp-nm-sm);
      transition: all .3s; cursor: default;
    }
    .lp-taxcard:hover { transform: translateY(-3px); border-color: var(--lp-accent-b); }
    .lp-txflag { font-size: 26px; margin-bottom: 8px; }
    .lp-txcountry { font-size: 11.5px; color: var(--lp-muted); margin-bottom: 3px; }
    .lp-txtype { font-size: 10px; color: var(--lp-muted2); margin-bottom: 6px; }
    .lp-txrate { font-size: 22px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--lp-gold3); }
    [data-theme='dark'] .lp-txrate { color: #A78BFA; }

    /* ══ RETRY ══ */
    .lp-retry { padding: 80px 0; border-top: 1px solid var(--lp-border); }
    .lp-rtl { display: flex; margin-top: 48px; position: relative; }
    .lp-rtl::before {
      content: ''; position: absolute; top: 27px; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--lp-accent-b), transparent);
    }
    .lp-rstep { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; position: relative; }
    .lp-rdot {
      width: 56px; height: 56px; border-radius: 15px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; font-family: 'JetBrains Mono', monospace;
      border: 1.5px solid; position: relative; z-index: 1;
      box-shadow: var(--lp-nm-sm);
      transition: all 0.4s;
    }
    .lp-rl { font-size: 12px; font-weight: 700; color: var(--lp-ink); text-align: center; }
    .lp-rs { font-size: 11px; color: var(--lp-muted); text-align: center; padding: 0 8px; }

    /* ══ TECH ══ */
    .lp-tech { padding: 80px 0; border-top: 1px solid var(--lp-border); }
    .lp-trow { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 40px; }
    .lp-tpill {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 18px; border-radius: 999px;
      background: var(--lp-card); border: 1px solid var(--lp-border);
      font-size: 13px; font-weight: 600; color: var(--lp-ink2);
      box-shadow: var(--lp-nm-sm);
      transition: all .25s;
    }
    .lp-tpill:hover { border-color: var(--lp-accent-b); color: var(--lp-gold3); transform: translateY(-2px); }
    [data-theme='dark'] .lp-tpill:hover { color: #A78BFA; }
    .lp-tdot { width: 8px; height: 8px; border-radius: 50%; }

    /* ══ CTA ══ */
    .lp-cta { padding: 120px 0; text-align: center; position: relative; overflow: hidden; }
    .lp-cta-blob {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 700px; height: 400px;
      background: radial-gradient(ellipse, rgba(212,168,0,0.07), transparent 70%);
      pointer-events: none; transition: background 0.4s;
    }
    [data-theme='dark'] .lp-cta-blob { background: radial-gradient(ellipse, rgba(139,92,246,0.08), transparent 70%); }
    .lp-cta h2 { font-size: clamp(30px,4vw,52px); font-weight: 800; color: var(--lp-ink); line-height: 1.1; max-width: 650px; margin: 0 auto; }
    .lp-cta h2 em { font-style: normal; color: var(--lp-gold3); }
    [data-theme='dark'] .lp-cta h2 em { color: #A78BFA; }
    .lp-cta p { color: var(--lp-muted); margin-top: 18px; font-size: 16px; }
    .lp-cta-acts { display: flex; gap: 14px; justify-content: center; margin-top: 40px; flex-wrap: wrap; }
    .lp-ctrust { display: flex; gap: 24px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
    .lp-ct { font-size: 13px; color: var(--lp-muted); display: flex; align-items: center; gap: 6px; }
    .lp-ct::before { content: '✓'; color: var(--lp-mint); font-weight: 800; }

    /* ══ FOOTER ══ */
    .lp-footer { border-top: 1px solid var(--lp-border); padding: 64px 0 32px; background: var(--lp-bg2); transition: background 0.4s; }
    .lp-fgrid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; }
    .lp-fdesc { font-size: 13.5px; color: var(--lp-muted); max-width: 260px; line-height: 1.7; margin-top: 14px; }
    .lp-fcol h5 { font-size: 11px; color: var(--lp-ink); text-transform: uppercase; letter-spacing: .1em; font-weight: 700; margin-bottom: 16px; }
    .lp-fcol a { display: block; font-size: 13.5px; color: var(--lp-muted); margin-bottom: 10px; transition: color .2s; }
    .lp-fcol a:hover { color: var(--lp-gold3); }
    [data-theme='dark'] .lp-fcol a:hover { color: #A78BFA; }
    .lp-fbot { display: flex; justify-content: space-between; align-items: center; margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--lp-border); font-size: 12.5px; color: var(--lp-muted); }
    .lp-ibadge {
      background: var(--lp-accent-t); border: 1px solid var(--lp-accent-b);
      padding: 4px 14px; border-radius: 999px;
      color: var(--lp-gold3); font-weight: 700; font-size: 11px;
      transition: all 0.4s;
    }
    [data-theme='dark'] .lp-ibadge { color: #A78BFA; }

    /* ══ SCROLL REVEAL ══ */
    .lp-sr { opacity: 0; transform: translateY(26px); transition: opacity .75s ease, transform .75s ease; }
    .lp-sr-in { opacity: 1; transform: translateY(0); }
    .lp-d1 { transition-delay: .1s; } .lp-d2 { transition-delay: .2s; } .lp-d3 { transition-delay: .3s; }

    /* ══ RESPONSIVE ══ */
    @media(max-width:1024px){
      .lp-hero .lpw { grid-template-columns: 1fr; }
      .lp-bg { grid-template-columns: 1fr 1fr; }
      .bs4,.bs5,.bs7,.bs8 { grid-column: span 1; } .bs6 { grid-column: span 1; } .bs12 { grid-column: span 2; }
      .lp-pgrid { grid-template-columns: 1fr 1fr; }
      .lp-taxgrid { grid-template-columns: repeat(3,1fr); }
      .lp-flow .lpw { grid-template-columns: 1fr; }
      .lp-fgrid { grid-template-columns: 1fr 1fr; }
    }
    @media(max-width:720px){
      .lp-navlinks { display: none; }
      .lp-bg, .lp-pgrid, .lp-mgrid { grid-template-columns: 1fr; }
      .bs4,.bs5,.bs6,.bs7,.bs8,.bs12 { grid-column: span 1; }
      .lp-stats .lpw { grid-template-columns: 1fr 1fr; }
      .lp-taxgrid { grid-template-columns: 1fr 1fr; }
      .lp-rtl { flex-direction: column; align-items: center; gap: 20px; }
      .lp-rtl::before { display: none; }
      .lp-fgrid { grid-template-columns: 1fr; }
      .lp-fbot { flex-direction: column; gap: 12px; text-align: center; }
    }
  `

  return (
    <>
      <style>{css}</style>
      <div className="lp">
        <canvas ref={canvasRef} />

        {/* ══ NAV ══ */}
        <nav className="lp-nav">
          <div className="lpw">
            <div className="lp-brand">
              <div className="lp-brand-icon">
                <svg viewBox="0 0 20 20" fill="none"><path d="M10 2L13.5 8.5H18L13.5 13L15.5 19L10 15.5L4.5 19L6.5 13L2 8.5H6.5L10 2Z" fill="white" opacity=".95"/></svg>
              </div>
              <span className="lp-brand-name">Vaultly</span>
            </div>
            <div className="lp-navlinks">
              <a href="#features">Features</a>
              <a href="#flow">How it works</a>
              <a href="#modules">Modules</a>
              <a href="#plans">Plans</a>
              <a href="#stack">Tech Stack</a>
            </div>
            <div className="lp-navcta">
              <button className="lpbtn lpbtn-icon" onClick={toggleTheme} title="Toggle theme" style={{fontSize:18}}>
                {isDark ? '☀️' : '🌙'}
              </button>
              <a className="lpbtn lpbtn-ghost" href="/signin" onClick={go}>Sign in</a>
              <a className="lpbtn lpbtn-primary" href="/signin" onClick={go}>Get started →</a>
            </div>
          </div>
        </nav>

        {/* ══ HERO ══ */}
        <section className="lp-hero">
          <div className="lpw">
            <div>
              <div className="lp-badge"><span className="lp-pulse" />&nbsp;Infosys VRI 7.0 · M3 Complete · All Tasks Done</div>
              <h1>
                Subscription billing<br />
                made <span className="lp-hi"><span className="lp-typed-wrap" id="lp-typed">simple</span></span>
              </h1>
              <p className="lp-sub">
                Vaultly is a full-stack SaaS billing platform built on{' '}
                <strong style={{color:'var(--lp-ink)'}}>React + FastAPI + PostgreSQL</strong>.
                Manage customers, plans, invoices, UPI QR payments, failed-payment retries,
                refunds, and a complete audit trail — all in one place.
              </p>
              <div className="lp-actions">
                <a className="lpbtn lpbtn-primary lpbtn-lg" href="/signin" onClick={go}>Open Dashboard →</a>
                <a className="lpbtn lpbtn-ghost lpbtn-lg" href="#flow">See how it works</a>
              </div>
              <div className="lp-trust">
                <div className="lp-chip"><span className="lp-chk">✓</span>UPI QR Payments</div>
                <div className="lp-chip"><span className="lp-chk">✓</span>Auto GST / VAT by country</div>
                <div className="lp-chip"><span className="lp-chk">✓</span>PWA installable</div>
                <div className="lp-chip"><span className="lp-chk">✓</span>Role-based access</div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div className="lp-mock">
              <div className="lp-mock-bar">
                <div className="lp-wdots">
                  <div className="lp-wd" style={{background:'#FF5F57'}}/>
                  <div className="lp-wd" style={{background:'#FEBC2E'}}/>
                  <div className="lp-wd" style={{background:'#28C840'}}/>
                </div>
                <div className="lp-mock-title">Vaultly — Admin Dashboard · localhost:5173</div>
              </div>
              <div className="lp-mock-body">
                <div className="lp-mc">
                  <div className="lp-ml">MRR</div>
                  <div className="lp-mv">$<span data-to="49200">0</span></div>
                  <div className="lp-ms">▲ Growing month-on-month</div>
                </div>
                <div className="lp-mc">
                  <div className="lp-ml">Active Subs</div>
                  <div className="lp-mv" style={{color:'var(--lp-mint)'}}><span data-to="613">0</span></div>
                  <div className="lp-ms" style={{color:'var(--lp-muted)'}}>Starter · Growth · Scale · Enterprise</div>
                </div>
                <div className="lp-mc lp-mc-wide">
                  <div className="lp-ml">Revenue Trend — Jan–Aug 2026</div>
                  <div className="lp-chart">
                    <svg viewBox="0 0 320 50" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="lpg1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isDark ? '#8B5CF6' : '#D4A800'} stopOpacity=".35"/>
                          <stop offset="100%" stopColor={isDark ? '#8B5CF6' : '#D4A800'} stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path id="lp-spa" fill="url(#lpg1)" d=""/>
                      <path id="lp-sp" fill="none" stroke={isDark ? '#8B5CF6' : '#D4A800'} strokeWidth="2"/>
                    </svg>
                  </div>
                </div>
                <div className="lp-mc lp-mc-wide">
                  <div className="lp-ml">Recent Subscriptions</div>
                  <div className="lp-row"><span>Ava Thompson — Northwind Labs · Growth</span><span className="lpc lpc-g">Active</span></div>
                  <div className="lp-row"><span>Noah Patel — BluePeak Systems · Scale</span><span className="lpc lpc-g">Active</span></div>
                  <div className="lp-row"><span>Priya Sharma — Beacon AI · Starter</span><span className="lpc lpc-a">Trial</span></div>
                  <div className="lp-row"><span>Arjun Verma — Cascadia Tech · Enterprise</span><span className="lpc lpc-r">Past Due</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ STATS ══ */}
        <div className="lp-stats">
          <div className="lpw">
            {[
              {n:'49,200',pre:'$',suf:'',to:49200,c:'var(--lp-gold3)',bc:'linear-gradient(90deg,#D4A800,transparent)',desc:'Monthly Recurring Revenue'},
              {n:'613',pre:'',suf:'',to:613,c:'var(--lp-mint)',bc:'linear-gradient(90deg,#10B981,transparent)',desc:'Active subscriptions'},
              {n:'20',pre:'',suf:'',to:20,c:'var(--lp-coral)',bc:'linear-gradient(90deg,#F05A5A,transparent)',desc:'Customers across 4 plans'},
              {n:'100',pre:'',suf:'%',to:100,c:'var(--lp-sky)',bc:'linear-gradient(90deg,#3B82F6,transparent)',desc:'Audit trail coverage'},
            ].map(({pre,suf,to,c,bc,desc},i) => (
              <div key={desc} className={`lp-sr lp-d${i}`}>
                <div className="lp-snum" style={{color:c}}>{pre}<span data-to={to}>0</span>{suf}</div>
                <div className="lp-sbar" style={{background:bc}}/>
                <div className="lp-sdesc">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ FEATURES BENTO ══ */}
        <section className="lp-bento" id="features">
          <div className="lpw">
            <div className="lp-sh lp-sr">
              <div className="lp-ey">✦ Features</div>
              <h2>Everything billing <em>actually needs</em></h2>
              <p>From plan creation to UPI QR payment — the complete billing lifecycle, fully implemented.</p>
            </div>
            <div className="lp-bg">

              <div className="lp-bc bs5 lp-sr">
                <div className="lp-btag">Plans & Pricing</div>
                <div className="lp-bicon">📋</div>
                <h3>Four plans with monthly / annual billing cycles.</h3>
                <p>Admin creates Starter, Growth, Scale, or Enterprise plans. Each stores price, billing interval, trial days, and features.</p>
                <div style={{marginTop:16}}>
                  {[['Starter — $29/mo','lpc-g','184 subs'],['Growth — $79/mo','lpc-v','312 subs'],['Scale — $199/mo','lpc-b','96 subs'],['Enterprise — $499/mo','lpc-a','21 subs']].map(([l,c,s])=>(
                    <div key={l} className="lp-vr"><span style={{fontSize:12}}>{l}</span><span className={`lpc ${c}`}>{s}</span></div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs7 lp-sr lp-d1">
                <div className="lp-btag">Invoice Management</div>
                <div className="lp-bicon">🧾</div>
                <h3>Auto-generated invoices with GST/VAT applied per customer country.</h3>
                <p>Tax auto-calculated by the backend tax engine. Download PDF via <span className="lp-code">/invoices/{'{id}'}/pdf</span>. Filter: Draft · Unpaid · Paid · Failed · Refunded.</p>
                <div style={{background:'var(--lp-bg3)',border:'1px solid var(--lp-border)',borderRadius:12,overflow:'hidden',marginTop:14}}>
                  <div style={{background:'var(--lp-accent-t)',padding:'9px 14px',display:'flex',justifyContent:'space-between',borderBottom:'1px solid var(--lp-border)',fontSize:12}}>
                    <span style={{color:'var(--lp-gold3)',fontWeight:700}}>INV-03000</span><span className="lpc lpc-g">Paid</span>
                  </div>
                  {[['Growth Plan — Monthly','$79.00'],['Usage overage','$22.00'],['GST 18%','$18.18'],['Total','$119.18']].map(([l,v],i)=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 14px',borderBottom:i<3?'1px solid var(--lp-border)':'none',fontSize:12,color:i===3?'var(--lp-gold3)':'var(--lp-ink2)',fontWeight:i===3?700:400}}>
                      <span>{l}</span><span style={{fontFamily:"'JetBrains Mono',monospace"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs7 lp-sr">
                <div className="lp-btag">UPI QR Payments</div>
                <div className="lp-bicon">📱</div>
                <h3>Customers pay by scanning a live QR — no payment gateway needed.</h3>
                <p>Open any unpaid invoice → "Pay via QR" tab → QR generates for UPI ID <span className="lp-code">vaultly@upi</span>. Scan with GPay, PhonePe, Paytm, or BHIM.</p>
                <div style={{display:'flex',gap:14,alignItems:'center',marginTop:16}}>
                  <div style={{width:76,height:76,background:'#fff',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,flexShrink:0,border:'2px solid var(--lp-border2)',boxShadow:'var(--lp-nm-sm)'}}>▦</div>
                  <div>
                    {['Open unpaid invoice','Switch to "Pay via QR" tab','QR generated: vaultly@upi','Scan → confirm → Invoice = Paid'].map((s,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,fontSize:12,color:'var(--lp-ink2)'}}>
                        <div style={{width:20,height:20,borderRadius:'50%',background:'var(--lp-accent-t)',color:'var(--lp-gold3)',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:'1px solid var(--lp-accent-b)'}}>{i+1}</div>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lp-bc bs5 lp-sr lp-d1">
                <div className="lp-btag">Failed Payment Queue</div>
                <div className="lp-bicon">⚠️</div>
                <h3>Retry queue — Day 1 → 3 → 7. Auto-cancel after 3 failures.</h3>
                <p>Failed payments queue at <span className="lp-code">/payment-retries/</span>. Run via <span className="lp-code">POST /payment-retries/run</span>. 3 failures → subscription cancelled.</p>
                <div style={{marginTop:14}}>
                  {[['INV-03009 · Ava Thompson','lpc-r','Attempt 1 · Day 1'],['INV-03018 · Noah Patel','lpc-a','Attempt 2 · Day 3'],['INV-03027 · Liam Chen','lpc-r','Attempt 3 · Day 7']].map(([l,c,s])=>(
                    <div key={l} className="lp-vr"><span style={{fontSize:11}}>{l}</span><span className={`lpc ${c}`}>{s}</span></div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs8 lp-sr">
                <div className="lp-btag">Admin Dashboard · M3 Task 1</div>
                <div className="lp-bicon">📊</div>
                <h3>Real-time KPIs, revenue charts, subscription metrics from live backend.</h3>
                <p>Data from <span className="lp-code">/dashboard/summary</span>, <span className="lp-code">/dashboard/revenue-by-plan</span>, <span className="lp-code">/dashboard/subscription-metrics</span>.</p>
                <div className="lp-kgrid">
                  {[['Total Revenue','$593K+','var(--lp-gold3)'],['MRR','$49,200','var(--lp-mint)'],['Churn Rate','dynamic %','var(--lp-coral)'],['Trial Conv.','dynamic %','var(--lp-sky)']].map(([l,v,c])=>(
                    <div key={l} className="lp-kbox"><div className="lp-klbl">{l}</div><div className="lp-kval" style={{color:c}}>{v}</div></div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs4 lp-sr lp-d1">
                <div className="lp-btag">Audit Logs · M3 Task 3</div>
                <div className="lp-bicon">🔍</div>
                <h3>Every action logged — actor, entity, timestamp.</h3>
                <p>Filter by entity & action. Built at <span className="lp-code">/audit-logs/</span>.</p>
                <div style={{marginTop:14}}>
                  {[['created','Subscription · System','var(--lp-mint)'],['updated','Customer · Admin','var(--lp-gold3)'],['refunded','Refund · Admin','var(--lp-coral)'],['exported','Invoice · Ava','var(--lp-sky)']].map(([a,d,c])=>(
                    <div key={a} className="lp-vr">
                      <span style={{color:c,fontSize:10.5,fontWeight:800,textTransform:'uppercase'}}>{a}</span>
                      <span style={{fontSize:11,color:'var(--lp-muted)'}}>{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs6 lp-sr">
                <div className="lp-btag">Customer Billing Timeline · M3 Task 3</div>
                <div className="lp-bicon">👤</div>
                <h3>Full billing history per customer — chronological view.</h3>
                <p>Click any customer (<em style={{color:'var(--lp-ink)'}}>Ava Thompson · Northwind Labs</em>) for timeline, activity summary, total invoices, failed count, refund history.</p>
                <div style={{marginTop:14}}>
                  {[['🔁','Subscribed — Growth Plan','Feb 14, 2024','var(--lp-gold3)'],['🧾','INV-03000 Generated','Aug 1, 2026','var(--lp-sky)'],['💳','Payment · Visa •••• 4242','Aug 1, 2026','var(--lp-mint)'],['↩️','Refund Issued — $79.00','Aug 3, 2026','var(--lp-coral)']].map(([ic,t,d,c])=>(
                    <div key={t} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid var(--lp-border)',alignItems:'flex-start',fontSize:12}}>
                      <div style={{width:28,height:28,borderRadius:8,background:'var(--lp-accent-t)',border:'1px solid var(--lp-accent-b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>{ic}</div>
                      <div><div style={{fontWeight:700,color:'var(--lp-ink)',fontSize:11.5}}>{t}</div><div style={{color:'var(--lp-muted)',fontSize:11,marginTop:1}}>{d}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-bc bs6 lp-sr lp-d1">
                <div className="lp-btag">Refunds & Activity Summary</div>
                <div className="lp-bicon">↩️</div>
                <h3>Prorated or custom-amount refunds with reason tracking.</h3>
                <p><span className="lp-code">POST /refunds</span> with <span className="lp-code">invoice_id</span>, <span className="lp-code">refund_amount</span>, <span className="lp-code">reason</span>. Omit amount for automatic proration.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:14}}>
                  {[['Total Invoices','40','var(--lp-gold3)'],['Total Paid','$50K+','var(--lp-mint)'],['Failed','dynamic','var(--lp-coral)'],['Refunds','tracked','var(--lp-sky)']].map(([l,v,c])=>(
                    <div key={l} style={{background:'var(--lp-bg3)',border:'1px solid var(--lp-border)',borderRadius:10,padding:'10px 12px',boxShadow:'var(--lp-nm-sm)'}}>
                      <div style={{fontSize:10,color:'var(--lp-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{l}</div>
                      <div style={{fontSize:18,fontWeight:800,color:c,marginTop:4}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section className="lp-flow" id="flow">
          <div className="lpw">
            <div className="lp-sr">
              <div className="lp-ey">⚡ How it works</div>
              <h2 style={{fontSize:'clamp(26px,2.8vw,38px)',lineHeight:1.15}}>From signup to payment —<br/>the full billing lifecycle.</h2>
              <p style={{color:'var(--lp-muted)',marginTop:16,fontSize:15,lineHeight:1.7}}>
                Backend: FastAPI + PostgreSQL (<span className="lp-code">resume_db</span>) via SQLAlchemy + Alembic. Every step tracked in real-time.
              </p>
              <div style={{marginTop:36}}>
                {[
                  ['01','Admin creates plans via /plans/','Define Starter, Growth, Scale, Enterprise. Set price, billing interval, trial days, features.'],
                  ['02','Add customers & assign subscription','Add customers with country & currency. Assign a plan via POST /subscriptions/.'],
                  ['03','Invoices auto-generated','Tax calculated per country at invoice creation. PDF download via /invoices/{id}/pdf.'],
                  ['04','Payment — mock card or UPI QR','POST /payments/process simulates 80% success / 20% fail. Or scan live UPI QR (vaultly@upi).'],
                  ['05','Failed retry queue — Day 1 → 3 → 7','Failed payments queue with auto-retry. After 3 failures subscription is auto-cancelled.'],
                  ['06','Refunds & Audit trail','Issue refunds with proration. Every action logged to /audit-logs/ with actor + timestamp.'],
                ].map(([n,h,p]) => (
                  <div key={n} className="lp-fstep">
                    <div className="lp-fnum">{n}</div>
                    <div className="lp-ftext"><h4>{h}</h4><p>{p}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-sr lp-d2">
              <div className="lp-hub">
                <div className="lp-hub-inner">
                  <svg viewBox="0 0 300 360">
                    <line className="lp-hline" x1="150" y1="180" x2="40" y2="60"/>
                    <line className="lp-hline" x1="150" y1="180" x2="260" y2="60"/>
                    <line className="lp-hline" x1="150" y1="180" x2="40" y2="300"/>
                    <line className="lp-hline" x1="150" y1="180" x2="260" y2="300"/>
                  </svg>
                  <div className="lp-hub-core">💰</div>
                  <div className="lp-hnode" style={{top:10,left:4}}><div className="lp-hni">👥</div><div className="lp-hnl">Customers</div><div className="lp-hns">20 · 4 countries</div></div>
                  <div className="lp-hnode" style={{top:10,right:4}}><div className="lp-hni">🧾</div><div className="lp-hnl">Invoices</div><div className="lp-hns">40 records · PDF</div></div>
                  <div className="lp-hnode" style={{bottom:20,left:4}}><div className="lp-hni">📱</div><div className="lp-hnl">UPI Payments</div><div className="lp-hns">vaultly@upi</div></div>
                  <div className="lp-hnode" style={{bottom:20,right:4}}><div className="lp-hni">🔍</div><div className="lp-hnl">Audit Logs</div><div className="lp-hns">60 entries</div></div>
                </div>
                <div className="lp-hub-cap">One platform. Customers → Plans → Invoices → Payments → Audit.</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ TAX ══ */}
        <section className="lp-tax" id="tax">
          <div className="lpw">
            <div className="lp-sh lp-sr" style={{marginBottom:0}}>
              <div className="lp-ey">🌏 Tax Engine</div>
              <h2 style={{fontSize:'clamp(22px,2.5vw,34px)'}}>Auto tax by <em>customer country</em></h2>
              <p>Applied at invoice generation. Zero configuration needed.</p>
            </div>
            <div className="lp-taxgrid lp-sr lp-d1">
              {[
                {f:'🇮🇳',c:'India',t:'GST (CGST 9% + SGST 9%)',r:'18%',col:'#D4A800'},
                {f:'🇺🇸',c:'United States',t:'Sales Tax',r:'10%',col:'#3B82F6'},
                {f:'🇬🇧',c:'United Kingdom',t:'VAT',r:'20%',col:'#F05A5A'},
                {f:'🇩🇪',c:'Germany',t:'VAT',r:'19%',col:'#10B981'},
                {f:'🇦🇪',c:'UAE',t:'VAT',r:'5%',col:'#7C3AED'},
                {f:'🇨🇦',c:'Canada',t:'GST',r:'5%',col:'#F59E0B'},
                {f:'🇦🇺',c:'Australia',t:'GST',r:'10%',col:'#06B6D4'},
                {f:'🇸🇬',c:'Singapore',t:'GST',r:'9%',col:'#EF4444'},
                {f:'🇯🇵',c:'Japan',t:'Consumption Tax',r:'10%',col:'#8B5CF6'},
                {f:'🌐',c:'Others',t:'No tax',r:'0%',col:'#9CA3AF'},
              ].map(({f,c,t,r,col})=>(
                <div key={c} className="lp-taxcard">
                  <div className="lp-txflag">{f}</div>
                  <div className="lp-txcountry">{c}</div>
                  <div className="lp-txtype">{t}</div>
                  <div className="lp-txrate" style={{color:col}}>{r}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ RETRY ══ */}
        <section className="lp-retry" id="retry">
          <div className="lpw">
            <div className="lp-sh lp-sr" style={{marginBottom:0}}>
              <div className="lp-ey">🔄 Retry Schedule</div>
              <h2 style={{fontSize:'clamp(22px,2.5vw,34px)'}}>Failed payments retried <em>automatically</em></h2>
              <p>Three attempts on a fixed schedule. Auto-cancel after the third failure.</p>
            </div>
            <div className="lp-rtl lp-sr lp-d1">
              {[
                {d:'Day 0',l:'Payment Failed',s:'Invoice marked failed. Retry record created.',c:'#F05A5A'},
                {d:'Day 1',l:'Attempt 1',s:'POST /payment-retries/run processes due retries.',c:'#F59E0B'},
                {d:'Day 3',l:'Attempt 2',s:'Second retry if Attempt 1 failed.',c:'#F59E0B'},
                {d:'Day 7',l:'Attempt 3',s:'Final retry before auto-cancel.',c:'#F59E0B'},
                {d:'Day 7+',l:'Auto-Cancel',s:'Subscription status → cancelled.',c:'#F05A5A'},
              ].map(({d,l,s,c})=>(
                <div key={d} className="lp-rstep">
                  <div className="lp-rdot" style={{borderColor:c+'60',background:c+'14',color:c,boxShadow:`var(--lp-nm-sm), 0 0 12px ${c}30`}}>{d}</div>
                  <div className="lp-rl">{l}</div>
                  <div className="lp-rs">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ MODULES ══ */}
        <section className="lp-mods" id="modules">
          <div className="lpw">
            <div className="lp-sh lp-sr">
              <div className="lp-ey">📦 Modules</div>
              <h2>Six complete modules, <em>fully connected</em></h2>
            </div>
            <div className="lp-mgrid">
              {[
                {icon:'📊',name:'Admin Dashboard',desc:'Real-time KPIs from /dashboard/summary — MRR, Active Subs, Churn Rate, Trial Conversion. Revenue by Plan bar chart (Recharts). Subscription Status pie chart.',tag:'M3 Task 1'},
                {icon:'🧾',name:'Invoice Management',desc:'Full lifecycle: Draft → Unpaid → Paid / Failed / Refunded. Search by invoice number. Download PDF via FastAPI. Pay via UPI QR (vaultly@upi) from invoice detail.',tag:'M3 Task 2'},
                {icon:'⚠️',name:'Failed Payments & Refunds',desc:'Two-tab: Retry Queue (attempt count, scheduled date, run retries) + Refund History (amount, reason, refunded_at). Retry schedule Day 1→3→7. Auto-cancel on 3rd failure.',tag:'M3 Task 2'},
                {icon:'👤',name:'Customer Management',desc:'Add customers with country & currency (COUNTRY_CURRENCY_MAP for 30+ countries). Filter Active/Inactive. Click for billing timeline and subscription history.',tag:'M3 Task 3'},
                {icon:'🔍',name:'Audit Log Viewer',desc:'60 log entries across Subscription, Customer, Invoice, Payment, Plan, User. Filter by entity type, action (created/updated/canceled/refunded/exported), and date range.',tag:'M3 Task 3'},
                {icon:'📋',name:'Plans & Subscriptions',desc:'CRUD for plans (Starter $29 · Growth $79 · Scale $199 · Enterprise $499). Assign customers to plans. Track status: Active · Trial · Past Due · Cancelled.',tag:'M1 & M2'},
              ].map(({icon,name,desc,tag},i)=>(
                <div key={name} className={`lp-mcard lp-sr ${i%3===1?'lp-d1':i%3===2?'lp-d2':''}`}>
                  <div className="lp-mico">{icon}</div>
                  <h4>{name}</h4>
                  <p>{desc}</p>
                  <span className="lp-mtag">{tag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PLANS ══ */}
        <section className="lp-plans" id="plans">
          <div className="lpw">
            <div className="lp-sh lp-sr">
              <div className="lp-ey">💳 Subscription Plans</div>
              <h2>Four real plans, <em>live in the platform</em></h2>
              <p>Actual plans stored in the database — Starter, Growth, Scale, Enterprise. Prices in USD.</p>
            </div>
            <div className="lp-pgrid">
              {[
                {name:'Starter',price:'$29',cycle:'/month',desc:'For individuals and small teams.',subs:'184 subscribers',feats:['Up to 500 customers','Basic analytics','Email support','2 team seats','Monthly billing'],col:'var(--lp-mint)'},
                {name:'Growth',price:'$79',cycle:'/month',desc:'For growing teams that need more.',subs:'312 subscribers',feats:['Up to 5,000 customers','Advanced analytics','Priority support','10 team seats','Webhooks'],featured:true,badge:'Most Popular',col:'var(--lp-gold3)'},
                {name:'Scale',price:'$199',cycle:'/month',desc:'For high-volume businesses.',subs:'96 subscribers',feats:['Unlimited customers','Custom reporting','Success manager','Unlimited seats','SSO & audit logs'],col:'var(--lp-sky)'},
                {name:'Enterprise',price:'$499',cycle:'/month',desc:'Custom contracts & on-prem options.',subs:'21 subscribers',feats:['Custom contracts','On-prem options','SLA guarantees','White-glove onboarding','Dedicated support'],col:'var(--lp-violet)'},
              ].map(({name,price,cycle,desc,subs,feats,featured,badge,col})=>(
                <div key={name} className={`lp-pcard lp-plan-card lp-sr ${featured?'lp-feat':''}`}>
                  {badge && <div className="lp-pbadge">{badge}</div>}
                  <div className="lp-pname">{name}</div>
                  <div className="lp-pprice" style={{color:col}}>{price}<span>{cycle}</span></div>
                  <div className="lp-pdesc">{desc}</div>
                  <div className="lp-psubs" style={{color:col}}>{subs}</div>
                  <ul className="lp-pf">
                    {feats.map(f=>(<li key={f}><span className="lp-ck">✓</span>{f}</li>))}
                  </ul>
                  <a className={`lpbtn ${featured?'lpbtn-primary':'lpbtn-ghost'}`} href="/signin" onClick={go}
                    style={{width:'100%',justifyContent:'center',marginTop:20}}>{featured?'Get started →':'Try now'}</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TECH STACK ══ */}
        <section className="lp-tech" id="stack">
          <div className="lpw">
            <div className="lp-sh lp-sr" style={{marginBottom:0}}>
              <div className="lp-ey">🛠 Tech Stack</div>
              <h2 style={{fontSize:'clamp(22px,2.5vw,34px)'}}>Built with <em>modern, production-grade tools</em></h2>
            </div>
            <div className="lp-trow lp-sr lp-d1">
              {[
                {dot:'#61DAFB',n:'React 18 + Vite'},{dot:'#D4A800',n:'CSS Modules (Neumorphic)'},
                {dot:'#38B2AC',n:'FastAPI (Python 3.11)'},{dot:'#EF4444',n:'SQLAlchemy ORM'},
                {dot:'#336791',n:'PostgreSQL (resume_db)'},{dot:'#34D399',n:'Alembic Migrations'},
                {dot:'#7C3AED',n:'Recharts (Charts)'},{dot:'#F97316',n:'JWT Authentication'},
                {dot:'#C084FC',n:'PWA (Vite Plugin)'},{dot:'#06B6D4',n:'UPI QR (qrserver API)'},
                {dot:'#F59E0B',n:'Axios (HTTP client)'},{dot:'#60A5FA',n:'React Router v6'},
              ].map(({dot,n})=>(
                <div key={n} className="lp-tpill"><div className="lp-tdot" style={{background:dot}}/>{n}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section className="lp-cta">
          <div className="lpw" style={{position:'relative',zIndex:1}}>
            <div className="lp-cta-blob"/>
            <div className="lp-ey" style={{margin:'0 auto 20px'}}>🚀 Ready to explore</div>
            <h2>Your complete billing platform<br/><em>is live and ready.</em></h2>
            <p>Sign in as Admin (<span className="lp-code">admin@vaultly.io</span>) to explore the full dashboard.</p>
            <div className="lp-cta-acts">
              <a className="lpbtn lpbtn-primary lpbtn-lg" href="/signin" onClick={go}>Open Dashboard →</a>
              <a className="lpbtn lpbtn-ghost lpbtn-lg" href="/signup" onClick={goUp}>Create account</a>
            </div>
            <div className="lp-ctrust">
              <div className="lp-ct">UPI QR Payments (vaultly@upi)</div>
              <div className="lp-ct">Auto Tax Engine (10 countries)</div>
              <div className="lp-ct">PWA Installable</div>
              <div className="lp-ct">Full Audit Trail (60+ logs)</div>
              <div className="lp-ct">Retry Queue Day 1→3→7</div>
            </div>
          </div>
        </section>

        {/* ══ FOOTER ══ */}
        <footer className="lp-footer">
          <div className="lpw">
            <div className="lp-fgrid">
              <div>
                <div className="lp-brand">
                  <div className="lp-brand-icon"><svg viewBox="0 0 20 20" fill="none"><path d="M10 2L13.5 8.5H18L13.5 13L15.5 19L10 15.5L4.5 19L6.5 13L2 8.5H6.5L10 2Z" fill="white" opacity=".95"/></svg></div>
                  <span className="lp-brand-name">Vaultly</span>
                </div>
                <p className="lp-fdesc">SaaS subscription billing & payment management platform. Built for Infosys VRI 7.0 — M1, M2, M3 complete.</p>
              </div>
              <div className="lp-fcol">
                <h5>Modules</h5>
                <a href="#features">Dashboard</a><a href="#features">Invoices</a>
                <a href="#features">Payments</a><a href="#features">Customers</a>
                <a href="#features">Audit Logs</a><a href="#features">Plans</a>
              </div>
              <div className="lp-fcol">
                <h5>Features</h5>
                <a href="#features">UPI QR Payments</a><a href="#tax">Auto Tax Engine</a>
                <a href="#retry">Retry Queue</a><a href="#features">Billing Timeline</a>
                <a href="#features">PDF Invoices</a>
              </div>
              <div className="lp-fcol">
                <h5>API Endpoints</h5>
                <a href="#stack">/dashboard/summary</a><a href="#stack">/payments/process</a>
                <a href="#stack">/payment-retries/run</a><a href="#stack">/invoices/id/pdf</a>
                <a href="#stack">/refunds</a><a href="#stack">/audit-logs/</a>
              </div>
            </div>
            <div className="lp-fbot">
              <span>© 2026 Vaultly · Backend: FastAPI + PostgreSQL · Frontend: React + Vite</span>
              <span className="lp-ibadge">Infosys Virtual Internship 7.0 · M3 Complete · All Tasks ✓</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
