import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: `${baseUrl}/api/auth/tiktok/callback`,
    response_type: 'code',
    scope: 'user.info.basic',
  })
  return NextResponse.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`)
}
