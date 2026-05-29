'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type NexusVoiceLocaleCode = 'pt' | 'es' | 'en';

/** Contrato mínimo para Web SpeechRecognition (tipos nativos nem sempre no projeto). */
type WebSpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

function synthLang(lc: NexusVoiceLocaleCode): string {
  if (lc === 'es') return 'es-ES';
  if (lc === 'en') return 'en-US';
  return 'pt-BR';
}

/** @returns ctor or null outside browser */
function getRecognitionCtor(): (new () => WebSpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    webkitSpeechRecognition?: new () => WebSpeechRecognitionLike;
    SpeechRecognition?: new () => WebSpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceDialogSupported(): boolean {
  return typeof window !== 'undefined' && !!getRecognitionCtor() && 'speechSynthesis' in window;
}

export function useNexusVoiceDialog(
  locale: NexusVoiceLocaleCode,
  opts: {
    onCommittedText: (text: string) => void;
    onInterim?: (text: string) => void;
  },
) {
  const { onCommittedText, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(() => (typeof window !== 'undefined' ? voiceDialogSupported() : false));
  const finalPartsRef = useRef<string[]>([]);
  const recRef = useRef<WebSpeechRecognitionLike | null>(null);

  const stopRecognition = useCallback(() => {
    const r = recRef.current;
    if (r) {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    setListening(false);
    finalPartsRef.current = [];
    onInterim?.('');
  }, [onInterim]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const toggleListen = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    if (listening) {
      const r = recRef.current;
      if (r) {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    finalPartsRef.current = [];
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = synthLang(locale);

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          const t = piece.trim();
          if (t) finalPartsRef.current.push(t);
        } else {
          interim += piece;
        }
      }
      const done = finalPartsRef.current.join(' ').trim();
      onInterim?.(done && interim ? `${done} ${interim}` : done || interim);
    };

    rec.onerror = () => {
      stopRecognition();
    };

    rec.onend = () => {
      const said = finalPartsRef.current.join(' ').trim();
      finalPartsRef.current = [];
      setListening(false);
      onInterim?.('');
      recRef.current = null;
      if (said) onCommittedText(said);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      onInterim?.('');
    } catch {
      setListening(false);
    }
  }, [listening, locale, onCommittedText, onInterim, stopRecognition]);

  const speakAssistant = useCallback(
    (text: string) => {
      if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = synthLang(locale);
      u.rate = 0.96;
      window.speechSynthesis.speak(u);
    },
    [locale],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    speechSupported,
    listening,
    toggleListen,
    /** Aborta escuta sem entregar texto (uso interno ao sair da página). */
    abortListening: stopRecognition,
    speakAssistant,
    stopSpeaking,
  };
}
