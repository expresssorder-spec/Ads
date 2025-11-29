export interface AdData {
  campaignName: string;
  adSetName: string;
  adName: string;
  amountSpent: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  results: number; // Conversions/Purchases/Messages
  costPerResult: number; // CPA
  roas: number;
  currency: string;
  resultType: string; // 'purchase', 'message', 'lead', 'generic'
}

export interface AnalysisResult {
  markdownReport: string;
  summary: {
    totalSpent: number;
    totalRevenue: number; // inferred from ROAS * Spent if not explicit
    avgRoas: number;
    avgCpa: number;
    totalResults: number;
    dominantResultType: string;
  };
}

export enum AppState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}