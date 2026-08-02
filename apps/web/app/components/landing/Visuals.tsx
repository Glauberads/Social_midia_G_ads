import type { SVGProps } from 'react';

export type IconName =
  | 'archive' | 'arrow-left' | 'arrow-right' | 'brief' | 'calendar' | 'check'
  | 'chevron-down' | 'clock' | 'close' | 'content' | 'dashboard' | 'edit'
  | 'external' | 'eye' | 'file' | 'gear' | 'instagram' | 'layout' | 'logout'
  | 'mail' | 'menu' | 'more' | 'plus' | 'search' | 'send' | 'sparkles'
  | 'team' | 'trash' | 'user' | 'workspace';

const paths: Record<IconName, React.ReactNode> = {
  archive: <><path d="M4 7h16"/><path d="M6 7v12h12V7"/><path d="M9 11h6"/><path d="M5 3h14l1 4H4l1-4Z"/></>,
  'arrow-left': <><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></>,
  'arrow-right': <><path d="m9 18 6-6-6-6"/><path d="M5 12h10"/></>,
  brief: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  'chevron-down': <path d="m7 10 5 5 5-5"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  content: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  edit: <><path d="M13 6 18 11"/><path d="m4 20 4.5-1 10-10a2 2 0 0 0-5-5l-10 10L3 21l6.5-1Z"/></>,
  external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>,
  logout: <><path d="M10 5H5v14h5"/><path d="m14 8 4 4-4 4M9 12h9"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z"/><path d="m5 14 .6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6Z"/></>,
  team: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  workspace: <><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

const landingStatusLabels: Record<string, string> = { DRAFT: 'Rascunho', READY: 'Pronto', APPROVED: 'Aprovado', REJECTED: 'Rejeitado', ARCHIVED: 'Arquivado' };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{landingStatusLabels[status] || status}</span>;
}
