import { LEVELS, LOW_LEVELS, EXPLODE_STEP } from './program.js';

/** A hidden parent also makes a raycast target unavailable. */
export function isWorldVisible(object) {
  for (let node = object; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

export const LEVEL_MODES = Array.from({ length: LEVELS }, (_, index) => String(index + 1));

/**
 * Visibility and exploded offset of each level group, in this order:
 * floors 1..LEVELS, the low roof (over the 3-storey blocks) and the top roof.
 * Physical floor heights live in their meshes; y is only the exploded offset.
 */
export function floorLayout(mode) {
  const whole = mode === 'all' || mode === 'exploded';
  if (!whole && !LEVEL_MODES.includes(mode)) return null;
  const cut = whole ? LEVELS : Number(mode);
  const exploded = mode === 'exploded';
  return [
    ...Array.from({ length: LEVELS }, (_, index) => ({
      visible: whole || index < cut,
      y: exploded ? index * EXPLODE_STEP : 0,
    })),
    // The low roof reappears once the cut passes the top of the 3-storey blocks.
    { visible: whole || cut > LOW_LEVELS, y: exploded ? LOW_LEVELS * EXPLODE_STEP : 0 },
    { visible: whole, y: exploded ? LEVELS * EXPLODE_STEP : 0 },
  ];
}
