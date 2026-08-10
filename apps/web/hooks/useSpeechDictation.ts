'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechLocale = 'pt' | 'es' | 'en';

type WebSpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((ev: {
        resultIndex: number;
        results: {
          length: number;
          [i: number]: { isFinal: boolean; 0: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

function speechLang(lc: SpeechLocale): string {
  if (lc === 'es') return 'es-ES';
  if (lc === 'en') return 'en-US';
  return 'pt-BR';
}

function getRecognitionCtor(): (new () => WebSpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    webkitSpeechRecognition?: new () => WebSpeechRecognitionLike;
    SpeechRecognition?: new () => WebSpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechDictationSupported(): boolean {
  return typeof window !== 'undefined' && !!getRecognitionCtor();
}

/**
 * Ditado contínuo via Web Speech API (Chrome/Edge).
 * Frases finais vão para o compositor à medida que são reconhecidas.
 */
export function useSpeechDictation(
  locale: SpeechLocale,
  opts: {
    onCommittedText: (text: string) => void;
    onInterim?: (text: string) => void;
  },
) {
  const { onCommittedText, onInterim } = opts;
  const [listening, setListening] = useState(false);
  const [supported] = useState(() =>
    typeof window !== 'undefined' ? speechDictationSupported() : false,
  );
  const wantListenRef = useRef(false);
  const recRef = useRef<WebSpeechRecognitionLike | null>(null);
  const onCommittedRef = useRef(onCommittedText);
  const onInterimRef = useRef(onInterim);
  onCommittedRef.current = onCommittedText;
  onInterimRef.current = onInterim;

  const clearRec = useCallback(() => {
    const r = recRef.current;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    clearRec();
    setListening(false);
    onInterimRef.current?.('');
  }, [clearRec]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !wantListenRef.current) return;

    clearRec();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechLang(locale);

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]![0]!.transcript;
        if (ev.results[i]!.isFinal) {
          const t = piece.trim();
          if (t) onCommittedRef.current(t);
        } else {
          interim += piece;
        }
      }
      onInterimRef.current?.(interim.trim());
    };

    rec.onerror = () => {
      // network / no-speech: deixar onend decidir se reinicia
    };

    rec.onend = () => {
      recRef.current = null;
      onInterimRef.current?.('');
      if (wantListenRef.current) {
        // Chrome corta após silêncio — reinicia enquanto o utilizador quer ditado
        try {
          startRecognition();
        } catch {
          wantListenRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      wantListenRef.current = false;
      setListening(false);
    }
  }, [clearRec, locale]);

  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (!getRecognitionCtor()) return;

    if (wantListenRef.current) {
      wantListenRef.current = false;
      const r = recRef.current;
      if (r) {
        try {
          r.stop();
        } catch {
          clearRec();
          setListening(false);
        }
      } else {
        setListening(false);
      }
      onInterimRef.current?.('');
      return;
    }

    wantListenRef.current = true;
    startRecognition();
  }, [clearRec, startRecognition]);

  return {
    supported,
    listening,
    toggle,
    stop,
  };
}
