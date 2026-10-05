/**
 * apply.js — Apply settings from a deep link or an assistant, always with a confirmation step.
 *
 *   #/apply?haptics.intensity=80&gamepad.defaultMode=xinput&then=haptics
 *
 * Every key must be a SettingDef key from schema.js. Values are validated with coerceValue();
 * the user sees a before → after summary and must confirm. Nothing is written without consent,
 * and changes are pushed live but only persisted when the user presses Save (or "Apply & save").
 * `then=<section>` chooses the page to open afterwards (default: home).
 * `source=assistant` only changes the dialog wording (links built by the MCP server set it).
 *
 * The same dialog is used by the in-page assistant bridge (src/agent/bridge.js → window.hhl.proposeSettings)
 * through confirmAndApply().
 */
import { h } from '../ui/dom.js';
import { button, callout } from '../ui/controls.js';
import { openDialog, toast } from '../ui/overlay.js';
import { session } from '../device/session.js';
import { getSetting, coerceValue, formatValue } from './schema.js';
import { navigate } from '../app/router.js';
import { t, plural, N_ } from '../i18n/index.js';

const RESERVED = new Set(['then', 'source']);

/** Parse params into { changes: [{def, value}], errors: [string] } (pure; no device needed). */
export function planChanges(params) {
  const changes = [];
  const errors = [];
  for (const [key, raw] of Object.entries(params)) {
    if (RESERVED.has(key)) continue;
    const def = getSetting(key);
    if (!def) { errors.push(`Unknown setting "${key}"`); continue; }
    const r = coerceValue(def, raw);
    if (r.ok) changes.push({ def, value: r.value });
    else errors.push(r.error);
  }
  return { changes, errors };
}

/**
 * Apply already-validated changes to the connected controller. Returns a report.
 * Callers must have obtained the user's consent first — use confirmAndApply() for that.
 */
export async function applyChanges(changes, { save = false } = {}) {
  const applied = [];
  const skipped = [];
  const blocks = new Set();
  for (const { def, value } of changes) {
    if (def.requires && !session.caps[def.requires]) { skipped.push({ key: def.key, reason: `controller has no ${def.requires} support` }); continue; }
    def.set(session, value);
    blocks.add(def.block);
    applied.push({ key: def.key, value });
  }
  await Promise.all([...blocks].map((b) => session.commit(b, { immediate: true })));
  let saved = false;
  if (save && applied.length) saved = await session.save();
  return { applied, skipped, saved };
}

/** Resolves when a controller is connected; `cancel()` stops waiting (avoids leaking the listener). */
function waitForConnection() {
  let off = () => {};
  const promise = new Promise((resolve) => {
    if (session.connected) return resolve(true);
    off = session.on('state', ({ state }) => {
      if (state === 'connected') { off(); resolve(true); }
    });
  });
  return { promise, cancel: () => off() };
}

const SOURCE_TEXT = {
  link: N_('A link wants to change these settings on your controller. Review them before applying.'),
  assistant: N_('An assistant suggested these changes for your controller. Review them before applying — nothing changes unless you press Apply.'),
};

/** formatValue() in the active language (schema.js stays English for Node/assistants). */
function displayValue(def, value) {
  if (def.type === 'enum') { const opt = def.options.find((o) => o.value === value); return opt ? t(opt.label) : String(value); }
  if (def.type === 'boolean') return value ? t('On') : t('Off');
  if (def.type === 'number' && def.unit) return formatValue({ ...def, unit: t(def.unit) }, value);
  return formatValue(def, value);
}

/**
 * Show the "Apply suggested settings?" dialog and, only if the user confirms, apply the changes.
 * Shared by the #/apply deep link and the assistant bridge.
 *
 * @param {Array<{def: object, value: any}>} changes  validated changes (from planChanges)
 * @param {string[]} [errors]                         entries that were rejected (shown as a warning)
 * @param {{ source?: 'link'|'assistant', save?: boolean }} [opts]
 *        source — wording of the dialog; save — make "Apply & save" the primary button (default true)
 * @returns {Promise<{ confirmed: boolean, choice: 'apply'|'save'|null, applied: Array, skipped: Array, saved: boolean, error?: string }>}
 */
