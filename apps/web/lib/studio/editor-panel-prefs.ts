const CHAT_OPEN_KEY = 'studio.chatPanelOpen';
const TOOLS_OPEN_KEY = 'studio.toolsPanelOpen';
const CASCADE_SECTION_KEY = 'studio.cascadeSection';

export type StudioCascadeSection = 'format' | 'insert' | 'page' | 'elements' | 'visual';

export function readStudioChatPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(CHAT_OPEN_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  return true;
}

export function writeStudioChatPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHAT_OPEN_KEY, open ? '1' : '0');
}

export function readStudioToolsPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(TOOLS_OPEN_KEY);
  if (v === '0') return false;
  if (v === '1') return true;
  return true;
}

export function writeStudioToolsPanelOpen(open: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOOLS_OPEN_KEY, open ? '1' : '0');
}

export function readStudioCascadeSection(): StudioCascadeSection {
  if (typeof window === 'undefined') return 'format';
  const v = localStorage.getItem(CASCADE_SECTION_KEY);
  if (
    v === 'format' ||
    v === 'insert' ||
    v === 'page' ||
    v === 'elements' ||
    v === 'visual'
  ) {
    return v;
  }
  return 'format';
}

export function writeStudioCascadeSection(section: StudioCascadeSection): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CASCADE_SECTION_KEY, section);
}
