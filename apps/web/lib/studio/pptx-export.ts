/**
 * Export PPTX outline (JSZip + OOXML mínimo) — camada Conteúdo / slides.
 */
import type { StudioBlock, StudioBlockLayout, StudioCanvasState } from '@/lib/studio/types';
import type { StudioBrandKit } from '@/lib/studio/export';
import { DEFAULT_STUDIO_BRAND } from '@/lib/studio/export';

export type StudioPptxSlide = {
  title: string;
  bullets: string[];
  notes: string;
  backgroundColor?: string;
  layoutTexts: Array<{
    lines: string[];
    layout?: StudioBlockLayout;
    bold?: boolean;
    fontSize?: number;
  }>;
  images: Array<{
    buffer: Buffer;
    ext: 'png' | 'jpeg';
    layout?: StudioBlockLayout;
    alt?: string;
  }>;
};

function decodeDataUrlImage(url: string): { buffer: Buffer; ext: 'png' | 'jpeg' } | null {
  const m = url.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  try {
    const ext = m[1]!.toLowerCase() === 'png' ? 'png' : 'jpeg';
    return { buffer: Buffer.from(m[2]!, 'base64'), ext };
  } catch {
    return null;
  }
}

async function resolveSlideImage(
  url: string,
): Promise<{ buffer: Buffer; ext: 'png' | 'jpeg' } | null> {
  const dataUrl = decodeDataUrlImage(url);
  if (dataUrl) return dataUrl;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('png') || /\.png(\?|$)/i.test(url)) return { buffer: buf, ext: 'png' };
    if (ct.includes('jpeg') || ct.includes('jpg') || /\.jpe?g(\?|$)/i.test(url)) {
      return { buffer: buf, ext: 'jpeg' };
    }
    return null;
  } catch {
    return null;
  }
}

const SLIDE_CX = 9144000;
const SLIDE_CY = 5143500;

function pctToEmu(pct: number, total: number): number {
  return Math.round((pct / 100) * total);
}

function pictureXml(rId: number, layout: StudioBlockLayout | undefined, picId: number): string {
  const x = pctToEmu(layout?.xPct ?? 8, SLIDE_CX);
  const y = pctToEmu(layout?.yPct ?? 35, SLIDE_CY);
  const cx = pctToEmu(layout?.wPct ?? 84, SLIDE_CX);
  const cy = pctToEmu(layout?.hPct ?? 42, SLIDE_CY);
  return `<p:pic>
    <p:nvPicPr>
      <p:cNvPr id="${picId}" name="Picture ${picId}"/>
      <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
      <p:nvPr/>
    </p:nvPicPr>
    <p:blipFill><a:blip r:embed="rId${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
    <p:spPr>
      <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    </p:spPr>
  </p:pic>`;
}

