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

// Sem gravação em nuvem ainda
config.fileRecordingsEnabled = false;
config.liveStreamingEnabled = false;

config.disableInviteFunctions = false;
config.enableWelcomePage = false;
config.hideConferenceSubject = true;
config.hideConferenceTimer = false;
config.prejoinConfig = config.prejoinConfig || {};
config.prejoinConfig.enabled = true;

config.breakoutRooms = config.breakoutRooms || {};
config.breakoutRooms.hideAddRoomButton = false;

config.filmstrip = config.filmstrip || {};
config.filmstrip.disableResizable = false;
config.filmstrip.disableStageFilmstrip = false;

// Transcrição ao vivo
config.transcription = config.transcription || {};
config.transcription.enabled = true;
config.transcription.autoCaptionOnTranscribe = true;
config.transcription.useAppLanguage = true;

// Fundos virtuais Etholys (além do blur nativo fraco do browser)
config.disableVirtualBackground = false;
config.virtualBackgrounds = [
  { id: 'etholys-ocean', src: 'https://app.etholys.com/meet-brand/backgrounds/soft-ocean.svg' },
  { id: 'etholys-studio', src: 'https://app.etholys.com/meet-brand/backgrounds/warm-studio.svg' },
  { id: 'etholys-forest', src: 'https://app.etholys.com/meet-brand/backgrounds/forest-mist.svg' },
  { id: 'etholys-office', src: 'https://app.etholys.com/meet-brand/backgrounds/office-soft.svg' },
];

config.toolbarButtons = [
  'microphone',
  'camera',
  'desktop',
  'raisehand',
  'reactions',
  'chat',
  'closedcaptions',
  'participants-pane',
  'tileview',
  'hangup',
  'settings',
  'fullscreen',
  'select-background',
  'noisesuppression',
  'recording',
  'shortcuts',
  'videoquality',
  'invite',
  'whiteboard',
  'highlight',
];
