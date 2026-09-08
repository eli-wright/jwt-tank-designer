// ASME Section VIII Div. 1 - preliminary vessel sizing engine (JS port).
//
// A faithful, line-for-line port of engine.py + materials.py. The Python core is
// validated by an independent invariant oracle (10/10 over 11,526 scenarios), 22
// unit tests, and a 100k-case fuzz; this port is verified to match it numerically
// (see scratchpad verify_port.mjs). Keep the two in sync.

export const PI = Math.PI;
export const WATER_LB_IN3 = 62.4 / 1728.0;
const WATER_PSI_PER_IN = WATER_LB_IN3;

// STRICT 1/8" plate increments; selected plate always rounds UP, never below
// the ASME required minimum.
const NOMINAL_THICKNESSES = [
  0.25, 0.375, 0.5, 0.625, 0.75, 0.875,
  1.0, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0,
];

// SHOP FLOOR for PLATE components (shell and formed heads): never order plate
// below 3/8", even when the code minimum and radiography would allow 1/4" -
// the 1/4" -> 3/8" price difference is too small to justify buying extra RT
// to unlock the thinner gauge (the auto-RT selector inherits this floor, so
// an RT step-up whose only benefit is a sub-3/8" plate no longer pays).
// Standard-OD pipe shells and B16.9 caps are schedule products - NOT floored.
export const PLATE_MIN_GAUGE = 0.375;

// MINIMUM ROLLABLE / FORMABLE DIAMETER - HOUSE DEFAULT, NOT AN ASME RULE.
// ASK ELI FOR HIS SHOP'S NUMBER AND OVERRULE THIS.
//
// The app would otherwise quote vessels nobody can build: a 2.375" diameter
// came back as one 36 x 120" sheet at 3/8" with 2:1 ellipsoidal heads, and the
// pipe fallback returned a 0.500" ROLLED PLATE shell at 3.5" / 6000 psi and a
// 0.625" one at 4.5". Nobody rolls a 3.5" shell from half-inch plate, and
// nobody forms a 2.375" ellipsoidal head.
//
// WHY 12": it is a shop-capacity floor, set from two independent constraints
// that happen to land in the same place.
//   * ROLLING. A plate roll cannot produce a cylinder much smaller than its
//     top roll, and the practical minimum rolled diameter is commonly quoted
//     as roughly 1.5x the top-roll diameter. Rolls used for 3/8"+ pressure
//     plate carry top rolls in the 5-8" class, which puts the floor around
//     8-12" - and thinner-walled small shells are not rolled at all.
//   * HEAD FORMING. Formed-head suppliers quote 2:1 ellipsoidal heads down to
//     roughly the same range; below it the trade uses B16.9 caps instead,
//     which is exactly what the pipe path already does.
// Below 12" the industry answer IS pipe, and this engine now covers pipe from
// NPS 2 (2.375") up - so the refusal never strands a buildable vessel between
// 2.375" and 12"; it only refuses the plate ROUTE there.
//
// THIS NUMBER IS A DEFAULT, NOT A MEASUREMENT. It is deliberately a single
// named constant so one edit moves it.
export const PLATE_MIN_ROLL_DIAMETER = 12.0;

// BUG-6 FIX: Appendix 1-4(d) torispherical OUTSIDE-diameter form is
//   t = 0.885 P Lo / (S E + 0.8 P) with Lo = Do - t,
// so the Do-based denominator coefficient is 0.885 + 0.8 = 1.685 (was 1.67:
// max deviation 0.18%, conservative). Used by BOTH headOdThickness() and
// mawpHead() so thickness and MAWP stay mutually consistent.
export const TORI_OD_COEFF = 1.685;

// ---- MANDATORY Appendix 1-4(f) LOWER-BOUND VALIDITY LIMIT (round 15) ----
// UG-32(d) sends torispherical heads to Appendix 1-4, and 1-4(f) applies an
// ADDITIONAL mandatory rule once t/L is under 0.002: the knuckle has to be
// checked against buckling, because below that ratio the 1-4(d) membrane
// formula alone stops being the whole answer.
// NOT IMPLEMENTED, DELIBERATELY SUBSTITUTED. Seven independent reviews agreed
// the limit is real and split on the remedy, but ALL SEVEN accept t >= 0.002L
// as a lawful and conservative way to comply - that agreement is the safe
// harbour, and the note says exactly what was substituted for what.
// It bites at the large-diameter low-pressure corner the shop floor used to
// hide: a 240" F&D head was quoted at the 3/8" floor, t/L = 0.00157, against
// 0.479" needed to reach 0.002L.
export const TORI_MIN_T_OVER_L = 0.002;
// L = inside crown radius (= the inside diameter for an ASME F&D head, L = D).
export function toriMinThickness(Linside) {
  return Linside > 0 ? TORI_MIN_T_OVER_L * Linside : 0.0;
}

// Stock plate sizes (width, length) by material. Stainless (SA-240) is only
// available in smaller sizes: widths 36/48/60/72/96, lengths 120/144/240.
const STOCK_PLATES_CARBON = [[96, 240], [96, 480], [120, 240], [120, 480]];
const STOCK_PLATES_STAINLESS = [];
for (const w of [36, 48, 60, 72, 96]) for (const l of [120, 144, 240]) STOCK_PLATES_STAINLESS.push([w, l]);
const STOCK_PLATES_BY_MATERIAL = {
  carbon: STOCK_PLATES_CARBON,
  stainless304: STOCK_PLATES_STAINLESS,
  stainless: STOCK_PLATES_STAINLESS,
  stainless316: STOCK_PLATES_STAINLESS,
  stainless316L: STOCK_PLATES_STAINLESS,
};

// Blank factors size the PURCHASED plate (trim + straight flange) and drive
// plate.purchased_weight / cost - NOT the finished vessel weight.
const HEAD_BLANK_FACTOR = { ellipsoidal: 1.24, hemispherical: 1.41, torispherical: 1.20 };

// BUG-5 FIX: FORMED-component surface area of one head as a multiple of the
// flat disc (PI/4 D^2). Empty weight is a shipping/lifting number so it must
// use the finished component, not the blank. Derived from geometry:
//   hemispherical 2 PI R^2 / (PI D^2/4) = 2.0
//   2:1 ellipsoid half oblate spheroid  = 1.0840 D^2 -> 1.38018
//   ASME F&D (L=D, r=0.06D)             = ~0.9286 D^2 -> 1.18232
// The hemi BLANK factor squared (1.41^2 = 1.988) lands within 0.6% of the
// true 2.0, which is why the old blank-based weight looked right for hemi and
// overstated every other head type by 11-22%.
const HEAD_AREA_FACTOR = { ellipsoidal: 1.38018, hemispherical: 2.0, torispherical: 1.18232 };

// Head FORMING THINNING allowance: hot forming thins the blank (worst in the
// knuckle). A candidate plate nominal is acceptable for forming if EITHER
//   (A) the multiplicative rule holds:  nominal * (1 - f) >= head required min
//       (industry-typical f: 2:1 ~10%, F&D ~12% - deeper knuckle, hemi ~6%), OR
//   (B) the ABSOLUTE margin rule holds: nominal - head required min >= 1/8".
// B applies at any OD (the old ">48\" press table + 1/8\"" rule is a subset);
// for thick heads it caps the multiplicative allowance at a flat 1/8".
// Formed plate heads only - B16.9 caps are schedule products.
export const HEAD_FORMING_THINNING = { ellipsoidal: 0.10, torispherical: 0.12, hemispherical: 0.06 };
export const HEAD_FORMING_MARGIN_IN = 0.125;     // absolute forming margin, in

// Thinnest plate that can be formed into a head still meeting its
// code-required minimum after forming (satisfies rule A or rule B).
export function headFormingMinPlate(tHeadRequired, headGeom) {
  const f = HEAD_FORMING_THINNING[headGeom] ?? 0.10;
  return Math.min(tHeadRequired / (1.0 - f), tHeadRequired + HEAD_FORMING_MARGIN_IN);
}

// Python-compatible round: correctly rounds the true double value (like
// Python's round()), avoiding the FP error of an x*10^n multiply. toFixed
// operates on the stored value, so it matches Python for all non-exact-tie
// cases (true binary ties at these decimals do not occur for computed weights).
function pyround(x, ndigits = 0) {
  if (!Number.isFinite(x)) return x;
  // Python's round() is HALF-TO-EVEN; JS toFixed() is half-away-from-zero.
  // They differ ONLY on an EXACT tie, so everything else must go through
  // toFixed unchanged.
  //
  // THE TIE TEST MUST USE THE DOUBLE'S TRUE DECIMAL EXPANSION, not x*10^n.
  // Scaling manufactures ties that are not there: 596.03250000000002728 * 1000
  // rounds to exactly 596032.5, which would round-half-to-even DOWN to 596.032
  // when the true value is above the halfway point and Python gives 596.033.
  // (That false positive was caught by the JS<->Python parity sweep.)
  // Conversely 13.8125 IS exactly representable, so it is a real tie: Python
  // gives 13.812 and bare toFixed gives 13.813.
  const exact = x.toPrecision(21);
  if (exact.indexOf("e") < 0 && exact.indexOf("E") < 0) {
    const dot = exact.indexOf(".");
    if (dot >= 0) {
      const frac = exact.slice(dot + 1);
      if (frac.length > ndigits && /^50*$/.test(frac.slice(ndigits))) {
        const p = Math.pow(10, ndigits);
        const fl = Math.floor(x * p);
        return (fl % 2 === 0 ? fl : fl + 1) / p;   // half to EVEN, like Python
      }
    }
  }
  return parseFloat(x.toFixed(ndigits));
}

// %g-style formatting for joint efficiencies (0.85 -> "0.85", 1.0 -> "1").
function g(x) {
  return parseFloat(Number(x).toPrecision(6)).toString();
}
function f4(x) { return Number(x).toFixed(4); }

// --------------------------------------------------------------------------- //
// Materials
// --------------------------------------------------------------------------- //

function interp(table, x) {
  const pts = [...table].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i], [t1, v1] = pts[i + 1];
    if (t0 <= x && x <= t1) {
      const fr = (x - t0) / (t1 - t0);
      return v0 + fr * (v1 - v0);
    }
  }
  return pts[pts.length - 1][1];
}

export const MATERIALS = {
  // SA-516-70 plate. VERIFIED CELL BY CELL against a published vessel
  // calculation (20,000 flat to 500 F; 19,700 at 550; 19,400 / 18,800 /
  // 18,100 / 14,800 / 12,000 at 600-800) - and the table's own interpolation
  // reproduces the published 550 F value exactly. DO NOT "fix": the
  // elevated-temperature synthesis bug found in the carbon PIPE family does
  // NOT affect this row.
  carbon: {
    key: "carbon",
    name: "SA-516-70 (Carbon Steel)",
    density: 0.2833,
    modulus: 29.5e6,
    e_table: [[100, 29.5e6], [200, 28.8e6], [300, 28.3e6], [400, 27.7e6],
              [500, 27.3e6], [600, 26.7e6], [700, 25.5e6], [800, 24.2e6],
              [900, 22.5e6], [1000, 20.4e6]],
    s_table: [[-20, 20000], [100, 20000], [200, 20000], [300, 20000],
              [400, 20000], [500, 20000], [600, 19400], [650, 18800],
              [700, 18100], [750, 14800], [800, 12000]],
    allowableStress(T) { return interp(this.s_table, T); },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  },
  // SA-240 austenitic grades: straight (304/316) 20.0 ksi to 300 F, L grades
  // (304L/316L) 16.7 ksi. 304 verified vs COMPRESS (II-D p.104 ln.4); 304L
  // verified vs COMPRESS (II-D p.96 ln.44). Derates >300 F approximate.
  stainless304: {
    key: "stainless304",
    name: "SA-240-304 (Stainless)",
    density: 0.2890,
    modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    // BUG-16: SOURCED II-D Table 1A rows (SA-240 plate, VIII-1). The old
    // table had NO 650 or 750 anchor, so the engine INTERPOLATED at exactly
    // the two temperatures where Table 1A publishes real values - the
    // suspiciously regular deltas were interpolation artifacts, not data.
    s_table: [[-20, 20000], [100, 20000], [200, 20000], [300, 18900],
              [400, 18300], [500, 17500], [600, 16600], [650, 16200],
              [700, 15800], [750, 15500], [800, 15200]],
    allowableStress(T) { return interp(this.s_table, T); },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  },
  stainless: {
    key: "stainless",          // legacy key = 304L
    name: "SA-240-304L (Stainless)",
    density: 0.2890,
    modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    // BUG-16: SOURCED II-D Table 1A rows (SA-240 plate, VIII-1). The old
    // table had NO 650 or 750 anchor, so the engine INTERPOLATED at exactly
    // the two temperatures where Table 1A publishes real values - the
    // suspiciously regular deltas were interpolation artifacts, not data.
    s_table: [[-20, 16700], [100, 16700], [200, 16700], [300, 16700],
              [400, 15800], [500, 14700], [600, 14000], [650, 13700],
              [700, 13500], [750, 13300], [800, 13000]],
    allowableStress(T) { return interp(this.s_table, T); },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  },
  stainless316: {
    key: "stainless316",
    name: "SA-240-316 (Stainless)",
    density: 0.2890,
    modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    // BUG-16: SOURCED II-D Table 1A rows (SA-240 plate, VIII-1). The old
    // table had NO 650 or 750 anchor, so the engine INTERPOLATED at exactly
    // the two temperatures where Table 1A publishes real values - the
    // suspiciously regular deltas were interpolation artifacts, not data.
    s_table: [[-20, 20000], [100, 20000], [200, 20000], [300, 20000],
              [400, 19300], [500, 18000], [600, 17000], [650, 16600],
              [700, 16300], [750, 16100], [800, 15900]],
    allowableStress(T) { return interp(this.s_table, T); },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  },
  stainless316L: {
    key: "stainless316L",
    name: "SA-240-316L (Stainless)",
    density: 0.2890,
    modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    // BUG-16: SOURCED II-D Table 1A rows (SA-240 plate, VIII-1). The old
    // table had NO 650 or 750 anchor, so the engine INTERPOLATED at exactly
    // the two temperatures where Table 1A publishes real values - the
    // suspiciously regular deltas were interpolation artifacts, not data.
    s_table: [[-20, 16700], [100, 16700], [200, 16700], [300, 16700],
              [400, 15700], [500, 14800], [600, 14000], [650, 13700],
              [700, 13500], [750, 13200], [800, 12900]],
    allowableStress(T) { return interp(this.s_table, T); },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  },
};

