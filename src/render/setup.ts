import * as THREE from 'three';

// The game's colours and lights were tuned on three.js r149 defaults. Newer versions convert sRGB
// colours to linear light and use physically based light units; these settings keep the original look:
// colours are used exactly as written, and the light intensities below are on the old scale.
THREE.ColorManagement.enabled = false;

/** Factor between the old ("legacy") light intensity scale and physically based units. */
export const LIGHT = Math.PI;
