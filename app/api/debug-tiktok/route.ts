import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: acct } = await db.from('accounts').select('*').eq('platform', 'tiktok').single()
  if (!acct) return NextResponse.json({ error: 'No tiktok account in DB' })

  const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: acct.refresh_token,
    }),
  })
  const refreshData = await refreshRes.json()

  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count',
    { headers: { Authorization: `Bearer ${acct.access_token}` } }
  )
  const userData = await userRes.json()

  return NextResponse.json({ refresh_response: refreshData, user_response: userData })
}
