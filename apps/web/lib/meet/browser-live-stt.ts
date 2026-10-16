/**
 * Transcrição ao vivo no browser (microfone local) quando o motor da sala
 * não devolve texto. Não grava vídeo e não abre o selector de ecrã.
 */

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
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function speechLang(locale: SpeechLocale): string {
  if (locale === 'es') return 'es-ES';
  if (locale === 'en') return 'en-US';
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

export function browserLiveSttSupported(): boolean {
  return getRecognitionCtor() != null;
}

export type BrowserLiveStt = { stop: () => void };

export function startBrowserLiveStt(opts: {
  locale: SpeechLocale;
  onText: (text: string, isFinal: boolean) => void;
}): BrowserLiveStt {
  const Ctor = getRecognitionCtor();
  let stopped = false;
  let rec: WebSpeechRecognitionLike | null = null;

  const clear = () => {
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* ignore */
    }
    rec = null;
  };

  const arm = () => {
    if (stopped || !Ctor) return;
    clear();
    const next = new Ctor();
    next.continuous = true;
    next.interimResults = true;
    next.lang = speechLang(opts.locale);
    next.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const piece = ev.results[i]?.[0]?.transcript || '';
        if (ev.results[i]?.isFinal) {
          const text = piece.trim();
          if (text) opts.onText(text, true);
        } else {
          interim += piece;
        }
      }
      const live = interim.trim();
      if (live) opts.onText(live, false);
    };
    next.onerror = (ev) => {
      const code = ev?.error || '';
      if (code === 'not-allowed' || code === 'audio-capture' || code === 'service-not-allowed') {
        stopped = true;
      }
    };
    next.onend = () => {
      rec = null;
      if (!stopped) window.setTimeout(arm, 250);
    };
    rec = next;
    try {
      next.start();
    } catch {
      stopped = true;
    }
  };

  arm();

  return {
    stop() {
      stopped = true;
      clear();
    },
  };
}
