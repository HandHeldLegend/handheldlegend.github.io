/**
 * overlay.js — Toasts, dialogs, confirmations and the global tooltip handler.
 *
 *   toast('Saved to controller', { tone: 'green' });
 *   const ok = await confirmDialog({ title: 'Reset mappings?', message: '...', danger: true });
 *   const dlg = openDialog({ title, icon, body, actions: [{ label: 'Close', value: false }] });
 *   const result = await dlg.result;
 */
import { h, append } from './dom.js';
import { icon } from './icons.js';
import { button } from './controls.js';
import { t } from '../i18n/index.js';

// ---------------------------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------------------------

let toastHost = null;

/**
 * @param {string} message
 * @param {{tone?: string, icon?: string, timeout?: number, action?: {label:string, onClick:Function}}} [o]
 */
export function toast(message, o = {}) {
  if (!toastHost) {
    toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const tone = o.tone || 'lavender';
  const ico = o.icon || { green: 'check', red: 'warning', yellow: 'warning', blue: 'info', lavender: 'sparkle' }[tone];
  const el = h('div.toast', { class: `tone-${tone}` },
    icon(ico),
    h('span.toast-msg', message),
    o.action && button({ label: o.action.label, size: 'sm', variant: 'tonal', onClick: () => { o.action.onClick(); dismiss(); } }));
  const dismiss = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', (e) => { if (!e.target.closest('button')) dismiss(); });
  toastHost.append(el);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  if (o.timeout !== 0) setTimeout(dismiss, o.timeout ?? 3600);
  return { dismiss };
}

// ---------------------------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------------------------

/**
 * Open a modal dialog built on <dialog>.
 * @param {{title: string, icon?: string, tone?: string, body?: Node|Node[]|string,
 *          actions?: Array<{label:string, variant?:string, value?:any, icon?:string, onClick?:(dlg)=>any, disabled?:boolean}>,
 *          dismissible?: boolean, wide?: boolean, onClose?: Function}} o
 * @returns {{el: HTMLDialogElement, body: HTMLElement, close: (value?:any)=>void, result: Promise<any>,
 *            setTitle: Function, setActions: Function}}
 */
export function openDialog(o) {
  const dismissible = o.dismissible !== false;
  const titleEl = h('h2', o.title);
  const art = h('span.dialog-art', o.icon ? icon(o.icon) : null);
  if (!o.icon) art.hidden = true;
  const body = h('div.dialog-body');
  const foot = h('div.dialog-foot');
  const closeBtn = dismissible ? button({ icon: 'close', variant: 'ghost', title: t('Close'), onClick: () => close(undefined) }) : null;
  const el = h('dialog.dialog', { class: o.tone ? `tone-${o.tone}` : null, style: o.wide ? { width: 'min(760px, calc(100vw - 24px))' } : null },
    h('div.dialog-head', art, titleEl, closeBtn), body, foot);

  let resolve;
  const result = new Promise((r) => { resolve = r; });
  let closed = false;

  function close(value) {
    if (closed) return;
    closed = true;
    resolve(value);
    o.onClose?.(value);
    el.close();
    setTimeout(() => el.remove(), 50);
  }

  el.addEventListener('cancel', (e) => { e.preventDefault(); if (dismissible) close(undefined); });
  el.addEventListener('click', (e) => { if (dismissible && e.target === el) close(undefined); }); // backdrop

  const api = {
    el, body, close, result,
    setTitle: (t) => { titleEl.textContent = t; },
    setIcon: (name, tone) => {
      art.hidden = !name; art.replaceChildren(name ? icon(name) : '');
      if (tone) { el.className = `dialog tone-${tone}`; }
    },
    setBody: (...nodes) => { body.replaceChildren(); append(body, nodes); },
    setActions: (actions) => {
      foot.replaceChildren();
      foot.hidden = !actions?.length;
      for (const a of actions || []) {
        const b = button({
          label: a.label, icon: a.icon, variant: a.variant, disabled: a.disabled,
          onClick: async () => {
            if (a.onClick) {
              const r = await a.onClick(api);
              if (r === false) return; // handler keeps dialog open
              if (a.value === undefined && r !== undefined) return close(r);
            }
            if (a.keepOpen) return;
            close(a.value);
          },
        });
        if (a.id) b.dataset.action = a.id;
        foot.append(b);
      }
    },
    action: (id) => foot.querySelector(`[data-action="${id}"]`),
  };

  if (typeof o.body === 'string') body.append(h('p', o.body));
  else if (o.body) append(body, [o.body]);
  api.setActions(o.actions || []);
  document.body.append(el);
  el.showModal();
  return api;
}

/** Yes/no confirmation. Resolves true when confirmed. */
export async function confirmDialog(o) {
  const dlg = openDialog({
    title: o.title,
    icon: o.icon || (o.danger ? 'warning' : 'help'),
    tone: o.danger ? 'red' : (o.tone || 'lavender'),
    body: typeof o.message === 'string' ? h('p.muted', o.message) : o.message,
    actions: [
      { label: o.cancelLabel || t('Cancel'), variant: 'ghost', value: false },
      { label: o.confirmLabel || t('Continue'), variant: o.danger ? 'danger' : 'primary', value: true },
    ],
  });
  return (await dlg.result) === true;
}

// ---------------------------------------------------------------------------------------------
// Tooltips: any element with [data-tip] gets a bubble on hover / focus / tap.
// ---------------------------------------------------------------------------------------------

let bubble = null;
let owner = null;

function showTip(target) {
  const text = target.getAttribute('data-tip');
  if (!text) return;
  hideTip();
  owner = target;
  owner.setAttribute('aria-expanded', 'true');
  bubble = h('div.tip-bubble', { role: 'tooltip' }, text);
  document.body.append(bubble);
  const r = target.getBoundingClientRect();
  const b = bubble.getBoundingClientRect();
  let left = r.left + r.width / 2 - b.width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - b.width - 12));
  let top = r.top - b.height - 8;
  if (top < 8) top = r.bottom + 8;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
}

function hideTip() {
  bubble?.remove();
  bubble = null;
  owner?.setAttribute('aria-expanded', 'false');
  owner = null;
}

export function installTooltips(root = document) {
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest?.('[data-tip]');
    if (t && t !== owner) showTip(t);
  });
  root.addEventListener('pointerout', (e) => {
    if (owner && !owner.contains(e.relatedTarget)) hideTip();
  });
  root.addEventListener('focusin', (e) => { const t = e.target.closest?.('[data-tip]'); if (t) showTip(t); });
  root.addEventListener('focusout', hideTip);
  root.addEventListener('click', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t && t.classList.contains('tip')) { e.preventDefault(); owner === t ? hideTip() : showTip(t); }
    else if (!t) hideTip();
  });
  window.addEventListener('scroll', hideTip, true);
}
