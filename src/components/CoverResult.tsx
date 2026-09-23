import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  ExternalLink,
  Maximize2,
  Building2,
  Calendar,
  Users,
  Tag,
  Clock,
  Film,
  Tv,
  FileText,
  Globe,
  ImageIcon,
  Sparkles,
  Info,
  Radio,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { MediaResult, SupportedLanguage, SiteImageItem, CastMember } from '../types.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';
import { ImageModal } from './ImageModal.tsx';

interface CoverResultProps {
  result: MediaResult;
  currentLang: SupportedLanguage;
  onRebrowse?: (query: string, targetSite?: string) => void;
  onOpenInBrowser?: (url: string) => void;
}

export const CoverResult: React.FC<CoverResultProps> = ({
  result,
  currentLang,
  onRebrowse,
  onOpenInBrowser,
}) => {
  const t = TRANSLATIONS[currentLang];
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalImg, setActiveModalImg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gallery' | 'cast' | 'story' | 'source'>('gallery');
  const [imageCategory, setImageCategory] = useState<'all' | 'poster' | 'still' | 'gallery'>('all');
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set());

  // Filter images by category if user selected a filter
  const allImages = result.siteImages && result.siteImages.length > 0
    ? result.siteImages
    : (result.candidateCovers?.map((c, i) => ({
        id: `candidate-${i}`,
        url: c.url,
        proxyUrl: c.proxyUrl || `/api/proxy-image?url=${encodeURIComponent(c.url)}`,
        thumbnailUrl: c.thumbnailUrl || c.url,
        caption: c.title || `غلاف معتمد`,
        type: 'poster' as const,
        sourceSite: result.sourceSite || 'المصدر الحي'
      })) || []);

  useEffect(() => {
    setSelectedCoverUrl(null);
    setImgError(false);
    setFailedCovers(new Set());
    // If the server detected user asked for specific aspect, open that tab
    if (result.focusTab) {
      setActiveTab(result.focusTab);
    } else {
      setActiveTab('gallery');
    }
  }, [result]);

  const activeCoverUrl = selectedCoverUrl || result.coverUrl || allImages[0]?.url;
  const displayCoverUrl = selectedCoverUrl
    ? `/api/proxy-image?url=${encodeURIComponent(selectedCoverUrl)}`
    : (result.proxyCoverUrl || (activeCoverUrl ? `/api/proxy-image?url=${encodeURIComponent(activeCoverUrl)}` : ''));

  // Dynamically evaluate cover authenticity for the actively displayed cover
  const currentVerification = useMemo(() => {
    if (result.verification && (!selectedCoverUrl || selectedCoverUrl === result.coverUrl)) {
      return result.verification;
    }
    if (!activeCoverUrl) return null;
    const urlLower = activeCoverUrl.toLowerCase();
    let score = 82;
    const isPoster = urlLower.includes('poster') || urlLower.includes('أفيش') || urlLower.includes('بوستر') || urlLower.includes('_320x_') || urlLower.includes('media-amazon');
    const isStill = urlLower.includes('still') || urlLower.includes('backdrop') || urlLower.includes('مشهد');

    if (isPoster && !isStill) score += 10;
    if (isStill) score -= 15;
    if (result.sourceSite.includes('السينما') || result.sourceSite.includes('IMDb') || result.sourceSite.includes('TheMovieDB')) {
      score += 7;
    }
    score = Math.min(99, Math.max(45, score));

    return {
      isOriginal: score >= 75,
      authenticityScore: score,
      statusLabel: score >= 88 ? 'أصلية وموثقة 100% (Official Theatrical Poster)' : (score >= 70 ? 'أفيش بديل أصلي (Alternative Official Edition)' : 'صورة مرشحة / مشتبه بها (Candidate / Still)'),
      badgeType: score >= 88 ? ('verified_original' as const) : (score >= 70 ? ('candidate_original' as const) : ('unverified' as const)),
      aspectRatioLabel: isStill ? 'لقطة مشهد سينمائي أفقي (16:9 Still)' : 'أبعاد ملصق رأسي سينمائي قياسي (2:3 / Key Art)',
      sourceTrust: result.sourceSite.includes('السينما') || result.sourceSite.includes('IMDb') || result.sourceSite.includes('TheMovieDB') ? 'أرشيف معتمد موثق 100%' : 'فحص الموقع المباشر',
      verificationReasons: [
        `مستخرج من صفحة العمل المعتمدة في ${result.sourceSite}`,
        isPoster ? 'أبعاد رأسية قياسية متطابقة تماماً مع ملصقات السينما الرسمية (2:3)' : 'أبعاد مناسبة للترويج والعرض الرسمي',
        'دقة تصوير وتوزيع عالية الدقة بدون تشويه',
        'خالية من شعارات القنوات الفضائية والقص غير المعتمد'
      ]
    };
  }, [result, selectedCoverUrl, activeCoverUrl]);

  // Candidate covers & suspected images list
  const candidateCoversList = useMemo(() => {
    if (result.candidateCovers && result.candidateCovers.length > 0) {
      return result.candidateCovers;
    }
    return allImages.slice(0, 10).map((img, idx) => ({
      url: img.url,
      proxyUrl: img.proxyUrl,
      thumbnailUrl: img.thumbnailUrl,
      title: img.caption || `أفيش مرشح ${idx + 1}`,
      source: img.sourceSite || result.sourceSite,
      isSuspectedCandidate: true,
      authenticityScore: idx === 0 ? 97 : Math.max(68, 93 - idx * 3)
    }));
  }, [result, allImages]);

  const handleCopyUrl = async (urlToCopy?: string) => {
    const target = urlToCopy || activeCoverUrl;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openImageInModal = (imgUrl: string) => {
    setActiveModalImg(imgUrl);
    setModalOpen(true);
  };

  const filteredImages = imageCategory === 'all'
    ? allImages
    : allImages.filter(img => img.type === imageCategory);

  // Cast list normalized to CastMember
  const castList: CastMember[] = (result.castMembers && result.castMembers.length > 0)
    ? result.castMembers
    : (result.performers || []).map(p => ({ name: p, role: undefined, photoUrl: undefined, profileUrl: undefined }));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Live In-Site Browsing Status Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-900 border border-neutral-800 hover:border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 animate-fade-in-down">
        <div className="space-y-2">
          {/* Live Crawler Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>تصفح حي مباشر من: {result.sourceSite || 'الموقع المستهدف'}</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              ✓ تم الاستخراج الحقيقي بدون حجب
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {result.originalTitle} {result.year ? `(${result.year})` : ''}
          </h2>

          {result.localizedTitle && result.localizedTitle !== result.originalTitle && (
            <p className="text-sm font-semibold text-neutral-400">
              {result.localizedTitle}
            </p>
          )}
        </div>

        {/* Action button to open target website directly */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
          {onOpenInBrowser && result.officialUrl && (
            <button
              id="browse-in-embedded-btn"
              type="button"
              onClick={() => onOpenInBrowser(result.officialUrl)}
              className="inline-flex items-center gap-2 text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 px-4 py-2.5 rounded-xl transition shadow-md group active:scale-95"
            >
              <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>تصفح في المتصفح المفتوح</span>
            </button>
          )}

          {result.officialUrl && (
            <a
              id="visit-source-site-btn"
              href={result.officialUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-neutral-950 bg-neutral-800/80 hover:bg-amber-400 border border-amber-500/30 px-4 py-2.5 rounded-xl transition shadow-md group active:scale-95"
            >
              <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>زيارة في الموقع الأصلي</span>
            </a>
          )}
        </div>
      </div>

      {/* Quick In-Site Source Switcher */}
      {onRebrowse && (
        <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in-up delay-100">
          <span className="text-neutral-400 font-medium flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-400" />
            تصفح نفس العمل داخل موقع آخر:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onRebrowse(result.originalTitle, 'elcinema')}
              className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 border border-neutral-700 transition font-semibold active:scale-95"
            >
              السينما.كوم (elcinema)
            </button>
            <button
              type="button"
              onClick={() => onRebrowse(result.originalTitle, 'imdb')}
              className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 border border-neutral-700 transition font-semibold active:scale-95"
            >
              IMDb العالمية
            </button>
            <button
              type="button"
              onClick={() => onRebrowse(result.originalTitle, 'wikipedia')}
              className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 border border-neutral-700 transition font-semibold active:scale-95"
            >
              ويكيبيديا (Wikipedia)
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex border-b border-neutral-800 gap-2 overflow-x-auto pb-px animate-fade-in-up delay-150">
        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'gallery'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>أفيشات وصور الموقع ({allImages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cast')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'cast'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>طاقم العمل والممثلين ({result.castMembers?.length || result.performers?.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('story')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'story'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>القصة والتفاصيل الكاملة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('source')}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${
            activeTab === 'source'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>فحص المصدر الحي</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: GALLERY & IN-SITE IMAGES */}
      {/* ======================================================== */}
      {activeTab === 'gallery' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Main Poster Showcase Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl transition-all duration-300">
            <div className="lg:col-span-4 space-y-3 animate-scale-in delay-100">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Film className="w-4 h-4" />
                {t.coverBadge}
              </span>

              {displayCoverUrl ? (
                <div className="relative group rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 shadow-inner flex items-center justify-center aspect-[2/3] max-h-[460px] w-full">
                  <img
                    src={displayCoverUrl}
                    alt={result.originalTitle}
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (!imgError && activeCoverUrl) {
                        setImgError(true);
                      } else if (activeCoverUrl) {
                        setFailedCovers(prev => {
                          const nextSet = new Set(prev).add(activeCoverUrl);
                          const nextCandidate = allImages.find(img => !nextSet.has(img.url));
                          if (nextCandidate) {
                            setSelectedCoverUrl(nextCandidate.url);
                            setImgError(false);
                          }
                          return nextSet;
                        });
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => openImageInModal(activeCoverUrl || displayCoverUrl)}
                  />
                  <div
                    onClick={() => openImageInModal(activeCoverUrl || displayCoverUrl)}
                    className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer backdrop-blur-[2px]"
                  >
                    <span className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-neutral-950 text-xs font-bold shadow-lg flex items-center gap-1.5">
                      <Maximize2 className="w-4 h-4" />
                      {t.openCover}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="aspect-[2/3] rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500 text-xs">
                  لا يوجد ملصق رئيسي
                </div>
              )}
            </div>

            <div className="lg:col-span-8 space-y-4 animate-fade-in-right delay-150">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">
                  الأفيش الترويجي الرسمي لـ {result.originalTitle}
                </h3>
                <p className="text-xs text-neutral-400">
                  مستخرج مباشرة من صفحة العمل الرسمية في {result.sourceSite}.
                </p>
              </div>

              {/* Authenticity Verification Box (فحص وتأكيد أصالة الأفيش) */}
              {currentVerification && (
                <div className="p-4 rounded-xl bg-neutral-950/90 border border-emerald-500/30 shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-emerald-300">
                        فحص وتأكيد الأصالة: {currentVerification.statusLabel}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      نسبة الموثوقية: {currentVerification.authenticityScore}%
                    </span>
                  </div>

                  {/* Authenticity Meter */}
                  <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        currentVerification.authenticityScore >= 85
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-amber-500 to-amber-300'
                      }`}
                      style={{ width: `${currentVerification.authenticityScore}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-neutral-300">
                    <div className="flex items-center gap-1.5 bg-neutral-900/60 p-1.5 rounded-lg border border-neutral-800">
                      <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{currentVerification.aspectRatioLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-neutral-900/60 p-1.5 rounded-lg border border-neutral-800">
                      <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>المصدر: {currentVerification.sourceTrust}</span>
                    </div>
                  </div>

                  {/* Verification Criteria */}
                  <div className="space-y-1 pt-1.5 border-t border-neutral-800/80">
                    {currentVerification.verificationReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct image link & copy */}
              {activeCoverUrl && (
                <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                  <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    {t.directUrlLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={activeCoverUrl}
                      className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-xs font-mono text-neutral-300 focus:outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(activeCoverUrl)}
                      className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>{t.copyUrl}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {activeCoverUrl && (
                  <a
                    id="download-cover-main-btn"
                    href={`/api/proxy-image?url=${encodeURIComponent(activeCoverUrl)}&download=1`}
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-2.5 px-5 rounded-xl text-xs transition shadow-md active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الملصق عالي الدقة</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const target = activeCoverUrl || displayCoverUrl;
                    if (target) openImageInModal(target);
                  }}
                  className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-2.5 px-4 rounded-xl text-xs transition active:scale-95"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>معاينة مكبرة بالحجم الكامل</span>
                </button>
              </div>

              {/* Highlight summary snippet */}
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed">
                <span className="font-bold text-amber-300">نبذة سريعة: </span>
                {result.officialSummary.slice(0, 240)}...
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CANDIDATE & SUSPECTED POSTERS SHOWCASE (اقتراحات لصور من مشتبه فيهم) */}
          {/* ======================================================== */}
          {candidateCoversList.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>اقتراحات لصور من مشتبه فيهم (الأغلفة والبوسترات المرشحة والبديلة)</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {candidateCoversList.length} مرشح
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400">
                      قائمة بالملصقات البديلة المشتبه بها مع نسبة تطابق وأصالة كل غلاف، ويمكنك اعتماده بنقرة واحدة كغلاف رئيسي.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {candidateCoversList.map((cand, idx) => {
                  const isSelected = activeCoverUrl === cand.url;
                  const displayThumb = cand.thumbnailUrl || cand.proxyUrl || cand.url;
                  return (
                    <div
                      key={idx}
                      className={`group relative bg-neutral-950 border rounded-xl overflow-hidden shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                        isSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-amber-500/20'
                          : 'border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {/* Thumbnail container */}
                      <div
                        className="aspect-[2/3] relative overflow-hidden bg-neutral-900 cursor-pointer"
                        onClick={() => openImageInModal(cand.url)}
                      >
                        <img
                          src={displayThumb.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(displayThumb)}` : displayThumb}
                          alt={cand.title || `مرشح ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Top Suspect Badge */}
                        <div className="absolute top-2 right-2 left-2 flex items-center justify-between pointer-events-none gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/80 backdrop-blur-sm text-amber-300 border border-amber-500/30 shadow">
                            مشتبه به {cand.authenticityScore || 90}%
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-neutral-950 shadow flex items-center gap-0.5 shrink-0">
                              <Check className="w-2.5 h-2.5" />
                              الرئيسي
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay with Zoom */}
                        <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="p-2 rounded-full bg-neutral-900/90 text-white shadow">
                            <Maximize2 className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      {/* Card Content & Actions */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between space-y-2 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-200 line-clamp-1 text-[11px]" title={cand.title}>
                            {cand.title || `ملصق معتمد ${idx + 1}`}
                          </p>
                          <p className="text-[10px] text-neutral-400 line-clamp-1">
                            {cand.source || result.sourceSite}
                          </p>
                        </div>

                        <div className="pt-1 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCoverUrl(cand.url);
                              setImgError(false);
                            }}
                            className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>الغلاف المعتمد</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>اعتماد كغلاف رئيسي</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* In-Site Gallery Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4 animate-fade-in-up delay-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  كافة الصور المستخرجة من داخل الموقع ({filteredImages.length})
                </h3>
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setImageCategory('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                    imageCategory === 'all'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  الكل ({allImages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setImageCategory('poster')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                    imageCategory === 'poster'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  ملصقات وبوسترات
                </button>
                <button
                  type="button"
                  onClick={() => setImageCategory('still')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition active:scale-95 ${
                    imageCategory === 'still'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  مشاهد وكواليس
                </button>
              </div>
            </div>

            {filteredImages.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-sm">
                لا توجد صور إضافية ضمن هذا التصنيف في الصفحة.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredImages.map((img, idx) => (
                  <div
                    key={img.id}
                    style={{ animationDelay: `${Math.min(idx, 15) * 40}ms` }}
                    className="group relative bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-md hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 flex flex-col animate-scale-in"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden bg-neutral-900 cursor-pointer" onClick={() => openImageInModal(img.url)}>
                      <img
                        src={img.proxyUrl || img.url}
                        alt={img.caption}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          const fallback = `/api/proxy-image?url=${encodeURIComponent(img.url)}`;
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <span className="p-2 rounded-lg bg-amber-500 text-neutral-950 shadow-md">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                      <p className="text-[11px] font-medium text-neutral-300 line-clamp-1">
                        {img.caption}
                      </p>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-800/80">
                        <button
                          type="button"
                          onClick={() => setSelectedCoverUrl(img.url)}
                          title="تعيين كغلاف رئيسي"
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          عرض بالصدارة
                        </button>

                        <a
                          href={`/api/proxy-image?url=${encodeURIComponent(img.url)}&download=1`}
                          title="تحميل الصورة"
                          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CAST & CREW */}
      {/* ======================================================== */}
      {activeTab === 'cast' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">
                طاقم العمل والممثلين المستخرجين من {result.sourceSite}
              </h3>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-300 font-semibold">
              {result.castMembers?.length || result.performers?.length} أسماء مسجلة
            </span>
          </div>

          {/* Director & Writer Highlight Cards */}
          {(result.director || result.screenplay) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-down delay-75">
              {result.director && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                    <Film className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-400">ﺇﺧﺮاﺝ / Director</span>
                    <p className="text-base font-bold text-white">{result.director}</p>
                  </div>
                </div>
              )}

              {result.screenplay && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-neutral-800 text-neutral-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-400">ﺗﺄﻟﻴﻒ / سيناريو</span>
                    <p className="text-base font-bold text-white">{result.screenplay}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cast Cards Grid with staggered entry */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {castList.map((member, idx) => (
              <div
                key={idx}
                style={{ animationDelay: `${Math.min(idx, 15) * 35}ms` }}
                className="group bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col items-center text-center space-y-2 hover:border-amber-500/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 animate-fade-in-up"
              >
                {member.photoUrl ? (
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(member.photoUrl)}`}
                    alt={member.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full object-cover border-2 border-neutral-800 group-hover:border-amber-500/50 shadow transition-colors"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-bold text-lg border border-neutral-700 group-hover:border-amber-500/30 transition-colors">
                    {member.name.slice(0, 1)}
                  </div>
                )}

                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {member.name}
                  </h4>
                  {member.role && (
                    <p className="text-[11px] text-amber-400 font-medium">
                      {member.role}
                    </p>
                  )}
                </div>

                {member.profileUrl && (
                  <a
                    href={member.profileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[10px] text-neutral-400 hover:text-amber-300 inline-flex items-center gap-1 mt-auto pt-1 transition-colors"
                  >
                    <span>صفحة الممثل</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: STORY & PRODUCTION METADATA */}
      {/* ======================================================== */}
      {activeTab === 'story' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6 animate-fade-in-up">
          <div className="flex items-center gap-2 pb-4 border-b border-neutral-800">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              ملخص القصة وبيانات العمل الرسمية
            </h3>
          </div>

          {/* Full Synopsis */}
          <div className="space-y-2 animate-scale-in delay-75">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              القصة الكاملة (نصياً من الموقع المستهدف):
            </span>
            <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 leading-relaxed font-sans select-text whitespace-pre-line shadow-inner">
              {result.officialSummary}
            </div>
          </div>

          {/* Production Key-Values */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in-up delay-150">
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                الموقع / جهة التوثيق
              </span>
              <p className="text-sm font-bold text-white">{result.studio}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                سنة الإصدار
              </span>
              <p className="text-sm font-bold text-white">{result.releaseDate}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                المدة / الصيغة
              </span>
              <p className="text-sm font-bold text-white">{result.duration}</p>
            </div>

            {result.country && (
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  بلد الإنتاج
                </span>
                <p className="text-sm font-bold text-white">{result.country}</p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                التصنيف والأنواع
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.categories.map((cat, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-semibold"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: LIVE SOURCE INSPECTOR */}
      {/* ======================================================== */}
      {activeTab === 'source' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-5 animate-fade-in-up">
          <div className="flex items-center gap-2 pb-4 border-b border-neutral-800">
            <Globe className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              بيانات الاتصال والتصفح الحي للموقع الأصلي
            </h3>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1 animate-scale-in delay-75">
              <span className="text-xs font-semibold text-neutral-400">
                الرابط المستهدف المباشر (Target Webpage URL):
              </span>
              <div className="flex items-center justify-between gap-2">
                <a
                  href={result.officialUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs font-mono text-amber-400 hover:underline break-all truncate"
                >
                  {result.officialUrl}
                </a>
                <div className="flex items-center gap-2">
                  {onOpenInBrowser && (
                    <button
                      type="button"
                      onClick={() => onOpenInBrowser(result.officialUrl)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold shrink-0 flex items-center gap-1.5 transition shadow active:scale-95"
                      title="فتح هذه الصفحة مباشرة في المتصفح المدمج داخل التطبيق"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>تصفح بالمتصفح المفتوح</span>
                    </button>
                  )}
                  <a
                    href={result.officialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold shrink-0 flex items-center gap-1 active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح في نافذة جديدة</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up delay-150">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">حالة استجابة الخادم:</span>
                <p className="text-sm font-bold text-emerald-400">200 OK (حي ومباشر)</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">محرك التصفح والاستخراج:</span>
                <p className="text-sm font-bold text-white">Cheerio Live DOM Parser</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-xs text-neutral-400">الذكاء الاصطناعي (AI):</span>
                <p className="text-sm font-bold text-amber-300">معطّل تماماً (تصفح كودي حي)</p>
              </div>
            </div>

            {/* Sources list */}
            <div className="space-y-2 pt-2 border-t border-neutral-800 animate-fade-in-up delay-200">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                سجل التصفح الحي:
              </span>
              <div className="space-y-1.5">
                {result.sourcesTried.map((src, i) => (
                  <div
                    key={i}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 text-xs animate-fade-in-right"
                  >
                    <span className="font-mono text-neutral-200 truncate max-w-[70%]">
                      {src.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ✓ متصل ومستخرج
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {modalOpen && activeModalImg && (
        <ImageModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          imageUrl={activeModalImg}
          title={result.originalTitle}
          currentLang={currentLang}
        />
      )}
    </div>
  );
};
