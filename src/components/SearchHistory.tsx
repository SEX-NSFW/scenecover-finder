import React from 'react';
import { History, Trash2, ArrowUpRight, Film, ExternalLink } from 'lucide-react';
import { HistoryItem, SupportedLanguage } from '../types.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';

interface SearchHistoryProps {
  history: HistoryItem[];
  onSelect: (query: string) => void;
  onClear: () => void;
  currentLang: SupportedLanguage;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onSelect,
  onClear,
  currentLang,
}) => {
  const t = TRANSLATIONS[currentLang];

  if (!history || history.length === 0) return null;

  return (
    <div className="w-full max-w-5xl mx-auto pt-8 border-t border-neutral-800/80 space-y-4 animate-fade-in-up">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm font-bold text-neutral-200">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <History className="w-4 h-4" />
          </div>
          <span>{t.recentSearches}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800/80 text-amber-400 font-mono font-semibold border border-neutral-700/50">
            {history.length}
          </span>
        </div>
        <button
          id="clear-history-btn"
          onClick={onClear}
          className="text-xs text-neutral-400 hover:text-red-400 flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-lg hover:bg-neutral-800/80 active:scale-95 border border-transparent hover:border-neutral-700/60"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.clearHistory}</span>
        </button>
      </div>

      {/* History Grid with staggered entrance animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {history.map((item, index) => {
          const proxyImg = item.coverUrl
            ? `/api/proxy-image?url=${encodeURIComponent(item.coverUrl)}`
            : undefined;

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.query)}
              style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
              className="group relative p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-amber-500/50 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 flex items-center gap-3 animate-scale-in overflow-hidden"
            >
              {/* Subtle hover gradient glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Cover thumbnail with hotlink bypass & fallback */}
              {item.coverUrl ? (
                <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-neutral-700/60 shrink-0 shadow-md bg-neutral-950">
                  <img
                    src={item.coverUrl}
                    alt={item.originalTitle}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback to proxy without blocking
                      if (proxyImg && e.currentTarget.src !== proxyImg) {
                        e.currentTarget.src = proxyImg;
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-12 h-16 rounded-lg bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center text-xs text-neutral-500 shrink-0 gap-1">
                  <Film className="w-4 h-4 text-neutral-600" />
                  <span className="text-[10px] font-mono">HD</span>
                </div>
              )}

              {/* Content info */}
              <div className="flex-1 min-w-0 relative z-10">
                <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors duration-200 truncate">
                  {item.originalTitle}
                </h4>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  {item.studio || 'إنتاج سينمائي'}
                </p>
                {item.performers && item.performers.length > 0 && (
                  <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                    {item.performers.slice(0, 2).join('، ')}
                  </p>
                )}
              </div>

              {/* Arrow Indicator */}
              <div className="relative z-10 p-1 rounded-lg text-neutral-500 group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-all duration-200 shrink-0 opacity-60 group-hover:opacity-100">
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform rtl:group-hover:-translate-x-0.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
