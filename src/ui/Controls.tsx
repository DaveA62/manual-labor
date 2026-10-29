import { useLayoutEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { serial } from './format';

export function Button({ children, className = '', tone = 'plain', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'plain' | 'primary' | 'danger' }) {
  return <button className={`control control--${tone} ${className}`} {...props}>{children}</button>;
}
export function StatusLamp({ running, children }: { running: boolean; children: ReactNode }) {
  return <span className={`status-label ${running ? 'is-running' : 'needs-input'}`}><i aria-hidden="true" />{children}</span>;
}
export function ScreenHeading({ title, code, children }: { title: string; code: string; children?: ReactNode }) {
  return <header className="screen-heading"><div><span className="equipment-label">{code}</span><h1>{title}</h1></div>{children}</header>;
}
export function Pager({ page, pages, onChange, dragPages = false }: { page: number; pages: number; onChange: (page: number) => void; dragPages?: boolean }) {
  return <nav className="pager" aria-label="Page controls">
    <Button aria-label="Previous page" disabled={page <= 0} data-storage-page={dragPages && page > 0 ? page - 1 : undefined} onClick={() => onChange(page - 1)}><Icon name="left" size={20} /></Button>
    <span className="page-label" aria-live="polite"><span className="pager-caption">PAGE </span>{serial(page + 1)} <span>/ {serial(pages)}</span></span>
    <Button aria-label="Next page" disabled={page >= pages - 1} data-storage-page={dragPages && page < pages - 1 ? page + 1 : undefined} onClick={() => onChange(page + 1)}><Icon name="right" size={20} /></Button>
  </nav>;
}
export function DialogPanel({ open, onClose, title, code, className = '', children }: { open: boolean; onClose: () => void; title: string; code: string; className?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} className={`equipment-dialog ${className}`} aria-label={title} onClose={() => { if (open) onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <header className="dialog-heading"><div><span className="equipment-label">{code}</span><h2>{title}</h2></div><Button className="square-control" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></Button></header>
    {children}
  </dialog>;
}
