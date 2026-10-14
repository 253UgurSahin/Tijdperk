// Muisaanwijzers.
import { cv } from '../render/scene.js';

const svgCur = (body, hx, hy, fb) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'>${body}</svg>`)}") ${hx} ${hy}, ${fb || 'auto'}`;
export const CUR = {
  def: svgCur(
    "<path d='M4 3 L4 22 L9 17 L13 26 L16.5 24.5 L12.5 16 L19.5 16 Z' fill='#f1e3b8' stroke='#1b1305' stroke-width='1.7' stroke-linejoin='round'/>",
    4,
    3,
    'default',
  ),
  hand: svgCur(
    "<path d='M4 3 L4 22 L9 17 L13 26 L16.5 24.5 L12.5 16 L19.5 16 Z' fill='#e2b92c' stroke='#1b1305' stroke-width='1.7' stroke-linejoin='round'/><circle cx='22' cy='22' r='4' fill='none' stroke='#e2b92c' stroke-width='2'/>",
    4,
    3,
    'pointer',
  ),
  atk: svgCur(
    "<path d='M3 3 L7 3 L21 17 L17 21 L3 7 Z' fill='#dfe3e8' stroke='#1b1305' stroke-width='1.5' stroke-linejoin='round'/><path d='M15 23 L23 15' stroke='#7a3a22' stroke-width='3.4' stroke-linecap='round'/><path d='M20 24 L25 29' stroke='#7a3a22' stroke-width='3' stroke-linecap='round'/>",
    3,
    3,
    'crosshair',
  ),
  build: svgCur(
    "<rect x='3' y='5' width='13' height='7' rx='1.5' fill='#a3a9ae' stroke='#1b1305' stroke-width='1.5' transform='rotate(-35 9 8)'/><path d='M11 12 L23 26' stroke='#8a6a40' stroke-width='3.4' stroke-linecap='round'/>",
    4,
    5,
    'copy',
  ),
  demo: svgCur(
    "<circle cx='14' cy='14' r='10' fill='rgba(176,70,58,.35)' stroke='#e3584a' stroke-width='2.4'/><path d='M9 9 L19 19 M19 9 L9 19' stroke='#ffd9d4' stroke-width='2.6' stroke-linecap='round'/>",
    14,
    14,
    'not-allowed',
  ),
};
cv.style.cursor = CUR.def;
