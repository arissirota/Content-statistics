/**
 * POST /api/sync
 * Called nightly by Vercel Cron (vercel.json schedule: "0 5 * * *")
 * Protected by Authorization: Bearer <CRON_SECRET>
 *
 * When platform keys are configured in env + accounts table,
 * this loops all adapters, refreshes tokens, fetches last 3 days,
 * and upserts into daily_snapshots.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: once Supabase is configured, uncomment and fill in:
  // const { createClient } = await import('@supabase/supabase-js')
  // const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // const { data: accounts } = await db.from('accounts').select('*')
  // const adapters = [youtubeAdapter, instagramAdapter, tiktokAdapter, snapchatAdapter]
  // for (const adapter of adapters) {
  //   const acct = accounts?.find(a => a.platform === adapter.key)
  //   if (!acct) continue
  //   const refreshed = await adapter.refreshToken(acct)
  //   await db.from('accounts').update(refreshed).eq('platform', adapter.key)
  //   const metrics = await adapter.fetchDaily(refreshed, 3)
  //   for (const m of metrics) {
  //     await db.from('daily_snapshots').upsert({
  //       platform: adapter.key,
  //       snapshot_date: m.date,
  //       followers: m.followers,
  //       views: m.views,
  //       likes: m.likes,
  //       comments: m.comments,
  //       extra: m.extra ?? {},
  //       synced_at: new Date().toISOString(),
  //     }, { onConflict: 'platform,snapshot_date' })
  //   }
  // }

  return NextResponse.json({ ok: true, synced_at: new Date().toISOString() })
}
