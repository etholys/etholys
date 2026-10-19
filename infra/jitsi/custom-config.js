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
  disable: true,
  notifyAllParticipants: false,
  disableSelfRecording: true,
};

// ENABLE_RECORDING=1 no .env é obrigatório para a transcrição ao vivo ser convidada.
// A gravação de vídeo da chamada no browser é o botão Gravar do CHORUS (aba actual).
config.recordingService = config.recordingService || {};
config.recordingService.enabled = true;
config.recordingService.hideStorageWarning = true;
config.disabledNotifications = (config.disabledNotifications || []).concat([
  'dialog.recording',
  'dialog.transcribing',
  'recording.failedToStart',
  'recording.unavailable',
  'transcribing.failedToStart',
]);

// Jibri (gravação ficheiro) ainda não está no VPS — mas tem de ficar `true`
// para o cliente poder pedir transcrição ao vivo (convidar o transcriber/Vosk).
// Sem isto, «CC» / startRecording({transcription:true}) falha em silêncio.
config.fileRecordingsEnabled = true;
config.liveStreamingEnabled = false;

config.disableInviteFunctions = false;
config.enableWelcomePage = false;
// Browser móvel: sem página «abrir na app» (o flag novo e o legado).
config.disableDeepLinking = true;
config.deeplinking = config.deeplinking || {};
config.deeplinking.disabled = true;
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

