export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SourceAttempt {
  name: string;
  url: string;
  status: 'verified' | 'rejected_still' | 'not_found' | 'blocked' | 'error';
  score?: number;
  statusCode?: number;
  reason?: string;
}

export interface CoverVerification {
  isOriginal: boolean;
  authenticityScore: number; // 0 - 100%
  statusLabel: string; // e.g. "أصلية وموثقة (Official Verified Poster)"
  badgeType: 'verified_original' | 'candidate_original' | 'unverified';
  aspectRatioLabel: string; // e.g. "ملصق رأسي سينمائي قياسي (2:3)"
  sourceTrust: string; // e.g. "أرشيف معتمد موثوق"
  verificationReasons: string[]; // Reasons verifying authenticity
}

export interface CandidateCover {
  url: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  width?: number;
  height?: number;
  source?: string;
  isSuspectedCandidate?: boolean;
  authenticityScore?: number;
}

export interface SiteImageItem {
  id: string;
  url: string;
  proxyUrl: string;
  thumbnailUrl: string;
  caption: string;
  type: 'poster' | 'gallery' | 'cast' | 'still';
  sourceSite: string;
  resolution?: string;
}

export interface CastMember {
  name: string;
  role?: string;
  photoUrl?: string;
  profileUrl?: string;
}

export interface MediaResult {
  mediaType: 'movie' | 'tv_series' | 'episode' | 'documentary' | 'anime';
  studio: string; // e.g. Warner Bros., Universal Pictures, HBO, Netflix, El Cinema
  network?: string;
  series?: string;
  originalTitle: string;
  localizedTitle?: string;
  episodeCode?: string; // e.g. S01E01
  releaseDate: string;
  year?: number;
  director?: string;
  performers: string[]; // Cast / Stars
  categories: string[]; // Genres / Tags
  officialSummary: string; // Official synopsis extracted from the site
  duration: string; // e.g. 148 min / 2h 28m
  officialUrl: string; // Direct URL to target webpage scraped
  confidence: ConfidenceLevel;
  notes?: string;
  coverUrl?: string; // DIRECT image URL of promotional poster
  proxyCoverUrl?: string;
  coverResolution?: string;
  backdropUrl?: string;
  candidateCovers?: CandidateCover[];
  verification?: CoverVerification;
  sourcesTried: SourceAttempt[];
  // Live in-site browser fields
  sourceSite: string; // e.g. "موقع السينما.كوم (elcinema.com)"
  siteImages: SiteImageItem[]; // All images extracted from inside the site
  castMembers: CastMember[]; // Detailed cast members with photos
  country?: string;
  episodesCount?: string;
  screenplay?: string;
  focusTab?: 'gallery' | 'cast' | 'story' | 'source'; // Focused section requested by user
  livePagePreviewHtml?: string;
}

export interface IdentifyResponse {
  success: boolean;
  error?: string;
  result?: MediaResult;
}

export interface HistoryItem {
  id: string;
  query: string;
  originalTitle: string;
  studio: string;
  performers: string[];
  coverUrl?: string;
  confidence: ConfidenceLevel;
  timestamp: number;
}

export type SupportedLanguage = 
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'de'
  | 'ru'
  | 'tr'
  | 'hi'
  | 'id'
  | 'ja'
  | 'ko'
  | 'zh';

export interface TranslationStrings {
  productName: string;
  tagline: string;
  searchPlaceholder: string;
  searchBtn: string;
  searchingBtn: string;
  exampleLabel: string;
  examples: {
    label: string;
    query: string;
  }[];
  // Loading stages:
  stage1: string; // reading query / parsing
  stage2: string; // matching studio + cast on cinema databases
  stage3: string; // fetching official synopsis & details
  stage4: string; // fetching promotional cover (not internal stills)
  // Result panel:
  coverTitle: string;
  coverBadge: string;
  directUrlLabel: string;
  copyUrl: string;
  copied: string;
  openCover: string;
  downloadCover: string;
  productionStudio: string;
  originalTitleLabel: string;
  releaseDateLabel: string;
  directorLabel: string;
  performersLabel: string;
  categoriesLabel: string;
  officialSummaryLabel: string;
  durationLabel: string;
  officialSiteLabel: string;
  episodeCodeLabel: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  sourcesTriedTitle: string;
  noCoverTitle: string;
  noCoverDescription: string;
  stillRejectedNote: string;
  // History:
  recentSearches: string;
  clearHistory: string;
  noHistory: string;
  // Errors & states:
  emptyInputError: string;
  serverError: string;
  tryAnother: string;
  close: string;
}