// ---- Standard-OD products: welded pipe shells + B16.9 fitting closures ----
// TWO SEPARATE 0.85 FACTORS APPLY TO AN ERW PIPE SHELL, AND THEY ARE
// CUMULATIVE (each applied once, in a different place, both kept visible):
//   TERMINOLOGY: the 0.85 is the longitudinal WELD FACTOR for welded product
//   forms - NOT a casting quality factor and NOT the piping-code elevated-
//   temperature weld strength reduction factor W.
//   II-D HAS TWO KINDS OF ROWS: a dedicated "Wld. pipe" row already HAS the
//   0.85 built in and must NOT be multiplied again (the row modelled here); a
//   generic "Smls. and wld." row carries Note W14 and does NOT, so for VIII-1
//   you multiply by 0.85 when the weld has no filler metal, or apply UW-12
//   when it does. Both land on 17,000 for TP304, so that value is right
//   either way.
//   FACTOR 1 - the II-D PRODUCT weld factor, baked INTO the S line below.
//     II-D Table 1A notes G3 / G24 mark lines whose tabulated values ALREADY
//     include a 0.85 joint efficiency (G24: divide by 0.85 to recover the
//     max allowable LONGITUDINAL tensile stress); note W14 marks lines that
//     do NOT, and must be multiplied by 0.85 for VIII-1 when the weld is made
//     without filler metal (ERW). These tables model a G3/G24-style line.
//   FACTOR 2 - the UW-12(d) VESSEL joint efficiency, applied separately in
//     designVessel on CIRCUMFERENTIAL stress, per ASME VIII-1 Interpretation
//     BC88-043 (VIII-1-86-218, 1988-02-18, subject UW-12(c)): an ERW pipe
//     shell with seamless heads and un-radiographed Cat. B seams must ALSO be
//     multiplied by E = 0.85 for circumferential-stress calculations.
//     RT-driven: 1.0 once the Cat. B seams meet spot/full RT, else 0.85.
// LONGITUDINAL stress must NOT carry FACTOR 1 (G24): use longitudinalStress().
// DIGITS UNVERIFIED in-workspace: 17,100 x 0.85 = 14,535, so 14,500 or 14,600
// are both consistent. Cross-check: with FACTOR 2 applied, S = 14,600
// reproduces the COMPRESS 2026 MAP of 1523.89 psi exactly (14,500 -> 1513.46).
// Flagged, NOT applied - the digits were previously confirmed as 14,500.
export const SA53_B_ERW = {
  key: "pipe_sa53b",
  name: "SA-53 Gr. B ERW (Pipe)",
  density: 0.2833,
  modulus: 29.5e6,
    e_table: [[100, 29.5e6], [200, 28.8e6], [300, 28.3e6], [400, 27.7e6],
              [500, 27.3e6], [600, 26.7e6], [700, 25.5e6], [800, 24.2e6],
              [900, 22.5e6], [1000, 20.4e6]],
  // PUBLISHED: ASME II-D 2025 Table 1A lists SA-53 Gr. B Type E (ERW) at
  // 14,600 psi at 100 F (Type S seamless 17,100). Round-once arithmetic:
  // 60,000/3.5 = 17,142.86 x 0.85 = 14,571.4 -> 14.6 ksi. Rounding the base
  // first would give 14.5 ksi, so the published 14.6 proves ASME rounds AFTER
  // applying the weld factor. Confirmed against COMPRESS MAP = 1,523.89 psi.
  // The 600-800 F rows are NOT published values: they were built as 0.85 x the
  // already-rounded seamless line and re-rounded (the same double-rounding
  // that produced the wrong 14,500). Round-once would give 14100/13700/13200/
  // 10800/8800, so each may read up to 100 psi LOW - the conservative
  // direction - and they are left pending the published elevated row.
  // Flat through 650 F - necessary, not a guess: the seamless criteria value
  // is flat through 650 F and the ERW line is 0.85 of that same criteria
  // value. 700-800 F are SOURCED (II-D 2025 Table 1A Line 11 + a published
  // SA-53-B ERW vessel calc): round-to-NEAREST 100 of 0.85 x the seamless
  // criteria value - 15,600->13,300; 13,000->11,100; 10,800->9,200. Beyond
  // this table (UI caps at 800 F): ERW 850 F 7,400 / 900 F 5,000; seamless
  // 850 F 8,700 / 900 F 5,900, with a Note G10 graphitization caution >800 F.
  s_table: [[-20, 14600], [100, 14600], [200, 14600], [300, 14600],
            [400, 14600], [500, 14600], [600, 14600], [650, 14600],
            [700, 13300], [750, 11100], [800, 9200]],
  product_factor: 0.85,            // FACTOR 1 is inside this line (G3/G24)
  allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  longitudinalStress(T) { return interp(this.s_table, T) / this.product_factor; },
};
// SEAMLESS carbon pipe - same grade, NO product weld factor. Printed as
// SA-53 Gr. B Type S to keep both product forms inside ONE specification;
// SA-106 Gr. B computes identically (60 ksi / 3.5), so the number does not
// distinguish them. DIGITS DERIVED BY CONVENTION (same 17,100 line as the
// SA-234 WPB fittings) - not read from a II-D copy here.
export const SA53_B_SMLS = {
  key: "pipe_sa53b_smls",
  name: "SA-53 Gr. B Type S (Seamless Pipe)",
  density: 0.2833,
  modulus: 29.5e6,
    e_table: [[100, 29.5e6], [200, 28.8e6], [300, 28.3e6], [400, 27.7e6],
              [500, 27.3e6], [600, 26.7e6], [700, 25.5e6], [800, 24.2e6],
              [900, 22.5e6], [1000, 20.4e6]],
  // ELEVATED ROW CORRECTED (synthesis bug): the old 600-800 F cells were
  // manufactured by scaling the SA-516-70 curve by 17100/20000 and rounding,
  // which reproduced 16600/16100/15500/12700/10300 exactly. SA-53 / SA-106 /
  // SA-234 (60 ksi UTS, 35 ksi yield) hold FLAT much longer. Confirmed row
  // (published vessel calc + II-D 2025 lookup, identical): 17,100 through
  // 650 F, then 15,600 / 13,000 / 10,800 (8,700 at 850, 5,900 at 900).
  s_table: [[-20, 17100], [100, 17100], [200, 17100], [300, 17100],
            [400, 17100], [500, 17100], [600, 17100], [650, 17100],
            [700, 15600], [750, 13000], [800, 10800]],
  product_factor: 1.0,             // seamless: no FACTOR 1
  allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
  longitudinalStress(T) { return interp(this.s_table, T) / this.product_factor; },
};
export const SA234_WPB = {
  key: "cap_wpb",
  name: "SA-234 WPB (Pipe Cap)",
  density: 0.2833,
  modulus: 29.5e6,
    e_table: [[100, 29.5e6], [200, 28.8e6], [300, 28.3e6], [400, 27.7e6],
              [500, 27.3e6], [600, 26.7e6], [700, 25.5e6], [800, 24.2e6],
              [900, 22.5e6], [1000, 20.4e6]],
  // ELEVATED ROW CORRECTED (synthesis bug): the old 600-800 F cells were
  // manufactured by scaling the SA-516-70 curve by 17100/20000 and rounding,
  // which reproduced 16600/16100/15500/12700/10300 exactly. SA-53 / SA-106 /
  // SA-234 (60 ksi UTS, 35 ksi yield) hold FLAT much longer. Confirmed row
  // (published vessel calc + II-D 2025 lookup, identical): 17,100 through
  // 650 F, then 15,600 / 13,000 / 10,800 (8,700 at 850, 5,900 at 900).
  s_table: [[-20, 17100], [100, 17100], [200, 17100], [300, 17100],
            [400, 17100], [500, 17100], [600, 17100], [650, 17100],
            [700, 15600], [750, 13000], [800, 10800]],
  allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
};

// ---- Stainless standard-OD products: SA-312 pipe shells + SA-403 WP caps ----
// *** DERIVED BY CONVENTION - NOT VERIFIED AGAINST ASME II-D TABLE 1A. ***
// Each grade has its OWN explicit line (not a computed multiple of another
// grade). Seeded as 0.85 x the SA-240 line of the matching UNS grade, which
// is structurally right for the WELDED product form but NOT a sound way to
// relate GRADES: 304/316 are tensile/3.5-governed in the plateau while
// 304L/316L are 2/3-yield-governed, so the L lines are not a fixed multiple
// of the straight grades and the ratio varies with temperature.
// II-D NOTE G5 (dual-certified high/low strength): these take the LOW-strength
// (conservative) choice; a high-strength cert would allow more.
// II-D NOTE G12: regular 304 is restricted above 1000 F unless carbon >= 0.04%,
// and 304L is not listed above 1200 F. These tables stop at 800 F so neither
// binds - do not extend past 800 F without consulting II-D.
// SA-403 CLASS ASSUMPTION: no product factor, i.e. SEAMLESS class WP-S. If
// welded-construction fittings (WP-W / WP-WX) are supplied, 0.85 applies to
// them too and these cap lines are ~15% optimistic.
// BUG-16: 650 and 750 anchors added - Table 1A publishes real values at both,
// and without them the engine interpolated straight across them.
const _SS_TEMPS = [-20, 100, 200, 300, 400, 500, 600, 650, 700, 750, 800];
const _SA312_S = {
  "stainless304":   [17000, 17000, 17000, 16065, 15555, 14875, 14110, 13770, 13430, 13175, 12920],
  "stainless":      [14200, 14200, 14200, 14200, 13430, 12495, 11900, 11645, 11475, 11305, 11050],
  "stainless316":   [17000, 17000, 17000, 17000, 16405, 15300, 14450, 14110, 13855, 13685, 13515],
  "stainless316L":  [14200, 14200, 14200, 14200, 13345, 12580, 11900, 11645, 11475, 11220, 10965],
};
const _SA403_S = {
  "stainless304":   [20000, 20000, 20000, 18900, 18300, 17500, 16600, 16200, 15800, 15500, 15200],
  "stainless":      [16700, 16700, 16700, 16700, 15800, 14700, 14000, 13700, 13500, 13300, 13000],
  "stainless316":   [20000, 20000, 20000, 20000, 19300, 18000, 17000, 16600, 16300, 16100, 15900],
  "stainless316L":  [16700, 16700, 16700, 16700, 15700, 14800, 14000, 13700, 13500, 13200, 12900],
};
const _SS_TAGS = { stainless304: "304", stainless: "304L", stainless316: "316", stainless316L: "316L" };
export const SA312_PIPE = {};   // WELDED: FACTOR 1 inside the line
export const SA312_SMLS = {};   // SEAMLESS: no product weld factor
export const SA403_CAP = {};
for (const [_key, _tag] of Object.entries(_SS_TAGS)) {
  SA312_PIPE[_key] = {
    key: `pipe_sa312_${_tag.toLowerCase()}`,
    name: `SA-312 TP${_tag} (Welded Pipe)`,
    density: 0.2890, modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    s_table: _SS_TEMPS.map((T, i) => [T, _SA312_S[_key][i]]),
    product_factor: 0.85,
    allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },

    longitudinalStress(T) { return interp(this.s_table, T) / this.product_factor; },
  };
  SA312_SMLS[_key] = {
    key: `pipe_sa312_${_tag.toLowerCase()}_smls`,
    name: `SA-312 TP${_tag} (Seamless Pipe)`,
    density: 0.2890, modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    s_table: _SS_TEMPS.map((T, i) => [T, _SA403_S[_key][i]]),
    product_factor: 1.0,
    allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },

    longitudinalStress(T) { return interp(this.s_table, T) / this.product_factor; },
  };
  SA403_CAP[_key] = {
    key: `cap_wp${_tag.toLowerCase()}`,
    name: `SA-403 WP${_tag} (Pipe Cap)`,
    density: 0.2890, modulus: 28.3e6,
    e_table: [[100, 28.3e6], [200, 27.6e6], [300, 27.0e6], [400, 26.5e6],
              [500, 25.8e6], [600, 25.3e6], [700, 24.8e6], [800, 24.1e6]],
    s_table: _SS_TEMPS.map((T, i) => [T, _SA403_S[_key][i]]),
    allowableStress(T) { return interp(this.s_table, T); },
  modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },
    modulusAt(T) { return this.e_table ? interp(this.e_table, T) : this.modulus; },

    longitudinalStress(T) { return interp(this.s_table, T); },
  };
}

// ---- Pipe construction (28" and below): standard-OD shells + B16.9 caps ----
// Carbon: SA-53B ERW shell + SA-234 WPB caps. Stainless: SA-312 welded pipe
// shell + SA-403 WP caps (grade follows the material selection).
export const PIPE_MAX_DIAMETER = 28.0;  // inclusive: <= 28" is pipe/cap eligible; 30"+ is plate

// MILL UNDERTOLERANCE (pipe/tube and B16.9 fittings ONLY - never plate).
// Pipe is bought to a NOMINAL wall, but B36.10M / SA-530 permit the wall to
// under-run nominal by 12.5% at any point, so only 87.5% of nominal is
// structural: that reduced value is the DESIGN wall. Schedule selection
// requires 0.875*wall >= t_required, and the pressure-adequacy checks
// (MAWP/MAP, the UG-27/UG-32 re-derivation, external pressure) run on it.
// What we BUY, weigh and cost is the NOMINAL wall - we pay for nominal steel.
//
// MDMT IS A DELIBERATE SPLIT, NOT AN OVERSIGHT. On the UCS-66 path the two
// halves take DIFFERENT walls, and each choice is the conservative one:
//   * the UCS-66.1 STRESS RATIO takes the reduced (design) wall as available
//     thickness - a thinner available wall RAISES the ratio, which SHRINKS the
//     reduction and lands WARMER;
//   * the UCS-66 CURVE is read at the NOMINAL governing thickness tg - reading
//     it at 0.875*nominal would give a colder (more generous) exemption.
// So the curve is NOT looked up on the reduced wall. t_shell_design appears
// nowhere in assessment.js, so MDMT cannot pick up the thin wall by accident.
// B16.9 CAP DECISION: caps (SA-234 WPB / SA-403 WP) use the SAME 87.5% basis -
// B16.9 specifies fitting wall shall not be less than 87.5% of nominal at any
// point (fittings are ordered to matching pipe schedules), the identical
// published floor for the same reason, not a silent reuse of the pipe number.
// PLATE is ordered TO thickness and is NOT reduced.
// PIPE HOOP JOINT EFFICIENCY - UW-12(d) SEAMLESS-SECTION QUALITY FACTOR.
//
// SETTLED against a real COMPRESS calculation package. The two 0.85s on a
// welded pipe are DIFFERENT THINGS:
//   FACTOR 1 - the ERW product-form / mill-seam reduction, already inside
//     S = 14,600 (II-D Table 1A Note G24); divided back out for the
//     longitudinal allowable.
//   FACTOR 2 - THIS constant. The UW-12(d) seamless-section quality factor,
//     reached for pipe via UW-12(e), keyed to the EXAMINATION OF THE CATEGORY
//     B CAP-TO-SHELL BUTT WELDS - not the mill seam, not the product form.
// So 14,600 x 0.85 = 12,410 is one product factor times one joint factor, not
// double counting.
//
// BUG-12 (was unconservative): FACTOR 2 is the SEAMLESS-SECTION rule, so it
// applies to SEAMLESS pipe too - it does not earn 1.00 merely by lacking a
// longitudinal seam. The old SEAMLESS = 1.00 selected 259 of 1,425 seamless
// carbon-pipe cases ONE SCHEDULE TOO THIN (18.2%); worst case 22" OD / 1800
// psi / 800F / CA 0.125 came out 0.2656" short of Code.
// BUG-13 (was leaving wall on the table): a qualifying UW-11(a)(5)(-b)
// examination takes the hoop E to 1.00 for BOTH forms; 532 of 1,279 welded
// cases (41.6%) can drop a schedule with it.
//
// Depends ONLY on the cap-weld examination level - never diameter, pressure,
// product form, or cap weld TYPE. UW-11(a)(5)(-a) allows the connecting Cat.
// A/B welds to be Type 1 OR Type 2, so Type 2 is not locked out of the 1.00
// route (Eli's COMPRESS report: both cap welds Type 2, no RT, E = 0.85).
export const PIPE_HOOP_E_UNEXAMINED = 0.85;
export const PIPE_HOOP_E_EXAMINED = 1.00;

export const CAP_EXAM_LEVELS = ["none", "a5b", "spot", "full"];

export const CAP_EXAM_HOOP_E = {
  none: PIPE_HOOP_E_UNEXAMINED,
  a5b: PIPE_HOOP_E_EXAMINED,
  spot: PIPE_HOOP_E_EXAMINED,
  full: PIPE_HOOP_E_EXAMINED,
};