function slideXml(
  title: string,
  bullets: string[],
  pictures: string,
  layoutTexts: string,
  backgroundColor?: string,
): string {
  const bgHex = (backgroundColor || '').replace('#', '').toUpperCase();
  const bgXml =
    bgHex.length === 6
      ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bgHex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`
      : '';
  const useLayout = layoutTexts.trim().length > 0;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld>${bgXml}<p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    ${useLayout ? layoutTexts : `${textBodyXml([title], 'title')}${textBodyXml(bullets.length ? bullets.map((b) => `• ${b}`) : [' '], 'body')}`}
    ${pictures}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function stripMd(s: string): string {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3}\s+/, '')
    .trim();
}

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Extrai outline slide-a-slide a partir do canvas. */
export function extractStudioPptxSlides(canvas: StudioCanvasState): StudioPptxSlide[] {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  return pages.map((page) => {
    const blocks = page.blocks.slice().sort((a, b) => a.order - b.order);
    let title = page.title;
    const bullets: string[] = [];
    const noteParts: string[] = [];

    for (const block of blocks) {
      const text = stripMd(block.text || '');
      if (!text && block.kind !== 'image') continue;

      if (block.kind === 'heading' && (title === page.title || !title.trim())) {
        title = text || title;
        continue;
      }
      if (block.kind === 'bullets') {
        for (const line of (block.text || '').split(/\r?\n/)) {
          const item = stripMd(line.replace(/^[-*•]\s*/, ''));
          if (item) bullets.push(item);
        }
        continue;
      }
      if (block.kind === 'callout' || block.kind === 'paragraph') {
        if (text) bullets.push(text);
        continue;
      }
      if (block.mediaMeta?.type === 'video-scene' && block.mediaMeta.narration) {
        noteParts.push(`[Plano] ${block.mediaMeta.narration}`);
        if (block.mediaMeta.durationSec) {
          noteParts.push(`Duração: ${block.mediaMeta.durationSec}s`);
        }
        continue;
      }
      if (block.kind === 'table') {
        noteParts.push('[Tabela]\n' + (block.text || '').slice(0, 500));
        continue;
      }
      if (text) noteParts.push(text);
    }

    if (!bullets.length && blocks.length) {
      const first = blocks.find((b) => stripMd(b.text || ''));
      if (first) bullets.push(stripMd(first.text || ''));
    }

    return {
      title: title || `Slide ${page.order + 1}`,
      bullets,
      notes: noteParts.join('\n\n'),
      backgroundColor: page.backgroundColor,
      layoutTexts: [],
      images: [],
    };
  });
}

function blockToLayoutText(block: StudioBlock): StudioPptxSlide['layoutTexts'][0] | null {
  if (!block.layout || (block.layout.xPct == null && block.layout.yPct == null)) return null;
  if (block.kind === 'image') return null;
  if (block.kind === 'bullets') {
    const lines = (block.text || '')
      .split(/\r?\n/)
      .map((l) => stripMd(l.replace(/^[-*•]\s*/, '')))
      .filter(Boolean)
      .map((l) => `• ${l}`);
    if (!lines.length) return null;
    return { lines, layout: block.layout, bold: false, fontSize: 2000 };
  }
  const text = stripMd(block.text || '');
  if (!text) return null;
  return {
    lines: [text],
    layout: block.layout,
    bold: block.kind === 'heading',
    fontSize: block.kind === 'heading' ? 3200 : 2000,
  };
}

/** Enriquece slides com imagens e textos posicionados (modo Design). */
export async function enrichPptxSlidesWithImages(
  canvas: StudioCanvasState,
  slides: StudioPptxSlide[],
): Promise<StudioPptxSlide[]> {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const out: StudioPptxSlide[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const page = pages[i];
    if (!page) {
      out.push(slide);
      continue;
    }
    const images: StudioPptxSlide['images'] = [];
    const layoutTexts: StudioPptxSlide['layoutTexts'] = [];
    for (const block of page.blocks) {
      if (block.kind === 'image' && block.imageUrl) {
        const resolved = await resolveSlideImage(block.imageUrl);
        if (resolved) {
          images.push({
            ...resolved,
            layout: block.layout,
            alt: block.text || block.imagePrompt,
          });
        }
        continue;
      }
      const lt = blockToLayoutText(block);
      if (lt) layoutTexts.push(lt);
    }
    out.push({
      ...slide,
      backgroundColor: page.backgroundColor || slide.backgroundColor,
      layoutTexts,
      images,
    });
  }
  return out;
}

const NS_A =
  'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P =
  'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function positionedTextXml(
  lines: string[],
  layout: StudioBlockLayout | undefined,
  spId: number,
  opts?: { bold?: boolean; fontSize?: number },
): string {
  const x = pctToEmu(layout?.xPct ?? 8, SLIDE_CX);
  const y = pctToEmu(layout?.yPct ?? 12, SLIDE_CY);
  const cx = pctToEmu(layout?.wPct ?? 84, SLIDE_CX);
  const cy = pctToEmu(layout?.hPct ?? 20, SLIDE_CY);
  const sz = opts?.fontSize ?? 2400;
  const paras = (lines.length ? lines : [' ']).map((line) => {
    const runs = escXml(line);
    const bold = opts?.bold ? '<w:b/>' : '';
    return `<a:p><a:r><a:rPr lang="pt-PT" sz="${sz}" dirty="0">${bold}</a:rPr><a:t>${runs}</a:t></a:r><a:endParaRPr lang="pt-PT" dirty="0"/></a:p>`;
  });
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${spId}" name="Text ${spId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
    <p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${paras.join('')}</p:txBody>
  </p:sp>`;
}

function textBodyXml(lines: string[], placeholderType?: 'title' | 'body'): string {
  const ph =
    placeholderType === 'title'
      ? `<p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>`
      : placeholderType === 'body'
        ? `<p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr txBox="1"/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>`
        : `<p:nvSpPr><p:cNvPr id="4" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`;

  const paras = (lines.length ? lines : [' ']).map((line) => {
    const runs = escXml(line);
    return `<a:p><a:r><a:rPr lang="pt-PT" dirty="0"/><a:t>${runs}</a:t></a:r><a:endParaRPr lang="pt-PT" dirty="0"/></a:p>`;
  });

  return `<p:sp>${ph}<p:spPr/><p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${paras.join('')}</p:txBody></p:sp>`;
}

