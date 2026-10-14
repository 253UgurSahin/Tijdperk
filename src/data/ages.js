// De negen tijdperken en wat je nodig hebt om naar het volgende te gaan.
// `acc` is de kleur van het tijdperk: de hele interface kleurt mee.
export const AGES = [
  {
    n: 'Steentijd',
    y: '± 10.000 v.Chr.',
    r: 'I',
    title: 'Een klein begin.',
    sub: 'Maak een thuis aan de rand van de wildernis.',
    lvl: 'Kampement',
    acc: '#c08a3e',
  },
  {
    n: 'Bronstijd',
    y: '± 3000 v.Chr.',
    r: 'II',
    title: 'Brons en vuur.',
    sub: 'Koper en tin smelten samen tot iets sterkers.',
    lvl: 'Dorp',
    acc: '#d0753a',
  },
  {
    n: 'IJzertijd',
    y: '± 800 v.Chr.',
    r: 'III',
    title: 'Het zwarte metaal.',
    sub: 'Wie ijzer kan smeden, maakt betere ploegen en scherpere zwaarden.',
    lvl: 'Heuveldorp',
    acc: '#8c7a6b',
  },
  {
    n: 'Middeleeuwen',
    y: '± 1200 n.Chr.',
    r: 'IV',
    title: 'Muren van steen.',
    sub: 'Goud en ridders maken van een dorp een stad.',
    lvl: 'Burcht',
    acc: '#b0453f',
  },
  {
    n: 'Gouden Eeuw',
    y: '± 1650',
    r: 'V',
    title: 'Wind in de zeilen.',
    sub: 'Molens draaien, kruit knalt en de handel bloeit.',
    lvl: 'Handelsstad',
    acc: '#e0a823',
  },
  {
    n: 'Industriële tijd',
    y: '± 1850',
    r: 'VI',
    title: 'Rook en stoom.',
    sub: 'Kolen en staal veranderen alles, ook de nacht.',
    lvl: 'Fabrieksstad',
    acc: '#6b8299',
  },
  {
    n: 'Moderne tijd',
    y: '± 1960',
    r: 'VII',
    title: 'Olie en asfalt.',
    sub: 'Onder het zand ligt de brandstof van een nieuwe eeuw.',
    lvl: 'Metropool',
    acc: '#6f9a45',
  },
  {
    n: 'Dronetijdperk',
    y: '± 2035',
    r: 'VIII',
    title: 'De zwerm.',
    sub: "Chips, accu's en een lucht vol drones.",
    lvl: 'Megastad',
    acc: '#1ea3ab',
  },
  {
    n: 'Sterrentijdperk',
    y: '± 2100',
    r: 'IX',
    title: 'Metaal uit de hemel.',
    sub: 'Sterrenmetaal uit meteorieten opent de weg naar de sterren.',
    lvl: 'Sterrenstad',
    acc: '#9b7bff',
  },
];

// Wat de stap naar het volgende tijdperk kost (index = het nieuwe tijdperk)
export const AGE_UP = [
  null,
  { cost: { food: 250, wood: 250, stone: 120 }, pop: 8, need: ['storage', 'farm'] },
  { cost: { food: 400, wood: 400, stone: 250, bronze: 50 }, pop: 12, need: ['foundry'] },
  { cost: { food: 600, wood: 500, stone: 400, iron: 200 }, pop: 16, need: ['smithy'] },
  { cost: { food: 900, wood: 700, stone: 600, iron: 200, gold: 120 }, pop: 22, need: ['market'] },
  {
    cost: { food: 1200, wood: 600, stone: 700, gold: 150, powder: 120 },
    pop: 28,
    need: ['windmill', 'powdermill'],
  },
  {
    cost: { food: 1400, stone: 800, coal: 300, steel: 250, gold: 200 },
    pop: 34,
    need: ['blastfurnace', 'powerplant'],
  },
  { cost: { food: 2000, steel: 350, fuel: 150, silicon: 120 }, pop: 45, need: ['refinery', 'silicaworks'] },
  { cost: { food: 2600, steel: 500, chips: 150, battery: 150 }, pop: 60, need: ['command'] },
];

// Extra materiaal dat een verbetering van een gebouw kost, per tijdperk
export const AGE_MAT = [
  null,
  { bronze: 12 },
  { iron: 15 },
  { iron: 20 },
  { powder: 15 },
  { steel: 20 },
  { silicon: 15 },
  { chips: 10 },
  { starmetal: 10 },
];