// Ponte CHORUS: convida o transcritor da sala sem pedir gravação de ficheiro,
// e grava o vídeo/áudio desta chamada dentro da própria página.
(function () {
  if (window.__etholysRoomBridge) return;
  window.__etholysRoomBridge = true;

  function allowedOrigin(origin) {
    try {
      var url = new URL(origin);
      var host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
      return url.protocol === 'https:' && (host === 'etholys.com' || host.endsWith('.etholys.com'));
    } catch (err) {
      return false;
    }
  }

  function reply(origin, payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(Object.assign({ source: 'etholys-room' }, payload), origin);
      }
    } catch (err) {
      /* ignore */
    }
  }

  function conferenceRoom() {
    try {
      return APP && APP.conference && APP.conference._room;
    } catch (err) {
      return null;
    }
  }

  var audioCtx = null;
  function warmAudio() {
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtx) audioCtx = new Ctor();
      if (audioCtx.state === 'suspended') void audioCtx.resume();
    } catch (err) {
      /* ignore */
    }
  }
  document.addEventListener('pointerdown', warmAudio, true);
  document.addEventListener('keydown', warmAudio, true);

  function addStream(found, seen, stream) {
    if (!stream || !stream.getAudioTracks) return;
    stream.getAudioTracks().forEach(function (track) {
      if (!track || track.readyState !== 'live' || seen[track.id]) return;
      seen[track.id] = true;
      found.push(track);
    });
  }

  function collectAudioTracks() {
    var found = [];
    var seen = {};
    function addJitsiTrack(track) {
      if (!track) return;
      try {
        if (track.getType && track.getType() !== 'audio') return;
        if (track.isMuted && track.isMuted()) return;
      } catch (err) {
        /* ignore */
      }
      try {
        addStream(found, seen, track.stream);
      } catch (err) {
        /* ignore */
      }
      try {
        addStream(found, seen, track.getOriginalStream && track.getOriginalStream());
      } catch (err) {
        /* ignore */
      }
    }
    var room = conferenceRoom();
    if (room) {
      try {
        (room.getLocalTracks() || []).forEach(addJitsiTrack);
      } catch (err) {
        /* ignore */
      }
      try {
        (room.getParticipants() || []).forEach(function (participant) {
          (participant.getTracks() || []).forEach(addJitsiTrack);
        });
      } catch (err) {
        /* ignore */
      }
    }
    document.querySelectorAll('audio,video').forEach(function (el) {
      try {
        addStream(found, seen, el.srcObject);
      } catch (err) {
        /* ignore */
      }
    });
    return found;
  }

  var active = null;

  function liveVideos() {
    return Array.prototype.filter.call(document.querySelectorAll('video'), function (video) {
      return video.videoWidth > 16 && video.videoHeight > 16 && video.readyState >= 2;
    });
  }

  function startRecording(origin, requestId) {
    if (active) {
      reply(origin, { action: 'recording-started', requestId: requestId });
      return;
    }
    warmAudio();
    var canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvas.setAttribute('data-etholys-recorder', '1');
    canvas.style.cssText =
      'position:fixed;left:-4000px;top:0;width:1280px;height:720px;opacity:0;pointer-events:none';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var running = true;
    function draw() {
      if (!running || !ctx) return;
      var videos = liveVideos();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var count = Math.max(videos.length, 1);
      var cols = Math.ceil(Math.sqrt(count));
      var rows = Math.ceil(count / cols);
      var cellW = canvas.width / cols;
      var cellH = canvas.height / rows;
      videos.forEach(function (video, index) {
        var col = index % cols;
        var row = Math.floor(index / cols);
        try {
          ctx.drawImage(video, col * cellW, row * cellH, cellW, cellH);
        } catch (err) {
          /* ignore */
        }
      });
      requestAnimationFrame(draw);
    }
    draw();
    var tracks = [];
    try {
      tracks = canvas.captureStream(15).getVideoTracks().slice();
    } catch (err) {
      running = false;
      canvas.remove();
      reply(origin, { action: 'recording-error', requestId: requestId, message: 'canvas' });
      return;
    }
    var audioTracks = collectAudioTracks();
    if (audioTracks.length && audioCtx) {
      try {
        if (audioCtx.state === 'suspended') void audioCtx.resume();
        var dest = audioCtx.createMediaStreamDestination();
        audioTracks.forEach(function (track) {
          try {
            var src = audioCtx.createMediaStreamSource(new MediaStream([track]));
            src.connect(dest);
          } catch (err) {
            /* ignore */
          }
        });
        tracks = tracks.concat(dest.stream.getAudioTracks());
      } catch (err) {
        tracks = tracks.concat(audioTracks.slice(0, 1));
      }
    } else if (audioTracks.length) {
      tracks = tracks.concat(audioTracks.slice(0, 1));
    }
    var mime = '';
    var candidates = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
    for (var i = 0; i < candidates.length; i += 1) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) {
        mime = candidates[i];
        break;
      }
    }
    var recorder;
    try {
      recorder = new MediaRecorder(
        new MediaStream(tracks),
        mime ? { mimeType: mime, videoBitsPerSecond: 1400000 } : undefined,
      );
    } catch (err) {
      running = false;
      canvas.remove();
      reply(origin, { action: 'recording-error', requestId: requestId, message: 'recorder' });
      return;
    }
    var chunks = [];
    recorder.ondataavailable = function (event) {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    active = {
      recorder: recorder,
      chunks: chunks,
      canvas: canvas,
      stopDraw: function () {
        running = false;
      },
    };
    recorder.start(1000);
    reply(origin, { action: 'recording-started', requestId: requestId });
  }

  function stopRecording(origin, requestId) {
    var current = active;
    active = null;
    if (!current) {
      reply(origin, { action: 'recording-stopped', requestId: requestId, total: 0, mime: 'video/webm' });
      return;
    }
    current.stopDraw();
    var recorder = current.recorder;
    function finish() {
      try {
        current.canvas.remove();
      } catch (err) {
        /* ignore */
      }
      var blob = new Blob(current.chunks, { type: recorder.mimeType || 'video/webm' });
      if (!blob.size) {
        reply(origin, { action: 'recording-stopped', requestId: requestId, total: 0, mime: blob.type });
        return;
      }
      blob.arrayBuffer().then(function (buffer) {
        var size = 256 * 1024;
        var total = Math.ceil(buffer.byteLength / size);
        var index;
        for (index = 0; index < total; index += 1) {
          var slice = buffer.slice(index * size, Math.min(buffer.byteLength, (index + 1) * size));
          window.parent.postMessage(
            {
              source: 'etholys-room',
              action: 'recording-chunk',
              requestId: requestId,
              index: index,
              total: total,
              mime: blob.type,
              buffer: slice,
            },
            origin,
          );
        }
        reply(origin, {
          action: 'recording-stopped',
          requestId: requestId,
          total: total,
          mime: blob.type,
          bytes: buffer.byteLength,
        });
      }).catch(function () {
        reply(origin, { action: 'recording-error', requestId: requestId, message: 'blob' });
      });
    }
    if (recorder.state === 'recording') {
      recorder.onstop = finish;
      try {
        recorder.requestData();
      } catch (err) {
        /* ignore */
      }
      try {
        recorder.stop();
      } catch (err) {
        finish();
      }
    } else {
      finish();
    }
  }

  function startTranscription(origin) {
    var room = conferenceRoom();
    if (!room || typeof room.dial !== 'function') {
      reply(origin, { action: 'transcription', ok: false, error: 'room-not-ready' });
      return;
    }
    var status = '';
    try {
      status = String((room.getTranscriptionStatus && room.getTranscriptionStatus()) || '');
    } catch (err) {
      status = '';
    }
    if (status && status.toUpperCase() !== 'OFF') {
      reply(origin, { action: 'transcription', ok: true, already: true });
      return;
    }
    room.dial('jitsi_meet_transcribe').then(function () {
      reply(origin, { action: 'transcription', ok: true });
    }).catch(function (err) {
      var message = (err && (err.message || err.reason || String(err))) || 'dial-failed';
      var notMod = /moderator|not-allowed|forbidden|privilege/i.test(message);
      reply(origin, { action: 'transcription', ok: false, error: notMod ? 'not-moderator' : message });
    });
  }

  function stopTranscription(origin) {
    var room = conferenceRoom();
    try {
      if (room && typeof room.stopTranscriber === 'function') {
        room.stopTranscriber();
      } else if (room && room.getParticipants && room.kickParticipant) {
        (room.getParticipants() || []).forEach(function (participant) {
          var name = '';
          try {
            name = (participant.getDisplayName && participant.getDisplayName()) || '';
          } catch (err) {
            name = '';
          }
          if (/transcri/i.test(name)) {
            try {
              room.kickParticipant(participant.getId());
            } catch (err) {
              /* ignore */
            }
          }
        });
      }
    } catch (err) {
      /* ignore */
    }
    reply(origin, { action: 'transcription-stopped', ok: true });
  }

  window.addEventListener('message', function (event) {
    if (!allowedOrigin(event.origin)) return;
    var data = event.data || {};
    if (data.source !== 'etholys-chorus') return;
    if (data.action === 'ping') reply(event.origin, { action: 'pong' });
    else if (data.action === 'start-transcription') startTranscription(event.origin);
    else if (data.action === 'stop-transcription') stopTranscription(event.origin);
    else if (data.action === 'start-recording') startRecording(event.origin, data.requestId);
    else if (data.action === 'stop-recording') stopRecording(event.origin, data.requestId);
  });
})();
