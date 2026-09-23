import React, { useState, useEffect } from 'react';
import { Search, Loader2, Sparkles, X, Globe, Film, Tv, BookOpen, Layers, Link as LinkIcon } from 'lucide-react';
import { SupportedLanguage } from '../types.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';

interface SearchBoxProps {
  currentLang: SupportedLanguage;
  onSearch: (query: string, targetSite?: string, customDomain?: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  onOpenBrowser?: (url?: string) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  currentLang,
  onSearch,
  isLoading,
  initialQuery = '',
  onOpenBrowser,
}) => {
  const t = TRANSLATIONS[currentLang];
  const [query, setQuery] = useState(initialQuery);
  const [selectedSite, setSelectedSite] = useState<'universal' | 'tmdb' | 'imdb' | 'elcinema' | 'wikipedia' | 'rottentomatoes' | 'custom'>('universal');
  const [customDomain, setCustomDomain] = useState('');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    let finalQuery = query.trim();
    if (selectedSite === 'elcinema' && !finalQuery.includes('السينما') && !finalQuery.includes('elcinema')) {
      finalQuery = `${finalQuery} من موقع السينما كوم`;
    } else if (selectedSite === 'imdb' && !finalQuery.toLowerCase().includes('imdb')) {
      finalQuery = `${finalQuery} IMDb`;
    } else if (selectedSite === 'tmdb' && !finalQuery.toLowerCase().includes('tmdb')) {
      finalQuery = `${finalQuery} TMDB`;
    } else if (selectedSite === 'wikipedia' && !finalQuery.includes('ويكيبيديا') && !finalQuery.toLowerCase().includes('wikipedia')) {
      finalQuery = `${finalQuery} ويكيبيديا`;
    } else if (selectedSite === 'rottentomatoes' && !finalQuery.toLowerCase().includes('rotten')) {
      finalQuery = `${finalQuery} Rotten Tomatoes`;
    }

    onSearch(finalQuery, selectedSite === 'universal' ? undefined : selectedSite, selectedSite === 'custom' ? customDomain : undefined);
  };

  const handleChipClick = (sampleQuery: string) => {
    setQuery(sampleQuery);
    onSearch(sampleQuery, selectedSite === 'universal' ? undefined : selectedSite, selectedSite === 'custom' ? customDomain : undefined);
  };

  const siteFilters = [
    { id: 'universal', label: 'كافة مواقع الويب المفتوحة (تغطية شاملة)', icon: Globe },
    { id: 'tmdb', label: 'TheMovieDB العالمية (4K)', icon: Sparkles },
    { id: 'imdb', label: 'IMDb العالمية', icon: Tv },
    { id: 'elcinema', label: 'السينما.كوم', icon: Film },
    { id: 'wikipedia', label: 'ويكيبيديا (Wikipedia)', icon: BookOpen },
    { id: 'rottentomatoes', label: 'Rotten Tomatoes', icon: Layers },
    { id: 'custom', label: 'موقع مخصص (أي موقع تريده)', icon: LinkIcon },
  ] as const;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Site filter picker pills */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap pb-1">
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider pl-2 rtl:pr-2 rtl:pl-0 flex items-center gap-1">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          نطاق المواقع:
        </span>
        {siteFilters.map((site) => {
          const Icon = site.icon;
          const isSelected = selectedSite === site.id;
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => setSelectedSite(site.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{site.label}</span>
            </button>
          );
        })}
      </div>

      {/* Custom site domain input if user selected 'custom' */}
      {selectedSite === 'custom' && (
        <div className="bg-neutral-900/95 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-2.5 text-xs shadow-lg animate-scale-in">
          <span className="text-amber-400 font-bold shrink-0 flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-amber-400" />
            اسم أو رابط الموقع للدخول والبحث:
          </span>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="مثال: IMDb أو elcinema أو netflix أو shahid أو أي موقع تريده..."
            className="flex-1 w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-medium"
          />
        </div>
      )}

      {/* Search Bar Form */}
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3.5">
        {/* Main Input Field */}
        <div className="relative flex items-center w-full bg-neutral-900 border-2 border-neutral-700/80 focus-within:border-amber-500 rounded-2xl shadow-2xl shadow-black/80 transition-all duration-200 overflow-hidden">
          <div className="pl-4 pr-2 rtl:pl-2 rtl:pr-4 text-neutral-400 focus-within:text-amber-400 transition">
            <Search className="w-6 h-6" />
          </div>

          <input
            id="main-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              selectedSite === 'custom' && customDomain.trim()
                ? `اكتب اسم الفيلم للبحث عنه واستخراجه من داخل موقع ${customDomain.trim()}...`
                : "ابحث عن أي فيلم أو اكتب اسم الفيلم والموقع (مثال: فيلم Inception من موقع IMDb)..."
            }
            disabled={isLoading}
            className="w-full py-4 px-2 bg-transparent text-white placeholder-neutral-500 font-medium text-base sm:text-lg focus:outline-none disabled:opacity-60"
          />

          {query && !isLoading && (
            <button
              type="button"
              id="clear-search-btn"
              onClick={() => setQuery('')}
              className="p-3 text-neutral-400 hover:text-white transition"
              aria-label="Clear input"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Action Buttons Underneath the Input Field */}
        <div className="w-full flex flex-wrap justify-center items-center gap-3 pt-1">
          <button
            id="submit-search-btn"
            type="submit"
            disabled={isLoading || !query.trim()}
            className="flex-1 sm:flex-none sm:min-w-[240px] flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-neutral-950 font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-amber-500/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t.searchingBtn}</span>
              </>
            ) : (
              <>
                <Globe className="w-5 h-5" />
                <span>استخراج وتصفح حي من كافة المواقع</span>
              </>
            )}
          </button>

          {onOpenBrowser && (
            <button
              id="open-embedded-browser-btn"
              type="button"
              onClick={() => onOpenBrowser(query.trim() ? (query.trim().startsWith('http') ? query.trim() : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`) : undefined)}
              className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-amber-500/30 font-semibold px-5 py-3.5 rounded-xl transition text-sm hover:border-amber-400 active:scale-[0.98]"
              title="تصفح أي موقع على الويب بحرية تامة داخل المتصفح المدمج"
            >
              <Globe className="w-4 h-4" />
              <span>المتصفح المفتوح لكافة المواقع</span>
            </button>
          )}
        </div>
      </form>

      {/* Suggested Example Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          {t.exampleLabel}
        </span>
        <div className="flex flex-wrap gap-1.5 items-center">
          {t.examples.map((item, idx) => (
            <button
              key={idx}
              id={`example-chip-${idx}`}
              type="button"
              onClick={() => handleChipClick(item.query)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-amber-300 border border-neutral-800 hover:border-amber-500/40 transition active:scale-95 text-start font-medium"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
