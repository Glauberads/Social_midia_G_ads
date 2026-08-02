'use client';

import type { RefObject } from 'react';
import { Icon } from './Icon';

export function Header({ workspaceName, menuOpen, menuButtonRef, onMenuOpen }: { workspaceName: string; menuOpen: boolean; menuButtonRef: RefObject<HTMLButtonElement | null>; onMenuOpen: () => void }) {
  return <><div className="mobile-bar"><div className="mobile-brand"><span className="brand-mark"><Icon name="sparkles" size={17} /></span>Social Media IA</div><button ref={menuButtonRef} className="button button-secondary icon-button" onClick={onMenuOpen} aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="app-sidebar"><Icon name="menu" /></button></div><header className="app-header"><span className="header-chip"><Icon name="workspace" size={14} />{workspaceName || 'Sem workspace ativo'}</span><span className="header-chip"><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#20a271' }} />Ambiente local</span></header></>;
}
