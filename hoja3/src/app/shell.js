/**
 * shell.js — The app frame: app bar, navigation, and page mounting.
 *
 * Layout
 *   ≥ 960px : app bar + persistent sidebar + page
 *   < 960px : app bar + page; Home shows the section grid, other pages get a back button
 *
 * Page lifecycle
 *   The router reports a route → the shell finds the section in registry.js → lazy-imports its
 *   view → calls view.mount(root, ctx). Device pages are only mounted while a controller is
 *   connected and has the required capability; otherwise a friendly empty state is shown.
 *   Leaving a device page flushes pending writes and refreshes the attention badges (like hoja2).
 *
 * Language changes rebuild the frame and remount the current page in place, so the controller
 * connection and any unsaved changes survive (src/i18n/index.js).
 */
import { h, replace } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { button, emptyState, dot, face } from '../ui/controls.js';
import { toast } from '../ui/overlay.js';
import { SECTIONS, GROUPS, getSection } from '../sections/registry.js';
import { session } from '../device/session.js';
import { device } from '../device/hoja-device.js';
import { isDemo, startDemo } from '../device/mock.js';
import { onRoute, currentRoute, navigate, setParams } from './router.js';
import { prefs } from './prefs.js';
import { pwa } from './pwa.js';
import { applyFromRoute } from '../settings/apply.js';
import { t, i18n } from '../i18n/index.js';

const WIDE = matchMedia('(min-width: 960px)');

/** Is a section usable right now? Returns null when available, otherwise a (translated) reason. */
export function unavailableReason(section) {
  if (!section.device) return null;
  if (!session.connected) return t('Connect a controller to use this page.');
  if (section.requires && !session.caps[section.requires]) return t('This controller doesn’t have this hardware.');
  return null;
}

/** Shared connect flow used by the app bar, Home and empty states. */
export async function connectController() {
  if (!navigator.usb && !isDemo()) {
    toast(t('This browser can’t talk to USB devices. Use Chrome or Edge on desktop or Android.'), { tone: 'red', timeout: 6000 });
    return false;
  }
  try {
    const result = await session.connect();
    if (result === true && session.connected) toast(t('Connected to {name}', { name: session.info.name }), { tone: 'green' });
    return result;
  } catch (err) {
    console.error(err);
    toast(err?.message?.includes('Access denied')
      ? t('The controller is busy in another tab or app. Close it and try again.')
      : t('Couldn’t connect. Unplug the controller, hold A (South) while plugging it back in, then try again.'), { tone: 'red', timeout: 7000 });
    return false;
  }
}

