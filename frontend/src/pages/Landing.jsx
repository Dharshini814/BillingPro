import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  const goSignIn = (e) => { e.preventDefault(); navigate('/signin') }

  useEffect(() => {
    // CURSOR
    const cur = document.getElementById('vl-cursor')
    const onMouseMove = (e) => {
      cur.style.left = e.clientX + 'px'
      cur.style.top = e.clientY + 'px'
    }
    document.addEventListener('mousemove', onMouseMove)
    const hoverEls = document.querySelectorAll('a,.vl-plan-card,.vl-bc,.vl-testi-card')
    hoverEls.forEach(el => {
      el.addEventListener('mouseenter', () => cur.classList.add('big'))
      el.addEventListener('mouseleave', () => cur.classList.remove('big'))
    })

    // CANVAS PARTICLE GRID
    const canvas = document.getElementById('vl-bgCanvas')
    const ctx = canvas.getContext('2d')
    let W, H, dots = [], animId
    function resizeCanvas() {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
      dots = []
      const sp = 54
      for (let x = 0; x < W; x += sp)
        for (let y = 0; y < H; y += sp)
          dots.push({ x, y, bx: x, by: y, vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2 })
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    let mx = 0, my = 0
    const onMove = (e) => { mx = e.clientX; my = e.clientY }
    window.addEventListener('mousemove', onMove)
    function drawCanvas() {
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        d.x += d.vx; d.y += d.vy
        if (Math.abs(d.x - d.bx) > 8) d.vx *= -1
        if (Math.abs(d.y - d.by) > 8) d.vy *= -1
        const dist = Math.hypot(d.x - mx, d.y - my)
        const r = Math.max(0, 1 - dist / 260)
        ctx.beginPath(); ctx.arc(d.x, d.y, 1 + r * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(63,116,255,${0.08 + r * .4})`; ctx.fill()
        for (let j = i + 1; j < dots.length; j++) {
          const d2 = dots[j]
          const dx = d.x - d2.x, dy = d.y - d2.y
          const dd = Math.sqrt(dx * dx + dy * dy)
          if (dd < 68) {
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d2.x, d2.y)
            ctx.strokeStyle = `rgba(63,116,255,${(1 - dd / 68) * .09})`; ctx.lineWidth = .6; ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(drawCanvas)
    }
    drawCanvas()

    // HERO COUNTERS
    let mrrV = 0; const mrrT = 84250; const mrrEl = document.getElementById('vl-heroMrr')
    const mrrS = () => { mrrV += mrrT / 80; if (mrrV >= mrrT) { mrrEl.textContent = '₹' + mrrT.toLocaleString('en-IN'); return; } mrrEl.textContent = '₹' + Math.floor(mrrV).toLocaleString('en-IN'); requestAnimationFrame(mrrS) }
    requestAnimationFrame(mrrS)
    let subV = 0; const subT = 1243; const subEl = document.getElementById('vl-heroSubs')
    const subS = () => { subV += subT / 80; if (subV >= subT) { subEl.textContent = subT.toLocaleString('en-IN'); return; } subEl.textContent = Math.floor(subV).toLocaleString('en-IN'); requestAnimationFrame(subS) }
    requestAnimationFrame(subS)

    // SPARKLINE
    const pts = [14, 22, 18, 30, 26, 38, 34, 45].map((v, i) => [i * (400 / 7), 56 - (v / 45) * 50])
    let d2 = `M ${pts[0][0]} ${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) { const cx = (pts[i - 1][0] + pts[i][0]) / 2; d2 += ` C ${cx} ${pts[i - 1][1]}, ${cx} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}` }
    d2 += ` L ${pts[pts.length - 1][0]} 56 L 0 56 Z`
    document.getElementById('vl-chartPath').setAttribute('d', d2)

    // STATS COUNT-UP
    const statEls = document.querySelectorAll('.vl-stat-value')
    const statIo = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return
        const el = en.target, to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || 0), suf = el.dataset.suf || ''
        let v = 0; const s = () => { v += to / 50; if (v >= to) { el.textContent = to.toFixed(dec) + suf; return; } el.textContent = v.toFixed(dec) + suf; requestAnimationFrame(s) }; requestAnimationFrame(s)
        statIo.unobserve(el)
      })
    }, { threshold: .6 })
    statEls.forEach(e => statIo.observe(e))

    // SCROLL REVEAL
    const revIo = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('in-view') })
    }, { threshold: .1 })
    document.querySelectorAll('.vl-reveal,.vl-bc,.vl-plan-card,.vl-testi-card').forEach(e => revIo.observe(e))

    // HUB PANEL
    const hubPanel = document.getElementById('vl-hubPanel')
    if (hubPanel) {
      const hubIo = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { hubPanel.classList.add('active'); hubIo.unobserve(hubPanel) } })
      }, { threshold: .4 })
      hubIo.observe(hubPanel)
    }

    // PLAN ITEM CYCLE
    const planItems = document.querySelectorAll('#vl-planItems .vl-plan-item')
    let idx = 0
    const planInterval = setInterval(() => {
      planItems.forEach(i => i.classList.remove('ap'))
      planItems[idx % planItems.length].classList.add('ap'); idx++
    }, 1800)

    // MAGNETIC PRICING CARDS
    document.querySelectorAll('.vl-plan-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left - r.width / 2) / r.width
        const y = (e.clientY - r.top - r.height / 2) / r.height
        card.style.transform = `translateY(-10px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`
      })
      card.addEventListener('mouseleave', () => card.style.transform = '')
    })

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animId)
      clearInterval(planInterval)
      statIo.disconnect()
      revIo.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        .vl-root *{box-sizing:border-box}
        .vl-root{--ink:#EAF0F8;--ink-2:#DEE6F2;--surface:#F2F6FB;--surface-2:#E9EFF8;--border:rgba(30,42,68,0.08);--border-bright:rgba(63,116,255,0.4);--gold:#3F74FF;--gold-light:#2FB6D9;--gold-dim:rgba(63,116,255,0.10);--mint:#17A788;--mint-dim:rgba(23,167,136,0.12);--red:#EE4F5B;--red-dim:rgba(238,79,91,0.12);--sky:#7C6CFF;--paper:#1C2740;--slate:#66738A;--slate-light:#8B96AA;--r:18px;--shadow-out:8px 8px 18px rgba(163,177,198,0.5),-8px -8px 18px rgba(255,255,255,0.85);--shadow-out-sm:5px 5px 10px rgba(163,177,198,0.45),-5px -5px 10px rgba(255,255,255,0.85);--shadow-in:inset 4px 4px 8px rgba(163,177,198,0.45),inset -4px -4px 8px rgba(255,255,255,0.8)}
        .vl-root{background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(63,116,255,0.08),transparent),linear-gradient(160deg,var(--ink),var(--ink-2) 60%,var(--ink));color:var(--paper);font-family:'Inter',sans-serif;overflow-x:hidden;line-height:1.6;min-height:100vh;margin:0;padding:0}
        .vl-root h1,.vl-root h2,.vl-root h3,.vl-root h4{font-family:'Space Grotesk',sans-serif;letter-spacing:-0.02em;margin:0}
        .vl-root a{color:inherit;text-decoration:none}
        .vl-root p{margin:0}
        .vl-mono{font-family:'JetBrains Mono',monospace}
        #vl-cursor{position:fixed;width:18px;height:18px;border-radius:50%;background:var(--gold);opacity:0.45;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);transition:width .25s,height .25s,opacity .25s;mix-blend-mode:multiply}
        #vl-cursor.big{width:56px;height:56px;opacity:0.1}
        #vl-bgCanvas{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.5}
        .vl-wrap{max-width:1160px;margin:0 auto;padding:0 28px}
        /* NAV */
        .vl-nav{position:sticky;top:0;z-index:100;backdrop-filter:blur(20px) saturate(1.6);background:rgba(234,240,248,0.7);border-bottom:1px solid var(--border)}
        .vl-nav .vl-wrap{display:flex;align-items:center;justify-content:space-between;height:68px}
        .vl-logo{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;color:var(--paper)}
        .vl-logo-icon{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--gold),var(--gold-light));display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:var(--shadow-out-sm)}
        .vl-navlinks{display:flex;gap:32px;font-size:14px;color:var(--slate)}
        .vl-navlinks a{transition:color .2s;position:relative}
        .vl-navlinks a::after{content:'';position:absolute;bottom:-4px;left:0;width:0;height:1px;background:var(--gold);transition:width .3s}
        .vl-navlinks a:hover{color:var(--paper)}
        .vl-navlinks a:hover::after{width:100%}
        .vl-navcta{display:flex;gap:12px;align-items:center}
        /* BUTTONS */
        .vl-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 20px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Space Grotesk',sans-serif;cursor:pointer;border:none;transition:all .3s cubic-bezier(.2,.8,.2,1)}
        .vl-btn-primary{background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#fff;box-shadow:0 8px 20px rgba(63,116,255,0.35)}
        .vl-btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(63,116,255,0.5)}
        .vl-btn-ghost{background:var(--surface);border:1px solid var(--border);color:var(--paper);box-shadow:var(--shadow-out-sm)}
        .vl-btn-ghost:hover{border-color:var(--border-bright);color:var(--gold)}
        /* HERO */
        .vl-hero{position:relative;z-index:1;padding:100px 0 40px}
        .vl-hero-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--gold);letter-spacing:.07em;text-transform:uppercase;background:var(--surface);box-shadow:var(--shadow-out-sm);border:1px solid var(--border);padding:6px 14px;border-radius:999px;margin-bottom:24px;opacity:0;animation:vl-rise .8s ease .1s forwards}
        .vl-pulse{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 rgba(23,167,136,0.6);animation:vl-pulseAnim 2s infinite}
        @keyframes vl-pulseAnim{0%{box-shadow:0 0 0 0 rgba(23,167,136,0.6)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
        .vl-hero-top{display:grid;grid-template-columns:1fr 500px;gap:48px;align-items:center}
        .vl-hero h1{font-size:clamp(36px,4.8vw,60px);font-weight:800;line-height:1.04;opacity:0;animation:vl-rise .9s ease .2s forwards;color:var(--paper)}
        .vl-hero h1 .vl-hi{background:linear-gradient(135deg,var(--gold),var(--gold-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .vl-hero-sub{font-size:17px;color:var(--slate-light);margin-top:20px;max-width:480px;opacity:0;animation:vl-rise .9s ease .35s forwards;line-height:1.7}
        .vl-hero-actions{display:flex;gap:14px;margin-top:32px;opacity:0;animation:vl-rise .9s ease .5s forwards;flex-wrap:wrap}
        .vl-hero-trust{display:flex;gap:20px;align-items:center;margin-top:28px;opacity:0;animation:vl-rise .9s ease .65s forwards}
        .vl-trust-item{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--slate)}
        .vl-trust-item .vl-chk{color:var(--mint);font-weight:700}
        @keyframes vl-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        /* DASHBOARD MOCKUP */
        .vl-dashboard-mockup{background:var(--surface);border:1px solid var(--border);border-radius:22px;overflow:hidden;box-shadow:var(--shadow-out),0 40px 80px rgba(30,42,68,0.12);opacity:0;animation:vl-rise .9s ease .4s forwards}
        .vl-db-topbar{background:var(--surface-2);padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
        .vl-db-dots{display:flex;gap:6px}
        .vl-db-dot{width:10px;height:10px;border-radius:50%}
        .vl-db-title{font-size:12px;color:var(--slate);flex:1;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:500}
        .vl-db-body{padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .vl-db-card{background:var(--ink);border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow-in)}
        .vl-db-card-label{font-size:10px;color:var(--slate);text-transform:uppercase;letter-spacing:.06em}
        .vl-db-card-value{font-size:18px;font-weight:600;font-family:'JetBrains Mono',monospace;margin-top:4px;color:var(--paper)}
        .vl-db-card-change{font-size:11px;margin-top:3px}
        .vl-db-wide{grid-column:1/-1}
        .vl-db-chart{height:56px;position:relative;overflow:hidden;margin-top:8px}
        .vl-db-chart svg{width:100%;height:100%}
        .vl-db-sub-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11.5px;color:var(--paper)}
        .vl-db-sub-row:last-child{border-bottom:none}
        .vl-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}
        .vl-chip-mint{background:var(--mint-dim);color:var(--mint)}
        .vl-chip-gold{background:var(--gold-dim);color:var(--gold)}
        .vl-chip-red{background:var(--red-dim);color:var(--red)}
        /* STATSBAND */
        .vl-statsband{position:relative;z-index:1;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:rgba(242,246,251,0.6);backdrop-filter:blur(8px);padding:52px 0}
        .vl-statsband .vl-wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;text-align:center}
        .vl-stat-value{font-size:clamp(28px,3vw,40px);font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--gold);line-height:1}
        .vl-stat-bar{height:2px;width:40px;background:linear-gradient(90deg,var(--gold),transparent);margin:8px auto 8px;border-radius:1px}
        .vl-stat-desc{font-size:13px;color:var(--slate)}
        /* SECTION TITLE */
        .vl-st{text-align:center;max-width:600px;margin:0 auto 70px}
        .vl-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--gold);letter-spacing:.09em;text-transform:uppercase;font-weight:600;background:var(--gold-dim);border:1px solid var(--border-bright);padding:5px 14px;border-radius:999px;margin-bottom:18px}
        .vl-st h2{font-size:clamp(26px,3.2vw,40px);font-weight:700;line-height:1.1;color:var(--paper)}
        .vl-st h2 em{font-style:normal;color:var(--gold)}
        .vl-st p{color:var(--slate-light);margin-top:14px;font-size:15.5px}
        /* BENTO */
        .vl-bento{position:relative;z-index:1;padding:110px 0}
        .vl-bento-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
        .vl-bc{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;overflow:hidden;position:relative;transition:border-color .3s,transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s;opacity:0;transform:translateY(28px);box-shadow:var(--shadow-out)}
        .vl-bc.in-view{opacity:1;transform:translateY(0)}
        .vl-bc::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(63,116,255,0.4),transparent);opacity:0;transition:opacity .4s}
        .vl-bc:hover{border-color:var(--border-bright);transform:translateY(-4px);box-shadow:0 20px 40px rgba(30,42,68,0.14),var(--shadow-out)}
        .vl-bc:hover::before{opacity:1}
        .vl-s4{grid-column:span 4}.vl-s5{grid-column:span 5}.vl-s7{grid-column:span 7}.vl-s8{grid-column:span 8}.vl-s12{grid-column:span 12}
        .vl-bc-tag{font-size:10.5px;color:var(--gold);letter-spacing:.08em;text-transform:uppercase;font-weight:600;margin-bottom:12px;opacity:.9}
        .vl-bc h3{font-size:19px;font-weight:700;margin-bottom:8px;line-height:1.25;color:var(--paper)}
        .vl-bc p{font-size:14px;color:var(--slate-light);line-height:1.65}
        .vl-bc-icon{width:40px;height:40px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:16px;box-shadow:var(--shadow-out-sm)}
        .vl-plan-item{display:flex;align-items:center;justify-content:space-between;background:var(--ink);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;margin-top:8px;transition:background .3s,border-color .3s;color:var(--paper)}
        .vl-plan-item.ap{background:var(--gold-dim);border-color:var(--border-bright)}
        .vl-meter-vis{margin-top:18px}
        .vl-meter-label{display:flex;justify-content:space-between;font-size:12px;color:var(--slate);margin-bottom:6px}
        .vl-meter-track{height:10px;background:var(--ink);box-shadow:var(--shadow-in);border-radius:5px;overflow:hidden;margin-bottom:12px}
        .vl-meter-fill{height:100%;border-radius:5px;width:0;transition:width 1.4s cubic-bezier(.2,.8,.2,1)}
        .vl-mf-gold{background:linear-gradient(90deg,var(--gold),var(--gold-light))}
        .vl-mf-mint{background:linear-gradient(90deg,#0f8a70,var(--mint))}
        .vl-mf-sky{background:linear-gradient(90deg,#5b4bdb,var(--sky))}
        .in-view .vl-meter-fill{width:var(--w)}
        .vl-invoice-vis{margin-top:16px;background:var(--ink);border:1px solid var(--border);border-radius:12px;overflow:hidden}
        .vl-inv-header{background:var(--gold-dim);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);font-size:12px}
        .vl-inv-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:12.5px;border-bottom:1px solid var(--border);color:var(--paper)}
        .vl-inv-row:last-child{border-bottom:none;font-weight:600;color:var(--gold)}
        /* GLOBE */
        .vl-globe-vis{position:relative;height:160px;margin-top:16px;display:flex;align-items:center;justify-content:center}
        .vl-globe-ring{position:absolute;border-radius:50%;border:1px solid rgba(63,116,255,0.2);animation:vl-spinR 20s linear infinite}
        .vl-globe-ring:nth-child(1){width:140px;height:140px}
        .vl-globe-ring:nth-child(2){width:110px;height:40px;animation-duration:14s;animation-direction:reverse;border-color:rgba(23,167,136,0.25)}
        .vl-globe-ring:nth-child(3){width:80px;height:80px;animation-duration:8s}
        .vl-locale-dot{position:absolute;width:26px;height:26px;background:var(--surface);box-shadow:var(--shadow-out-sm);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px}
        @keyframes vl-spinR{to{transform:rotate(360deg)}}
        .vl-rec-row{display:flex;align-items:center;gap:8px;font-size:12.5px;margin-bottom:8px;color:var(--paper)}
        .vl-rec-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
        .vl-rec-bar{flex:1;height:6px;background:var(--ink);box-shadow:var(--shadow-in);border-radius:3px;overflow:hidden}
        .vl-rec-fill{height:100%;border-radius:3px}
        .vl-rec-pct{font-size:11px;color:var(--slate);min-width:28px;text-align:right}
        /* FLOW */
        .vl-flow-section{position:relative;z-index:1;padding:100px 0;overflow:hidden}
        .vl-flow-section .vl-wrap{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
        .vl-flow-left h2{font-size:clamp(26px,2.8vw,36px);font-weight:700;line-height:1.15;color:var(--paper)}
        .vl-flow-left p{color:var(--slate-light);margin-top:16px;font-size:15px;line-height:1.7}
        .vl-flow-step{display:flex;gap:16px;padding:18px 0;position:relative}
        .vl-flow-step:not(:last-child)::after{content:'';position:absolute;left:16px;top:52px;bottom:0;width:1px;background:linear-gradient(to bottom,var(--border-bright),transparent)}
        .vl-flow-num{width:34px;height:34px;border-radius:10px;background:var(--surface);box-shadow:var(--shadow-out-sm);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--gold);flex-shrink:0;font-family:'JetBrains Mono',monospace}
        .vl-flow-text h4{font-size:15px;font-weight:600;margin-bottom:3px;color:var(--paper)}
        .vl-flow-text p{font-size:13.5px;color:var(--slate)}
        /* HUB */
        .vl-hub-panel{background:var(--surface);border:1px solid var(--border);border-radius:20px;box-shadow:var(--shadow-out);padding:24px 18px 8px;overflow:hidden}
        .vl-hub-illustration{position:relative;width:100%;height:380px}
        .vl-hub-illustration svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .vl-hub-line{fill:none;stroke:var(--border-bright);stroke-width:2;stroke-dasharray:6 6;stroke-dashoffset:300;transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)}
        .vl-hub-panel.active .vl-hub-line{stroke-dashoffset:0}
        .vl-hub-line:nth-of-type(1){transition-delay:.1s}
        .vl-hub-line:nth-of-type(2){transition-delay:.35s}
        .vl-hub-line:nth-of-type(3){transition-delay:.6s}
        .vl-hub-line:nth-of-type(4){transition-delay:.85s}
        .vl-hub-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);width:88px;height:88px;border-radius:24px;background:linear-gradient(135deg,var(--gold),var(--gold-light));box-shadow:0 12px 30px rgba(63,116,255,0.4);display:flex;align-items:center;justify-content:center;font-size:34px;transition:transform .6s cubic-bezier(.34,1.56,.64,1)}
        .vl-hub-panel.active .vl-hub-core{transform:translate(-50%,-50%) scale(1)}
        .vl-hub-core::after{content:'';position:absolute;inset:-10px;border-radius:30px;border:1px solid var(--border-bright);opacity:0}
        .vl-hub-panel.active .vl-hub-core::after{animation:vl-hubPulse 2.4s ease-out .8s infinite}
        @keyframes vl-hubPulse{0%{opacity:.6;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}
        .vl-hub-node{position:absolute;width:132px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-out-sm);border-radius:14px;padding:12px;opacity:0;transform:scale(.7) translateY(10px);transition:opacity .5s ease,transform .5s cubic-bezier(.34,1.56,.64,1)}
        .vl-hub-panel.active .vl-hub-node{opacity:1;transform:scale(1) translateY(0)}
        .vl-hub-node:nth-of-type(1){transition-delay:.45s}
        .vl-hub-node:nth-of-type(2){transition-delay:.7s}
        .vl-hub-node:nth-of-type(3){transition-delay:.95s}
        .vl-hub-node:nth-of-type(4){transition-delay:1.2s}
        .vl-hub-node-icon{width:30px;height:30px;border-radius:9px;background:var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:8px}
        .vl-hub-node-label{font-size:12.5px;font-weight:600;color:var(--paper)}
        .vl-hub-node-sub{font-size:11px;color:var(--slate);margin-top:2px}
        .vl-hub-caption{text-align:center;font-size:12.5px;color:var(--slate);padding:14px 0 6px;border-top:1px solid var(--border);margin-top:6px}
        /* PRICING */
        .vl-pricing{position:relative;z-index:1;padding:110px 0;background:linear-gradient(to bottom,var(--ink),var(--ink-2),var(--ink))}
        .vl-pricing::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 50%,rgba(63,116,255,0.05),transparent);pointer-events:none}
        .vl-plans-wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:50px;position:relative;z-index:1}
        .vl-plan-card{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:32px 28px;position:relative;overflow:hidden;transition:transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s,border-color .4s;display:flex;flex-direction:column;box-shadow:var(--shadow-out)}
        .vl-plan-card:hover{box-shadow:0 24px 48px rgba(30,42,68,0.16),var(--shadow-out)}
        .vl-plan-card.featured{border-color:var(--border-bright);background:linear-gradient(135deg,rgba(63,116,255,0.06),var(--surface))}
        .vl-plan-badge{position:absolute;top:20px;right:20px;background:linear-gradient(135deg,var(--gold),var(--gold-light));color:#fff;font-size:10.5px;font-weight:700;padding:4px 12px;border-radius:999px;font-family:'Space Grotesk',sans-serif}
        .vl-plan-name{font-size:12px;color:var(--slate);text-transform:uppercase;letter-spacing:.09em;font-weight:600}
        .vl-plan-price-wrap{margin:14px 0 6px;display:flex;align-items:flex-end;gap:4px}
        .vl-plan-price{font-size:38px;font-weight:700;font-family:'JetBrains Mono',monospace;line-height:1;color:var(--paper)}
        .vl-plan-per{font-size:13px;color:var(--slate);margin-bottom:5px}
        .vl-plan-desc{font-size:13.5px;color:var(--slate-light);margin-bottom:22px;min-height:38px}
        .vl-plan-divider{height:1px;background:var(--border);margin-bottom:20px}
        .vl-plan-feature{display:flex;gap:10px;font-size:14px;color:var(--slate-light);margin-bottom:12px;align-items:flex-start;line-height:1.4}
        .vl-pf-check{color:var(--mint);font-size:13px;margin-top:1px;flex-shrink:0}
        .vl-plan-cta{margin-top:auto;padding-top:22px}
        .vl-plan-cta .vl-btn{width:100%;justify-content:center}
        /* INTEGRATIONS */
        .vl-integrations{position:relative;z-index:1;padding:80px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
        .vl-logos-scroll{overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,black 10%,black 90%,transparent);mask:linear-gradient(90deg,transparent,black 10%,black 90%,transparent);margin-top:36px}
        .vl-logos-track{display:flex;gap:24px;animation:vl-marquee 22s linear infinite;width:max-content}
        .vl-logos-track:hover{animation-play-state:paused}
        @keyframes vl-marquee{to{transform:translateX(-50%)}}
        .vl-logo-chip{background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-out-sm);border-radius:12px;padding:12px 22px;font-size:13.5px;font-weight:600;color:var(--slate-light);white-space:nowrap;transition:border-color .3s,color .3s}
        .vl-logo-chip:hover{border-color:var(--border-bright);color:var(--gold)}
        /* TESTIMONIALS */
        .vl-testimonials{position:relative;z-index:1;padding:100px 0}
        .vl-testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:50px}
        .vl-testi-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;transition:transform .3s,border-color .3s;box-shadow:var(--shadow-out);opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .vl-testi-card.in-view{opacity:1;transform:translateY(0)}
        .vl-testi-card:hover{transform:translateY(-4px);border-color:var(--border-bright)}
        .vl-testi-stars{color:var(--gold);font-size:13px;margin-bottom:14px;letter-spacing:2px}
        .vl-testi-quote{font-size:14.5px;color:var(--slate-light);line-height:1.7;margin-bottom:20px}
        .vl-testi-author{display:flex;align-items:center;gap:12px}
        .vl-testi-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold-dim),var(--mint-dim));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--gold);border:1px solid var(--border-bright)}
        .vl-testi-name{font-size:14px;font-weight:600;color:var(--paper)}
        .vl-testi-role{font-size:12px;color:var(--slate)}
        /* CTA FINAL */
        .vl-cta-final{position:relative;z-index:1;padding:110px 0;text-align:center;overflow:hidden}
        .vl-cta-final::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:300px;background:radial-gradient(ellipse,rgba(63,116,255,0.1),transparent 70%);pointer-events:none}
        .vl-cta-final h2{font-size:clamp(28px,4vw,50px);font-weight:800;line-height:1.08;max-width:700px;margin:0 auto;color:var(--paper)}
        .vl-cta-final p{color:var(--slate-light);margin-top:18px;font-size:16px}
        .vl-cta-actions{display:flex;gap:16px;justify-content:center;margin-top:36px;flex-wrap:wrap}
        .vl-cta-trust{display:flex;gap:28px;justify-content:center;margin-top:24px;flex-wrap:wrap}
        .vl-ct-item{font-size:13px;color:var(--slate);display:flex;align-items:center;gap:6px}
        .vl-ct-item::before{content:'✓';color:var(--mint);font-weight:700}
        /* FOOTER */
        .vl-footer{position:relative;z-index:1;border-top:1px solid var(--border);padding:52px 0 28px}
        .vl-footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
        .vl-footer-brand .vl-logo{margin-bottom:14px}
        .vl-footer-brand p{font-size:13.5px;color:var(--slate);max-width:260px;line-height:1.65}
        .vl-footer-col h5{font-size:12px;color:var(--paper);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:14px}
        .vl-footer-col a{display:block;font-size:13.5px;color:var(--slate);margin-bottom:9px;transition:color .2s}
        .vl-footer-col a:hover{color:var(--gold)}
        .vl-footer-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:40px;padding-top:20px;border-top:1px solid var(--border);font-size:12.5px;color:var(--slate)}
        /* REVEAL */
        .vl-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .vl-reveal.in-view{opacity:1;transform:translateY(0)}
        /* RESPONSIVE */
        @media(max-width:1024px){
          .vl-hero-top{grid-template-columns:1fr}
          .vl-bento-grid{grid-template-columns:1fr 1fr}
          .vl-s4,.vl-s5,.vl-s7,.vl-s8{grid-column:span 1}.vl-s12{grid-column:span 2}
          .vl-testi-grid{grid-template-columns:1fr 1fr}
          .vl-footer-grid{grid-template-columns:1fr 1fr}
        }
        @media(max-width:720px){
          .vl-navlinks{display:none}
          .vl-plans-wrap,.vl-testi-grid,.vl-bento-grid{grid-template-columns:1fr}
          .vl-s4,.vl-s5,.vl-s7,.vl-s8,.vl-s12{grid-column:span 1}
          .vl-flow-section .vl-wrap{grid-template-columns:1fr}
          .vl-statsband .vl-wrap{grid-template-columns:1fr 1fr}
          .vl-footer-grid{grid-template-columns:1fr}
        }
      `}</style>

      <div className="vl-root">
        <div id="vl-cursor"></div>
        <canvas id="vl-bgCanvas"></canvas>

        {/* NAV */}
        <nav className="vl-nav">
          <div className="vl-wrap">
            <div className="vl-logo"><div className="vl-logo-icon">🔐</div>Vaultly</div>
            <div className="vl-navlinks">
              <a href="#vl-features">Features</a>
              <a href="#vl-flow">How it works</a>
              <a href="#vl-pricing">Pricing</a>
              <a href="#vl-features">Docs</a>
              <a href="#vl-features">Blog</a>
            </div>
            <div className="vl-navcta">
              <a className="vl-btn vl-btn-ghost" href="/signin" onClick={goSignIn}>Sign in</a>
              <a className="vl-btn vl-btn-primary" href="/signin" onClick={goSignIn}>Start free trial →</a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="vl-hero">
          <div className="vl-wrap">
            <div className="vl-hero-top">
              <div>
                <div className="vl-hero-badge"><span className="vl-pulse"></span>New — Usage-based billing is live</div>
                <h1>Subscription billing<br />that <span className="vl-hi">scales on its own.</span></h1>
                <p className="vl-hero-sub">Vaultly automates every step of the billing lifecycle — from plan configuration to dunning recovery — so your team ships features, not invoices.</p>
                <div className="vl-hero-actions">
                  <a className="vl-btn vl-btn-primary" href="/signin" onClick={goSignIn}>Start free — no card needed →</a>
                  <a className="vl-btn vl-btn-ghost" href="/signin" onClick={goSignIn}>Watch demo ▷</a>
                </div>
                <div className="vl-hero-trust">
                  <div className="vl-trust-item"><span className="vl-chk">✓</span> SOC 2 compliant</div>
                  <div className="vl-trust-item"><span className="vl-chk">✓</span> GDPR ready</div>
                  <div className="vl-trust-item"><span className="vl-chk">✓</span> 7 locales</div>
                </div>
              </div>
              <div className="vl-dashboard-mockup">
                <div className="vl-db-topbar">
                  <div className="vl-db-dots">
                    <div className="vl-db-dot" style={{background:'#FF5F57'}}></div>
                    <div className="vl-db-dot" style={{background:'#FEBC2E'}}></div>
                    <div className="vl-db-dot" style={{background:'#28C840'}}></div>
                  </div>
                  <div className="vl-db-title">Vaultly Dashboard — Growth Plan</div>
                </div>
                <div className="vl-db-body">
                  <div className="vl-db-card">
                    <div className="vl-db-card-label">MRR</div>
                    <div className="vl-db-card-value vl-mono" style={{color:'var(--gold)'}} id="vl-heroMrr">₹0</div>
                    <div className="vl-db-card-change" style={{color:'var(--mint)'}}>▲ 18.4% this month</div>
                  </div>
                  <div className="vl-db-card">
                    <div className="vl-db-card-label">Active subs</div>
                    <div className="vl-db-card-value vl-mono" id="vl-heroSubs">0</div>
                    <div className="vl-db-card-change" style={{color:'var(--mint)'}}>+34 this week</div>
                  </div>
                  <div className="vl-db-card vl-db-wide">
                    <div className="vl-db-card-label">Revenue · last 7 days</div>
                    <div className="vl-db-chart">
                      <svg id="vl-sparkSvg" viewBox="0 0 400 56" preserveAspectRatio="none">
                        <defs><linearGradient id="vl-cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3F74FF" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#3F74FF" stopOpacity="0"/>
                        </linearGradient></defs>
                        <path id="vl-chartPath" fill="url(#vl-cg)" stroke="var(--gold)" strokeWidth="2" d=""/>
                      </svg>
                    </div>
                  </div>
                  <div className="vl-db-card vl-db-wide">
                    <div className="vl-db-card-label">Recent subscriptions</div>
                    <div className="vl-db-sub-row"><span>Acme Corp — Growth</span><span className="vl-chip vl-chip-mint">Active</span></div>
                    <div className="vl-db-sub-row"><span>ByteWave — Starter</span><span className="vl-chip vl-chip-mint">Active</span></div>
                    <div className="vl-db-sub-row"><span>NexaLabs — Enterprise</span><span className="vl-chip vl-chip-gold">Trialing</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS BAND */}
        <div className="vl-statsband">
          <div className="vl-wrap">
            <div><div className="vl-stat-value" data-to="99.97" data-dec="2" data-suf="%">0</div><div className="vl-stat-bar"></div><div className="vl-stat-desc">Uptime SLA</div></div>
            <div><div className="vl-stat-value" data-to="7" data-suf=" locales">0</div><div className="vl-stat-bar" style={{background:'linear-gradient(90deg,var(--mint),transparent)'}}></div><div className="vl-stat-desc">Languages supported</div></div>
            <div><div className="vl-stat-value" data-to="4" data-suf="min avg">0</div><div className="vl-stat-bar" style={{background:'linear-gradient(90deg,var(--sky),transparent)'}}></div><div className="vl-stat-desc">Plan launch time</div></div>
            <div><div className="vl-stat-value" data-to="38" data-suf="% recovered">0</div><div className="vl-stat-bar" style={{background:'linear-gradient(90deg,var(--gold),transparent)'}}></div><div className="vl-stat-desc">Avg churn saved by dunning</div></div>
          </div>
        </div>

        {/* BENTO */}
        <section className="vl-bento" id="vl-features">
          <div className="vl-wrap">
            <div className="vl-st vl-reveal">
              <div className="vl-eyebrow">✦ Platform</div>
              <h2>Everything your billing stack<br /><em>actually needs</em></h2>
              <p>Built for SaaS teams who move fast. Configure, automate, and recover — all from one platform.</p>
            </div>
            <div className="vl-bento-grid">
              <div className="vl-bc vl-s5">
                <div className="vl-bc-tag">Plans & Pricing</div>
                <div className="vl-bc-icon">💳</div>
                <h3>Visual plan builder. No deploy required.</h3>
                <p>Create flat, tiered, seat-based or usage plans — then publish instantly.</p>
                <div id="vl-planItems">
                  <div className="vl-plan-item ap"><span>Growth · ₹2,499/mo</span><span className="vl-chip vl-chip-mint">Live</span></div>
                  <div className="vl-plan-item"><span>Starter · ₹0/mo</span><span className="vl-chip vl-chip-gold">Draft</span></div>
                  <div className="vl-plan-item"><span>Enterprise · Custom</span><span className="vl-chip vl-chip-mint">Live</span></div>
                </div>
              </div>
              <div className="vl-bc vl-s7">
                <div className="vl-bc-tag">Usage Metering</div>
                <div className="vl-bc-icon">📊</div>
                <h3>Meter API calls, storage, compute — bill it all, accurately.</h3>
                <p>Stream events in real time. Customers see usage as it happens.</p>
                <div className="vl-meter-vis">
                  <div className="vl-meter-label"><span>API Requests</span><span className="vl-mono">68k / 100k</span></div>
                  <div className="vl-meter-track"><div className="vl-meter-fill vl-mf-gold" style={{'--w':'68%'}}></div></div>
                  <div className="vl-meter-label"><span>Storage Used</span><span className="vl-mono">24 GB / 50 GB</span></div>
                  <div className="vl-meter-track"><div className="vl-meter-fill vl-mf-mint" style={{'--w':'48%'}}></div></div>
                  <div className="vl-meter-label"><span>Team Seats</span><span className="vl-mono">9 / 25</span></div>
                  <div className="vl-meter-track"><div className="vl-meter-fill vl-mf-sky" style={{'--w':'36%'}}></div></div>
                </div>
              </div>
              <div className="vl-bc vl-s7">
                <div className="vl-bc-tag">Invoicing</div>
                <div className="vl-bc-icon">🧾</div>
                <h3>Invoices that write, send, and reconcile themselves.</h3>
                <p>Every line item, tax, proration, and discount — handled automatically on billing day.</p>
                <div className="vl-invoice-vis">
                  <div className="vl-inv-header"><span style={{color:'var(--gold)',fontWeight:600}}>INV-0241</span><span className="vl-chip vl-chip-mint">Paid</span></div>
                  <div className="vl-inv-row"><span>Growth Plan × 1</span><span className="vl-mono">₹2,499.00</span></div>
                  <div className="vl-inv-row"><span>GST 18%</span><span className="vl-mono">₹449.82</span></div>
                  <div className="vl-inv-row"><span>Total</span><span className="vl-mono">₹2,948.82</span></div>
                </div>
              </div>
              <div className="vl-bc vl-s5">
                <div className="vl-bc-tag">i18n & Multi-currency</div>
                <div className="vl-bc-icon">🌐</div>
                <h3>7 locales. Invoices in the customer's language.</h3>
                <p>INR, USD, EUR, JPY and more — Vaultly formats every invoice to local standards.</p>
                <div className="vl-globe-vis">
                  <div className="vl-globe-ring"></div>
                  <div className="vl-globe-ring"></div>
                  <div className="vl-globe-ring"></div>
                  <div className="vl-locale-dot" style={{top:'40px',left:'28px'}}>🇮🇳</div>
                  <div className="vl-locale-dot" style={{top:'20px',right:'52px'}}>🇺🇸</div>
                  <div className="vl-locale-dot" style={{top:'40px',right:'28px'}}>🇩🇪</div>
                  <div className="vl-locale-dot" style={{bottom:'18px',left:'38px'}}>🇫🇷</div>
                  <div className="vl-locale-dot" style={{bottom:'30px',right:'44px'}}>🇯🇵</div>
                  <div style={{fontSize:'11px',color:'var(--gold)',fontFamily:"'JetBrains Mono',monospace",textAlign:'center'}}>¥4,200 · €38 · ₹3,499</div>
                </div>
              </div>
              <div className="vl-bc vl-s4">
                <div className="vl-bc-tag">Access Control</div>
                <div className="vl-bc-icon">🛡️</div>
                <h3>Role-based access. Zero guesswork.</h3>
                <p>Finance, Support, and Admin each land in a scoped workspace with the right permissions.</p>
                <div style={{marginTop:'10px'}}>
                  <div className="vl-plan-item ap" style={{marginTop:'8px',justifyContent:'space-between'}}><span>Admin</span><span className="vl-chip vl-chip-gold">Full access</span></div>
                  <div className="vl-plan-item" style={{marginTop:'8px',justifyContent:'space-between'}}><span>Finance</span><span className="vl-chip vl-chip-mint">Billing only</span></div>
                  <div className="vl-plan-item" style={{marginTop:'8px',justifyContent:'space-between'}}><span>Support</span><span className="vl-chip vl-chip-gold">Read only</span></div>
                </div>
              </div>
              <div className="vl-bc vl-s8">
                <div className="vl-bc-tag">Revenue Recovery</div>
                <div className="vl-bc-icon">♻️</div>
                <h3>Smart dunning that brings back failed payments automatically.</h3>
                <p>Custom retry schedules, email sequences, and pause-before-cancel logic — recovering 38% of churned revenue on average.</p>
                <div style={{marginTop:'16px'}}>
                  <div className="vl-rec-row">
                    <div className="vl-rec-icon" style={{background:'var(--mint-dim)'}}>📧</div>
                    <span style={{fontSize:'12px',minWidth:'90px',color:'var(--slate-light)'}}>Email retry</span>
                    <div className="vl-rec-bar"><div className="vl-rec-fill" style={{width:'82%',background:'var(--mint)'}}></div></div>
                    <span className="vl-rec-pct">82%</span>
                  </div>
                  <div className="vl-rec-row">
                    <div className="vl-rec-icon" style={{background:'var(--gold-dim)'}}>🔁</div>
                    <span style={{fontSize:'12px',minWidth:'90px',color:'var(--slate-light)'}}>Smart retry</span>
                    <div className="vl-rec-bar"><div className="vl-rec-fill" style={{width:'61%',background:'var(--gold-light)'}}></div></div>
                    <span className="vl-rec-pct">61%</span>
                  </div>
                  <div className="vl-rec-row">
                    <div className="vl-rec-icon" style={{background:'var(--red-dim)'}}>⏸</div>
                    <span style={{fontSize:'12px',minWidth:'90px',color:'var(--slate-light)'}}>Pause logic</span>
                    <div className="vl-rec-bar"><div className="vl-rec-fill" style={{width:'44%',background:'var(--red)'}}></div></div>
                    <span className="vl-rec-pct">44%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="vl-flow-section" id="vl-flow">
          <div className="vl-wrap">
            <div className="vl-flow-left vl-reveal">
              <div className="vl-eyebrow">⚡ How it works</div>
              <h2>From zero to billing<br />in under five minutes.</h2>
              <p>Vaultly connects to your stack without a long integration sprint. Configure once, automate forever.</p>
              <div style={{marginTop:'30px'}}>
                <div className="vl-flow-step">
                  <div className="vl-flow-num">01</div>
                  <div className="vl-flow-text"><h4>Connect your payment gateway</h4><p>Paste your Stripe or Razorpay key — Vaultly syncs your existing customers and payment methods instantly.</p></div>
                </div>
                <div className="vl-flow-step">
                  <div className="vl-flow-num">02</div>
                  <div className="vl-flow-text"><h4>Define your plans visually</h4><p>Build tiered or usage plans in the dashboard. No code, no yaml, no deploy.</p></div>
                </div>
                <div className="vl-flow-step">
                  <div className="vl-flow-num">03</div>
                  <div className="vl-flow-text"><h4>Publish & watch revenue flow</h4><p>Billing starts on schedule. Invoices send, payments collect, dunning handles the rest.</p></div>
                </div>
              </div>
            </div>
            <div className="vl-reveal" style={{transitionDelay:'.2s'}}>
              <div className="vl-hub-panel" id="vl-hubPanel">
                <div className="vl-hub-illustration">
                  <svg viewBox="0 0 400 380">
                    <path className="vl-hub-line" d="M200,190 L70,70"></path>
                    <path className="vl-hub-line" d="M200,190 L330,70"></path>
                    <path className="vl-hub-line" d="M200,190 L70,310"></path>
                    <path className="vl-hub-line" d="M200,190 L330,310"></path>
                  </svg>
                  <div className="vl-hub-core">🔐</div>
                  <div className="vl-hub-node" style={{top:'14px',left:'8px'}}><div className="vl-hub-node-icon">💳</div><div className="vl-hub-node-label">Payments</div><div className="vl-hub-node-sub">Stripe · Razorpay</div></div>
                  <div className="vl-hub-node" style={{top:'14px',right:'8px'}}><div className="vl-hub-node-icon">🧾</div><div className="vl-hub-node-label">Invoices</div><div className="vl-hub-node-sub">Auto-generated</div></div>
                  <div className="vl-hub-node" style={{bottom:'14px',left:'8px'}}><div className="vl-hub-node-icon">📊</div><div className="vl-hub-node-label">Usage</div><div className="vl-hub-node-sub">Metered in real time</div></div>
                  <div className="vl-hub-node" style={{bottom:'14px',right:'8px'}}><div className="vl-hub-node-icon">🔔</div><div className="vl-hub-node-label">Alerts</div><div className="vl-hub-node-sub">Dunning & renewals</div></div>
                </div>
                <div className="vl-hub-caption">Vaultly sits at the center of your billing stack — connecting payments, invoices, usage and alerts.</div>
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <div className="vl-integrations">
          <div className="vl-wrap">
            <div className="vl-st" style={{marginBottom:0}}>
              <div className="vl-eyebrow">🔌 Integrations</div>
              <h2 style={{fontSize:'26px'}}>Works with tools you already use</h2>
            </div>
          </div>
          <div className="vl-logos-scroll" style={{marginTop:'32px'}}>
            <div className="vl-logos-track">
              {['⚡ Stripe','₹ Razorpay','🔔 Slack','📊 Segment','📦 Notion','🔀 Zapier','📬 SendGrid','🗄️ PostgreSQL','🐍 FastAPI','⚛️ React','☁️ AWS','🐳 Docker'].map((l,i) => <div key={i} className="vl-logo-chip">{l}</div>)}
              {['⚡ Stripe','₹ Razorpay','🔔 Slack','📊 Segment','📦 Notion','🔀 Zapier','📬 SendGrid','🗄️ PostgreSQL','🐍 FastAPI','⚛️ React','☁️ AWS','🐳 Docker'].map((l,i) => <div key={'b'+i} className="vl-logo-chip">{l}</div>)}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <section className="vl-pricing" id="vl-pricing">
          <div className="vl-wrap">
            <div className="vl-st vl-reveal">
              <div className="vl-eyebrow">💎 Pricing</div>
              <h2>Plans built for every stage<br /><em>of your growth</em></h2>
              <p>Start free. Upgrade when you're ready. No surprise bills.</p>
            </div>
            <div className="vl-plans-wrap">
              <div className="vl-plan-card vl-reveal" style={{transitionDelay:'.05s'}}>
                <div className="vl-plan-name">Starter</div>
                <div className="vl-plan-price-wrap"><div className="vl-plan-price">₹0</div><div className="vl-plan-per">/month</div></div>
                <div className="vl-plan-desc">For founders and early-stage products.</div>
                <div className="vl-plan-divider"></div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>1 admin seat</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Up to 1,000 subscriptions</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Flat & tiered plans</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Basic invoicing</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Email support</div>
                <div className="vl-plan-cta"><a className="vl-btn vl-btn-ghost" href="/signin" onClick={goSignIn}>Get started free</a></div>
              </div>
              <div className="vl-plan-card featured vl-reveal" style={{transitionDelay:'.15s'}}>
                <span className="vl-plan-badge">Most popular</span>
                <div className="vl-plan-name">Growth</div>
                <div className="vl-plan-price-wrap"><div className="vl-plan-price">₹2,499</div><div className="vl-plan-per">/month</div></div>
                <div className="vl-plan-desc">For scaling SaaS teams with complex billing needs.</div>
                <div className="vl-plan-divider"></div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>25 team seats + roles</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Unlimited subscriptions</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Usage-based billing</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Smart dunning & recovery</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>7-locale i18n</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Priority support</div>
                <div className="vl-plan-cta"><a className="vl-btn vl-btn-primary" href="/signin" onClick={goSignIn}>Start 14-day trial →</a></div>
              </div>
              <div className="vl-plan-card vl-reveal" style={{transitionDelay:'.25s'}}>
                <div className="vl-plan-name">Enterprise</div>
                <div className="vl-plan-price-wrap"><div className="vl-plan-price" style={{fontSize:'26px',alignSelf:'center'}}>Custom</div></div>
                <div className="vl-plan-desc">For high-volume and regulated businesses.</div>
                <div className="vl-plan-divider"></div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Unlimited seats</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>SOC 2 audit logs</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Custom SLA</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>Dedicated CSM</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>SSO + SAML</div>
                <div className="vl-plan-feature"><span className="vl-pf-check">✓</span>On-premise option</div>
                <div className="vl-plan-cta"><a className="vl-btn vl-btn-ghost" href="/signin" onClick={goSignIn}>Talk to sales</a></div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="vl-testimonials">
          <div className="vl-wrap">
            <div className="vl-st vl-reveal">
              <div className="vl-eyebrow">💬 Customers</div>
              <h2>Teams who stopped worrying<br />about billing</h2>
            </div>
            <div className="vl-testi-grid">
              <div className="vl-testi-card">
                <div className="vl-testi-stars">★★★★★</div>
                <div className="vl-testi-quote">"We launched three new pricing tiers in a single afternoon. No engineer needed. Vaultly paid for itself in the first week."</div>
                <div className="vl-testi-author"><div className="vl-testi-avatar">P</div><div><div className="vl-testi-name">Priya Menon</div><div className="vl-testi-role">Head of Growth · ByteWave</div></div></div>
              </div>
              <div className="vl-testi-card" style={{transitionDelay:'.1s'}}>
                <div className="vl-testi-stars">★★★★★</div>
                <div className="vl-testi-quote">"The dunning recovery alone brought back ₹2.4 lakh in the first month. I was manually chasing failed payments before this."</div>
                <div className="vl-testi-author"><div className="vl-testi-avatar">R</div><div><div className="vl-testi-name">Rohan Shetty</div><div className="vl-testi-role">Founder · NexaLabs</div></div></div>
              </div>
              <div className="vl-testi-card" style={{transitionDelay:'.2s'}}>
                <div className="vl-testi-stars">★★★★★</div>
                <div className="vl-testi-quote">"i18n support is incredible. We serve 5 countries and every invoice renders in the right language and currency, automatically."</div>
                <div className="vl-testi-author"><div className="vl-testi-avatar">A</div><div><div className="vl-testi-name">Anika Rao</div><div className="vl-testi-role">CTO · AcmeSaaS</div></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="vl-cta-final">
          <div className="vl-wrap">
            <div className="vl-eyebrow" style={{margin:'0 auto 20px'}}>🚀 Get started today</div>
            <h2>Your billing stack,<br /><span style={{color:'var(--gold)'}}>finally automated.</span></h2>
            <p>Set up your first plan in under five minutes. No credit card required.</p>
            <div className="vl-cta-actions">
              <a className="vl-btn vl-btn-primary" href="/signin" onClick={goSignIn}>Start free trial →</a>
              <a className="vl-btn vl-btn-ghost" href="/signin" onClick={goSignIn}>Book a demo</a>
            </div>
            <div className="vl-cta-trust">
              <div className="vl-ct-item">No setup fees</div>
              <div className="vl-ct-item">Cancel anytime</div>
              <div className="vl-ct-item">SOC 2 compliant</div>
              <div className="vl-ct-item">GDPR ready</div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="vl-footer">
          <div className="vl-wrap">
            <div className="vl-footer-grid">
              <div className="vl-footer-brand">
                <div className="vl-logo"><div className="vl-logo-icon">🔐</div>Vaultly</div>
                <p>Subscription billing automation for modern SaaS teams. Configure, automate, and recover.</p>
              </div>
              <div className="vl-footer-col">
                <h5>Product</h5>
                <a href="#vl-pricing">Plans & Pricing</a><a href="#vl-features">Usage Billing</a>
                <a href="#vl-features">Invoicing</a><a href="#vl-features">Dunning</a><a href="#vl-features">Integrations</a>
              </div>
              <div className="vl-footer-col">
                <h5>Developers</h5>
                <a href="#vl-features">API Docs</a><a href="#vl-features">Webhooks</a>
                <a href="#vl-features">SDKs</a><a href="#vl-features">Changelog</a>
              </div>
              <div className="vl-footer-col">
                <h5>Company</h5>
                <a href="#vl-features">About</a><a href="#vl-features">Blog</a>
                <a href="#vl-features">Careers</a><a href="#vl-features">Privacy</a><a href="#vl-features">Terms</a>
              </div>
            </div>
            <div className="vl-footer-bottom">
              <span>© 2026 Vaultly. Built for billing.</span>
              <span>Made for Infosys Virtual Internship 7.0</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
