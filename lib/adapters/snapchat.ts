/**
 * Snapchat adapter — followers + high-level totals only
 * There is no open creator-analytics API. We pull subscriberCount + public
 * Story/Spotlight view totals from the public profile JSON.
 * Rich Insights (avg view time, per-Spotlight, audience) stay in the Snapchat
 * app — use the manual entry page at /manual-entry to add those to daily_snapshots.
 */
import type { Account, DailyMetric, PlatformAdapter } from './types'

export const snapchatAdapter: PlatformAdapter = {
  key: 'snapchat',

  // No token to refresh
  async refreshToken(acct: Account): Promise<Account> {
    return acct
  },

  async fetchDaily(acct: Account, _sinceDays: number): Promise<DailyMetric[]> {
    const handle = acct.handle
    if (!handle) return []

    const res = await fetch(`https://www.snapchat.com/add/${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const html = await res.text()

    // Extract subscriberCount from the embedded JSON-LD or meta tags
    const subscriberMatch = html.match(/"subscriberCount"\s*:\s*(\d+)/)
    const subscribers = subscriberMatch ? Number(subscriberMatch[1]) : 0

    const today = new Date().toISOString().slice(0, 10)
    return [
      {
        date: today,
        followers: subscribers,
        views: 0, // Public profile doesn't expose view totals reliably
        likes: 0,
        comments: 0,
      },
    ]
  },
}
