// Kleine hulpjes voor de pagina: een element opzoeken en weten hoe groot het scherm is.
export const $ = s => document.querySelector(s);

// "Compact" = telefoon of klein venster: smal óf laag (bijv. een telefoon die je liggend houdt).
// Deze regel moet gelijk zijn aan de media-query in styles/responsive.css.
export const COMPACT_QUERY = '(max-width: 900px), (max-height: 560px)';
export const isCompact = () => matchMedia(COMPACT_QUERY).matches;
// Heel smal scherm (telefoon staand)
export const isNarrow = () => innerWidth <= 620;
