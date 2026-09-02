export interface LinkDto {
  code: string;
  shortUrl: string;
  targetUrl: string;
  clickCount: number;
  isCustom: boolean;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface LinkStats {
  code: string;
  targetUrl: string;
  totalClicks: number;
  createdAt: string;
  byDay: { day: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topCountries: { country: string; count: number }[];
}
