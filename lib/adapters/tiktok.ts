/**
 * TikTok adapter — core metrics only (per-video views/likes/comments/shares)
 * Auth: OAuth2, scopes user.info.basic + video.list
 * Token TTL: access 24h / refresh 365d
 * NOTE: sandbox works immediately; production requires TikTok app audit (~1-2 weeks)
 * Watch-time, traffic sources, and follower growth over time are NOT available
 * to individual developers for free — do not add them.
 */
import type { Account, DailyMetric, PlatformAdapter } from './types'

export const tiktokAdapter: PlatformAdapter = {
  key: 'tiktok',

  async refreshToken(acct: Account): Promise<Account> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: acct.refresh_token!,
      }),
    })
    const data = await res.json()
    return {
      ...acct,
      access_token: data.data?.access_token ?? acct.access_token,
      refresh_token: data.data?.refresh_token ?? acct.refresh_token,
      token_expires_at: new Date(Date.now() + (data.data?.expires_in ?? 86400) * 1000).toISOString(),
    }
  },

  async fetchDaily(acct: Account, sinceDays: number): Promise<DailyMetric[]> {
    const token = acct.access_token!
    const sinceMs = Date.now() - sinceDays * 86400000

    // Step 1: list video IDs
    const listRes = await fetch('https://open.tiktokapis.com/v2/video/list/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_count: 20 }),
    })
    const listData = await listRes.json()
    const videoIds: string[] = (listData.data?.videos ?? []).map((v: { id: string }) => v.id)

    if (!videoIds.length) return []

    // Step 2: query metrics for those IDs
    const queryRes = await fetch('https://open.tiktokapis.com/v2/video/query/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { video_ids: videoIds },
        fields: ['view_count', 'like_count', 'comment_count', 'share_count', 'create_time'],
      }),
    })
    const queryData = await queryRes.json()

    // Step 3: follower count
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=follower_count',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const userData = await userRes.json()
    const followerCount: number = userData.data?.user?.follower_count ?? 0

    // Bucket by date
    const byDate: Record<string, DailyMetric> = {}
    for (const v of queryData.data?.videos ?? []) {
      const date = new Date(v.create_time * 1000).toISOString().slice(0, 10)
      if (new Date(v.create_time * 1000).getTime() < sinceMs) continue
      byDate[date] = byDate[date] ?? { date, followers: followerCount, views: 0, likes: 0, comments: 0, extra: { shares: 0 } }
      byDate[date].views! += v.view_count ?? 0
      byDate[date].likes! += v.like_count ?? 0
      byDate[date].comments! += v.comment_count ?? 0
      byDate[date].extra!.shares += v.share_count ?? 0
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  },
}
