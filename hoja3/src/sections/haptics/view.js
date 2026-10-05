/**
 * Haptics view — reference implementation of a section view.
 *
 * Contract (see docs/SECTIONS.md):
 *   export function mount(root, ctx) -> cleanup function | { destroy?(), update?(params) } | void
 *   ctx = { session, device, params, section, navigate(path), setParams(obj) }
 * The shell only mounts device sections while a controller is connected and the capability in
 * registry.js `requires` is present, so views can assume both.
 *
 * Port of hoja2/modules/haptic-md.js, plus a waveform visualizer (scope.js) that animates during the
 * feedback test and whenever a trigger click fires.
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, asyncButton } from '../../ui/controls.js';
import { settingField } from '../../settings/field.js';
import { enumValues } from '../../device/struct.js';
import { onInputReport } from '../../device/reports.js';
import { hapticScope } from './scope.js';
import { t } from '../../i18n/index.js';

loadStyles(new URL('./haptics.css', import.meta.url));

/** Mapper input codes whose press fires a trigger click (mapper.c: LT/LT_ANALOG → left, RT/RT_ANALOG → right). */
function triggerCodes() {
  const code = (name) => enumValues('mapper_input_code_t').find((e) => e.name === `INPUT_CODE_${name}`)?.value;
  return { left: [code('LT'), code('LT_ANALOG')].filter((v) => v != null), right: [code('RT'), code('RT_ANALOG')].filter((v) => v != null) };
}

export function mount(root, { session, device }) {
  const strength = () => session.config.haptic.haptic_strength / 255;
  const scope = hapticScope({ getStrength: strength, label: t('Haptic waveform: shows the test buzz and trigger clicks at your intensity') });

  // HAPTIC_CMD_TEST_STRENGTH plays a ~1 s buzz at the current strength.
  const test = asyncButton({
    label: t('Test feedback'), icon: 'play', variant: 'warning',
    busyLabel: t('Testing…'), okLabel: t('Done'), failLabel: t('Test failed'),
    run: async () => {
      await session.flush(); // make sure the latest intensity is on the controller first
      scope.startTest();
      try {
        const { status } = await session.command('haptic', 'TEST_STRENGTH', { timeout: 10000 });
        return status;
      } finally {
        scope.endTest();
      }
    },
  });

  const intensity = settingField('haptics.intensity', { tone: 'yellow', onChange: () => scope.preview() });
  // Live guide-line updates while dragging (settingField reports committed changes only).
  intensity.control.addEventListener('input', () => {
    session.config.haptic.haptic_strength = Math.round((intensity.control.value / 100) * 255);
    scope.invalidate();
  });

  const triggers = session.caps.hapticHD && settingField('haptics.triggerFeedback', { tone: 'yellow' });

  root.append(
    card({ title: t('Rumble'), subtitle: t('Changes apply instantly — press Save to keep them.'), icon: 'haptics', tone: 'yellow', actions: test },
      h('div.hp-scope', scope.el,
        h('p.hp-scope-caption', session.caps.hapticHD
          ? t('Press Test, or pull a trigger past its activation point, to see the feedback at your intensity. (Shown in slow motion.)')
          : t('Press Test to see the feedback at your intensity. (Shown in slow motion.)'))),
      intensity,
      triggers),
  );

  // Trigger clicks: watch the raw input stream for L/R crossing their activation point.
  let stopInput = () => {};
  if (session.caps.hapticHD) {
    const codes = triggerCodes();
    const held = { left: false, right: false };
    device.setInputMode(false).catch(() => {});
    stopInput = onInputReport(device, (r) => {
      if (r.kind !== 'raw') return;
      for (const side of ['left', 'right']) {
        const down = codes[side].some((c) => r.inputs[c]?.pressed);
        if (down !== held[side]) {
          held[side] = down;
          if (session.config.haptic.haptic_triggers) scope.bump(side, down ? 'press' : 'release');
        }
      }
    });
  }

  return () => { stopInput(); scope.destroy(); };
}
