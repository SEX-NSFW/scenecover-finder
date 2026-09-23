import React, { useState } from 'react';
import { X, ExternalLink, Download } from 'lucide-react';
import { SupportedLanguage } from '../types.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  currentLang: SupportedLanguage;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  currentLang,
}) => {
  const [useProxy, setUseProxy] = useState(false);
  if (!isOpen) return null;
  const t = TRANSLATIONS[currentLang];

  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
  const displaySrc = useProxy ? proxyUrl : imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in-up">
      <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center animate-scale-in">
        {/* Top action bar */}
        <div className="w-full flex items-center justify-between pb-3 text-neutral-300">
          <div className="truncate pr-4 font-semibold text-sm sm:text-base text-white">
            {title}
          </div>
          <div className="flex items-center gap-2">
            <a
              id="modal-open-direct"
              href={imageUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition flex items-center gap-1.5 text-xs font-medium active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">{t.openCover}</span>
            </a>
            <a
              id="modal-download"
              href={`${proxyUrl}&download=1`}
              className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 transition flex items-center gap-1.5 text-xs font-bold active:scale-95 shadow-md"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t.downloadCover}</span>
            </a>
            <button
              id="modal-close-btn"
              onClick={onClose}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Big image */}
        <div className="relative max-h-[80vh] overflow-hidden rounded-xl border border-neutral-800 shadow-2xl bg-neutral-950 flex items-center justify-center">
          <img
            src={displaySrc}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => {
              if (!useProxy) {
                setUseProxy(true);
              }
            }}
            className="max-h-[80vh] w-auto object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};
