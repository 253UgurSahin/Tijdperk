/** `document.querySelector` for elements that are known to exist in index.html. */
export const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector(sel) as T;
export const TOUCH = matchMedia('(pointer:coarse)').matches;
const COMPACT = matchMedia('(max-width:900px), (orientation:landscape) and (max-height:520px)');
/** Compact (phone) layout: narrow screens, or phones held sideways. Keep in sync with hud.css. */
export const compact = (): boolean => COMPACT.matches;
