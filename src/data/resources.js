export const RES={
  food:{n:'Voedsel',c:'#d9a640',age:0}, wood:{n:'Hout',c:'#9c6b3c',age:0}, stone:{n:'Steen',c:'#9a9c92',age:0},
  copper:{n:'Koper',c:'#c9723f',age:1}, tin:{n:'Tin',c:'#a9b6bd',age:1}, bronze:{n:'Brons',c:'#b9853a',age:1,cr:1},
  iron:{n:'IJzer',c:'#7d7b88',age:2}, gold:{n:'Goud',c:'#e2b92c',age:2},
  coal:{n:'Kolen',c:'#4d5058',age:3}, steel:{n:'Staal',c:'#7f9ab0',age:3,cr:1},
  oil:{n:'Olie',c:'#5b4a68',age:4}, sand:{n:'Zand',c:'#d8c184',age:4}, fuel:{n:'Brandstof',c:'#d0612f',age:4,cr:1}, silicon:{n:'Silicium',c:'#6f84b8',age:4,cr:1},
  lithium:{n:'Lithium',c:'#7fcdb5',age:5}, chips:{n:'Chips',c:'#2fae80',age:5,cr:1}, battery:{n:'Accu\'s',c:'#77bf40',age:5,cr:1},
};
export const RKEYS=Object.keys(RES);
export const GATHER=['food','wood','stone','copper','tin','iron','gold','coal','sand','lithium'];
export const HARD={food:1,wood:.9,stone:.75,copper:.7,tin:.7,iron:.65,gold:.6,coal:.7,sand:1,lithium:.65};
export const BASEW={food:1.5,wood:1.3,stone:1,copper:.9,tin:.9,iron:.95,gold:.6,coal:.95,sand:.8,lithium:.8};