// ---- THE ONE GENUINELY AMBIGUOUS CELL - OPEN QUESTION FOR ELI ----
//
// Does the UW-11(a)(5)(-b) quality spot, BY ITSELF, also earn the Category B
// seam the Table UW-12 SPOT column? The sources support two readings and this
// constant picks between them. It defaults to the CONSERVATIVE one.
//
// UW-11(a)(5)(-b) calls for a spot radiograph of the Category B seam to qualify
// a seamless section for the UW-12(d) quality factor. UW-52(b)(4) then bars a
// radiograph taken to satisfy UW-11(a)(5)(-b) from also being counted as one of
// the spot radiographs of an ordinary UW-52 spot-examination programme.
//
//   * CONSERVATIVE (false, the default). The A5b shot buys the UW-12(d) quality
//     factor and nothing else. Because UW-52(b)(4) keeps it out of the spot
//     programme, the seam is not spot examined for Table UW-12 purposes and
//     keeps the no-RT column (0.70 Type 1 / 0.65 Type 2). Only the explicit
//     spot+A5b level - which pays for BOTH radiographs, per the same clause -
//     earns 0.85 / 0.80.
//   * PERMISSIVE (true). A radiograph is a radiograph: the seam HAS been spot
//     examined in fact, so Table UW-12's spot column applies, and what
//     UW-52(b)(4) actually withholds is only the RT-3 marking.
//
//
// ---- SETTLED, ROUND 14: THE CONSERVATIVE READING IS THE CODE READING ----
// Polled across eight independent systems plus a literature search; the answer
// was unanimous, so this constant stays False and is no longer an open question.
// The chain, in the Code's own order:
//   * UW-12(b) permits the column (b) efficiency only where the weld is
//     examined under UW-11(b).
//   * UW-52(b)(1) defines the spot population as each 50 ft increment "for
//     which a joint efficiency from column (b) of Table UW-12 is selected" -
//     and an A5b film is not shot pursuant to any such selection.
//   * the closing sentence of UW-11(a)(5)(-b) bars cross-crediting outright.
// Corroborating: ASME PTB-4-2013 example E7.2 takes the one-film-one-purpose
// position explicitly; the Hartford Steam Boiler technical bulletin calls the
// A5b film a "quality shot" unrelated to UW-11(b) spot RT; and real U-1A forms
// show girth seams listed as spot radiographed while still carrying 0.65, with
// the A5b shots supporting 1.00 on the shell and head.
// THE ONE COUNTER-ARGUMENT, recorded and NOT acted on: the deleted Appendix L
// samples once implied dual use. They are deleted; they do not govern.
//
// DIRECTION OF RISK: the permissive reading RAISES E, which LOWERS required
// thickness - and it is now also contrary to the settled reading above.
export const A5B_ALONE_EARNS_SPOT_EL = false;

// One Table UW-12 column, with the ambiguous a5b cell resolved by the constant
// above rather than by a hardcoded guess.
function capLongRow(noneE, spotE, fullE) {
  return { none: noneE, a5b: A5B_ALONE_EARNS_SPOT_EL ? spotE : noneE,
           spot: spotE, full: fullE };
}

// Table UW-12 LONGITUDINAL efficiency for the Cat. B cap weld (UG-27(c)(2)
// only - never the hoop equation). Type 1 is a full-penetration double-welded
// (or equivalent) butt joint; Type 2 is a single-welded butt joint with backing
// strip left in place.
export const CAP_WELD_LONG_E = {
  type1: capLongRow(0.70, 0.85, 1.00),
  type2: capLongRow(0.65, 0.80, 0.90),
};

// DIRECTION OF RISK: going 0.85 -> 1.00 REDUCES the required shell wall, so
// this must key STRICTLY on the examination level actually selected and never
// on an inherited or defaulted one. Anything not in the table reads unexamined.
export function pipeHoopEfficiency(capExam) {
  return CAP_EXAM_HOOP_E[capExam] ?? PIPE_HOOP_E_UNEXAMINED;
}

export function capWeldLongEfficiency(capWeldType, capExam) {
  const row = CAP_WELD_LONG_E[capWeldType] ?? CAP_WELD_LONG_E.type2;
  return row[capExam] ?? row.none;
}

// UW-12 effective closure efficiency on the PIPE path.
//
// ROUND 13. There is no Category A shop seam on a pipe body, so the plate
// path's radiography level (joint_eff) describes nothing here and must not
// reach any output. It used to: headEfficiency(joint_eff, ...) drove the
// closure E off an invisible control, so whatever the Cat. A buttons happened
// to be holding from a previous PLATE design silently rewrote the pipe vessel's
// head requirement - 0.9974 in against 0.8574 in at 24" / 1305 psi carbon, a
// 0.1400 in swing on a control the user cannot see or set.
//
// A SEAMLESS closure - a B16.9 cap, or a seamless formed head - takes the same
// UW-12(d) quality factor as the seamless pipe section it is welded to: 1.00
// once the Category B welds carry a UW-11(a)(5)(-b) examination, 0.85 when they
// do not. A WELDED formed head has its own Category A meridional seam, and that
// seam's efficiency is the head-seam control itself, which is visible and
// settable on this path.
export function pipeHeadEfficiency(capExam, headJointEff, jointEff) {
  if (headJointEff >= 1.0 - 1e-9) return pipeHoopEfficiency(capExam);
  return jointEff;   // welded formed head: its OWN Cat. A meridional seam
}

// Smallest bore any stocked size can serve: NPS 6 at its THINNEST stocked wall.
// Used as the ID-basis floor so both bases refuse the same requests.
export const PIPE_MIN_BORE = 2.375 - 2 * 0.109;   // 2.157" (NPS 2, Sch 10)

export const PIPE_MILL_UNDERTOLERANCE = 0.125;
export const PIPE_WALL_AVAIL = 1.0 - PIPE_MILL_UNDERTOLERANCE;
// ASME B36.10M: [NPS, actual OD]; the shell OD snaps UP to the next standard OD.
export const PIPE_NPS = [
  // SMALL SIZES (round 10). B36.10M walls, cross-checked against two
  // independent sources and validated by the plain-end weight identity
  // W = 10.69*(OD - t)*t against the published 40/STD weights to within 0.004.
  // Sch 120 begins at NPS 4 (not NPS 5); NPS 3-1/2 has no Sch 160. Three
  // third-decimal disagreements were resolved from the METRIC primary:
  // 8.74 mm -> 0.344, 11.13 mm -> 0.438. NPS 3-1/2 XXS is DELIBERATELY
  // OMITTED - unresolved, and a wall that does not exist is worse than a
  // missing option.
  [2, 2.375], [2.5, 2.875], [3, 3.5], [3.5, 4.0], [4, 4.5], [5, 5.563],
  [6, 6.625], [8, 8.625], [10, 10.75], [12, 12.75], [14, 14.0], [16, 16.0],
  [18, 18.0], [20, 20.0], [22, 22.0], [24, 24.0], [26, 26.0], [28, 28.0],
];
// B36.10M nominal wall series per NPS, ascending, [schedule name, wall in].
export const PIPE_WALLS = {
  2:   [["Sch 10", 0.109], ["Sch 40/STD", 0.154], ["Sch 80/XS", 0.218],
        ["Sch 160", 0.344], ["XXS", 0.436]],
  2.5: [["Sch 10", 0.120], ["Sch 40/STD", 0.203], ["Sch 80/XS", 0.276],
        ["Sch 160", 0.375], ["XXS", 0.552]],
  3:   [["Sch 10", 0.120], ["Sch 40/STD", 0.216], ["Sch 80/XS", 0.300],
        ["Sch 160", 0.438], ["XXS", 0.600]],
  // NPS 3-1/2: no Sch 160, and XXS omitted as unresolved (see PIPE_NPS)
  3.5: [["Sch 10", 0.120], ["Sch 40/STD", 0.226], ["Sch 80/XS", 0.318]],
  4:   [["Sch 10", 0.120], ["Sch 40/STD", 0.237], ["Sch 80/XS", 0.337],
        ["Sch 120", 0.438], ["Sch 160", 0.531], ["XXS", 0.674]],
  5:   [["Sch 10", 0.134], ["Sch 40/STD", 0.258], ["Sch 80/XS", 0.375],
        ["Sch 120", 0.500], ["Sch 160", 0.625], ["XXS", 0.750]],
  // ROUND 11: Sch 10 restored at NPS 6, 8, 10 and 12. Its omission made the
  // THINNEST AVAILABLE WALL non-monotonic in size - NPS 6 floored at 0.280
  // (Sch 40/STD, its first row) while NPS 8 and NPS 14 floored at 0.250 - so a
  // 6.625" vessel was quoted a HEAVIER wall than an 8.625" one at the same
  // duty. Measured at 50 psi over 240" T-T, before/after:
  //     6.625"  0.280 -> 0.134     8.625"  0.250 -> 0.148
  //    10.75"   0.250 -> 0.165    12.75"   0.250 -> 0.180
  // Walls validated by the plain-end weight identity W = 10.69*(OD - t)*t
  // against published Sch 10 weights 9.29 / 13.40 / 18.70 / 24.20 lb/ft; worst
  // deviation 0.030 lb/ft (NPS 10). NPS 6 genuinely has NO Sch 20 or Sch 30 in
  // B36.10M - it goes 10 straight to 40/STD - which is exactly why its floor
  // was the coarsest of the four.
  6:  [["Sch 10", 0.134], ["Sch 40/STD", 0.280], ["Sch 80/XS", 0.432], ["Sch 120", 0.562],
       ["Sch 160", 0.719], ["XXS", 0.864]],
  8:  [["Sch 10", 0.148], ["Sch 20", 0.250], ["Sch 30", 0.277], ["Sch 40/STD", 0.322],
       ["Sch 60", 0.406], ["Sch 80/XS", 0.500], ["Sch 100", 0.594],
       ["Sch 120", 0.719], ["Sch 140", 0.812], ["XXS", 0.875], ["Sch 160", 0.906]],
  10: [["Sch 10", 0.165], ["Sch 20", 0.250], ["Sch 30", 0.307], ["Sch 40/STD", 0.365],
       ["Sch 60/XS", 0.500], ["Sch 80", 0.594], ["Sch 100", 0.719],
       ["Sch 120", 0.844], ["Sch 140/XXS", 1.000], ["Sch 160", 1.125]],
  12: [["Sch 10", 0.180], ["Sch 20", 0.250], ["Sch 30", 0.330], ["STD", 0.375], ["Sch 40", 0.406],
       ["XS", 0.500], ["Sch 60", 0.562], ["Sch 80", 0.688], ["Sch 100", 0.844],
       ["Sch 120/XXS", 1.000], ["Sch 140", 1.125], ["Sch 160", 1.312]],
  14: [["Sch 10", 0.250], ["Sch 20", 0.312], ["Sch 30/STD", 0.375],
       ["Sch 40", 0.438], ["XS", 0.500], ["Sch 60", 0.594], ["Sch 80", 0.750],
       ["Sch 100", 0.938], ["Sch 120", 1.094], ["Sch 140", 1.250], ["Sch 160", 1.406]],
  16: [["Sch 10", 0.250], ["Sch 20", 0.312], ["Sch 30/STD", 0.375],
       ["Sch 40/XS", 0.500], ["Sch 60", 0.656], ["Sch 80", 0.844],
       ["Sch 100", 1.031], ["Sch 120", 1.219], ["Sch 140", 1.438], ["Sch 160", 1.594]],
  18: [["Sch 10", 0.250], ["Sch 20", 0.312], ["STD", 0.375], ["Sch 30", 0.438],
       ["XS", 0.500], ["Sch 40", 0.562], ["Sch 60", 0.750], ["Sch 80", 0.938],
       ["Sch 100", 1.156], ["Sch 120", 1.375], ["Sch 140", 1.562], ["Sch 160", 1.781]],
  20: [["Sch 10", 0.250], ["Sch 20/STD", 0.375], ["Sch 30/XS", 0.500],
       ["Sch 40", 0.594], ["Sch 60", 0.812], ["Sch 80", 1.031], ["Sch 100", 1.281],
       ["Sch 120", 1.500], ["Sch 140", 1.750], ["Sch 160", 1.969]],
  22: [["Sch 10", 0.250], ["Sch 20/STD", 0.375], ["Sch 30/XS", 0.500],
       ["Sch 60", 0.875], ["Sch 80", 1.125], ["Sch 100", 1.375],
       ["Sch 120", 1.625], ["Sch 140", 1.875], ["Sch 160", 2.125]],
  24: [["Sch 10", 0.250], ["Sch 20/STD", 0.375], ["XS", 0.500], ["Sch 30", 0.562],
       ["Sch 40", 0.688], ["Sch 60", 0.969], ["Sch 80", 1.219], ["Sch 100", 1.531],
       ["Sch 120", 1.812], ["Sch 140", 2.062], ["Sch 160", 2.344]],
  26: [["Sch 10", 0.312], ["STD", 0.375], ["Sch 20/XS", 0.500]],
  28: [["Sch 10", 0.312], ["STD", 0.375], ["Sch 20/XS", 0.500], ["Sch 30", 0.625]],
};

// Smallest standard pipe [NPS, OD] whose OD covers the requested diameter.
function pipeNpsFor(diameter) {
  for (const [nps, od] of PIPE_NPS) if (od >= diameter - 1e-9) return [nps, od];
  return PIPE_NPS[PIPE_NPS.length - 1];
}

// Thinnest B36.10M schedule wall >= t for this NPS -> [schedule, wall]; falls
// back to the 1/8" plate lattice with schedule 'custom' when even the heaviest
// standard schedule is too thin (heavy-wall special order).
// HARD RULE (BUG-15): NEVER return a wall that is not a published schedule for
// this NPS. When nothing published covers the requirement, return [null, inf]
// and let the caller bail. This used to fall through to the 1/8" PLATE lattice
// as ["custom", ...], which is not a pipe size at all - and when even that was
// overshot it back-solved nominal = required/0.875 and printed the raw
// decimal (28" OD / 2500 psi / 800F / CA 0.125 quoted a 4.679195906081708"
// wall on an NPS whose heaviest published schedule is 0.625"). 959 of 4,980
// OD-basis pipe cases (19.3%) quoted an unpurchasable wall; the dangerous ones
// were the plausible round gauges, not the absurd ones.
function nextPipeWall(nps, t) {
  for (const [name, wall] of PIPE_WALLS[nps]) if (wall >= t - 1e-9) return [name, wall];
  return [null, Infinity];
}

// --------------------------------------------------------------------------- //
// Internal pressure - shell (UG-27) and heads (UG-32)
// --------------------------------------------------------------------------- //

function shellInternalThickness(P, dia, basis, S, E, CA) {
  if (P > 0.385 * S * E) return Infinity; // UG-27(c)(1) validity limit
  const denom = S * E - 0.6 * P;
  if (basis.toUpperCase() === "ID") {
    const R = dia / 2.0 + CA;
    return P * R / denom + CA;
  }
  return P * (dia / 2.0) / (denom + P) + CA;
}

// Effective joint efficiency for a formed head (UW-12(d), COMPRESS-verified):
// seamless head = 1.0 when the vessel is spot/fully radiographed, 0.85 with NO RT
// (no-RT jobs print heads at E 0.85 with the cylinder at 0.70); welded head =
// vessel RT category.
function headEfficiency(jointEff, headJointEff) {
  if (headJointEff >= 1.0 - 1e-9) return jointEff >= 0.85 - 1e-9 ? 1.0 : 0.85;
  return jointEff;
}

// Head thickness on the INSIDE diameter (ID-basis vessels).
function headInternalThickness(P, D_in, headType, S, E, CA) {
  let t;
  if (headType === "ellipsoidal") {
    const denom = 2 * S * E - 0.2 * P;
    t = denom > 0 ? P * D_in / denom : Infinity;
  } else if (headType === "hemispherical") {
    const L = D_in / 2.0;
    const denom = 2 * S * E - 0.2 * P;
    t = denom > 0 ? P * L / denom : Infinity;
  } else if (headType === "torispherical") {
    const L = D_in;
    const denom = S * E - 0.1 * P;
    t = denom > 0 ? 0.885 * P * L / denom : Infinity;
  } else {
    throw new Error("unknown head type: " + headType);
  }
  return t + CA;
}