export async function confirmAndApply(changes, errors = [], { source = 'link', save = true } = {}) {
  const none = { confirmed: false, choice: null, applied: [], skipped: [], saved: false };
  if (!changes.length) {
    toast(errors[0] || t('That settings link didn’t contain any changes.'), { tone: 'red', timeout: 6000 });
    return { ...none, error: errors[0] || 'No valid changes' };
  }

  const list = h('ul.change-list');
  const renderList = () => {
    list.replaceChildren(...changes.map(({ def, value }) => {
      const unsupported = session.connected && def.requires && !session.caps[def.requires];
      const before = session.connected ? displayValue(def, def.get(session)) : '—';
      return h('li', { class: unsupported ? 'unsupported' : null },
        h('span.change-label', t(def.label), h('span.faint.xs', ` ${def.key}`)),
        h('span.change-values', h('span.muted', before), ' → ', h('strong', displayValue(def, value))),
        unsupported && h('span.badge.tone-yellow', t('Not supported')));
    }));
  };
  renderList();

  const status = h('div');
  const dlg = openDialog({
    title: t('Apply suggested settings?'),
    icon: 'link', tone: 'lavender',
    body: [
      h('p.muted', t(SOURCE_TEXT[source] || SOURCE_TEXT.link)),
      list,
      errors.length > 0 && callout({ tone: 'yellow', title: t('Some entries were ignored:'), text: errors.join(' · ') }),
      status,
    ],
    actions: [],
  });

  const setActions = () => dlg.setActions(session.connected ? [
    { label: t('Cancel'), variant: 'ghost', value: false },
    { label: t('Apply'), variant: save ? 'tonal' : 'primary', value: 'apply' },
    { label: t('Apply & save'), variant: save ? 'primary' : 'tonal', icon: 'save', value: 'save' },
  ] : [
    { label: t('Cancel'), variant: 'ghost', value: false },
  ]);
  const connectHint = () => {
    status.replaceChildren(session.connected ? '' : callout({ tone: 'blue', text: t('Connect your controller to continue.') + ' ' },
      button({ label: t('Connect'), icon: 'usb', variant: 'primary', size: 'sm', onClick: async () => {
        const { connectController } = await import('../app/shell.js');
        connectController();
      } })));
  };
  setActions();
  connectHint();
  const wait = waitForConnection();
  wait.promise.then(() => { renderList(); setActions(); connectHint(); });

  const choice = await dlg.result;
  wait.cancel();
  if (!choice) return none;
  if (!session.connected) {
    toast(t('The controller disconnected — nothing was changed.'), { tone: 'red', timeout: 6000 });
    return { ...none, error: 'Controller disconnected' };
  }
  try {
    const report = await applyChanges(changes, { save: choice === 'save' });
    const n = report.applied.length;
    toast(report.saved
      ? plural(n, '{n} setting applied and saved', '{n} settings applied and saved')
      : plural(n, '{n} setting applied — press Save to keep them', '{n} settings applied — press Save to keep them'), { tone: 'green' });
    return { confirmed: true, choice, ...report };
  } catch (err) {
    console.error('[apply] failed', err);
    toast(t('Couldn’t apply the settings — check the connection and try again.'), { tone: 'red', timeout: 6000 });
    return { ...none, confirmed: true, choice, error: err?.message || String(err) };
  }
}

/** Route handler for #/apply?… (see shell.js). */
export async function applyFromRoute(route) {
  const then = route.params.then || 'home';
  const { changes, errors } = planChanges(route.params);
  navigate(then, {}, { replace: true });
  await confirmAndApply(changes, errors, { source: route.params.source === 'assistant' ? 'assistant' : 'link' });
}
