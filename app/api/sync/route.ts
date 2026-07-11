import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, supabaseKey)

  const { data: accounts, error } = await db.from('accounts').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, message: 'No accounts configured yet', synced_at: new Date().toISOString() })
  }
  const foundPlatforms = accounts.map((a: { platform: string }) => a.platform)

  const { youtubeAdapter } = await import('../../../lib/adapters/youtube')
  const { instagramAdapter } = await import('../../../lib/adapters/instagram')
  const { tiktokAdapter } = await import('../../../lib/adapters/tiktok')
  const { snapchatAdapter } = await import('../../../lib/adapters/snapchat')
  const adapters = [youtubeAdapter, instagramAdapter, tiktokAdapter, snapchatAdapter]

  const results: Record<string, unknown> = {}

  // TikTok credentials from env vars (fallback when accounts table doesn't return them)
  const tiktokEnvAcct = process.env.TIKTOK_ACCESS_TOKEN ? {
    platform: 'tiktok', handle: null, access_token: process.env.TIKTOK_ACCESS_TOKEN,
    refresh_token: process.env.TIKTOK_REFRESH_TOKEN, token_expires_at: null, meta: {},
  } : null

  for (const adapter of adapters) {
    const acct = accounts.find((a: { platform: string }) => a.platform === adapter.key)
      ?? (adapter.key === 'tiktok' ? tiktokEnvAcct : null)
    if (!acct) { results[adapter.key] = 'no account'; continue }

    try {
      const refreshed = await adapter.refreshToken(acct)
      await db.from('accounts').update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: refreshed.token_expires_at,
      }).eq('platform', adapter.key)

      const sinceDays = Number(req.nextUrl.searchParams.get('days') ?? '3')
      const metrics = await adapter.fetchDaily(refreshed, sinceDays)
      for (const m of metrics) {
        await db.from('daily_snapshots').upsert({
          platform: adapter.key,
          snapshot_date: m.date,
          followers: m.followers ?? null,
          views: m.views ?? null,
          likes: m.likes ?? null,
          comments: m.comments ?? null,
          extra: m.extra ?? {},
          synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,snapshot_date' })
      }
      results[adapter.key] = `synced ${metrics.length} days`
    } catch (e) {
      results[adapter.key] = `error: ${(e as Error).message}`
    }
  }

  return NextResponse.json({ ok: true, synced_at: new Date().toISOString(), results, foundPlatforms })
}
