import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin

  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 })

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${baseUrl}/api/auth/tiktok/callback`,
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return NextResponse.json({ error: 'No access token', tokens }, { status: 400 })
  }

  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const userData = await userRes.json()
  const user = userData.data?.user

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await db.from('accounts').upsert({
    platform: 'tiktok',
    handle: user?.display_name,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 86400) * 1000).toISOString(),
    meta: {},
  }, { onConflict: 'platform' })

  return NextResponse.redirect(`${baseUrl}/?connected=tiktok`)
}
