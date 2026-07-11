import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SEEDS: Record<string, { f: number; v: number; e: number }> = {
  youtube:   { f: 11800, v: 2600,  e: 0.055 },
  instagram: { f: 8200,  v: 5400,  e: 0.07  },
  tiktok:    { f: 20500, v: 14000, e: 0.09  },
  snapchat:  { f: 3100,  v: 4200,  e: 0.028 },
}

function makeRng() {
  let s = 7.13
  return () => { s = Math.sin(s * 99991) * 1e4; return s - Math.floor(s) }
}

function generateSampleData(days: number) {
  const today = new Date()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  const rnd = makeRng()
  const result: Record<string, { date: string; followers: number; views: number; likes: number; comments: number }[]> = {}
  const platforms = ['youtube', 'instagram', 'tiktok', 'snapchat']
  platforms.forEach((key, pi) => {
    const seed = SEEDS[key]; const arr = []; let follow = seed.f * 0.72
    for (let i = 0; i < days; i++) {
      const t = i / days
      const growth = 1 + t * 0.42
      const week = 1 + 0.28 * Math.sin((i / 7) * Math.PI * 2 + pi)
      const spike = rnd() < 0.045 ? 1.9 + rnd() * 2.4 : 1
      const noise = 0.78 + rnd() * 0.5
      const views = Math.max(80, seed.v * growth * week * noise * spike)
      follow += views * 0.0016 * (0.6 + rnd())
      const eng = views * seed.e * (0.8 + rnd() * 0.5)
      arr.push({ date: dates[i], followers: Math.round(follow), views: Math.round(views), likes: Math.round(eng * 0.86), comments: Math.round(eng * 0.14) })
    }
    result[key] = arr
  })
  return result
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('days')
  const days = Math.min(366, Math.max(1, raw ? Number(raw) : 366))

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Fall back to sample data if Supabase isn't configured
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(generateSampleData(days), {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
    })
  }

  const db = createClient(supabaseUrl, supabaseKey)
  const since = new Date(); since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().slice(0, 10)

  const { data, error } = await db
    .from('daily_snapshots')
    .select('platform, snapshot_date, followers, views, likes, comments, extra')
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: true })

  // If no real data yet, return sample data
  if (error || !data || data.length === 0) {
    return NextResponse.json(generateSampleData(days), {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
    })
  }

  const result: Record<string, { date: string; followers: number; views: number; likes: number; comments: number }[]> = {
    youtube: [], instagram: [], tiktok: [], snapchat: [],
  }
  for (const row of data) {
    if (result[row.platform]) {
      result[row.platform].push({
        date: row.snapshot_date,
        followers: row.followers ?? 0,
        views: row.views ?? 0,
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        extra: row.extra ?? {},
      })
    }
  }

  // Pad all platforms to full `days` length so the chart never crashes on short arrays
  const sample = generateSampleData(days)
  const allDates = sample['youtube'].map(r => r.date)
  for (const platform of ['youtube', 'instagram', 'tiktok', 'snapchat']) {
    if (result[platform].length === 0) {
      result[platform] = sample[platform]
    } else {
      const realByDate = Object.fromEntries(result[platform].map(r => [r.date, r]))
      let lastFollowers = 0
      result[platform] = allDates.map(date => {
        if (realByDate[date]) { lastFollowers = realByDate[date].followers; return realByDate[date] }
        return { date, followers: lastFollowers, views: 0, likes: 0, comments: 0 }
      })
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
  })
}