function notesSlideXml(notes: string): string {
  const lines = notes.split(/\r?\n/).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    ${textBodyXml(lines.length ? lines : [' '])}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:notes>`;
}

const SLIDE_MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;

const SLIDE_LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="obj" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${NS_A}" name="Etholys Studio">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F2937"/></a:dk2>
      <a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>
      <a:accent1><a:srgbClr val="EA580C"/></a:accent1>
      <a:accent2><a:srgbClr val="78350F"/></a:accent2>
      <a:accent3><a:srgbClr val="64748B"/></a:accent3>
      <a:accent4><a:srgbClr val="0EA5E9"/></a:accent4>
      <a:accent5><a:srgbClr val="10B981"/></a:accent5>
      <a:accent6><a:srgbClr val="8B5CF6"/></a:accent6>
      <a:hlink><a:srgbClr val="EA580C"/></a:hlink>
      <a:folHlink><a:srgbClr val="78350F"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office"><a:majorFont/><a:minorFont/></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;

export async function studioCanvasToPptxBuffer(
  title: string,
  canvas: StudioCanvasState,
  brand: StudioBrandKit = DEFAULT_STUDIO_BRAND,
): Promise<Buffer> {
  void title;
  void brand;
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const slides = await enrichPptxSlidesWithImages(canvas, extractStudioPptxSlides(canvas));
  const slideCount = Math.max(slides.length, 1);
  let mediaIndex = 0;

  const presentationRels: string[] = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/>`,
  ];
  const sldIdLst: string[] = [];
  const contentTypesOverrides: string[] = [
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
    `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>`,
  ];

  const contentTypesDefaults = [`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>`];

  for (let i = 0; i < slideCount; i++) {
    const n = i + 1;
    const slide = slides[i] || {
      title: 'Slide 1',
      bullets: [],
      notes: '',
      layoutTexts: [],
      images: [],
    };

    const slideRels = [
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`,
    ];
    const pictureParts: string[] = [];
    let picId = 10;
    let spId = 20;
    const layoutTextParts = slide.layoutTexts.map((lt) =>
      positionedTextXml(lt.lines, lt.layout, spId++, { bold: lt.bold, fontSize: lt.fontSize }),
    );
    for (const img of slide.images) {
      mediaIndex += 1;
      const mediaName = `image${mediaIndex}.${img.ext}`;
      zip.folder('ppt')?.folder('media')?.file(mediaName, img.buffer);
      const relId = slideRels.length + 1;
      slideRels.push(
        `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`,
      );
      pictureParts.push(pictureXml(relId, img.layout, picId++));
    }

    zip.folder('ppt')?.folder('slides')?.file(
      `slide${n}.xml`,
      slideXml(
        slide.title,
        slide.bullets,
        pictureParts.join('\n'),
        layoutTextParts.join('\n'),
        slide.backgroundColor,
      ),
    );
    zip
      .folder('ppt')
      ?.folder('slides')
      ?.folder('_rels')
      ?.file(
        `slide${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRels.join('\n  ')}
</Relationships>`,
      );
    zip
      .folder('ppt')
      ?.folder('notesSlides')
      ?.file(`notesSlide${n}.xml`, notesSlideXml(slide.notes));
    zip
      .folder('ppt')
      ?.folder('notesSlides')
      ?.folder('_rels')
      ?.file(
        `notesSlide${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>
</Relationships>`,
      );

    const relId = n + 2;
    presentationRels.push(
      `<Relationship Id="rId${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`,
    );
    sldIdLst.push(`<p:sldId id="${255 + n}" r:id="rId${relId}"/>`);
    contentTypesOverrides.push(
      `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
      `<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`,
    );
  }

  zip.folder('ppt')?.file(
    'presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" saveSubsetFonts="1">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIdLst.join('')}</p:sldIdLst>
  <p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`,
  );

  zip.folder('ppt')?.folder('_rels')?.file(
    'presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presentationRels.join('\n')}
</Relationships>`,
  );

  zip.folder('ppt')?.folder('slideMasters')?.file('slideMaster1.xml', SLIDE_MASTER);
  zip
    .folder('ppt')
    ?.folder('slideMasters')
    ?.folder('_rels')
    ?.file(
      'slideMaster1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
    );

  zip.folder('ppt')?.folder('slideLayouts')?.file('slideLayout1.xml', SLIDE_LAYOUT);
  zip
    .folder('ppt')
    ?.folder('slideLayouts')
    ?.folder('_rels')
    ?.file(
      'slideLayout1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
    );

  zip.folder('ppt')?.folder('theme')?.file('theme1.xml', THEME);

  zip.folder('ppt')?.folder('notesMasters')?.file(
    'notesMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:notesStyle/>
</p:notesMaster>`,
  );
  zip
    .folder('ppt')
    ?.folder('notesMasters')
    ?.folder('_rels')
    ?.file(
      'notesMaster1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
    );

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  ${contentTypesDefaults.join('\n  ')}
  ${contentTypesOverrides.join('\n  ')}
</Types>`,
  );

  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );

  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escXml(title || 'Etholys Studio')}</dc:title>
  <dc:creator>Etholys Studio</dc:creator>
</cp:coreProperties>`,
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(buf);
}
