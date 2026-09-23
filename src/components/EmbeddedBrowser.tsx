import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Search,
  Maximize2,
  Minimize2,
  Sparkles,
  Film,
  Tv,
  ShieldCheck,
  Radio,
  X,
  AlertCircle
} from 'lucide-react';
import { SupportedLanguage } from '../types.ts';

interface EmbeddedBrowserProps {
  initialUrl?: string;
  searchFallbackQuery?: string;
  currentLang: SupportedLanguage;
  onExtractFromUrl: (url: string) => void;
  onClose?: () => void;
}

export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  initialUrl,
  searchFallbackQuery,
  currentLang,
  onExtractFromUrl,
  onClose,
}) => {
  const getDefaultUrl = () => {
    if (initialUrl) return initialUrl;
    if (searchFallbackQuery && searchFallbackQuery.trim()) {
      const q = searchFallbackQuery.trim();
      if (q.startsWith('http://') || q.startsWith('https://')) return q;
      return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    }
    return 'https://html.duckduckgo.com/html/?q=cinema+movies';
  };

  const [currentUrl, setCurrentUrl] = useState<string>(getDefaultUrl);
  const [inputUrl, setInputUrl] = useState<string>(getDefaultUrl);
  const [history, setHistory] = useState<string[]>([getDefaultUrl()]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [embedMode, setEmbedMode] = useState<'proxy' | 'direct'>('proxy');
  const [iframeKey, setIframeKey] = useState<number>(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Update URL if props change
  useEffect(() => {
    const newUrl = getDefaultUrl();
    setCurrentUrl(newUrl);
    setInputUrl(newUrl);
    setHistory([newUrl]);
    setHistoryIndex(0);
    setIsLoadingIframe(true);
  }, [initialUrl, searchFallbackQuery]);

  // Listen to navigation messages from embedded iframe script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CINECOVER_EMBED_NAVIGATED' && event.data.url) {
        const navigatedUrl = event.data.url as string;
        if (navigatedUrl && navigatedUrl !== currentUrl) {
          setCurrentUrl(navigatedUrl);
          setInputUrl(navigatedUrl);
          setHistory((prev) => {
            const next = prev.slice(0, historyIndex + 1);
            return [...next, navigatedUrl];
          });
          setHistoryIndex((prev) => prev + 1);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentUrl, historyIndex]);

  const navigateTo = (url: string) => {
    let target = url.trim();
    if (!target) return;

    // If user entered search words without http/domain, search the open web
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.')) {
        target = `https://${target}`;
      } else {
        target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(target)}`;
      }
    }

    setCurrentUrl(target);
    setInputUrl(target);
    setIsLoadingIframe(true);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, target];
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(inputUrl);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentUrl(prevUrl);
      setInputUrl(prevUrl);
      setIsLoadingIframe(true);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentUrl(nextUrl);
      setInputUrl(nextUrl);
      setIsLoadingIframe(true);
    }
  };

  const handleReload = () => {
    setIsLoadingIframe(true);
    setIframeKey((k) => k + 1);
  };

  const handleHome = () => {
    navigateTo('https://html.duckduckgo.com/html/?q=cinema+movies');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const computedIframeSrc = embedMode === 'proxy'
    ? `/api/embed-proxy?url=${encodeURIComponent(currentUrl)}`
    : currentUrl;

  const quickBookmarks = [
    { label: '🔍 بحث جوجل (مفتوح بالكامل)', url: 'https://www.google.com/search?igu=1&q=cinema+movies', icon: Search },
    { label: '🌐 بحث الويب الشامل', url: 'https://html.duckduckgo.com/html/?q=cinema', icon: Globe },
    { label: 'السينما.كوم', url: 'https://elcinema.com/', icon: Film },
    { label: 'IMDb العالمية', url: 'https://www.imdb.com/', icon: Tv },
    { label: 'TheMovieDB', url: 'https://www.themoviedb.org/', icon: Sparkles },
    { label: 'ويكيبيديا', url: 'https://ar.wikipedia.org/', icon: Globe },
    { label: 'Rotten Tomatoes', url: 'https://www.rottentomatoes.com/', icon: Film },
    { label: 'منصة شاهد', url: 'https://shahid.mbc.net/', icon: Tv },
    { label: 'Letterboxd', url: 'https://letterboxd.com/', icon: Film },
  ];

  const isWorkPage = currentUrl.includes('/work/') || currentUrl.includes('/title/tt') || currentUrl.includes('/movie/') || currentUrl.includes('/tv/') || currentUrl.includes('/m/');

  return (
    <div
      className={`w-full max-w-6xl mx-auto rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
        isExpanded ? 'fixed inset-4 z-50 max-w-none w-auto h-auto' : ''
      }`}
    >
      {/* Top Browser Window Header */}
      <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left Side: Browser Identity & Window Dots */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              المتصفح المفتوح لكافة المواقع (Universal Web Browser)
            </span>
          </div>
        </div>

        {/* Right Side: Mode Tag & Window Controls */}
        <div className="flex items-center gap-2">
          {/* Proxy Mode Badge */}
          <button
            type="button"
            onClick={() => {
              setEmbedMode((m) => (m === 'proxy' ? 'direct' : 'proxy'));
              setIsLoadingIframe(true);
            }}
            title="انقر للتبديل بين وضع تخطي الحجب (Proxy) والاتصال المباشر"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
              embedMode === 'proxy'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{embedMode === 'proxy' ? 'بروكسي تخطي الحجب (مفعّل)' : 'اتصال مباشر'}</span>
          </button>

          {/* Expand / Minimize Window */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'تصغير الحجم' : 'تكبير ملء الشاشة'}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="إغلاق المتصفح المدمج"
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-900/40 text-neutral-300 hover:text-red-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation & Address Bar */}
      <div className="bg-neutral-900/95 px-4 py-2.5 border-b border-neutral-800 flex flex-wrap items-center gap-2">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            title="الصفحة السابقة"
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ArrowRight className="w-4 h-4 rtl:hidden" />
            <ArrowLeft className="w-4 h-4 ltr:hidden" />
          </button>

          <button
            type="button"
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            title="الصفحة التالية"
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ArrowLeft className="w-4 h-4 rtl:hidden" />
            <ArrowRight className="w-4 h-4 ltr:hidden" />
          </button>

          <button
            type="button"
            onClick={handleReload}
            title="إعادة تحميل الصفحة"
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          >
            <RotateCw className={`w-4 h-4 ${isLoadingIframe ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleHome}
            title="السينما.كوم الرئيسية"
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* Address Input Bar */}
        <form onSubmit={handleFormSubmit} className="flex-1 min-w-[240px] flex items-center gap-1.5">
          <div className="flex-1 relative flex items-center">
            <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-neutral-500">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="اكتب عنوان الرابط أو ابحث عن فيلم أو مسلسل..."
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl ps-9 pe-20 py-2 text-xs font-mono text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
            />
            {inputUrl && (
              <button
                type="button"
                onClick={() => setInputUrl('')}
                className="absolute inset-y-0 end-12 flex items-center px-1 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute inset-y-1 end-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs transition flex items-center gap-1"
            >
              <span>تصفح</span>
            </button>
          </div>
        </form>

        {/* Actions for current page */}
        <div className="flex items-center gap-1.5">
          {/* Extract Button: if user is on a work page or wants to extract from current page */}
          <button
            type="button"
            onClick={() => onExtractFromUrl(currentUrl)}
            title="استخراج الأفيش الرسمي والبيانات من هذه الصفحة فوراً"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-md ${
              isWorkPage
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-neutral-950 ring-2 ring-amber-400/50 animate-pulse'
                : 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>استخراج هذا العمل</span>
          </button>

          {/* Copy URL */}
          <button
            type="button"
            onClick={handleCopy}
            title="نسخ رابط الصفحة الحالية"
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition text-xs flex items-center gap-1"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Open in external tab */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer noopener"
            title="فتح الرابط في نافذة جديدة"
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Quick Bookmarks Bar */}
      <div className="bg-neutral-950/70 px-4 py-2 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-neutral-500 text-[11px] font-bold whitespace-nowrap flex items-center gap-1">
          <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
          مواقع سريعة:
        </span>
        {quickBookmarks.map((bm, i) => {
          const Icon = bm.icon;
          const isActive = currentUrl === bm.url;
          return (
            <button
              key={i}
              type="button"
              onClick={() => navigateTo(bm.url)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              <Icon className="w-3 h-3 text-amber-400" />
              <span>{bm.label}</span>
            </button>
          );
        })}
      </div>

      {/* Embedded Iframe Container */}
      <div className="relative flex-1 bg-neutral-950" style={{ minHeight: isExpanded ? 'calc(100vh - 140px)' : '680px' }}>
        {isLoadingIframe && (
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
            <RotateCw className="w-8 h-8 text-amber-500 animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-white">جارٍ تحميل وتصفح الموقع...</p>
              <p className="text-xs text-neutral-400 font-mono max-w-md truncate px-4">
                {currentUrl}
              </p>
            </div>
          </div>
        )}

        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={computedIframeSrc}
          title="CineCover Embedded Browser"
          className="w-full h-full border-0"
          style={{ minHeight: isExpanded ? 'calc(100vh - 140px)' : '680px' }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          onLoad={() => setIsLoadingIframe(false)}
          onError={() => setIsLoadingIframe(false)}
        />
      </div>

      {/* Footer helper note */}
      <div className="bg-neutral-950 px-4 py-2 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            تصفح مباشر حي داخل التطبيق — عند وصولك لصفحة أي فيلم أو مسلسل، انقر على زر{' '}
            <strong className="text-amber-400">«استخراج هذا العمل»</strong> في الشريط العلوي.
          </span>
        </div>

        <span className="text-neutral-500 font-mono text-[10px]">
          X-Frame-Options Bypassed via CineCover Proxy
        </span>
      </div>
    </div>
  );
};