// Head thickness on the OUTSIDE diameter Do (COMPRESS convention) — the exact
// closed form of the inside equation with D_inside = Do - 2t. Ellipsoidal is
// Appendix 1-4(c) with K = 1: t = P*Do / (2*S*E + 1.8*P) + CA.
function headOdThickness(P, Do, headType, S, E, CA) {
  let t;
  if (headType === "ellipsoidal") {
    const denom = 2 * S * E + 1.8 * P;
    t = denom > 0 ? P * Do / denom : Infinity;
  } else if (headType === "hemispherical") {
    const denom = 4 * S * E + 1.6 * P;
    t = denom > 0 ? P * Do / denom : Infinity;
  } else if (headType === "torispherical") {
    const denom = S * E + TORI_OD_COEFF * P;
    t = denom > 0 ? 0.885 * P * Do / denom : Infinity;
  } else {
    throw new Error("unknown head type: " + headType);
  }
  return t + CA;
}

// Table UG-33.1 - "Values of Spherical Radius Factor Ko for Ellipsoidal Head
// With Pressure on Convex Side": D/2h -> Ko, Ro = Ko * Do, linear interpolation.
// Self-consistent with the hemi rule: D/2h = 1.0 -> Ko = 0.50 -> Ro = Do/2, so
// one table covers both head types. A 2:1 head is D/2h = 2.0 -> Ko = 0.90.
const UG33_KO = [[1.0, 0.50], [1.2, 0.57], [1.4, 0.65], [1.6, 0.73], [1.8, 0.81],
                 [2.0, 0.90], [2.2, 0.99], [2.4, 1.08], [2.6, 1.18], [2.8, 1.27],
                 [3.0, 1.36]];
const HEAD_D_OVER_2H = { ellipsoidal: 2.0, hemispherical: 1.0 };
function ug33Ko(r) {
  if (r <= UG33_KO[0][0]) return UG33_KO[0][1];
  if (r >= UG33_KO[UG33_KO.length - 1][0]) return UG33_KO[UG33_KO.length - 1][1];
  for (let i = 0; i < UG33_KO.length - 1; i++) {
    const [a, va] = UG33_KO[i], [b, vb] = UG33_KO[i + 1];
    if (a <= r && r <= b) return va + (vb - va) * (r - a) / (b - a);
  }
  return UG33_KO[UG33_KO.length - 1][1];
}

// UG-33(a)(1): the head external thickness is the GREATER of two legs.
//   LEG A - UG-28(d) spherical procedure on the equivalent outside spherical
//     radius Ro (Table UG-33.1 Ko for ellipsoidal/hemi; outside crown radius
//     = Do for ASME F&D with L = D):  t = Ro sqrt(Pe / (0.0625 E)).
//   LEG B - the UG-32 INTERNAL formula for the same head type evaluated at
//     1.67 x the design pressure on the convex side, with E = 1.00.
// PROVISIONAL, like the shell external check (analytical elastic form rather
// than the Figure G / Factor B chart route).
function headExternalThickness(Pe, Do, headType, E_mod, S, CA, idBasisDia = null) {
  if (Pe <= 0) return 0.0;
  const Ro = headType === "torispherical" ? Do
    : ug33Ko(HEAD_D_OVER_2H[headType] ?? 2.0) * Do;
  const legA = Ro * Math.sqrt(Pe / (0.0625 * E_mod)) + CA;
  const pB = 1.67 * Pe;
  const legB = idBasisDia === null
    ? headOdThickness(pB, Do, headType, S, 1.0, CA)
    : headInternalThickness(pB, idBasisDia, headType, S, 1.0, CA);
  return Math.max(legA, legB);
}

function mawpShell(S, E, t_corr, R) { return S * E * t_corr / (R + 0.6 * t_corr); }

// Head MAWP from the corroded wall, solved from the OUTSIDE-diameter equation.
function mawpHead(S, E, t_corr, Do, headType) {
  if (headType === "ellipsoidal") return 2 * S * E * t_corr / (Do - 1.8 * t_corr);
  if (headType === "hemispherical") return 4 * S * E * t_corr / (Do - 1.6 * t_corr);
  if (headType === "torispherical") return S * E * t_corr / (0.885 * Do - TORI_OD_COEFF * t_corr);
  throw new Error(headType);
}

function staticHeadPsi(sg, height_in) { return sg * WATER_PSI_PER_IN * height_in; }

// Inside dish depth as a fraction of the head inside diameter.
const HEAD_DEPTH_IN = { ellipsoidal: 0.25, hemispherical: 0.5, torispherical: 0.169 };

// Inside dish depth h of one head: 2:1 ellipsoidal Di/4, hemi Di/2, F&D ~0.169 Di.
export function headInsideDepth(headType, Di) {
  return (HEAD_DEPTH_IN[headType] ?? 0.25) * Di;
}

// UG-28 UNSUPPORTED LENGTH (BUG-14). L runs between LINES OF SUPPORT, and a
// formed head's line of support is at ONE THIRD the head depth - not the
// tangent line:   L = tan-to-tan + h1/3 + h2/3.
// We previously used L = tan-to-tan flat, which is always SHORT; a short L
// raises the critical pressure and UNDERSTATES the required external
// thickness. Over 420 plate cases every one understated (up to 8.5%) and 27
// (6.4%) selected a thinner plate than Code requires; head TYPE had zero
// influence, which cannot be right. The UG-28 solver itself was never
// provisional - validated against COMPRESS (10.75" OD x 17.75" T-T, 15 psi,
// 200F: their L = 25.3878" and t = 0.049"; our solver at that L gives 0.0490").
export function externalUnsupportedLength(inp, Di) {
  return inp.length + 2.0 * (headInsideDepth(inp.head_type, Di) / 3.0);
}

// B16.9 CAP LINE-OF-SUPPORT OFFSET - SOURCED from the shop's cap height table.
// A cap is a curved crown PLUS a cylindrical STRAIGHT FLANGE; the flange
// carries no line of support of its own, so the UG-28 addition per cap is
//     SF + h/3   where SF = H - h     =>     H - 2h/3
// H is the TOTAL cap height (straight flange + crown).
export const PIPE_CAP_HEIGHT_H = {
  2: 1.5, 2.5: 1.5, 3: 2.0, 3.5: 2.5, 4: 2.5, 5: 3.0, 6: 3.5, 8: 4.0,
  10: 5.0, 12: 6.0, 14: 6.5, 16: 7.0, 18: 8.0, 20: 9.0, 22: 10.0,
  24: 10.5, 26: 12.0, 28: 12.0, 30: 12.0, 32: 12.0, 34: 12.0, 36: 12.0,
};
// UG-28 LINE-OF-SUPPORT CALIBRATION CONSTANT - NOT A GEOMETRIC CLAIM.
//
// READ THIS BEFORE "FIXING" THE 0.169. It exists ONLY to place the UG-28 line
// of support on a B16.9 cap. It was obtained by forcing our offset to match
// COMPRESS's stated 3.8189 in per cap while holding the cap height at 5 in -
// one equation, one free parameter - so any error in the cap height or in
// COMPRESS's own offset convention lands entirely on this number. Treating it
// as geometry is exactly the mistake that produced a phantom UG-32(d) scare.
//
// THE CAPS ARE 2:1. Tested against the WHOLE cap height table rather than the
// single calibration point: h = Di/4 implies a tight 0.19-0.25 x Di straight
// flange from NPS 8 through 28, the regularity a real product standard
// produces. A 0.169 crown would imply 3.31 in of flange at NPS 10 and
// 5.75-7.73 in at NPS 20-28 - a pipe nipple, not a fitting. Hemispherical
// needs a NEGATIVE flange from NPS 10 up.
//
// So 2:1 (K = 1) is the standing geometric assumption for the cap, and it is
// what the internal-pressure path and the volume/weight model both use.
// The constant stays 0.169 on purpose: crediting LESS crown depth yields a
// LONGER UG-28 L than 2:1 would, which is CONSERVATIVE for external pressure,
// and it is what matches COMPRESS.
export const PIPE_CAP_UG28_OFFSET_CALIB = 0.169;  // UG-28 offset only, not geometry
export const PIPE_CAP_SUPPORT_OFFSET_SOURCED = true;

// UG-28 addition to L from ONE B16.9 cap: H - 2h/3. h is clamped to at most H
// (a crown cannot be deeper than the whole cap), so SF = H - h never goes
// negative. Returns null for a size outside the table so the caller can flag.
export function pipeCapSupportOffset(nps, Di) {
  const H = PIPE_CAP_HEIGHT_H[nps];
  if (H === undefined) return null;
  const h = Math.min(PIPE_CAP_UG28_OFFSET_CALIB * Di, H);
  return H - 2.0 * h / 3.0;
}

// Per-component static heads, COMPRESS elevation convention (verified on all 14
// shell/head components of 7 calc reports): each component's column runs from
// the liquid surface down to ITS lowest inside point. Vertical rule extrapolated
// from the same principle (no vertical job in the dataset).
function componentStaticHeads(trueOD, tShellNom, tHeadMin, inp) {
  const g = inp.fluid_sg * WATER_PSI_PER_IN;
  const Ro = trueOD / 2.0;
  let hsShell, hsHead;
  if (inp.orientation === "vertical") {
    const idHead = Math.max(trueOD - 2.0 * tHeadMin, 0.0);
    const depth = (HEAD_DEPTH_IN[inp.head_type] ?? 0.25) * idHead;
    const hInside = inp.length + 2.0 * depth;
    const h = inp.liquid_level_in != null ? inp.liquid_level_in : inp.fill_fraction * hInside;
    hsHead = Math.max(Math.min(h, hInside), 0.0);
    hsShell = Math.max(Math.min(h, hInside) - depth, 0.0);
  } else {
    const h = inp.liquid_level_in != null ? inp.liquid_level_in
      : (2.0 * inp.fill_fraction - 1.0) * (Ro - tHeadMin);
    hsShell = Math.max(h + (Ro - tShellNom), 0.0);
    hsHead = Math.max(h + (Ro - tHeadMin), 0.0);
  }
  return [g * hsShell, g * hsHead, hsShell, hsHead];
}

// --------------------------------------------------------------------------- //
// External pressure (UG-28) - PROVISIONAL elastic model
// --------------------------------------------------------------------------- //

function externalCriticalPressure(E_mod, t, Do, L, nu = 0.3) {
  const a = 2.42 * E_mod * Math.pow(t / Do, 2.5);
  const b = Math.pow(1 - nu * nu, 0.75);
  let c = (L / Do) - 0.45 * Math.pow(t / Do, 0.5);
  if (c <= 0) c = 1e-6;
  return a / (b * c);
}

// UG-28 ELASTIC-BRANCH VALIDITY GUARD.
// This solver implements ONLY the left-of-curve ELASTIC branch,
// Pa = 2AE/(3(Do/t)). There is no Factor-B chart data here - no CS-2, no HA-1
// or HA-2, no yield term - so it is valid only while the strain factor A stays
// LEFT of the applicable material/temperature line. Right of the knee the real
// chart flattens onto the yield-governed branch and this formula becomes
// UNCONSERVATIVE.
// THE ENVELOPE IS NOT ELASTIC EVERYWHERE - THE EARLIER CLAIM HERE WAS WRONG.
// This comment used to say max A over the reachable envelope was 5.469e-4 raw /
// 4.857e-4 with the BUG-14 head credit, i.e. "elastic everywhere today". An
// independent 384,320-scenario sweep of the live build disproved that, and
// re-measuring confirms it: over Do 6-360, L 12-1200, Pe 1-30, T 100-800 the
// strain factor reaches A = 1.956e-3 on carbon and 1.961e-3 on 304, at
// 360" OD / L 12 / 30 psi / 800F - about 3x the carbon knee, not 0.7x it.
// ~3.8% of that grid lands right of the curve.
// So this guard fires on inputs a user can type, and it must BAIL rather than
// throw: an uncaught throw took the whole render down, so the browser kept the
// PREVIOUS vessel's numbers with no warning.
export const A_KNEE = { carbon: 6.6e-4, stainless: 8.0e-4 };

// Knee for a MATERIAL KEY. Coarse on purpose - a REFUSAL threshold, not a
// design value.
//
// ROUND 15 (found while rewriting the guard test, not in the audit): this used
// to infer the family from the modulus - "austenitic moduli sit near 28.3e6,
// carbon near 29.5e6" - and pick the stainless knee below 29.0e6. That is a
// ROOM-TEMPERATURE discriminator applied to a quantity that falls with
// temperature. Carbon is 28.8e6 at 200F and 24.2e6 at 800F, so EVERY carbon
// vessel above 100F got the stainless knee of 8.0e-4 instead of its own
// 6.6e-4 - a 21% LESS conservative refusal threshold, in the unconservative
// direction. The family is known at every call site, so pass it.
function aKneeFor(materialKey) {
  return materialKey === "carbon" ? A_KNEE.carbon : A_KNEE.stainless;
}

// UG-28 strain factor A implied by an elastic-branch solution:
//   Pa = 2AE/(3(Do/t))  =>  A = 1.5 * Pa * (Do/t) / E
export function externalStrainFactor(Pe, Do, t, E_mod) {
  if (t <= 0 || E_mod <= 0) return Infinity;
  return 1.5 * Pe * (Do / t) / E_mod;
}

function shellExternalThickness(Pe, Do, L, E_mod, CA, materialKey = "carbon") {
  if (Pe <= 0) return 0.0;
  const allowable = (t) => externalCriticalPressure(E_mod, t, Do, L) / 3.0;
  let lo = 0.03125, hi = 4.0;
  if (allowable(hi) < Pe) return hi + CA;
  for (let i = 0; i < 100; i++) {
    const mid = 0.5 * (lo + hi);
    if (allowable(mid) >= Pe) hi = mid; else lo = mid;
  }
  // RETURN Infinity, NEVER THROW. A design call that throws takes the whole
  // render down with it, and nothing caught this one: compute() aborted before
  // painting and the page kept the previous vessel's numbers - a stale screen
  // that reads as a live answer. Infinity flows into the ordinary not-computed
  // path and designVessel() turns it into an honest refusal.
  const A = externalStrainFactor(Pe, Do, hi, E_mod);
  if (A > aKneeFor(materialKey)) return Infinity;
  return hi + CA;
}

// --------------------------------------------------------------------------- //
// Geometry: volumes and weights
// --------------------------------------------------------------------------- //

function headInternalVolume(D_in, headType) {
  if (headType === "ellipsoidal") return PI * Math.pow(D_in, 3) / 24.0;
  if (headType === "hemispherical") return PI * Math.pow(D_in, 3) / 12.0;
  if (headType === "torispherical") return 0.0809 * Math.pow(D_in, 3);
  throw new Error(headType);
}

// FINISHED weight of one formed head or B16.9 cap - the developed surface of
// the component, not the blank. A cap is a purchased fitting rather than a
// plate blank, so it is weighed on the same formed-component basis.
function headFormedWeight(OD, t, headType, density) {
  return (PI / 4.0 * OD * OD) * HEAD_AREA_FACTOR[headType] * t * density;
}

function headPlateWeight(OD, t, headType, density) {
  const k = HEAD_BLANK_FACTOR[headType];
  const blank_area = PI / 4.0 * Math.pow(k * OD, 2);
  return blank_area * t * density;
}

// --------------------------------------------------------------------------- //
// Plate optimizer and drop analysis
// --------------------------------------------------------------------------- //

function largestDrop(Pw, Pl, w_used, l_used) {
  const candidates = [
    [Pw - w_used, Pl],
    [w_used, Pl - l_used],
    [Pw - w_used, l_used],
    [Pw, Pl - l_used],
  ];
  let best = candidates[0], bestArea = -Infinity;
  for (const d of candidates) {
    const area = Math.max(d[0], 0) * Math.max(d[1], 0);
    if (area > bestArea) { bestArea = area; best = d; }
  }
  return best;
}

