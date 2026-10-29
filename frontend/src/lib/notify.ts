// Tiny event-based notifier so any page can surface a message without a provider.
// <Toaster /> (mounted in Layout) listens for these events.
export type NoticeKind = 'error' | 'success' | 'info';

export interface Notice {
  id: number;
  kind: NoticeKind;
  text: string;
}

const EVENT_NAME = 'bitaran:notify';
let nextId = 1;

export function notify(kind: NoticeKind, text: string): void {
  window.dispatchEvent(
    new CustomEvent<Notice>(EVENT_NAME, { detail: { id: nextId++, kind, text } }),
  );
}

export const notifyError = (text: string): void => notify('error', text);

export function subscribeToNotices(handler: (notice: Notice) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<Notice>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
