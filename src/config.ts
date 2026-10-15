// Vaste getallen: hoe groot de kaart is, hoe lang een dag duurt, enz.
export const W = 256, // kaartbreedte in tegels
  H = 256, // kaarthoogte in tegels
  CX = W / 2, // midden van de kaart: hier begint je stam
  CY = H / 2,
  CS = 16,
  CN = W / CS,
  DAYLEN = 200,
  TW = 32,
  TH = 16,
  TAU = Math.PI * 2,
  R2 = Math.SQRT2;