function takeSingle(best, Pw, Pl, blank_w, blank_c, drop, orient) {
  const cand = {
    mode: "single", n_plates: 1, courses: 1, segments: 1,
    stock: [Pw, Pl], orient,
    blank: [pyround(blank_w, 2), pyround(blank_c, 2)],
    piece: [pyround(blank_w, 2), pyround(blank_c, 2)],  // the single cut IS the blank
    drop: [pyround(drop[0], 2), pyround(drop[1], 2)],
    drop_area: pyround(Math.max(drop[0], 0) * Math.max(drop[1], 0), 1),
    plate_area: Pw * Pl,
    used_area: blank_w * blank_c,
  };
  if (best === null) return cand;
  if (cand.n_plates < best.n_plates
      || (cand.n_plates === best.n_plates && cand.plate_area < best.plate_area)
      || (cand.n_plates === best.n_plates && cand.plate_area === best.plate_area
          && cand.drop_area > best.drop_area)) {
    return cand;
  }
  return best;
}

const MULTI_SPLIT_MAX = 24;   // covers the UI ranges (dia <= 360", len <= 1200") with room

// No single sheet holds the full shell blank: split it into COURSES along the
// tan-to-tan length (circ seams) and/or SEGMENTS around the circumference
// (long seams). Each of the courses*segments pieces is cut
// (shell_len/courses) x (circ/segments) from its own stock sheet, so the
// reported cut size, purchased stock, and drop are the real ones. Preference:
// fewest pieces, then least purchased (least drop) area, then fewest
// longitudinal seams, then the smaller sheet.
function multiCourse(OD, t_nom, shell_len, circ, stock) {
  let best = null;
  for (let n_c = 1; n_c <= MULTI_SPLIT_MAX; n_c++) {
    if (best !== null && n_c > best.n_plates) break;  // n = n_c*n_s always loses the count key
    const cut_len = shell_len / n_c;
    for (let n_s = 1; n_s <= MULTI_SPLIT_MAX; n_s++) {
      const n = n_c * n_s;
      if (best !== null && n > best.n_plates) break;
      const cut_circ = circ / n_s;
      for (const [Pw, Pl] of stock) {
        const fit_a = cut_len <= Pw && cut_circ <= Pl;    // length on width
        const fit_b = cut_circ <= Pw && cut_len <= Pl;    // circ on width
        if (!fit_a && !fit_b) continue;
        // largest usable remnant of one sheet, over the fitting layouts
        let drop = [0.0, 0.0], orient = "length-on-width";
        if (fit_a) drop = largestDrop(Pw, Pl, cut_len, cut_circ);
        if (fit_b) {
          const d2 = largestDrop(Pw, Pl, cut_circ, cut_len);
          if (!fit_a || Math.max(d2[0], 0) * Math.max(d2[1], 0)
              > Math.max(drop[0], 0) * Math.max(drop[1], 0)) {
            drop = d2; orient = "circ-on-width";
          }
        }
        const cand = {
          mode: "multi", n_plates: n, courses: n_c, segments: n_s,
          stock: [Pw, Pl], orient,
          blank: [pyround(shell_len, 2), pyround(circ, 2)],
          piece: [pyround(cut_len, 2), pyround(cut_circ, 2)],
          drop: [pyround(drop[0], 2), pyround(drop[1], 2)],
          drop_area: pyround(Math.max(drop[0], 0) * Math.max(drop[1], 0), 1),
          plate_area: Pw * Pl * n,
          used_area: shell_len * circ,
        };
        if (best === null || multiBetter(cand, best)) best = cand;
      }
    }
  }
  if (best === null) best = multiFallback(shell_len, circ, stock);
  return best;
}

// Strictly better multi-course candidate: fewest pieces, then least purchased
// area (= least drop), then fewest longitudinal seams (segments), then the
// smaller stock sheet. First-seen wins all remaining ties.
function multiBetter(a, b) {
  const ka = [a.n_plates, a.plate_area, a.segments, a.stock[0] * a.stock[1]];
  const kb = [b.n_plates, b.plate_area, b.segments, b.stock[0] * b.stock[1]];
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return true;
    if (ka[i] > kb[i]) return false;
  }
  return false;
}

// Legacy ceil-split estimate on the biggest sheet, for shells too large for
// any even split within MULTI_SPLIT_MAX (not reachable from the UI ranges).
function multiFallback(shell_len, circ, stock) {
  let [Pw, Pl] = stock[0];
  for (const [w, l] of stock) if (w * l > Pw * Pl) { Pw = w; Pl = l; }
  const long_dim = Math.max(Pw, Pl), short_dim = Math.min(Pw, Pl);
  const n_s = Math.max(1, Math.ceil(circ / long_dim));
  const n_c = Math.max(1, Math.ceil(shell_len / short_dim));
  const n = n_s * n_c;
  return {
    mode: "multi", n_plates: n, courses: n_c, segments: n_s,
    stock: [Pw, Pl], orient: "long-wrap",
    blank: [pyround(shell_len, 2), pyround(circ, 2)],
    piece: [pyround(shell_len / n_c, 2), pyround(circ / n_s, 2)],
    drop: [0, 0], drop_area: 0.0,
    plate_area: Pw * Pl * n,
    used_area: shell_len * circ,
  };
}

function attachWeights(plate, t_nom, density, price) {
  const [Pw, Pl] = plate.stock;
  const n = plate.n_plates;
  plate.shell_weight = pyround(plate.used_area * t_nom * density, 1);
  plate.purchased_weight = pyround(Pw * Pl * n * t_nom * density, 1);
  plate.drop_weight = pyround(Math.max(plate.plate_area - plate.used_area, 0) * t_nom * density, 1);
  plate.shell_cost = pyround(plate.shell_weight * price, 2);
  plate.purchased_cost = pyround(plate.purchased_weight * price, 2);
}

// Buy record for pipe construction: one NPS length of SA-53B ERW pipe (no
// drop) plus the schedule bookkeeping. Field names/shapes match the plate
// optimizer so every downstream consumer keeps working.
// PRODUCT NOUNS FOR NOTE COPY.
// The round-7 accessor in app.js fixed the panel LABELS, but note copy lives
// here and kept its own hardcoded nouns - so the pipe path printed "plate size"
// in rt_note (fixed in round 8) and "shell plus formed heads (plate weight)" in
// the empty-weight note, on a vessel that is a pipe shell with WPB caps. Both
// now come from ONE place, keyed on the same two facts the rest of the engine
// uses, so a third product form is one case here rather than a hunt through
// string literals.
export function productNouns(pipe, headIsCap) {
  return {
    shell: pipe ? "pipe" : "plate",
    selection: pipe ? "pipe schedule" : "plate size",
    assembly: pipe
      ? "pipe shell plus " + (headIsCap ? "B16.9 caps" : "formed plate heads")
      : "shell plus " + (headIsCap ? "B16.9 caps" : "formed heads"),
    weight_basis: pipe ? "pipe and fitting weight" : "plate weight",
  };
}

// PIPE IS BOUGHT BY THE JOINT, NOT BY THE INCH.
// A mill ships pipe in fixed lengths and you pay for the whole joint. The app
// previously quoted "24 OD x 600" as if pipe were cut to order - not a
// purchasable item - and costed it linearly on the used length.
//   carbon    - 21 ft (252 in) or 42 ft (504 in)
//   stainless - 20 ft (240 in) only
export const PIPE_JOINT_LENGTHS = { carbon: [504.0, 252.0], stainless: [240.0] };

export function pipeJointLengthsFor(material) {
  return PIPE_JOINT_LENGTHS[material === "carbon" ? "carbon" : "stainless"];
}

// MINIMIZE JOINT COUNT FIRST, then drop. Every extra joint is another Cat. B
// girth weld to make, radiograph and inspect - dearer than the drop it saves.
export function pipeJointPlan(needLen, material) {
  if (!Number.isFinite(needLen) || needLen <= 0) return null;
  const sizes = pipeJointLengthsFor(material);
  const longest = Math.max(...sizes), shortest = Math.min(...sizes);
  const n = Math.max(1, Math.ceil(needLen / longest - 1e-9));
  let joints;
  if (sizes.length === 1) {
    joints = Array(n).fill(longest);
  } else {
    // 504 = 2 x 252, so every reachable total is 252*(n+k); the smallest total
    // at n joints comes from the smallest k of 42 ft joints that still covers.
    let k = Math.max(0, Math.ceil(needLen / shortest - 1e-9) - n);
    k = Math.min(k, n);
    joints = Array(k).fill(longest).concat(Array(n - k).fill(shortest));
  }
  const total = joints.reduce((a, b) => a + b, 0);
  return { joints, count: n, total, drop: total - needLen };
}

// WHAT LENGTH ACTUALLY GETS CUT - stated explicitly; it decides joint count at
// boundaries. inp.length is TAN-TO-TAN, between the closure tangent lines, and
// a closure's STRAIGHT FLANGE lies inside that span.
//   * B16.9 CAPS: the flange arrives ON THE FITTING, so cut = T-T minus both
//     flanges, SF = H - Di/4 (2:1 - the settled cap geometry, NOT the 0.169
//     UG-28 calibration constant). ~5.4 in per cap on NPS 24. Rarely changes
//     the answer, but at a boundary it saves a whole joint.
//   * FORMED PLATE HEADS on a pipe shell: no sourced flange length exists, and
//     inventing one is the sort of number this codebase has had to strike
//     before - so cut the full T-T. That is the CONSERVATIVE side.
export function cutLengthForPipe(tanToTan, nps, Di, headIsCap) {
  if (!headIsCap) return tanToTan;
  const H = PIPE_CAP_HEIGHT_H[nps];
  if (H === undefined) return tanToTan;
  const sf = Math.max(0.0, H - Di / 4.0);
  return Math.max(0.0, tanToTan - 2.0 * sf);
}

function pipeBuy(nps, od, wall, schedule, cap_wall, cap_schedule, cap_nps, shell_len,
                 density, price, material = "carbon", cutLen = null) {
  const circ = PI * (od - wall);   // mean-diameter developed circumference
  if (cutLen === null) cutLen = shell_len;
  const plan = pipeJointPlan(cutLen, material);
  // AS-BUILT area spans the full TAN-TO-TAN length, not the cut length. The
  // difference is the two cap straight flanges: that steel is really there,
  // and the cap weight model covers the DISH ONLY, so attributing the flange
  // to the shell keeps the vessel's empty weight right in total. What gets
  // CUT (and therefore bought) is the shorter cutLen.
  const used = shell_len * circ;
  const d = {
    mode: "pipe", n_plates: 1, courses: 1, segments: 1,
    stock: [od, wall], orient: "pipe",
    blank: [pyround(cutLen, 2), pyround(circ, 2)],
    piece: [pyround(cutLen, 2), pyround(circ, 2)],
    drop: [plan ? pyround(plan.drop, 2) : 0, plan ? pyround(circ, 2) : 0],
    drop_area: plan ? plan.drop * circ : 0.0,
    plate_area: plan ? plan.total * circ : used,
    used_area: used,
    nps, schedule, cap_wall, cap_schedule, cap_nps,
    // JOINT BOOKKEEPING - pipe is bought by the joint, not the inch.
    cut_length: pyround(cutLen, 3),
    n_joints: plan ? plan.count : 0,
    joint_lengths: plan ? plan.joints.slice() : [],
    joint_total: plan ? pyround(plan.total, 2) : 0.0,
    joint_drop: plan ? pyround(plan.drop, 3) : 0.0,
    // every joint-to-joint girth weld is an EXTRA Category B butt seam
    shell_girth_welds: plan ? Math.max(0, plan.count - 1) : 0,
  };
  // AS-BUILT weight is the cut length; PURCHASED weight is every joint paid for.
  const w = pyround(used * wall * density, 1);                 // as-built vessel
  const pw = pyround((plan ? plan.total : cutLen) * circ * wall * density, 1);
  d.shell_weight = w;
  d.purchased_weight = pw;                                     // every joint paid for
  d.drop_weight = pyround(Math.max(0.0, pw - cutLen * circ * wall * density), 1);
  d.shell_cost = pyround(w * price, 2);
  d.purchased_cost = pyround(pw * price, 2);
  return d;
}

// --------------------------------------------------------------------------- //
// Stainless plate price, derived from the carbon (SA-516-70) plate price
// --------------------------------------------------------------------------- //

// Alloy surcharge constants, USD/lb.
// Source: Outokumpu North America July 2026 alloy surcharge table — update
// these two numbers when the monthly surcharge moves.
export const ALLOY_SURCHARGE_304_304L_USD_PER_LB = 1.0118;
export const ALLOY_SURCHARGE_316_316L_USD_PER_LB = 1.8002;
export const ALLOY_SURCHARGE_BY_MATERIAL = {
  stainless304: ALLOY_SURCHARGE_304_304L_USD_PER_LB,
  stainless: ALLOY_SURCHARGE_304_304L_USD_PER_LB,       // legacy key = 304L
  stainless316: ALLOY_SURCHARGE_316_316L_USD_PER_LB,
  stainless316L: ALLOY_SURCHARGE_316_316L_USD_PER_LB,
};
// W fallback when the purchased plate weight is not yet known: lb per inch of
// plate thickness (a typical single-sheet buy).
export const STAINLESS_PRICE_FALLBACK_LB_PER_IN = 4133.0;

// Estimated stainless plate price, USD/lb, derived from the carbon price:
//   Pss = AS - 0.17 + 1.38*P516 - 0.08*ln(W/4000) + 0.43*exp(-((t-0.55)/0.17)^2)
// AS = alloy surcharge for the grade, P516 = current SA-516-70 price ($/lb),
// t = shell nominal plate (in), W = total purchased plate weight (lb, from the
// plate-buy result; falls back to 4133*t when unknown). Returns null for
// carbon / unknown grades or unusable inputs — never NaN or Infinity.
export function stainlessPlatePrice(material, p516PerLb, tShellNominal, purchasedWeightLb = null) {
  const surcharge = ALLOY_SURCHARGE_BY_MATERIAL[material];
  if (surcharge === undefined) return null;
  const t = tShellNominal;
  if (t === null || t === undefined || !Number.isFinite(t) || t <= 0) return null;
  if (p516PerLb === null || p516PerLb === undefined || !Number.isFinite(p516PerLb)) return null;
  let W = purchasedWeightLb;
  if (W === null || W === undefined || !Number.isFinite(W) || W <= 0) {
    W = STAINLESS_PRICE_FALLBACK_LB_PER_IN * t;
  }
  return (surcharge - 0.17 + 1.38 * p516PerLb
          - 0.08 * Math.log(W / 4000.0)
          + 0.43 * Math.exp(-(((t - 0.55) / 0.17) ** 2)));
}

function optimizePlate(OD, t_nom, shell_len, density, price, stock) {
  const circ = PI * (OD - t_nom);
  const blank_w = shell_len, blank_c = circ;
  let best = null;
  for (const [Pw, Pl] of stock) {
    if (blank_w <= Pw && blank_c <= Pl) {
      const drop = largestDrop(Pw, Pl, blank_w, blank_c);
      best = takeSingle(best, Pw, Pl, blank_w, blank_c, drop, "length-on-width");
    }
    if (blank_c <= Pw && blank_w <= Pl) {
      const drop = largestDrop(Pw, Pl, blank_c, blank_w);
      best = takeSingle(best, Pw, Pl, blank_w, blank_c, drop, "circ-on-width");
    }
  }
  if (best === null) best = multiCourse(OD, t_nom, shell_len, circ, stock);
  attachWeights(best, t_nom, density, price);
  return best;
}

// --------------------------------------------------------------------------- //
// Orchestration
// --------------------------------------------------------------------------- //

function nextNominal(t) {
  for (const n of NOMINAL_THICKNESSES) if (n >= t) return n;
  return t;
}


