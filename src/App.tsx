import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { SearchBox } from './components/SearchBox.tsx';
import { LoadingStages } from './components/LoadingStages.tsx';
import { CoverResult } from './components/CoverResult.tsx';
import { SearchHistory } from './components/SearchHistory.tsx';
import { EmbeddedBrowser } from './components/EmbeddedBrowser.tsx';
import { MediaResult, HistoryItem, SupportedLanguage } from './types.ts';
import { LANGUAGES, TRANSLATIONS } from './lib/i18n.ts';
import { AlertCircle, Film, Sparkles, Globe } from 'lucide-react';

const STORAGE_KEY_LANG = 'cinecover_lang';
const STORAGE_KEY_HISTORY = 'cinecover_history_v1';

export default function App() {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    if (saved && saved in LANGUAGES) {
      return saved as SupportedLanguage;
    }
    return 'ar'; // Default Arabic
  });

  const [appMode, setAppMode] = useState<'extractor' | 'browser'>('extractor');
  const [browserUrl, setBrowserUrl] = useState<string | undefined>(undefined);
  const [browserSearchQuery, setBrowserSearchQuery] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<MediaResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Handle document direction and language changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, currentLang);
    const dir = LANGUAGES[currentLang]?.dir || 'rtl';
    document.documentElement.dir = dir;
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  // Save history updates
  const saveToHistory = (media: MediaResult, query: string) => {
    const newItem: HistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      query,
      originalTitle: media.originalTitle,
      studio: media.studio,
      performers: media.performers,
      coverUrl: media.coverUrl,
      confidence: media.confidence,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // Remove previous duplicate query if present
      const filtered = prev.filter((item) => item.query.toLowerCase() !== query.toLowerCase());
      const updated = [newItem, ...filtered].slice(0, 9);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save history to localStorage', err);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  const handleSearch = async (query: string, targetSite?: string, customDomain?: string) => {
    if (!query.trim() || isLoading) return;

    setErrorMsg(null);
    setIsLoading(true);
    setSearchQuery(query);
    setResult(null);

    try {
      const response = await fetch('/api/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, targetSite, customDomain }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.result) {
        setResult(data.result);
        saveToHistory(data.result, query);
      } else {
        setErrorMsg(data.error || TRANSLATIONS[currentLang].serverError);
      }
    } catch (err: any) {
      console.error('Search request error:', err);
      setErrorMsg(TRANSLATIONS[currentLang].serverError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBrowser = (url?: string) => {
    if (url) {
      setBrowserUrl(url);
    } else if (searchQuery.trim()) {
      const q = searchQuery.trim();
      setBrowserUrl(q.startsWith('http') ? q : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
    } else {
      setBrowserUrl('https://html.duckduckgo.com/html/?q=cinema+movies');
    }
    setBrowserSearchQuery(searchQuery);
    setAppMode('browser');
  };

  const t = TRANSLATIONS[currentLang];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-200">
      {/* Top Header & Language Bar with Mode Switcher */}
      <Header
        currentLang={currentLang}
        onSelectLang={setCurrentLang}
        activeMode={appMode}
        onSelectMode={setAppMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Mode Switcher for Mobile Screens */}
        <div className="flex sm:hidden items-center justify-center bg-neutral-900 border border-neutral-800 p-1 rounded-xl max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => setAppMode('extractor')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              appMode === 'extractor'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>محرك الاستخراج</span>
          </button>
          <button
            type="button"
            onClick={() => setAppMode('browser')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              appMode === 'browser'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>المتصفح المدمج</span>
          </button>
        </div>

        {/* EMBEDDED BROWSER MODE */}
        {appMode === 'browser' ? (
          <section className="space-y-6">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-wide">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>وضع التصفح الحي المفتوح لكافة المواقع</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                تصفح أي موقع على الويب مباشرة داخل التطبيق
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400">
                تصفح أي موقع ويب أو قاعدة بيانات سينمائية عالمية أو عربية بحرية تامة دون حجب، وعند وصولك لأي صفحة فيلم أو مسلسل اضغط على «استخراج هذا العمل» لجلب ملصقه وبياناته فوراً!
              </p>
            </div>

            <EmbeddedBrowser
              initialUrl={browserUrl}
              searchFallbackQuery={browserSearchQuery || searchQuery}
              currentLang={currentLang}
              onExtractFromUrl={(url) => {
                setAppMode('extractor');
                handleSearch(url);
              }}
              onClose={() => setAppMode('extractor')}
            />
          </section>
        ) : (
          /* STANDARD EXTRACTOR MODE */
          <>
            {/* Intro Banner */}
            <section className="text-center space-y-3 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>محرك الأغلفة والملصقات السينمائية الرسمية</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {t.tagline}
              </h1>

              <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                محرك ذكي مخصص للتعرف الفوري على الأفلام والمسلسلات التلفزيونية واستخراج الأغلفة والملصقات الترويجية المعتمدة (Official Key Art) بدقة فائقة وروابط مباشرة دون لقطات عشوائية.
              </p>
            </section>

            {/* Search Bar with Embedded Browser Quick-Launch */}
            <section>
              <SearchBox
                currentLang={currentLang}
                onSearch={handleSearch}
                isLoading={isLoading}
                initialQuery={searchQuery}
                onOpenBrowser={handleOpenBrowser}
              />
            </section>

            {/* Loading Progress Stages */}
            {isLoading && (
              <section>
                <LoadingStages currentLang={currentLang} />
              </section>
            )}

            {/* Error message */}
            {errorMsg && !isLoading && (
              <section className="space-y-4 max-w-3xl mx-auto">
                <div className="p-4 rounded-xl bg-red-950/50 border border-red-900/60 text-red-200 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="flex-1 text-sm font-medium">{errorMsg}</div>
                </div>

                {/* Embedded Browser Fallback Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 border border-amber-500/30 text-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                      <Globe className="w-4 h-4" />
                      <span>تعذر الاستخراج التلقائي المباشر أو لم يتم العثور على العمل؟</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed max-w-xl">
                      يمكنك تصفح أي موقع على الإنترنت بحرية تامة عبر <strong>المتصفح المفتوح لكافة المواقع</strong> داخل التطبيق، واستعراض الأفيشات والمعلومات مع تخطي قيود الحجب واستخراج العمل بنقرة واحدة!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenBrowser()}
                    className="w-full sm:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold shrink-0 transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Globe className="w-4 h-4" />
                    <span>فتح في المتصفح المدمج الآن</span>
                  </button>
                </div>
              </section>
            )}

            {/* Result Display */}
            {result && !isLoading && (
              <section>
                <CoverResult
                  result={result}
                  currentLang={currentLang}
                  onRebrowse={(title, targetSite) => handleSearch(title, targetSite)}
                  onOpenInBrowser={(url) => handleOpenBrowser(url)}
                />
              </section>
            )}

            {/* Search History */}
            {!isLoading && (
              <section>
                <SearchHistory
                  history={history}
                  onSelect={handleSearch}
                  onClear={handleClearHistory}
                  currentLang={currentLang}
                />
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neutral-400 font-medium">
            <Film className="w-4 h-4 text-amber-500" />
            <span>CineCover &copy; {new Date().getFullYear()}</span>
          </div>
          <p className="text-neutral-500">
            {t.stillRejectedNote}
          </p>
        </div>
      </footer>
    </div>
  );
}
