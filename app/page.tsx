'use client'
import { useEffect } from 'react'

export default function SignalDashboard() {
  useEffect(() => {
    const root = document.getElementById('signal-root')
    if (!root) return

    const fmt = (n: number) =>
      n >= 1e6
        ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
        : n >= 1e3
        ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'
        : Math.round(n).toLocaleString()
    const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

    const P = [
      {
        key: 'youtube', name: 'YouTube', acc: '#FF4E45', cov: 'FULL SYNC',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>',
      },
      {
        key: 'instagram', name: 'Instagram', acc: '#E6689C', cov: 'FULL SYNC',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
      },
      {
        key: 'tiktok', name: 'TikTok', acc: '#26E0E5', cov: 'CORE ONLY',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 5v9.5a3 3 0 1 1-3-3"/><path d="M9 5c.5 2.5 2.5 4 5 4"/></svg>',
      },
      {
        key: 'snapchat', name: 'Snapchat', acc: '#F7E14B', cov: 'FOLLOWERS + TOTALS',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 3c3 0 5 2 5 5 0 2 .3 3 1.5 3.6 1 .5 2 .4 2 .4s-.5 1.4-2 1.8c.3.8 1.4 1.8 3 2.1 0 0-1.6 1.6-4.5 1.4-.4.8-1.2 1.7-4.5 1.7s-4.1-.9-4.5-1.7C5.6 18.6 4 17 4 17c1.6-.3 2.7-1.3 3-2.1-1.5-.4-2-1.8-2-1.8s1 .1 2-.4C8.7 12 9 11 9 9c0-3 2-6 3-6z"/></svg>',
      },
    ]

    const RANGES: [string, string, number][] = [
      ['daily', 'Daily', 1], ['weekly', 'Weekly', 7], ['monthly', 'Monthly', 30],
      ['q', '90 Days', 90], ['h', '6 Months', 180], ['y', 'Year', 365],
    ]
    let range = 'monthly'
    let metric = 'views'
    const active: Record<string, boolean> = { youtube: true, instagram: true, tiktok: true, snapchat: true }

    let DATA: Record<string, { date: string; followers: number; views: number; likes: number; comments: number }[]> = {}
    let DAYS = 366

    fetch('/api/metrics?days=366')
      .then(r => r.json())
      .then(data => {
        DATA = data
        DAYS = data.youtube?.length ?? 366
        const today = new Date()
        const syncEl = document.getElementById('synctime')
        if (syncEl) syncEl.textContent = today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' 03:12'
        initUI()
        render()
      })

    function initUI() {
      const rn = document.getElementById('ranges')!
      rn.innerHTML = ''
      RANGES.forEach(([k, label]) => {
        const b = document.createElement('button')
        b.textContent = label
        b.dataset.k = k
        if (k === range) b.classList.add('on')
        b.onclick = () => {
          range = k
          Array.from(rn.children).forEach(c => (c as HTMLElement).classList.toggle('on', (c as HTMLElement).dataset.k === k))
          render()
        }
        rn.appendChild(b)
      })

      document.querySelectorAll('#metricsel button').forEach(b => {
        ;(b as HTMLButtonElement).onclick = () => {
          metric = (b as HTMLButtonElement).dataset.m!
          document.querySelectorAll('#metricsel button').forEach(x => x.classList.toggle('on', x === b))
          drawChart()
        }
      })
    }

    const windowDays = () => RANGES.find(r => r[0] === range)![2]

    function sumRange(key: string, m: string, startIdx: number, endIdx: number) {
      const a = DATA[key]; let s = 0
      for (let i = startIdx; i < endIdx; i++) {
        s += m === 'engagement' ? a[i].likes + a[i].comments : a[i].views
      }
      return s
    }

    function render() {
      if (!Object.keys(DATA).length) return
      const N = windowDays()
      const end = DAYS, start = DAYS - N, prevStart = Math.max(0, start - N)
      let views = 0, vprev = 0, eng = 0, eprev = 0, folNow = 0, folThen = 0, folPrevThen = 0
      P.forEach(p => {
        if (!active[p.key]) return
        views += sumRange(p.key, 'views', start, end)
        vprev += sumRange(p.key, 'views', prevStart, start)
        eng += sumRange(p.key, 'engagement', start, end)
        eprev += sumRange(p.key, 'engagement', prevStart, start)
        const a = DATA[p.key]
        folNow += a[end - 1].followers
        folThen += a[start].followers
        folPrevThen += a[prevStart].followers
      })
      const gained = folNow - folThen, gainedPrev = folThen - folPrevThen
      const rate = views > 0 ? (eng / views) * 100 : 0
      const rPrev = vprev > 0 ? (eprev / vprev) * 100 : 0
      const d = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : 0)
      const arrow = (v: number) =>
        `<span class="delta ${v >= 0 ? 'up' : 'down'}"><svg viewBox="0 0 10 10" fill="currentColor">${v >= 0 ? '<path d="M5 1l4 6H1z"/>' : '<path d="M5 9L1 3h8z"/>'}</svg>${pct(v)}</span>`

      const cards = [
        ['Total views', fmt(views), arrow(d(views, vprev)) + ' vs prev'],
        ['Followers', fmt(folNow), arrow(d(gained, gainedPrev)) + ' &nbsp;' + (gained >= 0 ? '+' : '') + fmt(gained) + ' gained'],
        ['Engagement', fmt(eng), arrow(d(eng, eprev)) + ' likes + comments'],
        ['Engagement rate', rate.toFixed(1) + '%', arrow(rate - rPrev) + ' of views'],
      ]
      document.getElementById('kpis')!.innerHTML = cards
        .map(c => `<div class="kpi"><div class="lbl">${c[0]}</div><div class="val">${c[1]}</div><div class="sub">${c[2]}</div></div>`)
        .join('')

      buildLegend()
      buildChannels()
      drawChart()
    }

    function buildLegend() {
      const L = document.getElementById('legend')!
      L.innerHTML = P.map(
        p => `<span class="chip ${active[p.key] ? '' : 'off'}" data-k="${p.key}">
          <span class="sw" style="background:${p.acc}"></span>${p.name}</span>`
      ).join('')
      L.querySelectorAll('.chip').forEach(c =>
        (c as HTMLElement).addEventListener('click', () => {
          active[(c as HTMLElement).dataset.k!] = !active[(c as HTMLElement).dataset.k!]
          render()
        })
      )
    }

    const chart = document.getElementById('chart') as unknown as SVGSVGElement
    const tip = document.getElementById('tip')!
    let CUR: { series: number[]; ds: string[] } = { series: [], ds: [] }

    function drawChart() {
      if (!chart || !Object.keys(DATA).length) return
      const N = Math.min(365, Math.max(windowDays(), 30))
      const start = DAYS - N
      const series: number[] = [], ds: string[] = []
      for (let i = start; i < DAYS; i++) {
        let v = 0
        P.forEach(p => {
          if (!active[p.key]) return
          const a = DATA[p.key][i]
          v += metric === 'followers' ? a.followers : metric === 'engagement' ? a.likes + a.comments : a.views
        })
        series.push(v)
        ds.push(DATA[P[0].key][i].date)
      }
      CUR = { series, ds }
      const W = (chart as unknown as SVGElement).clientWidth || 900
      const H = (chart as unknown as SVGElement).clientHeight || 210
      const pad = 6
      const max = Math.max(...series, 1)
      const min = metric === 'followers' ? Math.min(...series) * 0.985 : 0
      const X = (i: number) => pad + (i * (W - pad * 2)) / ((series.length - 1) || 1)
      const Y = (v: number) => H - 14 - ((v - min) / (max - min || 1)) * (H - 26)
      let line = '', area = ''
      series.forEach((v, i) => {
        const x = X(i).toFixed(1), y = Y(v).toFixed(1)
        line += (i ? 'L' : 'M') + x + ' ' + y + ' '
      })
      area = line + `L${X(series.length - 1).toFixed(1)} ${H - 14} L${X(0).toFixed(1)} ${H - 14} Z`
      let grid = ''
      for (let g = 0; g <= 3; g++) {
        const gy = (14 + (g * (H - 26)) / 3).toFixed(1)
        grid += `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="rgba(232,232,255,.05)"/>`
        const gv = max - (g / 3) * (max - min)
        grid += `<text x="2" y="${+gy - 4}" fill="#5A6274" font-size="9" font-family="JetBrains Mono">${fmt(gv)}</text>`
      }
      ;(chart as unknown as Element).innerHTML = `
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#F0C662" stop-opacity=".34"/>
          <stop offset="1" stop-color="#F0C662" stop-opacity="0"/></linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#ga)"/>
        <path d="${line}" fill="none" stroke="#F0C662" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${X(series.length - 1)}" cy="${Y(series[series.length - 1])}" r="3.5" fill="#F0C662"/>
        <circle cx="${X(series.length - 1)}" cy="${Y(series[series.length - 1])}" r="7" fill="#F0C662" opacity=".18"/>
        <rect id="hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`

      const hit = (chart as unknown as Element).querySelector('#hit')!
      const show = (cx: number) => {
        const r = (chart as unknown as Element).getBoundingClientRect()
        const x = cx - r.left
        const i = Math.round((x - pad) / ((W - pad * 2) / ((series.length - 1) || 1)))
        const idx = Math.max(0, Math.min(series.length - 1, i))
        tip.style.opacity = '1'
        tip.style.left = X(idx) + 'px'
        tip.style.top = Y(series[idx]) + 'px'
        document.getElementById('tip-d')!.textContent = new Date(CUR.ds[idx]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        document.getElementById('tip-v')!.textContent =
          fmt(series[idx]) + (metric === 'followers' ? ' followers' : metric === 'engagement' ? ' eng' : ' views')
      }
      hit.addEventListener('mousemove', e => show((e as MouseEvent).clientX))
      hit.addEventListener('mouseleave', () => (tip.style.opacity = '0'))
      hit.addEventListener('touchstart', e => show((e as TouchEvent).touches[0].clientX), { passive: true })
      hit.addEventListener('touchmove', e => { show((e as TouchEvent).touches[0].clientX); e.preventDefault() }, { passive: false })
      hit.addEventListener('touchend', () => setTimeout(() => (tip.style.opacity = '0'), 1400))
    }

    const resizeHandler = () => drawChart()
    window.addEventListener('resize', resizeHandler)

    function sparkPath(vals: number[], w: number, h: number) {
      const max = Math.max(...vals), min = Math.min(...vals)
      return vals
        .map((v, i) => {
          const x = ((i * w) / (vals.length - 1)).toFixed(1)
          const y = (h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)
          return (i ? 'L' : 'M') + x + ' ' + y
        })
        .join(' ')
    }

    function buildChannels() {
      const N = windowDays(), start = DAYS - N
      const host = document.getElementById('channels')!
      host.innerHTML = ''
      P.forEach(p => {
        const a = DATA[p.key]
        const views = sumRange(p.key, 'views', start, DAYS)
        const eng = sumRange(p.key, 'engagement', start, DAYS)
        let likes = 0, comments = 0
        for (let i = start; i < DAYS; i++) { likes += a[i].likes; comments += a[i].comments }
        const fNow = a[DAYS - 1].followers, fThen = a[start].followers, gained = fNow - fThen
        const rate = views > 0 ? (eng / views) * 100 : 0
        const spk: number[] = []
        for (let i = start; i < DAYS; i++) spk.push(a[i].views)
        const dim = active[p.key] ? '' : 'opacity:.42;filter:saturate(.4)'
        const el = document.createElement('div')
        el.className = 'channel'
        el.style.setProperty('--acc', p.acc)
        if (dim) el.setAttribute('style', el.getAttribute('style') + ';' + dim)
        el.innerHTML = `
          <div class="ch-id">
            <div class="ch-ic">${p.icon}</div>
            <div><div class="ch-name">${p.name}</div><div class="ch-cov">${p.cov}</div></div>
          </div>
          <div class="ch-metrics">
            <div class="m"><div class="mk">Followers</div><div class="mv">${fmt(fNow)} <small style="color:${gained >= 0 ? '#6FE39A' : '#FF6B6B'}">${gained >= 0 ? '+' : ''}${fmt(gained)}</small></div></div>
            <div class="m"><div class="mk">Views</div><div class="mv">${fmt(views)}</div></div>
            <div class="m"><div class="mk">Likes</div><div class="mv">${fmt(likes)}</div></div>
            <div class="m"><div class="mk">Comments</div><div class="mv">${fmt(comments)}</div></div>
          </div>
          <div class="spark"><svg viewBox="0 0 116 40" preserveAspectRatio="none">
            <path d="${sparkPath(spk, 116, 40)}" fill="none" stroke="${p.acc}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="${sparkPath(spk, 116, 40)} L116 40 L0 40 Z" fill="${p.acc}" opacity=".08"/>
          </svg><div style="font-family:var(--mono);font-size:10px;color:var(--dim);text-align:right;margin-top:2px">${rate.toFixed(1)}% eng</div></div>`
        host.appendChild(el)
      })
    }

    return () => {
      window.removeEventListener('resize', resizeHandler)
    }
  }, [])

  return (
    <div id="signal-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        #signal-root{
          --bg:#08090D; --bg2:#0C0E14; --surf:#12141C; --surf2:#171A24;
          --line:rgba(232,232,255,.08); --line2:rgba(232,232,255,.14);
          --txt:#EDF0F7; --mut:#8A92A6; --dim:#5A6274;
          --gold:#F0C662; --gold-dim:#8a6f2e;
          --yt:#FF4E45; --ig:#E6689C; --tt:#26E0E5; --sc:#F7E14B;
          --good:#6FE39A; --bad:#FF6B6B;
          --dspl:'Space Grotesk',system-ui,sans-serif;
          --body:'Inter',system-ui,sans-serif;
          --mono:'JetBrains Mono',ui-monospace,monospace;
          font-family:var(--body); color:var(--txt);
          background:
            radial-gradient(1100px 500px at 88% -8%, rgba(240,198,98,.06), transparent 60%),
            radial-gradient(900px 500px at 5% 108%, rgba(123,47,190,.10), transparent 55%),
            var(--bg);
          min-height:100vh; padding:26px clamp(14px,3vw,40px) calc(60px + env(safe-area-inset-bottom));
          padding-left:calc(clamp(14px,3vw,40px) + env(safe-area-inset-left));
          padding-right:calc(clamp(14px,3vw,40px) + env(safe-area-inset-right));
          box-sizing:border-box; line-height:1.45;
          -webkit-font-smoothing:antialiased;
        }
        #signal-root *{box-sizing:border-box}
        .wrap{max-width:1180px;margin:0 auto}
        .top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;
             padding-bottom:20px;border-bottom:1px solid var(--line);margin-bottom:24px}
        .brand{display:flex;align-items:center;gap:14px}
        .mark{width:38px;height:38px;border:1px solid var(--gold-dim);border-radius:9px;position:relative;
              background:linear-gradient(155deg,rgba(240,198,98,.14),rgba(240,198,98,0));flex:none}
        .mark span{position:absolute;left:50%;bottom:7px;transform:translateX(-50%);display:flex;gap:2.5px;align-items:flex-end}
        .mark span i{width:3px;background:var(--gold);border-radius:2px;display:block;opacity:.9}
        .brand h1{font-family:var(--dspl);font-weight:700;font-size:22px;letter-spacing:.16em;margin:0;line-height:1}
        .brand p{margin:5px 0 0;color:var(--mut);font-size:12px;letter-spacing:.02em}
        .sync{display:flex;align-items:center;gap:8px;color:var(--dim);font-family:var(--mono);font-size:11px;
              letter-spacing:.04em;padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:var(--surf)}
        .dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 0 3px rgba(111,227,154,.14)}
        .ranges{display:flex;gap:5px;flex-wrap:wrap;background:var(--surf);border:1px solid var(--line);
                padding:5px;border-radius:11px;margin-bottom:22px}
        .ranges button{flex:1;min-width:70px;font-family:var(--dspl);font-weight:500;font-size:12.5px;letter-spacing:.05em;
                color:var(--mut);background:transparent;border:0;border-radius:7px;padding:9px 6px;cursor:pointer;
                transition:.16s;white-space:nowrap}
        .ranges button:hover{color:var(--txt)}
        .ranges button.on{background:linear-gradient(180deg,rgba(240,198,98,.16),rgba(240,198,98,.05));
                color:var(--gold);box-shadow:inset 0 0 0 1px rgba(240,198,98,.28)}
        .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
        .kpi{background:linear-gradient(180deg,var(--surf2),var(--surf));border:1px solid var(--line);
             border-radius:13px;padding:16px 17px;position:relative;overflow:hidden}
        .kpi::after{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:var(--gold);opacity:.55}
        .kpi .lbl{color:var(--mut);font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:500}
        .kpi .val{font-family:var(--mono);font-weight:700;font-size:27px;letter-spacing:-.01em;margin:9px 0 4px;line-height:1}
        .kpi .sub{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:12px;color:var(--dim)}
        .delta{display:inline-flex;align-items:center;gap:3px;font-weight:600}
        .delta.up{color:var(--good)} .delta.down{color:var(--bad)}
        .delta svg{width:9px;height:9px}
        .panel{background:var(--bg2);border:1px solid var(--line);border-radius:15px;padding:18px 20px 8px;margin-bottom:14px}
        .phead{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:6px}
        .ptitle{display:flex;align-items:baseline;gap:10px}
        .ptitle b{font-family:var(--dspl);font-weight:600;font-size:15px;letter-spacing:.02em}
        .tag{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--dim);
             border:1px solid var(--line2);border-radius:5px;padding:2px 6px}
        .metricsel{display:flex;gap:4px}
        .metricsel button{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--mut);background:var(--surf);
             border:1px solid var(--line);border-radius:7px;padding:6px 11px;cursor:pointer;transition:.15s}
        .metricsel button.on{color:var(--txt);border-color:var(--line2);background:var(--surf2)}
        .metricsel button:hover{color:var(--txt)}
        .chartbox{position:relative;height:210px;margin-top:6px;touch-action:pan-y}
        svg.chart{width:100%;height:100%;display:block;overflow:visible}
        .legend{display:flex;gap:6px;flex-wrap:wrap;padding:12px 0 8px}
        .chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--mut);cursor:pointer;
              border:1px solid var(--line);background:var(--surf);border-radius:20px;padding:5px 12px 5px 9px;
              transition:.15s;font-family:var(--body);user-select:none}
        .chip:hover{color:var(--txt)}
        .chip .sw{width:9px;height:9px;border-radius:50%}
        .chip.off{opacity:.4}
        .chip.off .sw{background:var(--dim)!important}
        .tooltip{position:absolute;pointer-events:none;opacity:0;transition:opacity .12s;transform:translate(-50%,-116%);
              background:#05060A;border:1px solid var(--line2);border-radius:9px;padding:8px 11px;white-space:nowrap;z-index:5;
              box-shadow:0 10px 30px rgba(0,0,0,.5)}
        .tooltip .td{font-family:var(--mono);font-size:10px;color:var(--dim);letter-spacing:.05em;margin-bottom:3px}
        .tooltip .tv{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--gold)}
        .chsection h2{font-family:var(--dspl);font-weight:600;font-size:13px;letter-spacing:.1em;color:var(--mut);
              text-transform:uppercase;margin:22px 4px 12px}
        .channel{display:grid;grid-template-columns:200px 1fr 116px;gap:18px;align-items:center;
              background:linear-gradient(180deg,var(--surf2),var(--surf));border:1px solid var(--line);
              border-radius:13px;padding:15px 18px;margin-bottom:10px;position:relative;overflow:hidden}
        .channel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--acc)}
        .ch-id{display:flex;align-items:center;gap:12px;min-width:0}
        .ch-ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none;
              background:color-mix(in srgb,var(--acc) 16%,transparent);border:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}
        .ch-ic svg{width:18px;height:18px;stroke:var(--acc)}
        .ch-name{font-family:var(--dspl);font-weight:600;font-size:15px;line-height:1.1}
        .ch-cov{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--dim);margin-top:3px}
        .ch-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .m .mk{font-size:10px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase}
        .m .mv{font-family:var(--mono);font-weight:600;font-size:16px;margin-top:3px}
        .m .mv small{font-size:10px;font-weight:500}
        .spark{height:40px}
        .spark svg{width:100%;height:100%;overflow:visible}
        .foot{color:var(--dim);font-size:11.5px;text-align:center;margin-top:26px;letter-spacing:.02em;font-family:var(--mono)}
        .foot b{color:var(--gold-dim);font-weight:500}
        @media(max-width:820px){
          .kpis{grid-template-columns:1fr 1fr}
          .channel{grid-template-columns:1fr;gap:14px}
          .channel .spark{order:3}
          .ch-metrics{grid-template-columns:repeat(4,1fr)}
        }
        @media(max-width:480px){
          .brand h1{font-size:19px}
          .kpi .val{font-size:22px}
          .ch-metrics{grid-template-columns:repeat(2,1fr)}
          .ranges button{min-width:0;font-size:11.5px;padding:9px 3px;letter-spacing:.02em}
          .sync{font-size:10px;padding:6px 9px}
          .panel{padding:16px 14px 8px}
        }
        @media(prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>

      <div className="wrap">
        <header className="top">
          <div className="brand">
            <div className="mark">
              <span>
                <i style={{ height: '9px' }}></i>
                <i style={{ height: '15px' }}></i>
                <i style={{ height: '6px' }}></i>
                <i style={{ height: '12px' }}></i>
              </span>
            </div>
            <div>
              <h1>SIGNAL</h1>
              <p>Every channel, one master read-out</p>
            </div>
          </div>
          <div className="sync">
            <span className="dot"></span> SYNCED&nbsp;·&nbsp;<span id="synctime">—</span>
          </div>
        </header>

        <nav className="ranges" id="ranges"></nav>
        <div className="kpis" id="kpis"></div>

        <section className="panel">
          <div className="phead">
            <div className="ptitle">
              <b>Master trend</b>
              <span className="tag" id="span-tag">MASTER · SUM OF ACTIVE</span>
            </div>
            <div className="metricsel" id="metricsel">
              <button data-m="views" className="on">Views</button>
              <button data-m="engagement">Engagement</button>
              <button data-m="followers">Followers</button>
            </div>
          </div>
          <div className="chartbox">
            <svg className="chart" id="chart" preserveAspectRatio="none"></svg>
            <div className="tooltip" id="tip">
              <div className="td" id="tip-d"></div>
              <div className="tv" id="tip-v"></div>
            </div>
          </div>
          <div className="legend" id="legend"></div>
        </section>

        <section className="chsection">
          <h2>Channels</h2>
          <div id="channels"></div>
        </section>

        <div className="foot">
          sample data · connect Supabase + platform keys to go live ·{' '}
          <b>YouTube + Instagram full · TikTok core-only · Snapchat followers + totals</b>
        </div>
      </div>
    </div>
  )
}
