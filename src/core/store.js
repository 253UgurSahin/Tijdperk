// Gedeelde toestand die door meerdere onderdelen wordt aangepast.
// (Een geïmporteerde variabele kun je niet overschrijven, daarom staan ze samen in één object.)
export const store = {
  mapVersion: 0, // telt op als er iets op de kaart verandert (voor de minikaart)
  placing: null,
  expandMode: false,
  demolishArm: 0,
  lastGroup: null,
  cmdMode: null,
  demoMode: false,
  raidPing: null,
  periodic: 0,
  slowP: 0,
  histT: 0,
  shake: 0,
  TM: 0,
  V2: false,
  nodeSnap: null,
  nodeAge: -1,
  seasonSig: '',
  uiDirty: true,
  tab: 'home',
  curAge: -1,
  notePos: null,
  rateSnap: null,
  rateT: 0,
  resMax: 14,
  missionOpen: true,
  coachTile: null,
  coachAct: null,
  modalLocked: false, // het open venster gaat niet dicht met Esc of een klik ernaast
  profile: null, // spelersprofiel met prestaties, zoals { achievements: { age3: true } }; leeg = alleen vrije volken
};
