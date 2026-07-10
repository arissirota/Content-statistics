import { NextRequest, NextResponse } from 'next/server'

// Seed parameters matching the original signal-dashboard.html sample data
const SEEDS: Record<string, { f: number; v: number; e: number }> = {
  youtube:   { f: 11800, v: 2600,  e: 0.055 },
  instagram: { f: 8200,  v: 5400,  e: 0.07  },
  tiktok:    { f: 20500, v: 14000, e: 0.09  },
  snapchat:  { f: 3100,  v: 4200,  e: 0.028 },
}

// Deterministic seeded RNG matching the original
function makeRng() {
  let s = 7.13
  return () => {
    s = Math.sin(s * 99991) * 1e4
    return s - Math.floor(s)
  }
}

function generateSampleData(days: number) {
  const today = new Date()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const rnd = makeRng()
  const result: Record<string, { date: string; followers: number; views: number; likes: number; comments: number }[]> = {}

  const platforms = ['youtube', 'instagram', 'tiktok', 'snapchat']
  platforms.forEach((key, pi) => {
    const seed = SEEDS[key]
    const arr = []
    let follow = seed.f * 0.72

    for (let i = 0; i < days; i++) {
      const t = i / days
      const growth = 1 + t * 0.42
      const week = 1 + 0.28 * Math.sin((i / 7) * Math.PI * 2 + pi)
      const spike = rnd() < 0.045 ? 1.9 + rnd() * 2.4 : 1
      const noise = 0.78 + rnd() * 0.5
      const views = Math.max(80, seed.v * growth * week * noise * spike)
      follow += views * 0.0016 * (0.6 + rnd())
      const eng = views * seed.e * (0.8 + rnd() * 0.5)
      arr.push({
        date: dates[i],
        followers: Math.round(follow),
        views: Math.round(views),
        likes: Math.round(eng * 0.86),
        comments: Math.round(eng * 0.14),
      })
    }
    result[key] = arr
  })

  return result
}

export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('days')
  const days = Math.min(366, Math.max(1, raw ? Number(raw) : 366))
  const data = generateSampleData(days)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
  })
}
