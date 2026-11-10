/** Pure deep-link helpers for Work task notifications (safe for client + server). */

/** Panel section to open/highlight when following a Work notification. */
export type WorkTaskFocus = 'comments' | 'status' | 'people' | 'approvals';

export function normalizeWorkTaskFocus(raw?: string | null): WorkTaskFocus | null {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'comments' || v === 'updates') return 'comments';
  if (v === 'status') return 'status';
  if (v === 'people' || v === 'roles' || v === 'assignment') return 'people';
  if (v === 'approvals' || v === 'send' || v === 'review' || v === 'handoff') return 'approvals';
  return null;
}

/** Map persisted Notification.type → focus when the stored link is generic. */
export function focusFromNotificationType(type?: string | null): WorkTaskFocus | null {
  switch (String(type || '')) {
    case 'task_update':
    case 'task_mention':
      return 'comments';
    case 'task_status':
      return 'status';
    case 'task_assigned':
      return 'people';
    case 'task_review_request':
    case 'task_delivery':
    case 'task_handoff':
    case 'task_approval_decision':
      return 'approvals';
    default:
      return null;
  }
}

/** Deep-link into eTask opening a specific activity panel (+ optional section focus). */
export function workTaskLink(
  taskId?: string | null,
  folderId?: string | null,
  focus?: WorkTaskFocus | null,
) {
  const params = new URLSearchParams();
  if (taskId && folderId) {
    params.set('nav', 'folder');
    params.set('id', folderId);
    params.set('view', 'table');
  }
  if (taskId) params.set('task', taskId);
  if (focus) params.set('focus', focus);
  const qs = params.toString();
  return qs ? `/hub/work?${qs}` : '/hub/work';
}
