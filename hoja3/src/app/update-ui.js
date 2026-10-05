/**
 * update-ui.js — Progress and "restart to update" UI for app (service worker) updates.
 *
 * First visit: a small card shows "Saving for offline use… 42%" and then "Ready to work offline".
 * New version: "Downloading update…" with a progress bar, then "Update ready — Restart".
 * Updates never apply on their own while you're configuring a controller.
 */
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { button, progressBar } from '../ui/controls.js';
import { pwa } from './pwa.js';
import { session } from '../device/session.js';
import { t, plural, fmt } from '../i18n/index.js';

let card = null;

function ensureCard() {
  if (card) return card;
  const title = h('strong');
  const bar = progressBar();
  const actions = h('div.row', { style: { '--gap': '8px', justifyContent: 'flex-end' } });
  const el = h('div.update-card', { role: 'status', 'aria-live': 'polite' },
    h('div.row.nowrap', { style: { '--gap': '10px' } }, h('span.update-ico', icon('download')), title), bar, actions);
  document.body.append(el);
  card = { el, title, bar, actions };
  return card;
}

function close() {
  if (!card) return;
  card.el.classList.add('leaving');
  const el = card.el;
  card = null;
  setTimeout(() => el.remove(), 250);
}

export function initUpdateUi() {
  pwa.on('update', (e) => {
    if (e.state === 'downloading') {
      const c = ensureCard();
      c.title.textContent = e.first ? t('Saving for offline use…') : t('Downloading app update…');
      c.bar.set(e.total ? (e.done / e.total) * 100 : 0, plural(e.total, '{done} / {n} file', '{done} / {n} files', { done: fmt.number(e.done), n: fmt.number(e.total) }));
      c.bar.busy(true);
      c.actions.replaceChildren();
      if (e.first && e.done >= e.total) setTimeout(close, 900);
    } else if (e.state === 'ready') {
      const c = ensureCard();
      c.title.textContent = t('Update ready');
      c.bar.set(100, session.dirty.size ? t('Save your controller changes first, then restart.') : t('Restart to use the new version.'));
      c.bar.busy(false);
      c.actions.replaceChildren(
        button({ label: t('Later'), variant: 'ghost', size: 'sm', onClick: close }),
        button({ label: t('Restart'), icon: 'refresh', variant: 'primary', size: 'sm', onClick: () => pwa.applyUpdate() }));
    }
  });

  document.head.append(h('style', `
    .update-card {
      position: fixed; z-index: 1900; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));
      width: min(340px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 10px;
      padding: 14px 16px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow-3); animation: rise-in var(--dur-slow) var(--ease-out);
    }
    .update-card.leaving { opacity: 0; transform: translateY(8px); transition: opacity var(--dur-med), transform var(--dur-med); }
    .update-card .update-ico { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--blue-soft); color: var(--blue); }
  `));
}
