import React from 'react';
import { Film, Globe, Sparkles, Download } from 'lucide-react';
import { SupportedLanguage } from '../types.ts';
import { LANGUAGES, TRANSLATIONS } from '../lib/i18n.ts';

interface HeaderProps {
  currentLang: SupportedLanguage;
  onSelectLang: (lang: SupportedLanguage) => void;
  activeMode?: 'extractor' | 'browser';
  onSelectMode?: (mode: 'extractor' | 'browser') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLang,
  onSelectLang,
  activeMode = 'extractor',
  onSelectMode,
}) => {
  const t = TRANSLATIONS[currentLang];

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10 border border-amber-400/20">
            <Film className="w-5 h-5 text-neutral-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white font-mono">
                {t.productName}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Live Web
              </span>
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs in Header */}
        {onSelectMode && (
          <div className="hidden sm:flex items-center bg-neutral-950/80 border border-neutral-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onSelectMode('extractor')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === 'extractor'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>محرك الاستخراج</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectMode('browser')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeMode === 'browser'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>المتصفح المدمج</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 rounded uppercase">
                Iframe
              </span>
            </button>
          </div>
        )}

        {/* Language selector & Download ZIP */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/download-zip"
            download="cinecover-project.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition shadow-sm active:scale-95"
            title="تحميل كود المشروع كاملاً بصيغة ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تحميل الكود (ZIP)</span>
            <span className="sm:hidden">ZIP</span>
          </a>

          <div className="relative flex items-center bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg px-2.5 py-1.5 transition">
            <Globe className="w-4 h-4 text-neutral-400 mr-2 rtl:mr-0 rtl:ml-2" />
            <select
              id="lang-select"
              value={currentLang}
              onChange={(e) => onSelectLang(e.target.value as SupportedLanguage)}
              aria-label="Select Language"
              className="bg-transparent text-xs sm:text-sm text-neutral-200 font-medium focus:outline-none cursor-pointer pr-4 rtl:pr-0 rtl:pl-4"
            >
              {Object.entries(LANGUAGES).map(([code, info]) => (
                <option key={code} value={code} className="bg-neutral-900 text-neutral-200">
                  {info.nativeName} ({info.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