export const DEFAULT_INPUT = {
  diameter: 96.0, diameter_basis: "OD", length: 120.0, pressure: 250.0,
  ext_pressure: 0.0, head_type: "ellipsoidal", orientation: "horizontal",
  material: "carbon", temp_F: 100.0, joint_eff: 0.85, head_joint_eff: 1.0,
  corrosion: 0.0, fluid_sg: 1.0, fill_fraction: 1.0, price_per_lb: 0.86,
  liquid_level_in: null,
  // preheat >= 200F (95C) during welding -> satisfies the SA-516-70 PWHT rule
  weld_preheat: false,
  // "plate" (rolled shell + formed heads) or "pipe" (SA-53B ERW pipe shell +
  // B16.9 caps; 28" OD and below, else the plate path is used)
  construction: "plate",
  // pipe product form: "welded" (ERW / SA-312 welded - the DEFAULT) or
  // "seamless" (SA-53 Type S / SA-312 seamless). Pipe path only.
  pipe_product_form: "welded",
  // PIPE PATH ONLY. Examination of the Category B cap-to-shell butt welds -
  // what actually drives the UW-12(d) hoop quality factor:
  //   "none" no qualifying exam -> 0.85 | "a5b" UW-11(a)(5)(-b) quality spot,
  //   "spot" UW-11(b) spot + A5b, "full" full RT -> all 1.00
  // REPLACES joint_eff on the pipe path; joint_eff still drives the plate
  // path's Cat. A shop seam, a genuinely different joint.
  cap_weld_exam: "none",
  // Cat. B cap weld type per Table UW-12; Type 2 default (how these are
  // actually fabricated, and matches Eli's COMPRESS report). Drives the
  // UG-27(c)(2) LONGITUDINAL efficiency only, never the hoop.
  cap_weld_type: "type2",
};

// ---- ROUND 16 (b): null IS THE SENTINEL FOR "NOT COMPUTED", NEVER Infinity ----
//
// The bail paths used to set nine thickness fields to Infinity. Infinity is a
// NUMBER: it formats, it compares, it silently wins a min() with no isFinite
// guard, and JSON.stringify turns it into null on the way anywhere - so a
// missing value could travel a long way looking like a real one. null cannot
// pass unnoticed in the same way, and every comparison has to be written
// deliberately. That is the point.
const NULLED_THICKNESS_FIELDS = [
  "t_shell_internal", "t_shell_external", "t_shell_required",
  "t_head_internal", "t_head_required", "t_shell_nominal",
  "t_head_nominal", "t_nominal", "t_shell_internal_full_rt",
];
function nullAllThicknesses(res) {
  for (const f of NULLED_THICKNESS_FIELDS) res[f] = null;
  return res;
}
// True when a result field holds a real number. The one place that knows both
// sentinels. NOTE isFinite(null) is TRUE in JS (null coerces to 0) - exactly
// the trap this closes, so the null test comes first and is not optional.
export function ok(x) { return x !== null && x !== undefined && Number.isFinite(x); }

