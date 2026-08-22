/* Etholys Meet — config do servidor de vídeo
 * Visual aproximado ao Google Meet: fundo charcoal, toolbar limpa, filmstrip vertical.
 * Gravação local: o host grava no browser e descarrega o ficheiro.
 * Transcrição ao vivo: activa via motor STT no servidor (Vosk ES).
 */
config.defaultLogoUrl = 'https://app.etholys.com/meet-brand/etholys-mark.svg';
config.defaultLocalDisplayName = 'Eu';
config.defaultRemoteDisplayName = 'Participante';
config.disabledNotifications = config.disabledNotifications || [];

config.localRecording = {
  disable: false,
  notifyAllParticipants: true,
  disableSelfRecording: false,
};

// Sem Jibri / nuvem — gravação = ficheiro no computador do utilizador
config.recordingService = config.recordingService || {};
config.recordingService.enabled = false;
config.recordingService.hideStorageWarning = true;

// Jibri (gravação ficheiro) ainda não está no VPS — mas tem de ficar `true`
// para o cliente poder pedir transcrição ao vivo (convidar o transcriber/Vosk).
// Sem isto, «CC» / startRecording({transcription:true}) falha em silêncio.
config.fileRecordingsEnabled = true;
config.liveStreamingEnabled = false;

config.disableInviteFunctions = false;
config.enableWelcomePage = false;
// Permite entrar no browser móvel (sem página “use desktop / app”).
config.disableDeepLinking = true;
config.hideConferenceSubject = true;
config.hideConferenceTimer = false;
config.prejoinConfig = config.prejoinConfig || {};
config.prejoinConfig.enabled = true;

config.breakoutRooms = config.breakoutRooms || {};
config.breakoutRooms.hideAddRoomButton = false;

config.filmstrip = config.filmstrip || {};
config.filmstrip.disableResizable = false;
// Palco com vários participantes + partilha no grande vídeo
config.filmstrip.disableStageFilmstrip = false;
config.filmstrip.stageFilmstripParticipants = 6;
config.filmstrip.disableTopPanel = false;

config.tileView = config.tileView || {};
config.tileView.numberOfVisibleTiles = 25;

// Preferir a partilha no ecrã principal (estilo Google Meet)
config.autoPinLatestScreenShare = 'remote-only';

// Transcrição ao vivo (Vosk ES no contentor transcriber)
config.transcription = config.transcription || {};
config.transcription.enabled = true;
config.transcription.autoCaptionOnTranscribe = true;
config.transcription.useAppLanguage = true;
config.transcription.preferredLanguage = 'es';
config.transcription.disableStartForAll = false;

// Fundos virtuais Etholys (além do blur nativo fraco do browser)
config.disableVirtualBackground = false;
config.virtualBackgrounds = [
  { id: 'etholys-ocean', src: 'https://app.etholys.com/meet-brand/backgrounds/soft-ocean.svg' },
  { id: 'etholys-studio', src: 'https://app.etholys.com/meet-brand/backgrounds/warm-studio.svg' },
  { id: 'etholys-forest', src: 'https://app.etholys.com/meet-brand/backgrounds/forest-mist.svg' },
  { id: 'etholys-office', src: 'https://app.etholys.com/meet-brand/backgrounds/office-soft.svg' },
];

// Botão Etholys na toolbar (painel de transcrição na app) — não via configOverwrite só.
config.customToolbarButtons = [
  {
    id: 'etholys-transcript',
    text: 'Transcripción',
    // data-URI: não depende do deploy do ficheiro estático na app
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj48cmVjdCB4PSI0IiB5PSIzIiB3aWR0aD0iMTYiIGhlaWdodD0iMTgiIHJ4PSIyIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNzUiLz48cGF0aCBkPSJNOCA4aDhNOCAxMmg4TTggMTZoNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjc1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=',
  },
];

config.toolbarButtons = [
  'microphone',
  'camera',
  'desktop',
  'raisehand',
  'reactions',
  'chat',
  'closedcaptions',
  'etholys-transcript',
  'participants-pane',
  'tileview',
  'hangup',
  'settings',
  'fullscreen',
  'select-background',
  'noisesuppression',
  'shortcuts',
  'videoquality',
  'invite',
  'whiteboard',
  'highlight',
];
