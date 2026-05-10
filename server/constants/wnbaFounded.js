// Founding year by ESPN team ID. Keyed by the numeric string ESPN uses for team.id.
// "Founded" means the year the franchise played its first WNBA season, regardless of city changes.
// Sources: franchise histories — original city/name used even if the team relocated later.
//
// Current franchises and their lineage:
//   New York Liberty (9)       — 1997, original franchise
//   Las Vegas Aces (17)        — 1997, as Utah Starzz; relocated to San Antonio (2003), then Las Vegas (2018)
//   Phoenix Mercury (11)       — 1997, original franchise
//   Los Angeles Sparks (6)     — 1997, original franchise
//   Indiana Fever (5)          — 2000, expansion
//   Seattle Storm (14)         — 2000, expansion
//   Minnesota Lynx (8)         — 1999, expansion
//   Connecticut Sun (18)       — 1999, as Orlando Miracle; relocated to Connecticut (2003)
//   Washington Mystics (16)    — 1998, expansion
//   Chicago Sky (19)           — 2006, expansion
//   Atlanta Dream (20)         — 2008, expansion
//   Dallas Wings (3)           — 1998, as Detroit Shock; relocated to Tulsa (2010), then Dallas (2016)
//   Golden State Valkyries (129689) — 2025, expansion
//   Toronto Tempo (131935)     — 2026, expansion
//   Portland Fire (132052)     — 2026, expansion

const WNBA_FOUNDED = Object.freeze({
  '9':      1997, // New York Liberty
  '17':     1997, // Las Vegas Aces (originally Utah Starzz)
  '11':     1997, // Phoenix Mercury
  '6':      1997, // Los Angeles Sparks
  '5':      2000, // Indiana Fever
  '14':     2000, // Seattle Storm
  '8':      1999, // Minnesota Lynx
  '18':     1999, // Connecticut Sun (originally Orlando Miracle)
  '16':     1998, // Washington Mystics
  '19':     2006, // Chicago Sky
  '20':     2008, // Atlanta Dream
  '3':      1998, // Dallas Wings (originally Detroit Shock)
  '129689': 2025, // Golden State Valkyries
  '131935': 2026, // Toronto Tempo
  '132052': 2026, // Portland Fire
});

module.exports = { WNBA_FOUNDED };
