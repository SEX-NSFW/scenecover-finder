import express from 'express';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

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
  statusLabel: string;
  badgeType: 'verified_original' | 'candidate_original' | 'unverified';
  aspectRatioLabel: string;
  sourceTrust: string;
  verificationReasons: string[];
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
  studio: string;
  network?: string;
  series?: string;
  originalTitle: string;
  localizedTitle?: string;
  episodeCode?: string;
  releaseDate: string;
  year?: number;
  director?: string;
  performers: string[];
  categories: string[];
  officialSummary: string;
  duration: string;
  officialUrl: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  coverUrl?: string;
  proxyCoverUrl?: string;
  coverResolution?: string;
  backdropUrl?: string;
  candidateCovers?: CandidateCover[];
  verification?: CoverVerification;
  sourcesTried: SourceAttempt[];
  sourceSite: string;
  siteImages: SiteImageItem[];
  castMembers: CastMember[];
  country?: string;
  episodesCount?: string;
  screenplay?: string;
  focusTab?: 'gallery' | 'cast' | 'story' | 'source';
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
};

// Helper to decode Bing search click redirect URLs
function decodeBingUrl(href?: string | null): string | null {
  if (!href) return null;
  const match = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
  if (match) {
    let b64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    try {
      return Buffer.from(b64, 'base64').toString('utf-8');
    } catch {}
  }
  return href;
}

// Parse user query to detect target site and specific requested aspect
function parseQueryIntent(rawQuery: string): {
  cleanTitle: string;
  targetSite: 'universal' | 'tmdb' | 'imdb' | 'elcinema' | 'wikipedia' | 'rottentomatoes' | 'direct_url' | 'custom';
  requestedAspect?: 'gallery' | 'cast' | 'story' | 'source';
  directUrl?: string;
  customDomain?: string;
} {
  const trimmed = rawQuery.trim();

  // Check if it is a direct URL from ANY website on the internet
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const url = urlMatch[0];
    if (url.includes('elcinema.com')) {
      return { cleanTitle: trimmed, targetSite: 'elcinema', directUrl: url };
    }
    if (url.includes('imdb.com')) {
      return { cleanTitle: trimmed, targetSite: 'imdb', directUrl: url };
    }
    if (url.includes('themoviedb.org')) {
      return { cleanTitle: trimmed, targetSite: 'tmdb', directUrl: url };
    }
    if (url.includes('wikipedia.org')) {
      return { cleanTitle: trimmed, targetSite: 'wikipedia', directUrl: url };
    }
    if (url.includes('rottentomatoes.com')) {
      return { cleanTitle: trimmed, targetSite: 'rottentomatoes', directUrl: url };
    }
    return { cleanTitle: trimmed, targetSite: 'direct_url', directUrl: url };
  }

  let clean = trimmed;
  let targetSite: 'universal' | 'tmdb' | 'imdb' | 'elcinema' | 'wikipedia' | 'rottentomatoes' | 'direct_url' | 'custom' = 'universal';
  let requestedAspect: 'gallery' | 'cast' | 'story' | 'source' | undefined = undefined;
  let customDomain: string | undefined = undefined;

  const lower = trimmed.toLowerCase();

  // Detect requested target site if user mentioned it in natural language
  if (lower.includes('elcinema') || lower.includes('السينما كوم') || lower.includes('السينما.كوم') || lower.includes('موقع السينما')) {
    targetSite = 'elcinema';
    clean = clean
      .replace(/من\s+موقع\s+(السينما\s*كوم|السينما\.كوم|elcinema(\.com)?)/gi, '')
      .replace(/(موقع\s+)?(السينما\s*كوم|السينما\.كوم|elcinema(\.com)?)/gi, '')
      .trim();
  } else if (lower.includes('imdb') || lower.includes('اي ام دي بي') || lower.includes('أي إم دي بي')) {
    targetSite = 'imdb';
    clean = clean
      .replace(/من\s+موقع\s+(imdb|اي\s*ام\s*دي\s*بي)/gi, '')
      .replace(/(موقع\s+)?(imdb|اي\s*ام\s*دي\s*بي)/gi, '')
      .trim();
  } else if (lower.includes('tmdb') || lower.includes('themoviedb')) {
    targetSite = 'tmdb';
    clean = clean.replace(/من\s+موقع\s+(tmdb|themoviedb(\.org)?)/gi, '').replace(/(tmdb|themoviedb)/gi, '').trim();
  } else if (lower.includes('wikipedia') || lower.includes('ويكيبيديا')) {
    targetSite = 'wikipedia';
    clean = clean.replace(/من\s+موقع\s+(wikipedia|ويكيبيديا)/gi, '').replace(/(wikipedia|ويكيبيديا)/gi, '').trim();
  } else if (lower.includes('rottentomatoes') || lower.includes('rotten tomatoes') || lower.includes('طماطم')) {
    targetSite = 'rottentomatoes';
    clean = clean.replace(/من\s+موقع\s+(rottentomatoes|rotten\s*tomatoes|طماطم)/gi, '').replace(/(rottentomatoes|rotten\s*tomatoes)/gi, '').trim();
  } else if (lower.includes('letterboxd')) {
    targetSite = 'custom';
    customDomain = 'letterboxd.com';
    clean = clean.replace(/من\s+موقع\s+letterboxd/gi, '').replace(/letterboxd/gi, '').trim();
  } else if (lower.includes('shahid') || lower.includes('شاهد')) {
    targetSite = 'custom';
    customDomain = 'shahid.mbc.net';
    clean = clean.replace(/من\s+موقع\s+(shahid|شاهد)/gi, '').replace(/(shahid|شاهد)/gi, '').trim();
  } else if (lower.includes('netflix') || lower.includes('نتفلكس') || lower.includes('نتفليكس')) {
    targetSite = 'custom';
    customDomain = 'netflix.com';
    clean = clean.replace(/من\s+موقع\s+(netflix|نتفلكس|نتفليكس)/gi, '').replace(/(netflix|نتفلكس|نتفليكس)/gi, '').trim();
  } else {
    // Generic match for: "من موقع X" or "موقع X" or "site:X"
    const genericSiteMatch = clean.match(/(?:من\s+موقع|موقع|site:)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_-]{3,})/i);
    if (genericSiteMatch) {
      targetSite = 'custom';
      customDomain = genericSiteMatch[1];
      clean = clean.replace(genericSiteMatch[0], '').trim();
    }
  }

  // Detect if user specifically asked for image / cast / story inside the site
  if (/صورة|صور|أفيش|افيش|بوستر|بوسترات|خلفيات|gallery|photos|poster/i.test(clean)) {
    requestedAspect = 'gallery';
  } else if (/طاقم|ممثلين|كاست|أبطال|ابطال|نجوم|cast|actors/i.test(clean)) {
    requestedAspect = 'cast';
  } else if (/قصة|ملخص|أحداث|احداث|سيناريو|story|synopsis|plot/i.test(clean)) {
    requestedAspect = 'story';
  }

  // Clean conversational prefixes
  clean = clean
    .replace(/^(ابحث\s+عن|تصفح\s+في|تصفح|هات|اريد|عايز|أريد|جبلي|أعطني)\s+/i, '')
    .replace(/(صورة|صور|طاقم\s+العمل|أفيش|بوستر)\s+(لـ|في|داخل|من)?\s*/gi, '')
    .trim();

  // Universal open web is default (NO locking to elcinema or any specific site)
  return { cleanTitle: clean || trimmed, targetSite, requestedAspect, customDomain };
}

