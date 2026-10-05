/**
 * Haptics settings (hapticConfig_s). Reference example of a settings.js file.
 * Pure data + pure functions only — imported by Node for the MCP server.
 */
import { clampInt } from '../../settings/schema.js';

export default [
  {
    key: 'haptics.intensity',
    label: 'Intensity',
    description: 'How strong rumble feels, from off to full power.',
    block: 'haptic',
    type: 'number', min: 0, max: 100, step: 1, unit: '%',
    requires: 'haptics',
    // Stored as 0–255 on the controller, shown as a percentage.
    get: (s) => Math.round((s.config.haptic.haptic_strength / 255) * 100),
    set: (s, v) => { s.config.haptic.haptic_strength = clampInt((v / 100) * 255, 0, 255); },
  },
  {
    key: 'haptics.triggerFeedback',
    label: 'Trigger haptics',
    description: 'Pulse when an analog trigger passes its activation threshold or rapid-trigger delta (set in Input).',
    block: 'haptic',
    type: 'boolean',
    requires: 'hapticHD',
    get: (s) => !!s.config.haptic.haptic_triggers,
    set: (s, v) => { s.config.haptic.haptic_triggers = v ? 1 : 0; },
  },
];
