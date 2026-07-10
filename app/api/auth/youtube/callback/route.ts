import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'No code' }, { status: 400 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${baseUrl}/api/auth/youtube/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()
  if (!tokens.refresh_token) {
    return NextResponse.json({ error: 'No refresh token returned', tokens }, { status: 400 })
  }

  // Get channel ID
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const channelData = await channelRes.json()
  const channel = channelData.items?.[0]
  const channelId = channel?.id
  const handle = channel?.snippet?.title

  // Store in Supabase
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await db.from('accounts').upsert({
    platform: 'youtube',
    handle,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    meta: { channel_id: channelId },
  }, { onConflict: 'platform' })

  return NextResponse.redirect(`${baseUrl}/?connected=youtube`)
}