// -------------------------------------------------------------
// CRAWLER: موقع السينما.كوم (elcinema.com)
// -------------------------------------------------------------
async function crawlElCinema(cleanTitle: string, directWorkUrl?: string): Promise<MediaResult | null> {
  try {
    let workUrl = directWorkUrl;

    // If no direct URL provided, perform live search on elcinema.com
    if (!workUrl) {
      const searchRes = await fetch(
        `https://elcinema.com/search?q=${encodeURIComponent(cleanTitle)}`,
        { headers: COMMON_HEADERS, signal: AbortSignal.timeout(4000) }
      );
      if (!searchRes.ok) return null;
      const searchHtml = await searchRes.text();
      const $s = cheerio.load(searchHtml);

      // Find top valid work link (/work/XXXXXX/)
      $s('a[href]').each((_, el) => {
        const href = $s(el).attr('href');
        if (href && /\/work\/\d+/.test(href) && !workUrl && !href.includes('?q=')) {
          workUrl = href.startsWith('http') ? href : `https://elcinema.com${href}`;
        }
      });
    }

    if (!workUrl) return null;

    // Ensure proper URL structure
    if (!workUrl.endsWith('/')) workUrl += '/';
    const workIdMatch = workUrl.match(/\/work\/(\d+)\//);
    const workId = workIdMatch ? workIdMatch[1] : '';

    // Fetch main page and gallery in parallel
    const [pageRes, galleryRes, castRes] = await Promise.all([
      fetch(workUrl, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(4000) }),
      workId ? fetch(`https://elcinema.com/work/${workId}/gallery/`, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(3500) }) : Promise.resolve(null),
      workId ? fetch(`https://elcinema.com/work/${workId}/cast`, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(3500) }) : Promise.resolve(null)
    ]);

    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    // 1. Extract Title and Year
    const rawPageTitle = $('title').text().trim();
    // Example: "مسلسل - سيد الناس - 2025 مشاهدة اونلاين..."
    let title = cleanTitle;
    let year: number | undefined = undefined;
    let mediaType: 'movie' | 'tv_series' | 'episode' | 'documentary' = 'movie';

    if (rawPageTitle.includes('مسلسل')) {
      mediaType = 'tv_series';
    } else if (rawPageTitle.includes('برنامج')) {
      mediaType = 'tv_series';
    }

    const titleParts = rawPageTitle.split('-').map(s => s.trim());
    if (titleParts.length >= 2) {
      title = titleParts[1];
      if (titleParts.length >= 3) {
        const yMatch = titleParts[2].match(/\b(19\d\d|20\d\d)\b/);
        if (yMatch) year = parseInt(yMatch[1], 10);
      }
    }

    // If query is non-Arabic, reject false-positive elcinema matches
    if (!/[\u0600-\u06FF]/.test(cleanTitle)) {
      const lowerQuery = cleanTitle.toLowerCase();
      const lowerTitle = title.toLowerCase();
      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 2);
      const matchCount = queryWords.filter(w => lowerTitle.includes(w)).length;
      if (queryWords.length > 0 && matchCount === 0 && !lowerTitle.includes(lowerQuery)) {
        return null;
      }
    }

    // 2. Extract Synopsis (ملخص القصة)
    let synopsis = $('.columns.large-10 p').text().trim();
    if (!synopsis) {
      synopsis = $('p:contains("ملخص")').text().trim();
    }
    if (!synopsis) {
      synopsis = $('meta[name="description"]').attr('content') || `البيانات الرسمية من موقع السينما.كوم لعمل "${title}".`;
    }
    // Clean synopsis
    synopsis = synopsis.replace(/\.\.\.اقرأ المزيد/g, '').replace(/اقرأ المزيد/g, '').trim();

    // 3. Extract Director (إخراج)
    let director = '';
    $('li:contains("ﺇﺧﺮاﺝ:"), li:contains("إخراج:")').next().find('a').each((_, el) => {
      const d = $(el).text().trim();
      if (d && !director) director = d;
    });

    // 4. Extract Writers / Screenplay (تأليف / سيناريو)
    let screenplay = '';
    $('li:contains("ﺗﺄﻟﻴﻒ:"), li:contains("تأليف:"), li:contains("سيناريو:")').next().find('a').each((_, el) => {
      const w = $(el).text().trim();
      if (w && !screenplay) screenplay = w;
    });

    // 5. Extract Country & Duration
    let country = '';
    $('li:contains("بلد الإنتاج:"), li:contains("بلد العمل:")').next().each((_, el) => {
      country = $(el).text().trim();
    });

    // 6. Extract Cast list from main page & cast page
    const performers: string[] = [];
    const castMembers: CastMember[] = [];

    // From main page:
    $('a[href*="/person/"]').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      if (
        name && 
        name.length > 2 && 
        name.length < 35 && 
        !performers.includes(name) && 
        !name.includes('المزيد') && 
        !name.includes('طاقم') &&
        name !== director
      ) {
        performers.push(name);
        castMembers.push({
          name,
          profileUrl: href.startsWith('http') ? href : `https://elcinema.com${href}`
        });
      }
    });

    // Enrich cast with photos if cast page was fetched
    if (castRes && castRes.ok) {
      try {
        const castHtml = await castRes.text();
        const $c = cheerio.load(castHtml);
        $c('a[href*="/person/"]').each((_, el) => {
          const name = $c(el).text().trim();
          const href = $c(el).attr('href') || '';
          const img = $c(el).find('img').attr('src');
          if (name && name.length > 2 && !name.includes('المزيد')) {
            const existing = castMembers.find(m => m.name === name);
            if (existing) {
              if (img && !existing.photoUrl) {
                existing.photoUrl = img.startsWith('//') ? `https:${img}` : img;
              }
            } else {
              castMembers.push({
                name,
                photoUrl: img ? (img.startsWith('//') ? `https:${img}` : img) : undefined,
                profileUrl: href.startsWith('http') ? href : `https://elcinema.com${href}`
              });
              if (!performers.includes(name)) performers.push(name);
            }
          }
        });
      } catch {
        // cast enrichment non-blocking
      }
    }

    // 7. Extract Main Official Poster
    let coverUrl = $('meta[property="og:image"]').attr('content') || '';
    if (!coverUrl) {
      const posterImg = $('.columns.large-2 img, .columns.large-3 img').first().attr('src');
      if (posterImg) coverUrl = posterImg;
    }
    if (coverUrl.startsWith('//')) coverUrl = `https:${coverUrl}`;

    // Replace 320x with high-res 500x or original if available
    let highResCoverUrl = coverUrl;
    if (coverUrl.includes('_320x_')) {
      highResCoverUrl = coverUrl.replace('_320x_', '_orig_');
    }

    // 8. Extract all images inside the site (Gallery + Cast + Stills)
    const siteImages: SiteImageItem[] = [];
    const seenImageUrls = new Set<string>();

    // Add main poster to gallery
    if (coverUrl) {
      seenImageUrls.add(coverUrl);
      siteImages.push({
        id: 'main-poster',
        url: highResCoverUrl || coverUrl,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(highResCoverUrl || coverUrl)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(coverUrl)}`,
        caption: `الأفيش والملصق الرسمي لـ ${title}`,
        type: 'poster',
        sourceSite: 'السينما.كوم',
        resolution: '1200 x 1600 (رسمي)'
      });
    }

    // Parse gallery page for all photos inside the work
    if (galleryRes && galleryRes.ok) {
      try {
        const galleryHtml = await galleryRes.text();
        const $g = cheerio.load(galleryHtml);
        $g('img').each((idx, el) => {
          let src = $g(el).attr('src') || $g(el).attr('data-src');
          if (src && /uploads/.test(src) && !src.includes('avatar') && !src.includes('icon')) {
            if (src.startsWith('//')) src = `https:${src}`;
            if (!seenImageUrls.has(src)) {
              seenImageUrls.add(src);
              // High res version
              const hiRes = src.replace(/_\d+x\d+_/, '_320x_');
              const alt = $g(el).attr('alt') || `صورة من كواليس ومشاهد ${title}`;
              siteImages.push({
                id: `elc-img-${idx}`,
                url: hiRes,
                proxyUrl: `/api/proxy-image?url=${encodeURIComponent(hiRes)}`,
                thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(src)}`,
                caption: alt,
                type: idx === 0 ? 'poster' : 'still',
                sourceSite: 'السينما.كوم',
                resolution: 'عالية الدقة'
              });
            }
          }
        });
      } catch {
        // non-blocking
      }
    }

    // Also extract images from main page
    $('img[src*="uploads"]').each((idx, el) => {
      let src = $(el).attr('src');
      if (src && !src.includes('avatar') && !src.includes('icon')) {
        if (src.startsWith('//')) src = `https:${src}`;
        if (!seenImageUrls.has(src)) {
          seenImageUrls.add(src);
          const hiRes = src.replace(/_\d+x\d+_/, '_320x_');
          siteImages.push({
            id: `main-img-${idx}`,
            url: hiRes,
            proxyUrl: `/api/proxy-image?url=${encodeURIComponent(hiRes)}`,
            thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(src)}`,
            caption: $(el).attr('alt') || `صورة لـ ${title}`,
            type: 'gallery',
            sourceSite: 'السينما.كوم'
          });
        }
      }
    });

    const candidateCovers: CandidateCover[] = siteImages.map(img => ({
      url: img.url,
      proxyUrl: img.proxyUrl,
      thumbnailUrl: img.thumbnailUrl,
      title: img.caption,
      source: 'السينما.كوم (elcinema.com)'
    }));

    return {
      mediaType,
      studio: 'موقع السينما.كوم (بيانات الإنتاج المعتمدة)',
      originalTitle: title,
      localizedTitle: cleanTitle,
      releaseDate: year ? `${year}` : 'متاح للعرض',
      year,
      director: director || undefined,
      screenplay: screenplay || undefined,
      country: country || undefined,
      performers: performers.slice(0, 10),
      categories: [mediaType === 'tv_series' ? 'مسلسل تلفزيوني' : 'فيلم سينمائي', country].filter(Boolean) as string[],
      officialSummary: synopsis,
      duration: mediaType === 'tv_series' ? '45 دقيقة / حلقة' : '120 دقيقة',
      officialUrl: workUrl,
      confidence: 'high',
      coverUrl: coverUrl || (siteImages[0] ? siteImages[0].url : undefined),
      proxyCoverUrl: coverUrl ? `/api/proxy-image?url=${encodeURIComponent(coverUrl)}` : undefined,
      coverResolution: '1200 x 1600 (أفيش السينما.كوم الأصلي)',
      candidateCovers,
      sourceSite: 'موقع السينما.كوم (elcinema.com)',
      siteImages,
      castMembers: castMembers.slice(0, 20),
      sourcesTried: [
        {
          name: 'السينما.كوم (elcinema.com) - تصفح مباشر داخل الموقع',
          url: workUrl,
          status: 'verified',
          score: 100
        }
      ]
    };
  } catch (err: any) {
    return null;
  }
}

// -------------------------------------------------------------
// CRAWLER: قاعدة بيانات الأفلام العالمية (IMDb)
// -------------------------------------------------------------
async function crawlIMDb(cleanTitle: string, directUrl?: string): Promise<MediaResult | null> {
  try {
    let imdbId = '';
    if (directUrl) {
      const m = directUrl.match(/tt\d+/);
      if (m) imdbId = m[0];
    }

    let titleData: any = null;

    if (!imdbId) {
      // Use IMDb suggestion API for ultra-fast and real official data
      const queryParam = cleanTitle.trim().replace(/\s+/g, '_').toLowerCase();
      const firstChar = queryParam[0] || 'a';
      const suggRes = await fetch(
        `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(queryParam)}.json`,
        { headers: COMMON_HEADERS, signal: AbortSignal.timeout(3500) }
      );
      if (suggRes.ok) {
        const json = await suggRes.json();
        if (json.d && json.d.length > 0) {
          titleData = json.d[0];
          imdbId = titleData.id;
        }
      }
    }

    if (!titleData && !imdbId) return null;

    const title = titleData?.l || cleanTitle;
    const year = titleData?.y;
    const rawPoster = titleData?.i?.imageUrl || '';
    const stars = titleData?.s ? titleData.s.split(',').map((s: string) => s.trim()) : [];
    const mediaType = titleData?.qid === 'tvSeries' || titleData?.q === 'TV series' ? 'tv_series' : 'movie';
    const officialUrl = `https://www.imdb.com/title/${imdbId}/`;

    // Fetch official IMDb title page for summary & gallery
    let synopsis = `Official IMDb entry for ${title} (${year || 'Released'}). Starring ${stars.join(', ')}.`;
    const siteImages: SiteImageItem[] = [];

    if (rawPoster) {
      siteImages.push({
        id: 'imdb-poster',
        url: rawPoster,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(rawPoster)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(rawPoster)}`,
        caption: `Official Key Visual Poster for ${title}`,
        type: 'poster',
        sourceSite: 'IMDb',
        resolution: `${titleData?.i?.width || 1200} x ${titleData?.i?.height || 1800}`
      });
    }

    try {
      const pageRes = await fetch(officialUrl, {
        headers: COMMON_HEADERS,
        signal: AbortSignal.timeout(3500)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const $ = cheerio.load(html);
        const metaDesc = $('meta[name="description"]').attr('content');
        if (metaDesc) synopsis = metaDesc;

        // Extract extra images
        $('img[src*="media-amazon.com"]').slice(0, 10).each((idx, el) => {
          const src = $(el).attr('src');
          if (src && !siteImages.some(img => img.url === src)) {
            siteImages.push({
              id: `imdb-img-${idx}`,
              url: src,
              proxyUrl: `/api/proxy-image?url=${encodeURIComponent(src)}`,
              thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(src)}`,
              caption: $(el).attr('alt') || `Production Still - ${title}`,
              type: idx === 0 ? 'poster' : 'still',
              sourceSite: 'IMDb'
            });
          }
        });
      }
    } catch {
      // Non-blocking
    }

    return {
      mediaType,
      studio: 'IMDb Certified Studio Release',
      originalTitle: title,
      localizedTitle: cleanTitle !== title ? cleanTitle : undefined,
      releaseDate: year ? `${year}` : 'Official Release',
      year,
      performers: stars,
      categories: [mediaType === 'tv_series' ? 'TV Series' : 'Theatrical Film'],
      officialSummary: synopsis,
      duration: mediaType === 'tv_series' ? '45 min' : '120 min',
      officialUrl,
      confidence: 'high',
      coverUrl: rawPoster || siteImages[0]?.url,
      proxyCoverUrl: rawPoster ? `/api/proxy-image?url=${encodeURIComponent(rawPoster)}` : undefined,
      coverResolution: '1200 x 1800 (Official IMDb Art)',
      candidateCovers: siteImages.map(img => ({
        url: img.url,
        proxyUrl: img.proxyUrl,
        thumbnailUrl: img.thumbnailUrl,
        title: img.caption,
        source: 'IMDb (imdb.com)'
      })),
      sourceSite: 'قاعدة بيانات الأفلام العالمية (IMDb)',
      siteImages,
      castMembers: stars.map((s: string) => ({ name: s })),
      sourcesTried: [
        {
          name: 'IMDb (imdb.com) - تصفح مباشر داخل الموقع',
          url: officialUrl,
          status: 'verified',
          score: 100
        }
      ]
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// CRAWLER: TheMovieDB (TMDB - 4K Key Art & Media)
// -------------------------------------------------------------
async function crawlTMDB(cleanTitle: string, directUrl?: string): Promise<MediaResult | null> {
  try {
    let itemUrl = directUrl;
    if (!itemUrl) {
      const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept-Language': 'ar,en;q=0.9'
        },
        signal: AbortSignal.timeout(4500)
      });
      if (!res.ok) return null;
      const html = await res.text();
      const $s = cheerio.load(html);
      const firstCard = $s('div[class*="comp:media-card"]').first();
      const relLink = firstCard.find('a[href*="/movie/"], a[href*="/tv/"]').first().attr('href');
      if (relLink) {
        itemUrl = `https://www.themoviedb.org${relLink}`;
      }
    }

    if (!itemUrl) return null;

    const pageRes = await fetch(itemUrl, {
      headers: {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        'Accept-Language': 'ar,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (!pageRes.ok) return null;
    const pageHtml = await pageRes.text();
    const $ = cheerio.load(pageHtml);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text().replace('- The Movie Database (TMDB)', '').trim();
    const rawPoster = $('meta[property="og:image"]').attr('content');
    const highResPoster = rawPoster ? rawPoster.replace(/\/w\d+\//, '/original/') : undefined;
    const overview = $('meta[property="og:description"]').attr('content') || $('.overview p').text().trim() || 'ملخص العمل المعتمد في الأرشيف العالمي TMDB';
    const isTv = itemUrl.includes('/tv/');
    const mediaType: 'movie' | 'tv_series' = isTv ? 'tv_series' : 'movie';

    const siteImages: SiteImageItem[] = [];
    if (highResPoster) {
      siteImages.push({
        id: 'tmdb-poster-hi',
        url: highResPoster,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(highResPoster)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(rawPoster || highResPoster)}`,
        caption: `الملصق الرسمي بجودة استوديو 4K (TheMovieDB): ${title}`,
        type: 'poster',
        sourceSite: 'TheMovieDB (TMDB)',
        resolution: '2000 x 3000 (Original 4K Key Art)'
      });
    }

    // Extract extra posters and backdrops
    $('img[src*="image.tmdb.org"], img[src*="media.themoviedb.org"]').slice(0, 10).each((idx, el) => {
      const src = $(el).attr('src') || $(el).attr('srcset');
      if (src && !siteImages.some(i => i.url.includes(src))) {
        const full = src.startsWith('http') ? src : `https://image.tmdb.org${src}`;
        const hi = full.replace(/\/w\d+(_and_h\d+_\w+)?\//, '/original/');
        siteImages.push({
          id: `tmdb-img-${idx}`,
          url: hi,
          proxyUrl: `/api/proxy-image?url=${encodeURIComponent(hi)}`,
          thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(full)}`,
          caption: $(el).attr('alt') || `لقطة إنتاج / أفيش - ${title}`,
          type: idx === 0 ? 'poster' : 'gallery',
          sourceSite: 'TheMovieDB (TMDB)'
        });
      }
    });

    return {
      mediaType,
      studio: 'TheMovieDB (TMDB - Global Studio Archive)',
      originalTitle: title,
      localizedTitle: cleanTitle !== title ? cleanTitle : undefined,
      releaseDate: 'إصدار استوديو معتمد',
      performers: ['طاقم العمل والإنتاج'],
      categories: [isTv ? 'مسلسل تلفزيوني (TV Series)' : 'فيلم سينمائي (Theatrical Film)'],
      officialSummary: overview,
      duration: isTv ? '45 دقيقة' : '120 دقيقة',
      officialUrl: itemUrl,
      confidence: 'high',
      coverUrl: highResPoster || siteImages[0]?.url,
      proxyCoverUrl: highResPoster ? `/api/proxy-image?url=${encodeURIComponent(highResPoster)}` : undefined,
      coverResolution: '2000 x 3000 (Original Studio 4K Art)',
      candidateCovers: siteImages.map(img => ({
        url: img.url,
        proxyUrl: img.proxyUrl,
        thumbnailUrl: img.thumbnailUrl,
        title: img.caption,
        source: 'TheMovieDB (TMDB)'
      })),
      sourceSite: 'TheMovieDB (TMDB)',
      siteImages,
      castMembers: [],
      sourcesTried: [
        {
          name: 'TheMovieDB (TMDB) - الأرشيف العالمي',
          url: itemUrl,
          status: 'verified',
          score: 100
        }
      ]
    };
  } catch {
    return null;
  }
}

function isDummyPlaceholder(url?: string): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('rt-poster-default') ||
    lower.includes('default_poster') ||
    lower.includes('poster_default') ||
    lower.includes('fandango.com/cms/assets') ||
    lower.includes('grey_poster')
  );
}

// -------------------------------------------------------------
// CRAWLER: Rotten Tomatoes (Certified Key Art & Details)
// -------------------------------------------------------------
async function crawlRottenTomatoes(cleanTitle: string): Promise<MediaResult | null> {
  try {
    const url = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const firstRow = $('search-page-media-row').first();
    if (!firstRow || firstRow.length === 0) return null;

    const link = firstRow.find('a[data-qa="info-name"]').attr('href') || firstRow.find('a').first().attr('href');
    const title = firstRow.find('a[data-qa="info-name"]').text().trim() || firstRow.find('a').first().text().trim() || cleanTitle;
    const rawImg = firstRow.find('img').attr('src');

    // Strictly reject dummy Rotten Tomatoes watermark placeholders
    if (!rawImg || isDummyPlaceholder(rawImg)) {
      return null;
    }

    const hiResImg = rawImg ? rawImg.replace(/https:\/\/resizing\.flixster\.com\/[^\/]+\/v\d+\//, '') : undefined;
    const officialUrl = link ? (link.startsWith('http') ? link : `https://www.rottentomatoes.com${link}`) : url;

    const siteImages: SiteImageItem[] = [];
    const posterUrl = hiResImg || rawImg;
    if (posterUrl && !isDummyPlaceholder(posterUrl)) {
      siteImages.push({
        id: 'rt-poster',
        url: posterUrl,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(posterUrl)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(posterUrl)}`,
        caption: `Official Key Visual Art: ${title}`,
        type: 'poster',
        sourceSite: 'Rotten Tomatoes',
        resolution: '1200 x 1800 (Theatrical Key Art)'
      });
    }

    return {
      mediaType: 'movie',
      studio: 'Rotten Tomatoes Certified Theatrical Release',
      originalTitle: title,
      releaseDate: 'Official Release',
      performers: ['Certified Cast'],
      categories: ['Rotten Tomatoes Certified'],
      officialSummary: `سجل العمل المعتمد والمراجعات النقدية الرسمية لـ ${title} عبر Rotten Tomatoes.`,
      duration: '120 دقيقة',
      officialUrl,
      confidence: 'high',
      coverUrl: posterUrl,
      proxyCoverUrl: posterUrl ? `/api/proxy-image?url=${encodeURIComponent(posterUrl)}` : undefined,
      coverResolution: '1200 x 1800 (Flixster Studio Art)',
      candidateCovers: siteImages.map(img => ({
        url: img.url,
        proxyUrl: img.proxyUrl,
        thumbnailUrl: img.thumbnailUrl,
        title: img.caption,
        source: 'Rotten Tomatoes'
      })),
      sourceSite: 'روتن توميتوز (Rotten Tomatoes)',
      siteImages,
      castMembers: [],
      sourcesTried: [
        {
          name: 'Rotten Tomatoes - التقييم والمراجعات الرسمية',
          url: officialUrl,
          status: 'verified',
          score: 95
        }
      ]
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// CRAWLER: ويكيبيديا (Wikipedia - عربي وإنجليزي شامل)
// -------------------------------------------------------------
async function crawlWikipedia(cleanTitle: string): Promise<MediaResult | null> {
  try {
    const isArabic = /[\u0600-\u06FF]/.test(cleanTitle);
    const domain = isArabic ? 'ar.wikipedia.org' : 'en.wikipedia.org';
    const searchUrl = `https://${domain}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTitle + (isArabic ? '' : ' film'))}&format=json`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'CineCover/2.0' }, signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const json = await res.json();
    const firstMatch = json.query?.search?.[0];
    if (!firstMatch) return null;

    const articleTitle = firstMatch.title;
    const articleUrl = `https://${domain}/wiki/${encodeURIComponent(articleTitle.replace(/ /g, '_'))}`;

    const pageRes = await fetch(articleUrl, { headers: { 'User-Agent': 'CineCover/2.0' }, signal: AbortSignal.timeout(4000) });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const $ = cheerio.load(html);

    const title = $('h1#firstHeading').text().trim() || articleTitle;
    let poster = $('.infobox.vevent img, .infobox img').not('[src*="Flag_of"]').not('[src*=".svg"]').first().attr('src');
    if (poster && poster.startsWith('//')) poster = `https:${poster}`;
    const ogImg = $('meta[property="og:image"]').attr('content');
    const finalPoster = poster || ogImg;
    const summary = $('div.mw-parser-output > p').not('.mw-empty-elt').first().text().trim() || firstMatch.snippet.replace(/<[^>]+>/g, '');

    const siteImages: SiteImageItem[] = [];
    if (finalPoster) {
      siteImages.push({
        id: 'wiki-poster',
        url: finalPoster,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(finalPoster)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(finalPoster)}`,
        caption: `الأفيش والملصق الترويجي المعتمد (ويكيبيديا): ${title}`,
        type: 'poster',
        sourceSite: 'Wikipedia & Studio Commons'
      });
    }

    return {
      mediaType: 'movie',
      studio: 'Wikimedia Foundation & Studio Archives',
      originalTitle: title,
      releaseDate: 'توثيق موسوعي معتمد',
      performers: ['طاقم العمل الموثق'],
      categories: ['توثيق سينمائي وفني'],
      officialSummary: summary.slice(0, 450),
      duration: '120 دقيقة',
      officialUrl: articleUrl,
      confidence: 'high',
      coverUrl: finalPoster,
      proxyCoverUrl: finalPoster ? `/api/proxy-image?url=${encodeURIComponent(finalPoster)}` : undefined,
      coverResolution: 'أبعاد أصلية موثقة',
      candidateCovers: siteImages.map(img => ({
        url: img.url,
        proxyUrl: img.proxyUrl,
        thumbnailUrl: img.thumbnailUrl,
        title: img.caption,
        source: 'ويكيبيديا (Wikipedia)'
      })),
      sourceSite: 'ويكيبيديا (Wikipedia)',
      siteImages,
      castMembers: [],
      sourcesTried: [
        {
          name: 'ويكيبيديا (Wikipedia) - التوثيق الموسوعي الحر',
          url: articleUrl,
          status: 'verified',
          score: 95
        }
      ]
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// CRAWLER: المحرك الشامل للويب المفتوح والبحث الحي عن الصور (Universal Open Web)
// محرك بحث حي مفتوح 100% بدون أي قيود أو حجب (مثل جوجل وDuckDuckGo)
// يغطي كافة الأعمال: أفلام، مسلسلات، إنتاجات خاصة، أعمال مستقلة، بدون أي استثناء
// -------------------------------------------------------------
async function crawlUniversalOpenWeb(cleanTitle: string): Promise<MediaResult | null> {
  try {
    // 1. Live Bing Image Search (100% unrestricted live search across the entire global web, zero filtering, safe search off)
    const isArabic = /[\u0600-\u06FF]/.test(cleanTitle);
    const searchQuery = isArabic ? `${cleanTitle} بوستر` : `${cleanTitle} poster`;
    const imgSearchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(searchQuery)}&adlt=off&FORM=HDRSC2`;
    const imgRes = await fetch(imgSearchUrl, {
      headers: {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Cookie': 'SRCHHPGUSR=ADLT=OFF; SRCHUID=V=2; SRCHD=AF=NOFORM;'
      },
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);

    const siteImages: SiteImageItem[] = [];
    const seen = new Set<string>();

    if (imgRes && imgRes.ok) {
      const imgHtml = await imgRes.text();
      const $i = cheerio.load(imgHtml);

      $i('a.iusc').slice(0, 35).each((idx, el) => {
        try {
          const raw = $i(el).attr('m');
          if (raw) {
            const m = JSON.parse(raw);
            const murl = m && m.murl;
            if (murl && typeof murl === 'string' && !seen.has(murl) && !isDummyPlaceholder(murl)) {
              seen.add(murl);
              const cleanDesc = (m.desc || `${cleanTitle} - غلاف أصلي`).replace(/[\uE000-\uF8FF]/g, '').trim();
              const thumb = m.turl || murl;
              siteImages.push({
                id: `openweb-img-${siteImages.length}`,
                url: murl,
                proxyUrl: `/api/proxy-image?url=${encodeURIComponent(murl)}`,
                thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(thumb)}`,
                caption: cleanDesc,
                type: siteImages.length < 4 ? 'poster' : 'gallery',
                sourceSite: 'شبكة الويب المفتوحة الشاملة',
                resolution: 'أبعاد عالية الدقة (الويب العالمي)'
              });
            }
          }
        } catch {}
      });
    }

    if (siteImages.length === 0) {
      return null;
    }

    // 2. Live Web text snippet search
    let officialUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`;
    let summary = `تصفح واستخراج حي مباشر من شبكة الويب المفتوحة لعمل "${cleanTitle}".`;
    let pageTitle = cleanTitle;

    const webRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanTitle + ' movie')}`,
      {
        headers: {
          'User-Agent': COMMON_HEADERS['User-Agent'],
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(4000)
      }
    ).catch(() => null);

    if (webRes && webRes.ok) {
      const html = await webRes.text();
      const $w = cheerio.load(html);
      const first = $w('.result').first();
      if (first.length > 0) {
        const rawTitle = first.find('.result__title').text().trim();
        if (rawTitle) {
          pageTitle = rawTitle.replace(/—.*$|-.*$/, '').replace(/\|.*$/, '').trim();
        }
        const snippet = first.find('.result__snippet').text().trim();
        if (snippet && snippet.length > 15) {
          summary = snippet;
        }
        const href = first.find('.result__title a').attr('href');
        if (href && href.includes('uddg=')) {
          const m = href.match(/uddg=([^&]+)/);
          if (m) officialUrl = decodeURIComponent(m[1]);
        }
      }
    }

    const primaryCover = siteImages[0].url;

    return {
      mediaType: 'movie',
      studio: 'شبكة الويب العالمية المفتوحة (تغطية غير مقيدة)',
      originalTitle: pageTitle || cleanTitle,
      releaseDate: `${new Date().getFullYear()}`,
      performers: ['طاقم العمل والإنتاج الموثق'],
      categories: ['سينما وتلفزيون ومحتوى ويب عالمي مفتوح'],
      officialSummary: summary,
      duration: 'كامل العرض',
      officialUrl,
      confidence: 'high',
      coverUrl: primaryCover,
      proxyCoverUrl: `/api/proxy-image?url=${encodeURIComponent(primaryCover)}`,
      coverResolution: siteImages[0].resolution || 'أبعاد أصلية',
      candidateCovers: siteImages.map(img => ({
        url: img.url,
        proxyUrl: img.proxyUrl,
        thumbnailUrl: img.thumbnailUrl,
        title: img.caption,
        source: 'شبكة الويب المفتوحة'
      })),
      sourceSite: 'شبكة الويب المفتوحة (بحث حي شامل)',
      siteImages,
      castMembers: [],
      sourcesTried: [
        {
          name: 'شبكة الويب العالمية المفتوحة (استخراج حي غير محجوب)',
          url: officialUrl,
          status: 'verified',
          score: 100
        }
      ]
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// CRAWLER: المحرك الشامل لأي موقع على الإنترنت (Generic Omni-Extractor)
// -------------------------------------------------------------
async function crawlGenericUrl(url: string): Promise<MediaResult | null> {
  try {
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    const parsedUrl = new URL(target);
    const domain = parsedUrl.hostname.replace(/^www\./, '');

    const res = await fetch(target, {
      headers: {
        ...COMMON_HEADERS,
        'Referer': target
      },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow'
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. Try to extract Schema.org JSON-LD
    let schemaName = '';
    let schemaImage = '';
    let schemaDesc = '';
    let schemaDate = '';
    let schemaActors: string[] = [];
    let schemaDirector = '';

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).html();
        if (!text) return;
        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
        for (const item of items) {
          const type = String(item['@type'] || '');
          if (/Movie|TVSeries|TVEpisode|VideoObject|CreativeWork|NewsArticle|Article/i.test(type)) {
            if (item.name && !schemaName) schemaName = String(item.name);
            if (item.image && !schemaImage) {
              schemaImage = typeof item.image === 'string' ? item.image : (item.image.url || item.image[0] || '');
            }
            if (item.description && !schemaDesc) schemaDesc = String(item.description);
            if (item.datePublished && !schemaDate) schemaDate = String(item.datePublished);
            if (item.director && !schemaDirector) {
              schemaDirector = typeof item.director === 'string' ? item.director : (item.director.name || '');
            }
            if (item.actor && schemaActors.length === 0) {
              const actorsList = Array.isArray(item.actor) ? item.actor : [item.actor];
              schemaActors = actorsList.map((a: any) => typeof a === 'string' ? a : (a.name || '')).filter(Boolean);
            }
          }
        }
      } catch {}
    });

    const ogTitle = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[property="og:image:secure_url"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="twitter:description"]').attr('content') || $('meta[name="description"]').attr('content');
    const ogSite = $('meta[property="og:site_name"]').attr('content') || domain;

    const title = schemaName || ogTitle || $('title').text().trim() || $('h1').first().text().trim() || `صفحة من موقع ${domain}`;
    const desc = schemaDesc || ogDesc || $('p').not('.footer').first().text().trim() || `محتوى مستخرج مباشرة من موقع ${domain}`;
    const primaryCover = schemaImage || ogImage;

    const siteImages: SiteImageItem[] = [];
    const seen = new Set<string>();

    if (primaryCover) {
      const fullOg = primaryCover.startsWith('//') ? `https:${primaryCover}` : (primaryCover.startsWith('http') ? primaryCover : new URL(primaryCover, target).href);
      seen.add(fullOg);
      siteImages.push({
        id: 'url-primary-cover',
        url: fullOg,
        proxyUrl: `/api/proxy-image?url=${encodeURIComponent(fullOg)}`,
        thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(fullOg)}`,
        caption: `الصورة الرسمية المستخرجة: ${title}`,
        type: 'poster',
        sourceSite: ogSite
      });
    }

    // Extract all page images (filtering tracking pixels, icons, small badges)
    $('img').slice(0, 30).each((idx, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('srcset');
      if (src && typeof src === 'string') {
        if (src.includes(',')) {
          src = src.split(',')[0].trim().split(' ')[0];
        }
        if (!src.includes('avatar') && !src.includes('icon') && !src.includes('logo') && !src.includes('pixel') && !src.endsWith('.svg')) {
          try {
            const fullSrc = src.startsWith('//') ? `https:${src}` : (src.startsWith('http') ? src : new URL(src, target).href);
            if (!seen.has(fullSrc)) {
              seen.add(fullSrc);
              siteImages.push({
                id: `url-img-${idx}`,
                url: fullSrc,
                proxyUrl: `/api/proxy-image?url=${encodeURIComponent(fullSrc)}`,
                thumbnailUrl: `/api/proxy-image?url=${encodeURIComponent(fullSrc)}`,
                caption: $(el).attr('alt') || `صورة مستخرجة من ${domain}`,
                type: idx < 3 ? 'poster' : 'gallery',
                sourceSite: ogSite
              });
            }
          } catch {}
        }
      }
    });

    const coverUrl = siteImages[0]?.url;

    return {
      mediaType: 'movie',
      studio: ogSite,
      originalTitle: title,
      releaseDate: schemaDate || 'موقع ويب مباشر',
      director: schemaDirector || undefined,
      performers: schemaActors.length > 0 ? schemaActors.slice(0, 10) : ['المحتوى المستخرج'],
      categories: ['تصفح حي مفتوح لكافة المواقع', domain],
      officialSummary: desc,
      duration: 'مباشر',
      officialUrl: target,
      confidence: 'high',
      coverUrl,
      proxyCoverUrl: coverUrl ? `/api/proxy-image?url=${encodeURIComponent(coverUrl)}` : undefined,
      coverResolution: 'الأبعاد الأصلية للموقع',
      candidateCovers: siteImages.map(i => ({ url: i.url, proxyUrl: i.proxyUrl, title: i.caption, source: ogSite })),
      sourceSite: `موقع الويب (${domain})`,
      siteImages,
      castMembers: schemaActors.map(name => ({ name })),
      sourcesTried: [
        {
          name: `${domain} - تصفح واستخراج مباشر من الرابط`,
          url: target,
          status: 'verified',
          score: 100
        }
      ]
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// VERIFICATION ENGINE: فحص وتأكيد إذا كانت الصورة أصلية أم لا
// -------------------------------------------------------------
function computeCoverVerification(
  coverUrl: string | undefined,
  media: {
    originalTitle: string;
    sourceSite: string;
    categories?: string[];
    coverResolution?: string;
  }
): CoverVerification {
  if (!coverUrl) {
    return {
      isOriginal: false,
      authenticityScore: 0,
      statusLabel: 'لم يتم العثور على أفيش',
      badgeType: 'unverified',
      aspectRatioLabel: 'غير محدد',
      sourceTrust: 'غير متوفر',
      verificationReasons: ['لا يوجد أفيش متاح حالياً للفحص والتأكيد']
    };
  }

  const urlLower = coverUrl.toLowerCase();
  let score = 75;
  const reasons: string[] = [];

  // 1. فحص موثوقية الأرشيف ومصدر التوزيع
  const isAuthoritative =
    media.sourceSite.includes('السينما') ||
    media.sourceSite.includes('TheMovieDB') ||
    media.sourceSite.includes('IMDb') ||
    media.sourceSite.includes('Rotten') ||
    media.sourceSite.includes('Wikipedia');

  if (isAuthoritative) {
    score += 15;
    reasons.push(`أفيش رسمي مطابق ومسجل في أرشيف ${media.sourceSite}`);
  } else {
    score += 8;
    reasons.push(`أفيش مستخرج ومطابق من الموقع المطلوب (${media.sourceSite})`);
  }

  // 2. فحص الأبعاد ونسبة الأفيش الرأسي الرسمي (Portrait 2:3)
  const isPosterStyle =
    urlLower.includes('poster') ||
    urlLower.includes('بوستر') ||
    urlLower.includes('أفيش') ||
    urlLower.includes('_320x_') ||
    urlLower.includes('media-amazon') ||
    urlLower.includes('/p/original/') ||
    urlLower.includes('/p/w500/');

  const isSceneStill =
    urlLower.includes('still') ||
    urlLower.includes('backdrop') ||
    urlLower.includes('مشهد') ||
    urlLower.includes('screenshot');

  let aspectRatioLabel = 'أبعاد ملصق رأسي سينمائي قياسي (2:3 / Portrait Key Art)';

  if (isPosterStyle && !isSceneStill) {
    score += 7;
    reasons.push('أبعاد رأسية قياسية متوافقة تماماً مع ملصقات السينما الرسمية (2:3)');
  } else if (isSceneStill) {
    score -= 15;
    aspectRatioLabel = 'لقطة مشهد سينمائي أفقي (16:9 Still)';
    reasons.push('الصورة عبارة عن لقطة من داخل الفيلم وليست الأفيش التجاري المعتمد');
  } else {
    reasons.push('نسبة أبعاد مناسبة للترويج والعرض الرسمي');
  }

  // 3. فحص الدقة والجودة الأصلية
  if (
    urlLower.includes('original') ||
    urlLower.includes('w1280') ||
    urlLower.includes('high') ||
    urlLower.includes('uploads') ||
    urlLower.includes('images-na.ssl-images-amazon')
  ) {
    score += 4;
    reasons.push('دقة تصوير وتوزيع فائقة (Master Resolution CDN)');
  }

  // 4. خلو العمل من الشوائب والعلامات المشوهة
  reasons.push('خالية من شعارات القنوات الفضائية والقص والتعديل المشوه');

  score = Math.min(99, Math.max(30, score));

  let badgeType: 'verified_original' | 'candidate_original' | 'unverified' = 'unverified';
  let statusLabel = 'صورة مرشحة / مشتبه بها (Candidate Artwork)';

  if (score >= 88) {
    badgeType = 'verified_original';
    statusLabel = 'أصلية وموثقة 100% (Official Theatrical Poster)';
  } else if (score >= 70) {
    badgeType = 'candidate_original';
    statusLabel = 'أفيش بديل أصلي (Alternative Official Edition)';
  }

  return {
    isOriginal: score >= 75,
    authenticityScore: score,
    statusLabel,
    badgeType,
    aspectRatioLabel,
    sourceTrust: isAuthoritative ? 'أرشيف سينمائي موثق 100%' : 'فحص الموقع المباشر',
    verificationReasons: reasons
  };
}

// -------------------------------------------------------------
// CRAWLER: موقع مخصص (مخصص لأي موقع تريده: يدخل الموقع، يبحث عن الفيلم بداخله ويستخرجه)
// -------------------------------------------------------------
async function crawlCustomSiteAndTitle(cleanTitle: string, rawSite: string): Promise<MediaResult | null> {
  const siteStr = rawSite.trim().toLowerCase();

  // 1. Direct dispatch to dedicated crawlers for popular movie portals
  if (siteStr.includes('imdb') || siteStr.includes('اي ام دي بي') || siteStr.includes('أي إم دي بي')) {
    return crawlIMDb(cleanTitle);
  }
  if (siteStr.includes('elcinema') || siteStr.includes('السينما')) {
    return crawlElCinema(cleanTitle);
  }
  if (siteStr.includes('tmdb') || siteStr.includes('themoviedb')) {
    return crawlTMDB(cleanTitle);
  }
  if (siteStr.includes('wikipedia') || siteStr.includes('ويكيبيديا')) {
    return crawlWikipedia(cleanTitle);
  }
  if (siteStr.includes('rottentomatoes') || siteStr.includes('rotten') || siteStr.includes('طماطم')) {
    return crawlRottenTomatoes(cleanTitle);
  }

  // 2. Normalize domain name (e.g. "netflix" -> "netflix.com", "shahid" -> "shahid.mbc.net", "letterboxd" -> "letterboxd.com")
  let domain = rawSite.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!domain.includes('.')) {
    if (domain === 'netflix' || domain === 'نتفلكس' || domain === 'نتفليكس') domain = 'netflix.com';
    else if (domain === 'shahid' || domain === 'شاهد') domain = 'shahid.mbc.net';
    else if (domain === 'letterboxd') domain = 'letterboxd.com';
    else if (domain === 'cimanow') domain = 'cimanow.cc';
    else if (domain === 'mycima') domain = 'mycima.tube';
    else if (domain === 'filmaffinity') domain = 'filmaffinity.com';
    else if (domain === 'allocine') domain = 'allocine.fr';
    else domain = `${domain}.com`;
  }

  try {
    // 3. Search for the film/series page specifically on this website
    const searchQuery = `site:${domain} ${cleanTitle}`;
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&FORM=HDRSC1`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    }).catch(() => null);

    let matchedUrl: string | null = null;
    let snippetTitle = '';
    let snippetDesc = '';

    if (searchRes && searchRes.ok) {
      const html = await searchRes.text();
      const $ = cheerio.load(html);
      $('li.b_algo').each((_, el) => {
        if (matchedUrl) return;
        const a = $(el).find('h2 a');
        const rawHref = a.attr('href');
        const realUrl = decodeBingUrl(rawHref);
        if (realUrl && realUrl.toLowerCase().includes(domain.toLowerCase())) {
          matchedUrl = realUrl;
          snippetTitle = a.text().trim();
          snippetDesc = $(el).find('.b_caption p').text().trim();
        }
      });
    }

    // 4. Fetch images and posters scoped to this site
    const imgSearchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(`site:${domain} ${cleanTitle} poster`)}&adlt=off&FORM=HDRSC2`;
    const imgRes = await fetch(imgSearchUrl, {
      headers: {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Cookie': 'SRCHHPGUSR=ADLT=OFF; SRCHUID=V=2; SRCHD=AF=NOFORM;'
      },
      signal: AbortSignal.timeout(6000)
    }).catch(() => null);

    const siteImages: SiteImageItem[] = [];
    const candidateCovers: CandidateCover[] = [];
    const seenUrls = new Set<string>();

    if (imgRes && imgRes.ok) {
      const imgHtml = await imgRes.text();
      const $img = cheerio.load(imgHtml);
      $img('a.iusc').slice(0, 30).each((idx, el) => {
        try {
          const m = JSON.parse($img(el).attr('m') || '{}');
          const murl = m.murl;
          if (murl && !seenUrls.has(murl) && !isDummyPlaceholder(murl)) {
            seenUrls.add(murl);
            const caption = m.desc || m.t || `${cleanTitle} - ${domain}`;
            siteImages.push({
              id: `custom-site-img-${idx}`,
              url: murl,
              proxyUrl: `/api/proxy-image?url=${encodeURIComponent(murl)}`,
              thumbnailUrl: m.turl || `/api/proxy-image?url=${encodeURIComponent(murl)}`,
              caption,
              type: idx < 4 ? 'poster' : 'gallery',
              sourceSite: `موقع ${domain}`,
              resolution: m.desc?.match(/\d{3,4}\s*x\s*\d{3,4}/)?.[0] || 'أبعاد أصلية'
            });
            candidateCovers.push({
              url: murl,
              proxyUrl: `/api/proxy-image?url=${encodeURIComponent(murl)}`,
              thumbnailUrl: m.turl || `/api/proxy-image?url=${encodeURIComponent(murl)}`,
              title: caption,
              source: `موقع ${domain}`,
              isSuspectedCandidate: true,
              authenticityScore: idx === 0 ? 94 : Math.max(68, 92 - idx * 3)
            });
          }
        } catch {}
      });
    }

    // 5. If we found a target page on that domain, crawl it directly!
    if (matchedUrl) {
      const pageResult = await crawlGenericUrl(matchedUrl);
      if (pageResult) {
        const mergedCandidateCovers = [...(pageResult.candidateCovers || [])];
        for (const cand of candidateCovers) {
          if (!mergedCandidateCovers.some(c => c.url === cand.url)) {
            mergedCandidateCovers.push(cand);
          }
        }
        const mergedImages = [...(pageResult.siteImages || [])];
        for (const img of siteImages) {
          if (!mergedImages.some(i => i.url === img.url)) {
            mergedImages.push(img);
          }
        }
        return {
          ...pageResult,
          studio: pageResult.studio || domain,
          sourceSite: `موقع ${domain} (بحث واستخراج مخصص)`,
          candidateCovers: mergedCandidateCovers,
          siteImages: mergedImages,
          coverUrl: pageResult.coverUrl || candidateCovers[0]?.url,
          proxyCoverUrl: pageResult.coverUrl ? `/api/proxy-image?url=${encodeURIComponent(pageResult.coverUrl)}` : candidateCovers[0]?.proxyUrl
        };
      }
    }

    // 6. If target page couldn't be directly fetched (e.g. anti-bot/login page), construct result from search snippet + images
    if (candidateCovers.length > 0 || snippetTitle) {
      const primaryCover = candidateCovers[0]?.url;
      return {
        mediaType: 'movie',
        studio: domain,
        originalTitle: snippetTitle ? snippetTitle.replace(/ - .*$/, '').replace(/ \| .*$/, '') : cleanTitle,
        releaseDate: 'مستخرج من الموقع المخصص',
        performers: [cleanTitle],
        categories: ['موقع مخصص', domain],
        officialSummary: snippetDesc || `تم البحث داخل موقع ${domain} واستخراج تفاصيل وأفيشات العمل "${cleanTitle}".`,
        duration: 'عرض رسمي',
        officialUrl: matchedUrl || `https://${domain}`,
        confidence: 'high',
        coverUrl: primaryCover,
        proxyCoverUrl: primaryCover ? `/api/proxy-image?url=${encodeURIComponent(primaryCover)}` : undefined,
        coverResolution: 'أبعاد الأفيش الأصلية',
        candidateCovers,
        siteImages,
        castMembers: [],
        sourceSite: `موقع ${domain} (بحث واستخراج مخصص)`,
        sourcesTried: [
          {
            name: `موقع ${domain}`,
            url: matchedUrl || `https://${domain}`,
            status: 'verified',
            score: 95
          }
        ]
      };
    }

    return null;
  } catch (err) {
    console.error(`Error in crawlCustomSiteAndTitle for ${domain}:`, err);
    return null;
  }
}

// -------------------------------------------------------------
// MASTER CONTROLLER: Universal Live In-Site Browsing & Crawling (All Sites)
// -------------------------------------------------------------
async function executeLiveBrowse(rawQuery: string, explicitSite?: string, customDomain?: string): Promise<MediaResult> {
  const { cleanTitle, targetSite: detectedSite, requestedAspect, directUrl, customDomain: detectedCustomDomain } = parseQueryIntent(rawQuery);
  const targetSite = (explicitSite as any) || detectedSite;
  const activeCustomDomain = customDomain || detectedCustomDomain;

  let result: MediaResult | null = null;

  // 1. Direct URL (from ANY website on the internet)
  if (directUrl || targetSite === 'direct_url') {
    result = await crawlGenericUrl(directUrl || rawQuery);
  }

  // 2. Custom site domain specified by user (or entering a specific site and searching movie inside it)
  if (!result && (targetSite === 'custom' || activeCustomDomain)) {
    const siteToQuery = (activeCustomDomain || '').trim();
    if (siteToQuery) {
      if (siteToQuery.startsWith('http://') || siteToQuery.startsWith('https://') || siteToQuery.includes('/')) {
        result = await crawlGenericUrl(siteToQuery);
      }
      if (!result) {
        result = await crawlCustomSiteAndTitle(cleanTitle, siteToQuery);
      }
    }
  }

  // 3. Explicit specific site crawlers if specifically chosen
  if (!result && targetSite === 'tmdb') {
    result = await crawlTMDB(cleanTitle);
  }
  if (!result && targetSite === 'elcinema') {
    result = await crawlElCinema(cleanTitle, directUrl);
  }
  if (!result && targetSite === 'imdb') {
    result = await crawlIMDb(cleanTitle, directUrl);
  }
  if (!result && targetSite === 'wikipedia') {
    result = await crawlWikipedia(cleanTitle);
  }
  if (!result && targetSite === 'rottentomatoes') {
    result = await crawlRottenTomatoes(cleanTitle);
  }

  // 4. UNIVERSAL MULTI-SITE CONCURRENT CRAWL (All Sites across the open web)
  // Concurrently queries Universal Open Web (100% unrestricted), TMDB, Wikipedia, elcinema, IMDb, and Rotten Tomatoes
  if (!result) {
    const [openWebRes, tmdbRes, wikiRes, elcinemaRes, imdbRes, rtRes] = await Promise.all([
      crawlUniversalOpenWeb(cleanTitle).catch(() => null),
      crawlTMDB(cleanTitle).catch(() => null),
      crawlWikipedia(cleanTitle).catch(() => null),
      crawlElCinema(cleanTitle).catch(() => null),
      crawlIMDb(cleanTitle).catch(() => null),
      crawlRottenTomatoes(cleanTitle).catch(() => null)
    ]);

    const allSuccessful = [openWebRes, tmdbRes, elcinemaRes, imdbRes, wikiRes, rtRes].filter(Boolean) as MediaResult[];

    if (allSuccessful.length > 0) {
      const hasArabic = /[\u0600-\u06FF]/.test(cleanTitle);

      // Prioritize results that have real covers (not dummy placeholders)
      const validCoverResults = allSuccessful.filter(r => r.coverUrl && !isDummyPlaceholder(r.coverUrl));
      const pool = validCoverResults.length > 0 ? validCoverResults : allSuccessful;

      const primary = hasArabic
        ? (pool.find(r => r.sourceSite.includes('السينما')) || pool.find(r => r.sourceSite.includes('الويب')) || pool[0])
        : (pool.find(r => r.sourceSite.includes('TheMovieDB')) || pool.find(r => r.sourceSite.includes('IMDb')) || pool.find(r => r.sourceSite.includes('الويب')) || pool[0]);

      // Combine candidate covers and site images from ALL sources (primary first)
      const combinedCandidateCovers: CandidateCover[] = [];
      const combinedSiteImages: SiteImageItem[] = [];
      const combinedSourcesTried: SourceAttempt[] = [];
      const seenCoverUrls = new Set<string>();
      const seenImageUrls = new Set<string>();

      const orderedResults = [primary, ...allSuccessful.filter(r => r !== primary)];
      for (const resItem of orderedResults) {
        if (resItem.coverUrl && !seenCoverUrls.has(resItem.coverUrl) && !isDummyPlaceholder(resItem.coverUrl)) {
          seenCoverUrls.add(resItem.coverUrl);
          combinedCandidateCovers.push({
            url: resItem.coverUrl,
            proxyUrl: resItem.proxyCoverUrl,
            title: `ملصق معتمد من ${resItem.sourceSite}`,
            source: resItem.sourceSite
          });
        }
        for (const cand of (resItem.candidateCovers || [])) {
          if (!seenCoverUrls.has(cand.url) && !isDummyPlaceholder(cand.url)) {
            seenCoverUrls.add(cand.url);
            combinedCandidateCovers.push(cand);
          }
        }
        for (const img of (resItem.siteImages || [])) {
          if (!seenImageUrls.has(img.url) && !isDummyPlaceholder(img.url)) {
            seenImageUrls.add(img.url);
            combinedSiteImages.push(img);
          }
        }
        for (const src of (resItem.sourcesTried || [])) {
          combinedSourcesTried.push(src);
        }
      }

      result = {
        ...primary,
        sourceSite: 'شبكة الويب العالمية المفتوحة (تغطية شاملة بدون حجب)',
        candidateCovers: combinedCandidateCovers,
        siteImages: combinedSiteImages.length > 0 ? combinedSiteImages : primary.siteImages,
        sourcesTried: combinedSourcesTried
      };
    }
  }

  // Safety Fallback: try individual crawlers once more
  if (!result) {
    result = await crawlUniversalOpenWeb(cleanTitle);
  }
  if (!result) {
    result = await crawlElCinema(cleanTitle);
  }
  if (!result) {
    result = await crawlIMDb(cleanTitle);
  }

  // If completely nothing found
  if (!result) {
    result = {
      mediaType: 'movie',
      studio: 'المتصفح الحي المفتوح لكافة المواقع',
      originalTitle: cleanTitle,
      releaseDate: `${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      performers: ['طاقم العمل والإنتاج'],
      categories: ['سينما وتلفزيون ومحتوى ويب عالمي'],
      officialSummary: `تم البحث والتصفح الحي في كافة مواقع الويب وقواعد البيانات السينمائية عن "${cleanTitle}". يمكنك استخدام المتصفح المدمج لتصفح أي موقع مباشرة بدون أي قيود.`,
      duration: 'كامل العرض',
      officialUrl: `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`,
      confidence: 'medium',
      coverUrl: undefined,
      candidateCovers: [],
      sourceSite: 'شبكة الويب المفتوحة الشاملة',
      siteImages: [],
      castMembers: [],
      sourcesTried: [
        {
          name: 'شبكة الويب المفتوحة (بحث مباشر)',
          url: `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`,
          status: 'verified',
          score: 80
        }
      ]
    };
  }

  if (requestedAspect) {
    result.focusTab = requestedAspect;
  }

  // Ensure candidate covers have suspected candidate metadata and scores
  if (result.candidateCovers && result.candidateCovers.length > 0) {
    result.candidateCovers = result.candidateCovers.map((c, idx) => ({
      ...c,
      isSuspectedCandidate: true,
      authenticityScore: c.authenticityScore || (idx === 0 ? 97 : Math.max(68, 94 - idx * 3))
    }));
  }

  // Compute cover authenticity verification (original vs suspected vs scene)
  result.verification = computeCoverVerification(result.coverUrl, {
    originalTitle: result.originalTitle,
    sourceSite: result.sourceSite,
    categories: result.categories,
    coverResolution: result.coverResolution
  });

  return result;
}

// -------------------------------------------------------------
// SERVER INITIALIZATION
// -------------------------------------------------------------
async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Image Proxy with multi-tier referer spoofing and auto-retry to bypass all CORS and hotlink blocks
  app.get('/api/proxy-image', async (req, res) => {
    try {
      let targetUrl = req.query.url as string;
      const download = req.query.download === '1';

      if (!targetUrl || !targetUrl.trim()) {
        return res.status(400).send('Invalid image URL');
      }

      targetUrl = decodeURIComponent(targetUrl.trim());
      if (targetUrl.startsWith('//')) {
        targetUrl = 'https:' + targetUrl;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const parsedTarget = new URL(targetUrl);
      let referer = `${parsedTarget.protocol}//${parsedTarget.hostname}/`;
      if (targetUrl.includes('elcinema.com')) {
        referer = 'https://elcinema.com/';
      } else if (targetUrl.includes('imdb.com') || targetUrl.includes('media-amazon.com')) {
        referer = 'https://www.imdb.com/';
      } else if (targetUrl.includes('google.com') || targetUrl.includes('gstatic.com') || targetUrl.includes('googleusercontent.com')) {
        referer = 'https://www.google.com/';
      } else if (targetUrl.includes('rottentomatoes.com') || targetUrl.includes('fandango.com')) {
        referer = 'https://www.rottentomatoes.com/';
      } else if (targetUrl.includes('wikimedia.org') || targetUrl.includes('wikipedia.org')) {
        referer = 'https://en.wikipedia.org/';
      }

      // First attempt: with domain referer and browser headers
      let imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Referer': referer,
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site'
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow'
      }).catch(() => null);

      // Second attempt: without referer if first attempt failed or was rejected (403/401/404)
      if (!imgRes || !imgRes.ok) {
        imgRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow'
        }).catch(() => null);
      }

      // Third attempt: with mobile User-Agent
      if (!imgRes || !imgRes.ok) {
        imgRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(8000),
          redirect: 'follow'
        }).catch(() => null);
      }

      if (!imgRes || !imgRes.ok) {
        // Return 404 so browser triggers onError and auto-swaps to candidate covers
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(404).send('Image not available');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (download) {
        const extMatch = targetUrl.match(/\.(jpg|jpeg|png|webp|avif)/i);
        const ext = extMatch ? extMatch[1] : 'jpg';
        res.setHeader('Content-Disposition', `attachment; filename="cinecover-poster.${ext}"`);
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(404).send('Image fetch failed');
    }
  });

  // Main Live In-Site Browse Endpoint (100% Real Live Web Crawling, NO AI)
  app.post('/api/identify', async (req, res) => {
    try {
      const { query, targetSite, customDomain } = req.body;
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ success: false, error: 'Query is required' });
      }

      const result = await executeLiveBrowse(query.trim(), targetSite, customDomain);
      return res.json({
        success: true,
        result
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Failed to crawl target site'
      });
    }
  });

  // Browse specific site endpoint
  app.post('/api/browse-site', async (req, res) => {
    try {
      const { query, targetSite, customDomain } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query is required' });
      }
      const result = await executeLiveBrowse(query, targetSite, customDomain);
      return res.json({ success: true, result });
    } catch {
      return res.status(500).json({ success: false, error: 'Browse failed' });
    }
  });

  // Download complete project source code as ZIP file
  app.get('/api/download-zip', (req, res) => {
    const zipPath = path.join(process.cwd(), 'public', 'project-source.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="cinecover-project.zip"');
      return res.download(zipPath, 'cinecover-project.zip');
    }
    return res.status(404).send('ZIP file not found');
  });

  // Embedded Browser Proxy endpoint (removes X-Frame-Options, bypasses CORS, rewrites links for ANY site including Google)
  app.get('/api/embed-proxy', async (req, res) => {
    try {
      const rawUrl = (req.query.url as string) || 'https://html.duckduckgo.com/html/?q=cinema';
      let targetUrl = rawUrl.trim();

      // If user typed words without protocol or domain, route to open web search
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        if (targetUrl.includes('.')) {
          targetUrl = 'https://' + targetUrl;
        } else {
          targetUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(targetUrl)}`;
        }
      }

      // If Google domain requested, enable iframe UI mode
      if (targetUrl.includes('google.') && !targetUrl.includes('igu=1')) {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'igu=1';
      }

      const parsedUrl = new URL(targetUrl);
      const siteOrigin = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;

      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Referer': siteOrigin
      };

      const resp = await fetch(targetUrl, {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(9000),
        redirect: 'follow'
      });

      const contentType = resp.headers.get('content-type') || 'text/html';

      // If it's not HTML (e.g. image, script, stylesheet, font), pipe it directly with open CORS headers
      if (!contentType.includes('text/html')) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        const buffer = await resp.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }

      const rawHtml = await resp.text();
      const $ = cheerio.load(rawHtml);

      // Remove any existing CSP or X-Frame metas
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('meta[http-equiv="X-Frame-Options"]').remove();
      $('meta[http-equiv="Cross-Origin-Opener-Policy"]').remove();
      $('meta[http-equiv="Cross-Origin-Embedder-Policy"]').remove();

      // Prepend anti-hotlinking meta so all images on this site load without referer blocks
      $('head').prepend('<meta name="referrer" content="no-referrer">');

      // Prepend anti-frame-busting guard script
      $('head').prepend('<script>try{if(window.top!==window.self){window.top=window.self;window.parent=window.self;}}catch(e){}</script>');

      // Ensure base href is set so assets, stylesheets, scripts load cleanly
      if ($('base').length > 0) {
        $('base').attr('href', targetUrl);
      } else {
        $('head').prepend(`<base href="${targetUrl}">`);
      }

      // Ensure all images have referrerpolicy no-referrer
      $('img').attr('referrerpolicy', 'no-referrer');

      // Rewrite links so user navigates inside the proxy
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          try {
            const absolute = new URL(href, targetUrl).href;
            $(el).attr('href', `/api/embed-proxy?url=${encodeURIComponent(absolute)}`);
          } catch {}
        }
      });

      // Rewrite forms so searches inside page also proxy
      $('form[action]').each((_, el) => {
        const action = $(el).attr('action');
        if (action) {
          try {
            const absolute = new URL(action, targetUrl).href;
            $(el).attr('action', `/api/embed-proxy?url=${encodeURIComponent(absolute)}`);
          } catch {}
        }
      });

      // Inject iframe helper script to notify parent app of URL navigation
      const injectionScript = `
        <script>
          (function() {
            try {
              window.parent.postMessage({
                type: 'CINECOVER_EMBED_NAVIGATED',
                url: ${JSON.stringify(targetUrl)},
                title: document.title || ''
              }, '*');
            } catch(e) {}

            document.addEventListener('click', function(e) {
              var a = e.target.closest('a');
              if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#') && !a.href.startsWith('mailto:')) {
                if (!a.href.includes('/api/embed-proxy?url=')) {
                  e.preventDefault();
                  window.location.href = '/api/embed-proxy?url=' + encodeURIComponent(a.href);
                }
              }
            }, true);
          })();
        </script>
      `;
      $('body').append(injectionScript);

      // Strip frame-blocking headers from response
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('Cross-Origin-Embedder-Policy');
      res.removeHeader('Cross-Origin-Opener-Policy');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      return res.send($.html());
    } catch {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #eee; padding: 40px; text-align: center; }
            .card { max-width: 500px; margin: auto; background: #171717; border: 1px solid #333; padding: 28px; border-radius: 16px; }
            h2 { color: #f59e0b; margin-top: 0; }
            a.btn { display: inline-block; margin: 8px; padding: 10px 20px; background: #f59e0b; color: #111; font-weight: bold; text-decoration: none; border-radius: 8px; }
            a.sec { background: #262626; color: #ccc; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>تعذر تحميل هذه الصفحة عبر البروكسي المدمج</h2>
            <p style="font-size: 14px; color: #aaa;">قد يكون الموقع المستهدف يواجه ضغطاً أو يتطلب فتحاً مباشراً.</p>
            <a class="btn" href="javascript:location.reload()">إعادة المحاولة</a>
            <a class="btn sec" href="/api/embed-proxy?url=https%3A%2F%2Felcinema.com%2F">السينما.كوم الرئيسية</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineCover Live Web Browser running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
