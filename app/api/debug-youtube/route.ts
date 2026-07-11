import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: acct } = await db.from('accounts').select('*').eq('platform', 'youtube').single()

  if (!acct) return NextResponse.json({ error: 'No youtube account in DB' })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: acct.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return NextResponse.json({ google_response: data, has_refresh_token: !!acct.refresh_token })
}