export function createShell(root) {
  // Frame elements; (re)created by build() so a language change can redraw every label.
  let chipDot; let chipName; let chipSub; let chip;
  let saveBtn; let connectBtn; let installBtn;
  let page; let main; let frame;
  const navLinks = new Map();

  function build() {
    // ---- App bar -----------------------------------------------------------------------
    const brand = h('a.brand', { href: '#/', 'aria-label': t('HHL Gamepad Config — home') },
      h('img.brand-mark', { src: 'assets/icons/app/icon-96.png', alt: '', width: 32, height: 32 }),
      h('span.brand-text', h('strong', 'HHL'), ' Gamepad Config'));

    chipDot = dot('lavender');
    chipName = h('span.chip-name');
    chipSub = h('span.chip-sub');
    chip = h('button.device-chip', { type: 'button', onclick: () => navigate('home') }, chipDot, h('span.chip-text', chipName, chipSub));

    saveBtn = button({ label: t('Save'), icon: 'save', variant: 'tonal', title: t('Save settings to the controller'), onClick: onSave });
    saveBtn.classList.add('save-btn');
    connectBtn = button({ label: t('Connect'), icon: 'usb', variant: 'primary', onClick: onConnectClick });
    connectBtn.classList.add('connect-btn');
    installBtn = button({ label: t('Install'), icon: 'install', variant: 'ghost', title: t('Install as an app'), onClick: () => pwa.promptInstall() });
    installBtn.classList.add('install-btn');
    installBtn.hidden = !pwa.canInstall;
    const settingsBtn = button({ icon: 'settings', variant: 'ghost', title: t('App settings'), onClick: () => navigate('settings') });
    settingsBtn.classList.add('appbar-settings');

    const appbar = h('header.appbar', brand, h('div.spacer'), chip, installBtn, saveBtn, connectBtn, settingsBtn);

    // ---- Sidebar -------------------------------------------------------------------------
    const nav = h('nav.sidebar', { 'aria-label': t('Sections') });
    navLinks.clear();
    for (const g of GROUPS) {
      const items = SECTIONS.filter((s) => s.group === g.id);
      if (!items.length) continue;
      nav.append(h('div.nav-group', g.id !== 'start' && h('div.nav-group-title', t(g.title)),
        items.map((s) => {
          const a = h('a.nav-link', { href: `#/${s.id === 'home' ? '' : s.id}`, class: `tone-${s.tone}`, dataset: { section: s.id } },
            h('span.nav-icon', icon(s.icon)), h('span.nav-label', t(s.title)), h('span.nav-badge'));
          navLinks.set(s.id, a);
          return a;
        })));
    }
    nav.append(h('div.nav-foot', h('span.sfc-dots', h('i'), h('i'), h('i'), h('i')), h('span.faint.xs', 'Hand Held Legend')));

    page = h('div.page');
    main = h('main.main', { id: 'main' }, page);
    frame = h('div.app', { class: WIDE.matches ? 'wide' : null }, appbar, nav, main);
    replace(root, frame);
  }

  // ---- State → UI ------------------------------------------------------------------------
  function renderChrome() {
    const st = session.state;
    const connected = st === 'connected';
    chipDot.className = `dot tone-${connected ? 'green' : st === 'connecting' ? 'yellow' : st === 'legacy' ? 'red' : 'lavender'}${connected ? ' live' : ''}`;
    chipName.textContent = connected ? session.info.name : st === 'legacy' ? t('Legacy firmware') : t('No controller');
    chipSub.textContent = connected ? (isDemo() ? t('Demo mode') : t('Connected')) : st === 'connecting' ? t('Connecting…') : t('Not connected');
    chip.classList.toggle('demo', isDemo());

    connectBtn.setLabel(connected || st === 'legacy' ? t('Disconnect') : st === 'connecting' ? t('Connecting…') : t('Connect'));
    connectBtn.className = `btn connect-btn ${connected || st === 'legacy' ? 'btn-ghost' : 'btn-primary'}`;
    connectBtn.querySelector('use').setAttribute('href', connectBtn.querySelector('use').getAttribute('href').replace(/#i-.*/, connected ? '#i-unplug' : '#i-usb'));
    connectBtn.disabled = st === 'connecting';

    saveBtn.disabled = !connected;
    const dirty = session.dirty.size > 0;
    saveBtn.classList.toggle('dirty', dirty);
    saveBtn.querySelector('.pip')?.remove();
    if (dirty) saveBtn.append(h('span.pip.motion-ok'));
    saveBtn.title = dirty ? t('You have unsaved changes — save them to the controller') : t('Save settings to the controller');

    for (const s of SECTIONS) {
      const a = navLinks.get(s.id);
      const reason = unavailableReason(s);
      a.classList.toggle('disabled', !!reason && session.connected);
      a.classList.toggle('waiting', !!reason && !session.connected);
      a.title = reason || t(s.summary);
      const att = session.attention[s.id];
      const b = a.querySelector('.nav-badge');
      b.className = `nav-badge${att ? ` tone-${att.level === 'warn' ? 'yellow' : 'blue'} on` : ''}`;
      b.title = att ? t(att.text) : '';
    }
  }

  async function onConnectClick() {
    if (session.state === 'connected' || session.state === 'legacy') {
      if (session.dirty.size && !confirm(t('You have unsaved changes. Disconnect anyway? They will be lost when the controller powers off.'))) return;
      await session.disconnect();
      toast(t('Controller disconnected'), { tone: 'lavender' });
    } else {
      await connectController();
    }
  }

  async function onSave() {
    saveBtn.disabled = true;
    saveBtn.dataset.state = 'busy';
    const ok = await session.save().catch(() => false);
    delete saveBtn.dataset.state;
    saveBtn.disabled = !session.connected;
    toast(ok ? t('Saved to controller') : t('Save failed — check the connection and try again'), { tone: ok ? 'green' : 'red' });
    renderChrome();
  }

  // ---- Pages -----------------------------------------------------------------------------
  let mounted = null; // { section, cleanup, update, key }
  let renderToken = 0;

  function teardown() {
    if (!mounted) return;
    const { cleanup, section } = mounted;
    try { cleanup?.(); } catch (err) { console.error('[shell] cleanup failed', err); }
    mounted = null;
    if (section.device && session.connected) {
      session.flush().catch(() => {});
      session.refreshAttention();
    }
  }

  function pageHeader(section) {
    const showBack = section.id !== 'home';
    return h('header.page-head', { class: `tone-${section.tone}` },
      showBack && button({ icon: 'back', variant: 'ghost', title: t('Back to home'), onClick: () => navigate('home') }),
      section.id !== 'home' && face(section.icon, section.tone, 44),
      h('div.page-titles', h('h1', t(section.title)), h('p.muted', t(section.summary))),
      h('div.page-head-extra'));
  }

  async function render(route) {
    if (route.section === 'apply') {
      await applyFromRoute(route);
      return;
    }
    const section = getSection(route.section) || getSection('home');
    const token = ++renderToken;
    const reason = unavailableReason(section);
    const key = `${section.id}|${reason || 'ok'}|${session.state}|${i18n.lang}`;

    // Same page, only params changed → let the view handle it without remounting.
    if (mounted && mounted.key === key && mounted.update) { mounted.update(route.params); return; }

    teardown();
    for (const [id, a] of navLinks) a.toggleAttribute('aria-current', id === section.id);
    frame.dataset.page = section.id;
    document.title = section.id === 'home' ? 'HHL Gamepad Config' : `${t(section.title)} · HHL Gamepad Config`;

    const content = h('div.page-body');
    replace(page, pageHeader(section), content);
    page.classList.remove('page-enter'); void page.offsetWidth; page.classList.add('page-enter');
    main.scrollTo({ top: 0 });

    if (reason) {
      content.append(session.connected
        ? emptyState({ icon: section.icon, tone: section.tone, title: t('Not available on this controller'), text: reason,
          action: button({ label: t('Back to home'), variant: 'tonal', onClick: () => navigate('home') }) })
        : emptyState({ icon: 'usb', tone: section.tone, title: t('Connect your controller'), text: t('Plug in your controller with a USB data cable, then press Connect.'),
          action: h('div.row', { style: { justifyContent: 'center' } },
            button({ label: t('Connect controller'), icon: 'usb', variant: 'primary', size: 'lg', onClick: connectController }),
            button({ label: t('Try the demo'), icon: 'play', variant: 'ghost', onClick: () => startDemo() })) }));
      mounted = { section, key, cleanup: null };
      return;
    }

    let view;
    try {
      view = await section.load();
    } catch (err) {
      console.error(`[shell] failed to load ${section.id}`, err);
      content.append(emptyState({ icon: 'warning', tone: 'red', title: t('This page failed to load'), text: String(err?.message || err),
        action: button({ label: t('Reload app'), icon: 'refresh', variant: 'tonal', onClick: () => location.reload() }) }));
      return;
    }
    if (token !== renderToken) return; // user navigated away while loading

    const ctx = {
      session, device, section, params: route.params, sub: route.sub,
      navigate, setParams,
      header: page.querySelector('.page-head-extra'),
    };
    let result;
    try {
      result = view.mount(content, ctx);
    } catch (err) {
      console.error(`[shell] ${section.id} mount failed`, err);
      content.append(emptyState({ icon: 'warning', tone: 'red', title: t('Something went wrong'), text: String(err?.message || err) }));
    }
    mounted = {
      section, key,
      cleanup: typeof result === 'function' ? result : result?.destroy?.bind(result),
      update: typeof result === 'object' && result?.update ? result.update.bind(result) : null,
    };
    if (section.id !== 'home' && section.id !== 'apply') prefs.set('lastSection', section.id);
  }

  // ---- Wiring (registered once; build() can run again) ------------------------------------
  build();

  // Remount when connection state or capabilities change (e.g. device page becomes usable).
  session.on('state', () => { renderChrome(); render(currentRoute()); });
  session.on('dirty', renderChrome);
  session.on('attention', renderChrome);
  pwa.on('installable', (can) => { installBtn.hidden = !can; });
  onRoute((route) => render(route));

  // Language changed: redraw the frame and remount the page in the new language.
  i18n.onChange(() => {
    teardown();
    build();
    renderChrome();
    render(currentRoute());
  });

  // Escape returns home from a section (like hoja2), unless a dialog is open.
  // Views can claim Escape first (e.g. to close a side panel) by calling event.preventDefault().
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]') && currentRoute().section !== 'home'
      && !e.target.closest?.('input, textarea, select')) navigate('home');
  });

  WIDE.addEventListener('change', () => frame.classList.toggle('wide', WIDE.matches));

  // Warn before closing the tab with unsaved changes.
  window.addEventListener('beforeunload', (e) => {
    if (session.dirty.size) { e.preventDefault(); e.returnValue = ''; }
  });

  renderChrome();
  render(currentRoute());
  return { renderChrome };
}
