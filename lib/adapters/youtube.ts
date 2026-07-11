/**
 * YouTube adapter
 * Auth: OAuth2, scopes youtube.readonly + yt-analytics.readonly
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in env
 * Setup: Google Cloud → enable YouTube Data API v3 + YouTube Analytics API
 *        → OAuth consent screen (External, Testing) → add your email as test user
 *        → run OAuth flow once → store refresh_token in accounts table
 */
import type { Account, DailyMetric, PlatformAdapter } from './types'

export const youtubeAdapter: PlatformAdapter = {
  key: 'youtube',

  async refreshToken(acct: Account): Promise<Account> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: acct.refresh_token!,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!data.access_token) throw new Error(`Token refresh failed: ${data.error} - ${data.error_description}`)
    return {
      ...acct,
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    }
  },

  async fetchDaily(acct: Account, sinceDays: number): Promise<DailyMetric[]> {
    const token = acct.access_token!

    // Look up channel ID if not cached in meta
    let channelId = (acct.meta as Record<string, string>)?.channel_id
    if (!channelId) {
      const chRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const chData = await chRes.json()
      channelId = chData.items?.[0]?.id ?? ''
    }
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - sinceDays)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    // Analytics: views, likes, comments, subscribersGained per day
    const analyticsUrl = new URL('https://youtubeanalytics.googleapis.com/v2/reports')
    analyticsUrl.searchParams.set('ids', 'channel==MINE')
    analyticsUrl.searchParams.set('startDate', fmt(start))
    analyticsUrl.searchParams.set('endDate', fmt(end))
    analyticsUrl.searchParams.set('metrics', 'views,likes,comments,subscribersGained')
    analyticsUrl.searchParams.set('dimensions', 'day')
    const analyticsRes = await fetch(analyticsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const analyticsData = await analyticsRes.json()

    // Current subscriber count + uploads playlist ID
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${channelId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const statsData = await statsRes.json()
    const subscriberCount = Number(statsData.items?.[0]?.statistics?.subscriberCount ?? 0)
    const uploadsPlaylistId = statsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? ''

    // Count uploads per day by paginating the uploads playlist
    const uploadsByDate: Record<string, number> = {}
    if (uploadsPlaylistId) {
      let pageToken: string | undefined
      do {
        const params = new URLSearchParams({
          part: 'contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: '50',
          ...(pageToken ? { pageToken } : {}),
        })
        const plRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const plData = await plRes.json()
        for (const item of plData.items ?? []) {
          const date = String(item.contentDetails?.videoPublishedAt ?? '').slice(0, 10)
          if (date >= fmt(start) && date <= fmt(end)) {
            uploadsByDate[date] = (uploadsByDate[date] ?? 0) + 1
          }
        }
        pageToken = plData.nextPageToken
        // Stop early if all items are older than our window
        const oldest = (plData.items ?? []).at(-1)?.contentDetails?.videoPublishedAt ?? ''
        if (oldest && oldest < fmt(start)) break
      } while (pageToken)
    }

    const rows: DailyMetric[] = (analyticsData.rows ?? []).map((row: number[]) => ({
      date: String(row[0]),
      views: row[1],
      likes: row[2],
      comments: row[3],
      followers: subscriberCount,
      extra: { subscribersGained: row[4], uploads: uploadsByDate[String(row[0])] ?? 0 },
    }))
    return rows
  },
}
