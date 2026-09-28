import { useEffect } from 'react';

// Covers existing modal shells without changing their state or submission behavior.
export function DialogAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    let counter = 0;
    const enhance = () => {
      const shells = Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0')).filter(el => el.querySelector('input,button'));
      for (const shell of shells) {
        shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'true');
        const heading = shell.querySelector('h1,h2,h3');
        if (heading && !shell.hasAttribute('aria-labelledby')) {
          heading.id ||= `sopet-dialog-${++counter}`; shell.setAttribute('aria-labelledby', heading.id);
        }
      }
      const top = shells.sort((a,b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1) ?? null;
      if (top !== active) {
        if (top) { if (!active) previous = document.activeElement as HTMLElement; active = top; top.querySelector<HTMLElement>('input:not([disabled]),button:not([disabled])')?.focus(); }
        else { active = null; if (previous?.isConnected) previous.focus(); previous = null; }
      }
      document.body.style.overflow = top ? 'hidden' : '';
    };
    const keydown = (event: KeyboardEvent) => {
      if (!active) return;
      const controls = Array.from(active.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length);
      if (event.key === 'Tab' && controls.length) {
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
      if (event.key === 'Escape') {
        const close = active.querySelector<HTMLButtonElement>('button[aria-label^="Close"],button[aria-label^="Cancel"]');
        if (close && !close.disabled) { event.preventDefault(); close.click(); }
      }
    };
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true }); enhance();
    document.addEventListener('keydown', keydown);
    return () => { observer.disconnect(); document.removeEventListener('keydown', keydown); document.body.style.overflow = ''; };
  }, []);
  return null;
}
