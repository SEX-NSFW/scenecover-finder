import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles, Globe } from 'lucide-react';
import { SupportedLanguage } from '../types.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';

interface LoadingStagesProps {
  currentLang: SupportedLanguage;
}

export const LoadingStages: React.FC<LoadingStagesProps> = ({ currentLang }) => {
  const t = TRANSLATIONS[currentLang];
  const [currentStage, setCurrentStage] = useState(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStage(2), 650);
    const timer2 = setTimeout(() => setCurrentStage(3), 1400);
    const timer3 = setTimeout(() => setCurrentStage(4), 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const stages = [
    { number: 1, text: t.stage1 },
    { number: 2, text: t.stage2 },
    { number: 3, text: t.stage3 },
    { number: 4, text: t.stage4 },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-neutral-900/90 border border-neutral-800 rounded-2xl shadow-xl space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wide">
            {t.searchingBtn}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-full font-medium">
          <Globe className="w-3.5 h-3.5" />
          <span>تغطية مفتوحة شاملة بدون حجب</span>
        </div>
      </div>

      <div className="space-y-3.5">
        {stages.map((stg) => {
          const isDone = currentStage > stg.number;
          const isCurrent = currentStage === stg.number;
          const isPending = currentStage < stg.number;

          return (
            <div
              key={stg.number}
              className={`flex items-start gap-3.5 p-3 rounded-xl transition-all duration-300 ${
                isCurrent
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                  : isDone
                  ? 'bg-neutral-800/40 text-neutral-300'
                  : 'text-neutral-500 opacity-60'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-neutral-700 flex items-center justify-center text-xs font-mono">
                    {stg.number}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className={`text-sm font-medium ${isCurrent ? 'font-semibold text-white' : ''}`}>
                  {stg.text}
                </p>
                {stg.number === 4 && (
                  <p className="text-xs text-neutral-400 mt-1">
                    {t.stillRejectedNote}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
