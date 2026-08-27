import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectStudioVideoScenes,
  formatVideoTimestamp,
  patchBlockMediaMeta,
  storyboardToScript,
  storyboardToSrt,
  totalVideoDurationSec,
} from '@/lib/studio/video-timeline';
import type { StudioVideoScene } from '@/lib/studio/video-timeline';
import { emptyStudioCanvas } from '@/lib/studio/types';

describe('video timeline', () => {
  it('collects video scenes from blocks', () => {
    const canvas = emptyStudioCanvas('presentation');
    canvas.pages = [
      {
        id: 'p1',
        title: 'Plano 1',
        order: 0,
        blocks: [
          {
            id: 'img1',
            kind: 'image',
            text: 'Hook',
            order: 0,
            mediaMeta: { type: 'video-scene', durationSec: 6, narration: 'Abertura' },
          },
        ],
      },
      {
        id: 'p2',
        title: 'Plano 2',
        order: 1,
        blocks: [
          {
            id: 'img2',
            kind: 'image',
            text: 'CTA',
            order: 0,
            mediaMeta: { type: 'video-scene', durationSec: 4 },
          },
        ],
      },
    ];
    const scenes = collectStudioVideoScenes(canvas);
    assert.equal(scenes.length, 2);
    assert.equal(totalVideoDurationSec(scenes), 10);
    assert.equal(formatVideoTimestamp(65), '1:05');
  });

  it('patches block media meta duration', () => {
    const block = {
      id: 'b',
      kind: 'image' as const,
      text: '',
      order: 0,
    };
    const next = patchBlockMediaMeta(block, { durationSec: 12, narration: 'Test' });
    assert.equal(next.mediaMeta?.durationSec, 12);
    assert.equal(next.mediaMeta?.narration, 'Test');
  });
});

const SCENES: StudioVideoScene[] = [
  {
    pageId: 'p1',
    blockId: 'b1',
    pageTitle: 'Intro',
    pageOrder: 0,
    narration: 'Olá mundo',
    durationSec: 5,
  },
  {
    pageId: 'p2',
    blockId: 'b2',
    pageTitle: 'Plano 2',
    pageOrder: 1,
    narration: 'Segundo plano',
    durationSec: 3,
  },
];

describe('video timeline export', () => {
  it('exports SRT with cues', () => {
    const srt = storyboardToSrt(SCENES);
    assert.match(srt, /^1\n/m);
    assert.match(srt, /Olá mundo/);
    assert.match(srt, /00:00:05,000 --> 00:00:08,000/);
    assert.match(srt, /Segundo plano/);
  });

  it('exports script with ranges', () => {
    const script = storyboardToScript(SCENES);
    assert.match(script, /\[0:00 – 0:05\]/);
    assert.match(script, /Olá mundo/);
  });
});