export function designVessel(input) {
  let inp = { ...DEFAULT_INPUT, ...input };
  // Standard-OD products, each independently selectable (carbon, 28" and below):
  //  - construction "pipe": SA-53 Gr. B ERW pipe SHELL (schedule walls)
  //  - head_type "pipecap": seamless SA-234 WPB cap CLOSURES (~2:1
  //    ellipsoidal per B16.9, schedule walls)
  // Either one puts the vessel on a standard NPS outside diameter. Both
  // combine freely with the plate paths.
  const carbon = inp.material === "carbon";
  // Diameter BRACKET for standard-OD products: 28" NPS at the top on both
  // bases (inclusive - 28" qualifies, 30" falls through to plate + formed
  // heads); on OD basis also a bottom bound at the smallest stocked pipe OD
  // (6.625", NPS 6) - below it pipe would BALLOON the vessel past the
  // specified outside envelope, so those fall back to plate (exact OD).
  // THE FLOOR APPLIES ON BOTH BASES (round 9 part 2). It used to be tested only
  // on OD, so the ID path had NO minimum: a 2" ID request was served by NPS 6
  // with a 6.065" as-built bore - three times the requested bore and about NINE
  // TIMES the capacity. On ID basis the floor is the LARGEST bore the smallest
  // stocked size can offer (NPS 6 at its thinnest stocked wall).
  let inBracket = inp.diameter <= PIPE_MAX_DIAMETER + 1e-9;
  if (inp.diameter_basis.toUpperCase() === "OD") {
    inBracket = inBracket && inp.diameter >= PIPE_NPS[0][1] - 1e-9;
  } else {
    inBracket = inBracket && inp.diameter >= PIPE_MIN_BORE - 1e-9;
  }
  let pipe = inp.construction === "pipe" && inBracket;
  let headIsCap = inp.head_type === "pipecap" && inBracket;
  let usesNps = pipe || headIsCap;
  let pipeNps = null;
  let idFallbackNote = null;
  const origHeadJointEff = inp.head_joint_eff;   // before any cap override
  if (usesNps && inp.diameter_basis.toUpperCase() !== "OD") {
    // ID basis with standard-OD products: pick the smallest NPS whose
    // AS-BUILT bore covers the entered ID, retrying up a size when the wall
    // snap eats the bore. Single-level recursion (recursive call is OD basis).
    const wantId = inp.diameter;
    for (const [_nps, _od] of PIPE_NPS) {
      if (_od <= wantId + 1e-9) continue;
      const cand = designVessel({ ...inp, diameter: _od, diameter_basis: "OD" });
      // A candidate that itself fell back to plate is NOT a pipe answer -
      // accepting it would strand the search at the first NPS that runs off
      // its schedule table instead of trying larger, still-buildable sizes.
      if (cand.construction_fallback !== null) continue;
      // ok(), not Number.isFinite(): a bailed candidate nulls every thickness.
      // Number.isFinite(null) is already false so this one was safe, but ok()
      // is the single place that knows both sentinels - keep it uniform.
      if (cand.plate !== null && ok(cand.t_nominal)
          && cand.id_inside >= wantId - 1e-6) {
        // SILENT BORE SNAP (round 8), the ID twin of the OD snap note - and the
        // worse of the two, because the typed number is a PROCESS bore.
        if (cand.id_inside > wantId + 1e-6) {
          const pct = wantId > 0 ? (cand.id_inside - wantId) / wantId * 100.0 : 0.0;
          // The shell here may be PIPE (plate.nps) or PLATE with B16.9 cap
          // closures (plate.cap_nps) - a standard OD is resolved either way,
          // so name whichever key exists rather than assuming a pipe shell.
          const _n = cand.plate.nps ?? cand.plate.cap_nps;
          const _sch = cand.plate.schedule || cand.plate.cap_schedule || "";
          const _size = `NPS ${_n}` + (_sch ? ` ${_sch}` : "");
          cand.notes.unshift(`Bore snapped up: You asked for a ${g(wantId)}\u2033 inside `
            + `diameter, and this is a standard-OD product, so the smallest `
            + `size whose as-built bore covers it is ${_size} `
            + `at ${g(_od)}\u2033 OD - an as-built bore of `
            + `${cand.id_inside.toFixed(3)}\u2033 (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%). `
            + `CAPACITY, WEIGHT AND COST ALL FOLLOW THE BUILT BORE, not the `
            + `${g(wantId)}\u2033 you typed. Enter an OD instead if you need to control `
            + `the outside dimension.`);
        }
        return cand;
      }
    }
    // NO standard OD can cover the requested bore (either none is above the
    // ID, or every candidate's wall snap eats it): the process bore wins over
    // the standard-product preference - build from plate, which honors the ID
    // exactly. Never return a short-bore pipe vessel.
    // This IS a construction change the user did not ask for, so it must be
    // LOUD (BUG-15 review): it swaps the material family too (SA-53 / SA-234
    // -> SA-516-70), which moves the UCS-66 curve, the PWHT and RT rules and
    // the price basis. Silently returning a plate vessel under a "pipe"
    // selection would misreport every one of those.
    pipe = headIsCap = usesNps = false;
    // Move the INPUT to match the answer: no stale "pipe" / "pipe cap" state
    // sitting on a plate result (the UI reads inp back to drive its
    // Construction and Head type selectors).
    inp = { ...inp, construction: "plate", head_joint_eff: origHeadJointEff,
            head_type: inp.head_type === "pipecap" ? "ellipsoidal" : inp.head_type };
    idFallbackNote = `Construction changed: No standard pipe size has an as-built `
      + `bore covering the entered ${wantId} in ID at this pressure - every `
      + `candidate's wall snap eats the bore, or no published schedule covers the `
      + `wall. Switched to plate shell + formed heads, SA-516-70. Every downstream `
      + `result - MDMT curve, PWHT and radiography rules, price basis and cut plan - `
      + `is the PLATE one. Enter an OD instead if you need a standard pipe size.`;
  }
  let odSnap = null;
  if (usesNps) {
    const requestedDia = inp.diameter;
    const [nps, od] = pipeNpsFor(inp.diameter);
    pipeNps = nps;
    inp = { ...inp, diameter: od };
    // SILENT DIAMETER SNAP (round 8). Pipe is OD-controlled, so snapping UP to
    // a purchasable OD is correct engineering - doing it quietly is not. Asking
    // for 7" built an 8.625" vessel (+23.2%) with capacity / weight / MAWP
    // byte-identical to typing 8.625, while the Diameter box still read 7.
    // Record it, INCLUDING the size below, so the user can choose to go down.
    if (Math.abs(od - requestedDia) > 1e-9) {
      let below = null;
      for (const [n2, o2] of PIPE_NPS) if (o2 < od - 1e-9) below = [n2, o2];
      odSnap = [requestedDia, nps, od, below];
    }
  }
  if (headIsCap && inp.head_joint_eff < 1.0 - 1e-9) {
    inp = { ...inp, head_joint_eff: 1.0 };   // B16.9 caps are seamless
  }

  const baseMat = MATERIALS[inp.material];
  // shell / closure materials by family: carbon -> SA-53B ERW + SA-234 WPB;
  // stainless -> SA-312 welded pipe + SA-403 WP caps of the matching grade
  // shell material by family AND product form. WELDED is the default for both
  // families; SEAMLESS drops FACTOR 1 only - it keeps FACTOR 2 below, and
  // keeps the mill undertolerance (SA-530 gives -12.5% for seamless too).
  const seamlessPipe = (inp.pipe_product_form ?? "welded") === "seamless";
  const mat = pipe
    ? (carbon ? (seamlessPipe ? SA53_B_SMLS : SA53_B_ERW)
              : (seamlessPipe ? SA312_SMLS : SA312_PIPE)[inp.material])
    : baseMat;
  const matHead = headIsCap ? (carbon ? SA234_WPB : SA403_CAP[inp.material]) : baseMat;
  const S = mat.allowableStress(inp.temp_F);
  const S_head = matHead.allowableStress(inp.temp_F);
  // TWO CUMULATIVE 0.85s ON AN ERW/SA-312 PIPE SHELL:
  //   FACTOR 1 - the II-D product weld factor, already inside `S` above.
  //   FACTOR 2 - the UW-12(d) vessel joint efficiency, applied HERE on
  //     CIRCUMFERENTIAL stress. Per ASME VIII-1 Interpretation BC88-043
  //     (VIII-1-86-218, 1988-02-18, subject UW-12(c)) an ERW pipe shell closed
  //     by seamless heads with un-radiographed Category B seams must ALSO be
  //     multiplied by E = 0.85 for circumferential-stress calculations.
  //     RT-DRIVEN like any UW-12(d) seamless section.
  // PIPE PATH: the UW-12(d) hoop quality factor, keyed ONLY to the Category B
  // cap-weld examination - never to diameter, pressure or product form (BUG-9
  // determinism kept; BUG-12 applies it to seamless too; BUG-13 lets a
  // qualifying examination reach 1.00). PLATE PATH: unchanged.
  const capExam = inp.cap_weld_exam ?? "none";
  const E = pipe ? pipeHoopEfficiency(capExam) : inp.joint_eff;
  // UW-12 effective closure efficiency. ROUND 13: on the pipe path this keys on
  // the Cat. B cap-weld examination, NOT on the Cat. A radiography level - a
  // pipe body has no Cat. A shop seam, and joint_eff was silently rewriting the
  // head requirement from a control the UI does not even show there.
  const Eh = pipe ? pipeHeadEfficiency(capExam, inp.head_joint_eff, inp.joint_eff)
                  : headEfficiency(inp.joint_eff, inp.head_joint_eff);
  const CA = inp.corrosion;
  // plate snaps carry the 3/8" shop floor; pipe schedule walls instead carry
  // the 12.5% mill undertolerance (0.875*wall must cover the need)
  const snap = pipe ? ((t) => nextPipeWall(pipeNps, t / PIPE_WALL_AVAIL)[1])
    : ((t) => nextNominal(Math.max(t, PLATE_MIN_GAUGE)));
  // geometry: a pipe cap behaves as a ~2:1 ellipsoidal head everywhere
  const headGeom = inp.head_type === "pipecap" ? "ellipsoidal" : inp.head_type;

  const res = {
    inp, material: { name: mat.name, key: mat.key, density: mat.density, modulus: mat.modulus },
    S, id_inside: 0.0,
    t_shell_internal: 0.0, t_shell_external: 0.0, t_shell_required: 0.0,
    t_head_internal: 0.0, t_head_required: 0.0, t_head_external: 0.0,
    t_shell_nominal: 0.0, t_head_nominal: 0.0, t_nominal: 0.0,
    t_shell_design: 0.0, t_head_design: 0.0,
    // the two weld factors, kept SEPARATELY visible so the stack is auditable
    s_product_factor: mat.product_factor ?? 1.0,        // FACTOR 1 (in the line)
    e_circ: E,                                          // FACTOR 2 (UW-12(d))
    s_longitudinal: (mat.longitudinalStress ? mat.longitudinalStress(inp.temp_F)
                     : mat.allowableStress(inp.temp_F)),
    // UG-27(c)(2) longitudinal efficiency. Reported, never sized on: for this
    // PRESSURE-ONLY family the longitudinal check can never govern. THAT DIES
    // as soon as external axial load, wind, seismic or saddle reactions are
    // added - those put real axial stress in the shell.
    e_long: pipe ? capWeldLongEfficiency(inp.cap_weld_type ?? "type2", capExam)
                 : headEfficiency(inp.joint_eff, inp.head_joint_eff),
    governing: "", drives_nominal: "", thickness_transition: false, external_provisional: false,
    ext_length_used: 0.0, ext_length_flagged: false,     // UG-28 L (BUG-14)
    // set when the pipe path could not be built and the design fell back to
    // plate + formed heads: "pipe_over_schedule" | "id_no_standard_od"
    construction_fallback: null,
    static_head_psi: 0.0, p_local_design: 0.0,
    static_head_head_psi: 0.0, p_local_head: 0.0, hs_shell_in: 0.0, hs_head_in: 0.0,
    t_shell_internal_full_rt: 0.0,
    rt_note: "", mawp_shell: 0.0, mawp_head: 0.0,
    volume_gal: 0.0, weight_empty: 0.0, weight_full: 0.0,
    plate: null, notes: [],
  };

  const OD = inp.diameter;

  // BUG-14: L is the UG-28 distance between LINES OF SUPPORT (one third of the
  // head depth beyond each tangent line), not the tan-to-tan length. The depth
  // term needs the inside diameter, which needs the wall, so solve by fixed
  // point. PIPE path: we cannot place the line of support without the B16.9
  // cap length, so L stays tan-to-tan and the result is FLAGGED.
  const EmodX = mat.modulusAt(inp.temp_F);
  if (pipe) {
    // B16.9 caps: L = tan-to-tan + sum(H_i - 2h_i/3) from the sourced cap
    // height table. Formed PLATE heads on a pipe shell use the plate rule.
    let Lext = inp.length, tExt = 0.0;
    for (let i = 0; i < 6; i++) {
      tExt = shellExternalThickness(inp.ext_pressure, OD, Lext, EmodX, CA, mat.key);
      const Di = Math.max(OD - 2.0 * tExt, 1e-6);
      let newL;
      if (headIsCap) {
        const off = pipeCapSupportOffset(pipeNps, Di);
        newL = off !== null ? inp.length + 2.0 * off : inp.length;
      } else {
        newL = externalUnsupportedLength(inp, Di);
      }
      if (Math.abs(newL - Lext) < 1e-9) break;
      Lext = newL;
    }
    res.ext_length_used = Lext;
    res.t_shell_external = tExt;
    res.ext_length_flagged = inp.ext_pressure > 0 && headIsCap
      && pipeCapSupportOffset(pipeNps, OD) === null;
  } else {
    res.ext_length_flagged = false;
    let Lext = inp.length, tExt = 0.0;
    // ROUND 15 ITEM 5: UG-28(b) DEFINES Do AS THE OUTSIDE DIAMETER of the
    // cylindrical shell course. On the ID basis `OD` still holds the typed
    // INSIDE diameter, so handing it straight to the solver understated
    // t_shell_external every time - 0.97% at 24"/30 psi, 0.74% at 48", 0.57%
    // at 96", 0.46% at 180". Small, but always thin and never thick, which is
    // the wrong sign. Do = ID + 2t, so it iterates with t here.
    const isOdBasis = inp.diameter_basis.toUpperCase() === "OD";
    let DoExt = OD;
    for (let i = 0; i < 6; i++) {
      tExt = shellExternalThickness(inp.ext_pressure, DoExt, Lext, EmodX, CA, mat.key);
      if (!isOdBasis && Number.isFinite(tExt)) DoExt = inp.diameter + 2.0 * tExt;
      const Di = isOdBasis ? OD - 2.0 * tExt : inp.diameter;
      const newL = externalUnsupportedLength(inp, Math.max(Di, 1e-6));
      if (Math.abs(newL - Lext) < 1e-9) break;
      Lext = newL;
    }
    res.ext_length_used = Lext;
    res.t_shell_external = tExt;
  }
  res.external_provisional = false;

  // Static head + sizing, COMPRESS fixed point: each component's Ps comes from
  // the FINAL thicknesses (shell nominal, head minimum). Converges in 2-3 passes.
  const isOD = inp.diameter_basis.toUpperCase() === "OD";
  let psShell = 0.0, psHead = 0.0, hsS = 0.0, hsH = 0.0;
  let tShellInt = Infinity, tHeadReq = Infinity;
  let trueOdConv = isOD ? OD : inp.diameter;
  let prev = null, converged = false;
  for (let i = 0; i < 10; i++) {
    const pSh = inp.pressure + psShell;
    const pHd = inp.pressure + psHead;
    tShellInt = shellInternalThickness(pSh, inp.diameter, inp.diameter_basis, S, E, CA);
    tHeadReq = isOD
      ? headOdThickness(pHd, OD, headGeom, S_head, Eh, CA)
      : headInternalThickness(pHd, inp.diameter + 2 * CA, headGeom, S_head, Eh, CA);
    // Appendix 1-4(f) safe harbour, inside the fixed point so the shared gauge
    // and the static head both see the governed value.
    if (headGeom === "torispherical" && Number.isFinite(tHeadReq)) {
      const Lin = isOD ? (OD - 2 * tHeadReq) : inp.diameter;
      tHeadReq = Math.max(tHeadReq, toriMinThickness(Lin));
    }
    const tShellReq = Math.max(tShellInt, res.t_shell_external);
    // BUG-3: the head's UG-33 external requirement joins the GOVERNING head
    // requirement used for snapping. tHeadReq stays the pure INTERNAL value
    // (what t_head_internal reports); tHeadGov is the combined requirement
    // that drives the shared gauge.
    // Ro is an OUTSIDE radius, so leg A keys on the true outside diameter;
    // on ID basis that follows the fixed point (previous iteration's value)
    const tHeadExt = headExternalThickness(
      inp.ext_pressure, trueOdConv, headGeom, matHead.modulusAt(inp.temp_F),
      S_head, CA, isOD ? null : inp.diameter + 2 * CA);
    const tHeadGov = Number.isFinite(tHeadReq) ? Math.max(tHeadReq, tHeadExt) : tHeadReq;
    if (!Number.isFinite(tShellReq) || !Number.isFinite(tHeadReq)) break;
    let tSn = snap(tShellReq);
    // SHARED GAUGE (plate shell + formed plate heads): both parts are cut
    // from ONE plate thickness, so the loop's as-built shell wall must be
    // the shared gauge, not an independent shell-only snap.
    if (!pipe && !headIsCap && Number.isFinite(tHeadGov)) {
      const tf = headFormingMinPlate(tHeadGov, headGeom);
      tSn = nextNominal(Math.max(tShellReq, tf, PLATE_MIN_GAUGE));
    }
    const trueOdI = isOD ? inp.diameter : inp.diameter + 2 * tSn;
    trueOdConv = trueOdI;              // converged OUTSIDE diameter for UG-33
    // liquid geometry follows the GOVERNING head requirement
    const key = tSn + "|" + tHeadGov.toFixed(9);
    if (key === prev) { converged = true; break; }
    prev = key;
    [psShell, psHead, hsS, hsH] = componentStaticHeads(trueOdI, tSn, tHeadGov, inp);
  }
  // ROUND 15 ITEM 6(a). THE TWO PRINTED NUMBERS MUST SATISFY THEIR OWN
  // EQUATION. psShell is updated at the BOTTOM of the loop, after tShellInt was
  // computed from the previous pass's value - so an exit by exhaustion (rather
  // than by convergence) left t_shell_internal keyed to one static head and
  // p_local_design holding another: 1.375012752 against a re-derived
  // 1.374999685, 9.5e-6 relative. One final pass at the FINAL static heads
  // makes the pair self-consistent whether or not the iteration settled.
  if (!converged && Number.isFinite(tShellInt) && Number.isFinite(tHeadReq)) {
    tShellInt = shellInternalThickness(inp.pressure + psShell, inp.diameter,
                                       inp.diameter_basis, S, E, CA);
    tHeadReq = isOD
      ? headOdThickness(inp.pressure + psHead, OD, headGeom, S_head, Eh, CA)
      : headInternalThickness(inp.pressure + psHead, inp.diameter + 2 * CA,
                              headGeom, S_head, Eh, CA);
    if (headGeom === "torispherical" && Number.isFinite(tHeadReq)) {
      const Lfin = isOD ? (OD - 2 * tHeadReq) : inp.diameter;
      tHeadReq = Math.max(tHeadReq, toriMinThickness(Lfin));
    }
    res.static_head_unconverged = true;
  }

  res.static_head_psi = psShell;
  res.p_local_design = inp.pressure + psShell;
  res.static_head_head_psi = psHead;
  res.p_local_head = inp.pressure + psHead;
  res.hs_shell_in = hsS;
  res.hs_head_in = hsH;

  res.t_shell_internal = tShellInt;
  res.t_shell_internal_full_rt = shellInternalThickness(res.p_local_design, inp.diameter, inp.diameter_basis, S, 1.0, CA);

  res.t_shell_required = Math.max(res.t_shell_internal, res.t_shell_external);
  res.governing = (res.t_shell_external > res.t_shell_internal && inp.ext_pressure > 0)
    ? "external pressure (provisional)" : "internal pressure";

  const bore_for_head = inp.diameter;
  res.t_head_internal = tHeadReq;
  // UG-33 external check for the head, mirroring the shell external check
  // (BUG-3 fix); uses the temperature-derated modulus and stays inside the
  // existing "external pressure is PROVISIONAL" caveat.
  res.t_head_external = headExternalThickness(
    inp.ext_pressure, trueOdConv, headGeom, matHead.modulusAt(inp.temp_F),
    S_head, CA, isOD ? null : inp.diameter + 2 * CA);
  res.t_head_required = Math.max(res.t_head_internal, res.t_head_external);

  // PER-COMPONENT selection: shell from its own snap; the closure is never
  // thinner than the shell wall. Pipe shells snap on the B36.10M schedule
  // series; WPB caps snap on the same series (whatever the shell is); plate
  // components snap on the 1/8" lattice.
  let pipeSchedule = null, capSchedule = null;
  if (pipe) {
    // 12.5% mill undertolerance: a schedule qualifies only if its
    // guaranteed-minimum wall (87.5% of nominal) covers the code minimum
    [pipeSchedule, res.t_shell_nominal] = nextPipeWall(
      pipeNps, res.t_shell_required / PIPE_WALL_AVAIL);
  } else {
    // plate shell: 3/8" shop floor applies
    res.t_shell_nominal = nextNominal(Math.max(res.t_shell_required, PLATE_MIN_GAUGE));
  }
  let tForm = null;
  if (headIsCap) {
    let capWall;
    // cap wall: guaranteed-minimum (87.5%) covers the head requirement, and
    // the cap is never NOMINALLY thinner than the shell wall
    [capSchedule, capWall] = nextPipeWall(
      pipeNps, Math.max(res.t_head_required / PIPE_WALL_AVAIL, res.t_shell_nominal));
    res.t_head_nominal = capWall;
  } else if (pipe) {
    // pipe shell + formed plate heads: physically DIFFERENT products, so a
    // shared gauge is impossible - the head plate carries the forming
    // allowance (and the 3/8" plate floor) and is never lighter than the
    // pipe wall.
    tForm = headFormingMinPlate(res.t_head_required, headGeom);
    res.t_head_nominal = nextNominal(Math.max(tForm, res.t_shell_nominal, PLATE_MIN_GAUGE));
  } else {
    // SHARED GAUGE (hard rule): shell and formed heads are ordered from ONE
    // plate thickness - no shell/head taper or transition. The shared gauge
    // must cover the shell's required minimum AND the head's post-forming
    // minimum (rule A 10%/12%/6% thinning, OR rule B flat 1/8" margin),
    // and never dips below the 3/8" plate floor.
    tForm = headFormingMinPlate(res.t_head_required, headGeom);
    let tShared = nextNominal(Math.max(res.t_shell_required, tForm, PLATE_MIN_GAUGE));
    // verify the shared plate survives forming (either acceptance path); on
    // any snapping edge case bump the SHARED gauge up - never split
    const fthin = HEAD_FORMING_THINNING[headGeom] ?? 0.10;
    for (let k = 0; k < 4; k++) {
      // NOT `ok` - that is the module-level null/inf sentinel helper. Block
      // scope makes this one harmless here, but the Python twin of this local
      // shadowed the helper for the rest of design_vessel and broke the
      // full-RT probe guard. Same name, same rename, both ports.
      const formingOk = tShared * (1.0 - fthin) >= res.t_head_required - 1e-9
        || tShared - res.t_head_required >= HEAD_FORMING_MARGIN_IN - 1e-9;
      if (formingOk) break;
      tShared = nextNominal(tShared + 1e-9);
    }
    res.t_shell_nominal = tShared;
    res.t_head_nominal = tShared;
  }
  res.t_nominal = Math.max(res.t_shell_nominal, res.t_head_nominal);
  // "Drives the plate": on the shared-gauge path, report which REQUIREMENT set
  // the shared plate (shell minimum vs head post-forming minimum) - or the
  // 3/8" shop floor itself, when both requirements sit below it; on the
  // product-split paths (pipe shell / cap closures), compare the nominals.
  if (!pipe && !headIsCap) {
    if (PLATE_MIN_GAUGE > Math.max(res.t_shell_required, tForm) + 1e-9) {
      res.drives_nominal = '3/8" min. gauge';
    } else {
      res.drives_nominal = res.t_shell_required >= tForm ? "shell" : "head";
    }
    res.thickness_transition = Math.abs(res.t_shell_nominal - res.t_head_nominal) > 1e-12;
  } else {
    res.drives_nominal = res.t_shell_nominal >= res.t_head_nominal ? "shell" : "head";
    res.thickness_transition = false;
  }

  const head_thin_wall_ok = bore_for_head >= 4 * res.t_head_required;
  // BUG-2 FIX: nextNominal() falls through above the largest stocked plate and
  // returns the RAW requirement, which used to be presented as a purchasable
  // plate and fed the optimizer, cut plan, weight and cost. Bail instead - the
  // stock list is NOT extended to hide the number. Pipe/cap paths are exempt:
  // their heavy-wall fallback is the explicit "custom" schedule.
  const MAX_STOCK = NOMINAL_THICKNESSES[NOMINAL_THICKNESSES.length - 1];
  // ROUND 15 ITEM 3 - THE GATE IS "IS THERE A FORMED PLATE COMPONENT?", NOT
  // "IS THIS THE PLATE PATH?". A pipe shell closed by FORMED PLATE HEADS has a
  // plate component: that head is ordered to a thickness off this very stock
  // list, so it is bounded by it. Gating on `!pipe && !headIsCap` exempted the
  // whole mixed build, and nextNominal() falls through above the 3.0" top and
  // returns the RAW requirement - so a 24" OD / 3000 psi / 300F 304 F&D head
  // printed 3.035446692824565" on an NPS 24 Sch 160 shell as an ordered plate.
  // The pipe/cap exemption is real but narrow: it covers the SCHEDULE products,
  // whose heavy-wall route is the explicit "custom" schedule.
  const formedPlateComponent = !pipe || !headIsCap;
  const overStock = formedPlateComponent && Number.isFinite(res.t_nominal)
    && res.t_nominal > MAX_STOCK + 1e-9;
  // TOO SMALL TO ROLL OR FORM (round 11). This is a SHOP CAPACITY question,
  // not a Code one: nobody rolls a 3.5" shell from half-inch plate, and nobody
  // forms a 2.375" ellipsoidal head. Below the floor the industry answer is
  // pipe and B16.9 caps, which this engine covers from NPS 2 - so the refusal
  // never strands a buildable vessel, it only refuses the PLATE-FORMED route.
  //
  // BOTH plate-formed operations are gated, independently:
  //   * a rolled plate SHELL - i.e. any construction that is not pipe. A plate
  //     shell with B16.9 caps still has to have its shell rolled; the caps are
  //     bought fittings and go down to NPS 2 happily, the shell is what stops.
  //   * a formed plate HEAD - i.e. any head that is not a cap. A pipe shell
  //     with 2:1 ellipsoidal plate heads at 8.625" is exactly the "nobody forms
  //     that head" case, and gating only the shell would have let it through.
  // Only pipe shell + cap heads clears both.
  //
  // Measured on the OUTSIDE diameter, because that is what the rolls and the
  // former see. On ID basis trueOdConv is the converged ID + 2t from the fixed
  // point above.
  const rolledShell = !pipe;
  const formedHead = !headIsCap;
  const tooSmallToRoll = (rolledShell || formedHead)
    && trueOdConv < PLATE_MIN_ROLL_DIAMETER - 1e-9;
  if (tooSmallToRoll) {
    const fl = String(PLATE_MIN_ROLL_DIAMETER);
    const parts = rolledShell && formedHead
      ? "a rolled plate shell and formed plate heads"
      : rolledShell ? "a rolled plate shell" : "formed plate heads";
    nullAllThicknesses(res);
    res.rt_note = "Not applicable: the diameter is below the smallest shell "
      + "this shop can roll or form.";
    res.notes.push(`Too small to roll: The vessel is ${trueOdConv.toFixed(3)} in outside `
      + `diameter, and ${parts} cannot be made below the ${fl} in minimum `
      + `this app assumes for plate rolling and head forming, so thickness, `
      + `geometry, weight, and plate results are not computed. Below ${fl} in `
      + `the trade builds from pipe with B16.9 caps, which this engine `
      + `carries from NPS 2 (2.375 in OD) up. This floor is a SHOP CAPACITY `
      + `default, not an ASME rule: if your roller and head former go `
      + `smaller, change PLATE_MIN_ROLL_DIAMETER.`);
    return res;
  }
  // UG-28 OUTSIDE THE ELASTIC CHART (round 15). The external solver returns
  // Infinity rather than throwing when the strain factor lands right of the
  // applicable Factor-B knee, because only the left-of-curve elastic formula is
  // implemented and the answer would be UNCONSERVATIVE there. Refuse the way
  // every other out-of-scope case is refused - a stale screen is worse than a
  // refusal, and that is exactly what the throw produced.
  if (inp.ext_pressure > 0 && !Number.isFinite(res.t_shell_external)) {
    const knee = aKneeFor(mat.key);
    nullAllThicknesses(res);
    res.rt_note = "Not applicable: the external-pressure check is outside "
      + "the implemented chart range.";
    res.notes.push(`Outside chart range: The UG-28 external-pressure solution for this `
      + `vessel lands RIGHT of the applicable Factor-B curve (strain factor `
      + `A above the ~${knee.toExponential(1)} knee for this material), where only the `
      + `inelastic branch is valid. This engine implements the left-of-curve `
      + `ELASTIC formula Pa = 2AE/(3(Do/t)) only, so an answer here would be `
      + `UNCONSERVATIVE, and thickness, geometry, weight, and plate results `
      + `are not computed. It is driven by a short unsupported length at a `
      + `large diameter and high external pressure: lengthen the vessel, `
      + `reduce the external pressure, or add stiffening rings (UG-29) to `
      + `cut the unsupported length. Building the Factor-B branch is the `
      + `real fix.`);
    return res;
  }
  // BUG-15: the pipe/cap path runs off the end of its OWN schedule table. The
  // snap now yields Infinity rather than inventing a wall, so this lands in the
  // bail - but say WHY, naming the heaviest published schedule.
  // BUG-15: the pipe/cap path has run off the end of its OWN schedule table.
  // The snap now yields Infinity rather than inventing a wall. Eli's decision
  // is to FALL BACK to plate shell + formed heads rather than refuse - and to
  // make that switch LOUD. We re-enter designVessel on the plate path so that
  // EVERYTHING re-derives there (material family, UCS-66 curve, PWHT
  // thresholds, RT rules, price basis, cut plan, supplier copy). Nothing is
  // patched onto the pipe result, so there is no half-swapped state. A pipe cap
  // is geometrically ~2:1, so it maps to an ellipsoidal formed head.
  if (pipe && pipeNps !== null && !ok(res.t_nominal)) {
    const heaviest = PIPE_WALLS[pipeNps][PIPE_WALLS[pipeNps].length - 1];
    const need = ok(res.t_shell_required) ? res.t_shell_required : null;
    const fb = designVessel({ ...inp, construction: "plate",
      head_joint_eff: origHeadJointEff,
      head_type: inp.head_type === "pipecap" ? "ellipsoidal" : inp.head_type });
    fb.construction_fallback = "pipe_over_schedule";
    // The plate route can itself be refused - most often because the vessel is
    // below the roll floor, which is exactly where an over-schedule pipe lands.
    // Do not claim a switch that did not happen.
    const fbRefused = fb.notes.some((n) => n.startsWith("Too small to roll:"));
    fb.notes.unshift(`Construction changed: No published NPS ${pipeNps} schedule `
      + `meets the `
      + (need !== null ? `${need.toFixed(3)} in required wall ` : `required wall `)
      + `(thickest is ${heaviest[0]}, ${heaviest[1].toFixed(3)} in, giving only `
      + `${(heaviest[1] * PIPE_WALL_AVAIL).toFixed(3)} in of design wall after the `
      + `12.5% mill undertolerance). `
      + (fbRefused
        ? `Plate shell + formed heads is the only route left and it is not `
          + `buildable at this diameter either - see below.`
        : `Switched to plate shell + formed heads, `
          + `${fb.material.name}. Every downstream result - MDMT curve, PWHT and `
          + `radiography rules, price basis and cut plan - is the PLATE one.`));
    return fb;
  }
  if (overStock && head_thin_wall_ok) {
    const need = res.t_nominal;
    res.t_required_unbuyable = need;
    nullAllThicknesses(res);
    res.rt_note = "Not applicable: required plate exceeds the largest stocked size.";
    res.notes.push(`Over stock: The required plate is ${need.toFixed(4)} in, which exceeds `
      + `the largest stocked plate (${MAX_STOCK.toFixed(3)} in). No purchasable plate `
      + `covers this design on the current stock list, so thickness, geometry, weight, `
      + `and plate results are not computed. Re-run at a lower pressure or larger `
      + `diameter, or source a heavier plate and add it to the stock list with a `
      + `reference.`);
    return res;
  }
  if (!Number.isFinite(res.t_nominal) || !head_thin_wall_ok) {
    nullAllThicknesses(res);
    res.rt_note = "Not applicable: wall exceeds thin-wall validity (t/R > 0.5).";
    res.notes.push("Out of range: The required wall exceeds thin-wall membrane validity "
      + "(t/R > 0.5 for the shell and/or head); thick-wall analysis "
      + "(ASME Appendix 1-2 / 1-3) is required. Thickness, geometry, "
      + "weight, and plate results are not computed.");
    return res;
  }

  const as_built_id = inp.diameter_basis.toUpperCase() === "OD" ? OD - 2 * res.t_shell_nominal : inp.diameter;
  res.id_inside = as_built_id;
  const ID = res.id_inside;

  // Full-RT plates via a REAL redesign (same static-head fixed point); also
  // track the shell's own plate - full RT can cut it with the headline
  // (head-plate) nominal unchanged.
  let nom_full_rt = res.t_nominal, shell_full_rt = res.t_shell_nominal;
  // Guard on the INPUT efficiency, not the derived E: on the pipe path E is a
  // product-form property, so guarding on E would never terminate.
  //
  // ROUND 13: THE AXIS DIFFERS BY PATH. "What would more radiography buy?" is a
  // question about the examination the vessel actually has. On the plate path
  // that is the Cat. A shop-seam RT level (joint_eff -> 1.0); on the pipe path
  // there IS no Cat. A shop seam, and the lever is the Cat. B cap-weld
  // examination (cap_weld_exam -> "full"). Recursing on joint_eff made the pipe
  // path's rt_note answer a question about a control it does not have. Both
  // recursions terminate: the redesigned vessel is already at the top of its
  // own axis and skips this branch.
  if (pipe && capExam !== "full") {
    const frt = designVessel({ ...inp, cap_weld_exam: "full" });
    nom_full_rt = frt.t_nominal; shell_full_rt = frt.t_shell_nominal;
  } else if (!pipe && inp.joint_eff < 1.0 - 1e-9) {
    const frt = designVessel({ ...inp, joint_eff: 1.0 });
    nom_full_rt = frt.t_nominal; shell_full_rt = frt.t_shell_nominal;
  }
  // ROUND 16 FOLLOW-UP: THE FULL-RT PROBE CAN ITSELF BAIL.
  // More radiography makes the wall THINNER, and one of our refusals keys off
  // the OUTSIDE diameter (ID + 2*t_shell), so a thinner wall can newly trip a
  // bail the base design cleared. Reproducer: 10.75 in ID / 17.75 in / 1305 psi
  // / carbon / plate / E=0.7 builds, but the E=1.0 probe drops the OD to
  // 11.750 in and hits PLATE_MIN_ROLL_DIAMETER, which nulls every thickness.
  // THIS PORT FAILS SILENTLY WHERE PYTHON THROWS: `null < x` coerces null to 0,
  // so the first branch was TAKEN and printed "Full radiography would allow
  // null in instead of ...". Exactly the isFinite(null)===true trap class.
  // A bailed probe is not evidence that radiography buys anything: at full RT
  // there is no buildable vessel at all, so fall through to "does not change".
  if (!(ok(nom_full_rt) && ok(shell_full_rt))) {
    nom_full_rt = res.t_nominal; shell_full_rt = res.t_shell_nominal;
  }
  if (nom_full_rt < res.t_nominal - 1e-9) {
    res.rt_note = `Full radiography would allow ${f4(nom_full_rt)} in instead of ` +
      `${f4(res.t_nominal)} in. The selected plate is set by the radiography level ` +
      `(E=${g(E)}), not by pressure alone.`;
  } else if (shell_full_rt < res.t_shell_nominal - 1e-9) {
    res.rt_note = `Full radiography would allow a ${f4(shell_full_rt)} in shell plate ` +
      `instead of ${f4(res.t_shell_nominal)} in (head plate unchanged). The shell ` +
      `plate is set by the radiography level (E=${g(E)}), not by pressure alone.`;
  } else {
    // PRODUCT NOUN inside NOTE COPY - the round-7 accessor only reached labels,
    // so this string still said "plate" on the pipe path.
    res.rt_note = "Radiography level does not change the selected "
      + productNouns(pipe, headIsCap).selection + " here.";
  }

  // MAWP back-check in the corroded condition, PER COMPONENT.
  // Schedule products are rated on the DESIGN wall (87.5% of nominal after the
  // mill undertolerance), never the nominal we bought; the corroded radius
  // moves out with the metal that may be missing.
  const tShellDesign = res.t_shell_nominal * (pipe ? PIPE_WALL_AVAIL : 1.0);
  const tHeadDesign = res.t_head_nominal * (headIsCap ? PIPE_WALL_AVAIL : 1.0);
  res.t_shell_design = tShellDesign;
  res.t_head_design = tHeadDesign;
  const R_corr = ID / 2.0 + (res.t_shell_nominal - tShellDesign) + CA;
  res.mawp_shell = mawpShell(S, E, tShellDesign - CA, R_corr);
  res.mawp_head = mawpHead(S_head, Eh, tHeadDesign - CA, ID + 2 * res.t_shell_nominal, headGeom);

  const shell_vol = PI * Math.pow(ID / 2.0, 2) * inp.length;
  const head_bore = inp.diameter_basis.toUpperCase() === "OD"
    ? OD - 2 * res.t_head_nominal
    : inp.diameter + 2 * res.t_shell_nominal - 2 * res.t_head_nominal;
  const total_vol = shell_vol + 2 * headInternalVolume(head_bore, headGeom);
  res.volume_gal = total_vol / 231.0;

  const true_OD = inp.diameter_basis.toUpperCase() === "OD" ? inp.diameter : inp.diameter + 2 * res.t_shell_nominal;

  // PER-COMPONENT weight: shell at ITS OWN plate, heads at THEIRS.
  const shell_wt_plate = PI * (true_OD - res.t_shell_nominal) * inp.length * res.t_shell_nominal * mat.density;
  const heads_wt = 2 * headFormedWeight(true_OD, res.t_head_nominal, headGeom, matHead.density);
  res.weight_empty = shell_wt_plate + heads_wt;
  const liquid_wt = inp.fill_fraction * total_vol * (inp.fluid_sg * WATER_LB_IN3);
  res.weight_full = res.weight_empty + liquid_wt;

  // Buy analysis. Plate shell: optimizer + drop. Pipe shell: one NPS length
  // of ERW pipe (no drop). WPB-cap closures attach schedule bookkeeping
  // either way.
  if (pipe) {
    res.plate = pipeBuy(pipeNps, true_OD, res.t_shell_nominal, pipeSchedule,
                        headIsCap ? res.t_head_nominal : null, capSchedule,
                        headIsCap ? pipeNps : null,
                        inp.length, mat.density, inp.price_per_lb, inp.material,
                        cutLengthForPipe(inp.length, pipeNps,
                                         true_OD - 2 * res.t_shell_nominal, headIsCap));
  } else {
    res.plate = optimizePlate(true_OD, res.t_shell_nominal, inp.length, mat.density, inp.price_per_lb,
      STOCK_PLATES_BY_MATERIAL[inp.material] || STOCK_PLATES_CARBON);
    if (headIsCap) {
      res.plate.cap_nps = pipeNps;
      res.plate.cap_schedule = capSchedule;
      res.plate.cap_wall = res.t_head_nominal;
    }
  }

  res.notes.push("Preliminary sizing only. Not a stamped calculation "
    + "(no UG-37 nozzle reinforcement, MDMT, wind, seismic, or supports).");
  if (odSnap !== null) {
    const [rq, nps2, od2, below] = odSnap;
    const pct = rq > 0 ? (od2 - rq) / rq * 100.0 : 0.0;
    const alt = below
      ? ` The next size DOWN is NPS ${below[0]} at ${g(below[1])}\u2033 OD, which is `
        + `below your ${g(rq)}\u2033 - pick it deliberately if a smaller vessel is `
        + `acceptable.`
      : " There is no smaller stocked pipe size.";
    res.notes.push(`Diameter snapped up: You asked for ${g(rq)}\u2033, and pipe is an `
      + `OD-controlled product, so this is built as NPS ${nps2} at ${g(od2)}\u2033 OD `
      + `(${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%). CAPACITY, WEIGHT, MAWP AND COST `
      + `ALL FOLLOW THE BUILT ${g(od2)}\u2033 SIZE, not the ${g(rq)}\u2033 you typed.${alt}`);
  }
  if (headGeom === "torispherical" && Number.isFinite(res.t_head_required)) {
    const Lnote = isOD ? (OD - 2 * res.t_head_required) : res.id_inside;
    const floor = toriMinThickness(Lnote);
    const mem = isOD
      ? headOdThickness(res.p_local_head, OD, "torispherical", S_head, Eh, CA)
      : headInternalThickness(res.p_local_head, inp.diameter + 2 * CA,
                              "torispherical", S_head, Eh, CA);
    if (floor > 0 && Number.isFinite(mem) && floor > mem + 1e-9) {
      res.notes.push(`Torispherical lower limit: Appendix 1-4(f) applies an `
        + `ADDITIONAL mandatory rule to a torispherical head once t/L falls `
        + `below ${TORI_MIN_T_OVER_L} - the knuckle has to be checked against `
        + `buckling, and the 1-4(d) membrane formula alone is not the whole `
        + `answer there. That procedure is NOT implemented here. This head is `
        + `therefore floored at t = ${TORI_MIN_T_OVER_L}L = ${f4(floor)} in `
        + `(L = ${Lnote.toFixed(3)} in inside crown radius) instead of the `
        + `${f4(mem)} in the membrane formula alone would give - a DELIBERATELY `
        + `CONSERVATIVE substitute for the real check, not a computed 1-4(f) `
        + `result. Run the 1-4(f) knuckle procedure before designing to it.`);
    }
  }
  if (pipe) {
    res.notes.push("Pipe shell: SA-53 Gr. B (the II-D product weld factor is "
      + "inside the allowable stress; the UW-12(d) hoop quality factor is "
      + "applied separately - see the S / E line). Walls snap to B36.10M "
      + "schedules.");
  }
  if (headIsCap) {
    res.notes.push("Closures are seamless SA-234 WPB caps (~2:1 ellipsoidal, "
      + "B16.9), snapped to B36.10M schedule walls.");
  }
  // The UG-28 solver is NO LONGER called provisional: it was validated against
  // a COMPRESS package once the unsupported length was corrected. What IS
  // still flagged is the pipe path, where the B16.9 cap line of support cannot
  // be placed without sourced cap-length data.
  if (res.ext_length_flagged) {
    res.notes.push(`External pressure on the PIPE path uses L = tan-to-tan `
      + `(${res.ext_length_used.toFixed(2)} in) and is therefore UNDERSTATED. `
      + "UG-28 measures L between lines of support, one third of the depth "
      + "into each closure; for a B16.9 cap that offset needs the cap length "
      + "from B16.9, which is not sourced here. Verify externally.");
  } else if (inp.ext_pressure > 0) {
    res.notes.push(`External pressure per UG-28 at L = ${res.ext_length_used.toFixed(2)} in `
      + "(tan-to-tan plus one third of each head depth, per the lines of "
      + "support). Windenburg-Trilling elastic model, design factor 3.");
  }
  if (idFallbackNote) { res.notes.unshift(idFallbackNote); res.construction_fallback = "id_no_standard_od"; }
  const _n = productNouns(pipe, headIsCap);
  res.notes.push(`Empty weight is ${_n.assembly} (${_n.weight_basis}). `
    + "Attachments, nozzles, and supports typically add 10-15%.");
  return res;
}
