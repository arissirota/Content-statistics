/**
 * Instagram adapter
 * Auth: Facebook Login → long-lived user token (60-day TTL) → Page token
 * Scopes: instagram_basic, instagram_manage_insights, pages_read_engagement
 * Setup: Meta app (Business type) → Instagram Graph API → Dev mode
 *        → add yourself as admin → Facebook Login once
 *        → store long-lived token + ig_user_id in accounts.meta
 * Refresh: long-lived token must be refreshed before day 60
 */
import type { Account, DailyMetric, PlatformAdapter } from './types'

export const instagramAdapter: PlatformAdapter = {
  key: 'instagram',

  async refreshToken(acct: Account): Promise<Account> {
    const res = await fetch(
      `https://graph.facebook.com/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          fb_exchange_token: acct.access_token!,
        })
    )
    const data = await res.json()
    return {
      ...acct,
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }
  },

  async fetchDaily(acct: Account, sinceDays: number): Promise<DailyMetric[]> {
    const igUserId = (acct.meta as Record<string, string>).ig_user_id
    const token = acct.access_token!
    const since = Math.floor((Date.now() - sinceDays * 86400000) / 1000)
    const until = Math.floor(Date.now() / 1000)

    // Follower count + reach per day
    const insightsRes = await fetch(
      `https://graph.facebook.com/v20.0/${igUserId}/insights?` +
        new URLSearchParams({
          metric: 'reach,follower_count',
          period: 'day',
          since: String(since),
          until: String(until),
          access_token: token,
        })
    )
    const insightsData = await insightsRes.json()

    // Per-post likes/comments bucketed by day
    const mediaRes = await fetch(
      `https://graph.facebook.com/v20.0/${igUserId}/media?` +
        new URLSearchParams({
          fields: 'timestamp,like_count,comments_count',
          since: String(since),
          until: String(until),
          access_token: token,
        })
    )
    const mediaData = await mediaRes.json()

    const byDate: Record<string, { likes: number; comments: number }> = {}
    for (const post of mediaData.data ?? []) {
      const date = String(post.timestamp).slice(0, 10)
      byDate[date] = byDate[date] ?? { likes: 0, comments: 0 }
      byDate[date].likes += post.like_count ?? 0
      byDate[date].comments += post.comments_count ?? 0
    }

    // Build per-day array from insights
    const followerSeries = insightsData.data?.find((d: { name: string }) => d.name === 'follower_count')?.values ?? []
    return followerSeries.map((entry: { end_time: string; value: number }) => {
      const date = String(entry.end_time).slice(0, 10)
      return {
        date,
        followers: entry.value,
        views: 0,
        likes: byDate[date]?.likes ?? 0,
        comments: byDate[date]?.comments ?? 0,
      }
    })
  },
}
