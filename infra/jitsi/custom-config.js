/* Etholys Meet — config Jitsi
 * Gravação local: o host grava no browser e descarrega o ficheiro para o PC
 * (sem Jibri / nuvem ainda). Transcrição automática do áudio = fase seguinte.
 */
config.defaultLogoUrl = 'https://app.etholys.com/meet-brand/etholys-mark.svg';

config.localRecording = {
  disable: false,
  notifyAllParticipants: true,
  disableSelfRecording: false,
};

// Sem Jibri ainda — não oferecer gravação em servidor
config.fileRecordingsEnabled = false;
config.liveStreamingEnabled = false;

config.disableInviteFunctions = false;
config.enableWelcomePage = false;
config.prejoinConfig = config.prejoinConfig || {};
config.prejoinConfig.enabled = true;

config.breakoutRooms = config.breakoutRooms || {};
config.breakoutRooms.hideAddRoomButton = false;

config.toolbarButtons = [
  'microphone',
  'camera',
  'desktop',
  'chat',
  'raisehand',
  'participants-pane',
  'tileview',
  'toggle-camera',
  'hangup',
  'profile',
  'shortcuts',
  'settings',
  'select-background',
  'videoquality',
  'fullscreen',
  'etherpad',
  'sharedvideo',
  'shareaudio',
  'noisesuppression',
  'whiteboard',
  'recording',
  'closedcaptions',
  'highlight',
  'stats',
  'invite',
  'feedback',
];
