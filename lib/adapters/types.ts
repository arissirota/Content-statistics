export interface DailyMetric {
  date: string // YYYY-MM-DD
  followers?: number
  views?: number
  likes?: number
  comments?: number
  extra?: Record<string, number>
}

export interface Account {
  id: string
  platform: 'youtube' | 'instagram' | 'tiktok' | 'snapchat'
  handle: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  meta: Record<string, unknown>
}

export interface PlatformAdapter {
  key: 'youtube' | 'instagram' | 'tiktok' | 'snapchat'
  refreshToken(acct: Account): Promise<Account>
  fetchDaily(acct: Account, sinceDays: number): Promise<DailyMetric[]>
}
