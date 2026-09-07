// ASME UCS code-compliance assessment, layered on the (validated) sizing result.
// Covers: MDMT / impact-test screening (UCS-66, UCS-66.1, UG-20(f)/UHA-51),
// normalizing + PWHT thresholds (UCS-56 / stated shop practice), mandatory
// full radiography by thickness (UCS-57 / UHA-33), and the per-seam radiography
// designation (UW-11 / UW-12 joint types).
//
// PRELIMINARY screening. The UCS-66 exemption temperatures here are an APPROXIMATE
// digitization of Fig. UCS-66 (same spirit as the approximate II-D stress tables);
// confirm every MDMT / impact / PWHT / RT call against the actual ASME charts and
// tables before design.

// The UW-12(d) hoop quality factor and the Cat. B cap-weld examination ladder
// live in engine.js (single source of truth, mirroring assessment.py).
import { pipeHoopEfficiency, capWeldLongEfficiency, CAP_EXAM_LEVELS, ok } from "./engine.js";

// ---- UCS-56 / Table UCS-56-1, P-No. 1 Gr. 1 & 2 (BUG-1 FIX) ----
// PWHT is governed by a THICKNESS BAND, not a single threshold:
//   * at or below 1-1/4" nominal         -> PWHT not required
//   * over 1-1/4" through 1-1/2" nominal -> PWHT required UNLESS >= 200 F
//                                           preheat is maintained while welding
//   * over 1-1/2" nominal                -> PWHT ALWAYS required, preheat
//                                           is irrelevant above this point
// The previous single constant (1.375") let the preheat exemption run to any
// thickness, so a 2.75" plate reported "PWHT: not required" and the shell
// ticket omitted mandatory PWHT entirely.
// SOURCING: the band edges are corroborated by four independent restatements
// of Table UCS-56-1 for P-No. 1 Gr. 1 and 2 - including a direct quote of the
// note ("1-1/4 in. (32 mm) nominal thickness through 1-1/2 in. (38 mm)
// nominal ... preheat to a minimum temperature of 200 F (95 C) is applied")
// and Note (2)(a) making PWHT mandatory over 1-1/2 in. (38 mm). The PRIMARY
// code text is not in this workspace - verify before design.
// SCOPE (documented, deliberately NOT coded around): this is the P-No. 1
// Gr. 1 & 2 provision, and SA-516-70 is P-No. 1 Gr. 2, so it applies to the
// only carbon grade this engine offers. Gr. 3 carries a lower limit, and one
// source hints at an additional carbon-content proviso on the exemption that
// could not be pinned down.
export const PWHT_EXEMPT_THICK = 1.25;      // at or below: no PWHT
export const PWHT_MANDATORY_THICK = 1.50;   // above: PWHT regardless of preheat

// HOUSE CONVENTION (NOT an ASME rule): plate thicker than this is ordered
// NORMALIZED. Normalizing is a material supply condition, not a thickness-
// triggered code requirement. Kept because it reflects shop practice, but
// deliberately DECOUPLED from the PWHT band so the two cannot drift together.
// The UCS-66 Curve D credit it unlocks is only taken when normalizing is
// actually applied, i.e. when it also appears on the procurement ticket.
export const NORMALIZE_HOUSE_THICK = 1.375;
// Mirror of engine PIPE_WALL_AVAIL: schedule products (pipe, B16.9 caps) are
// assessed on 87.5% of the nominal wall (12.5% mill undertolerance).
const PIPE_WALL_AVAIL = 0.875;
// UCS-57 / UHA-33 (approx): carbon 1.25", any austenitic SS grade 1.5"
export const FULL_RT_THICK = { carbon: 1.25, stainless304: 1.5, stainless: 1.5,
                               stainless316: 1.5, stainless316L: 1.5 };

// UCS-66 exemption MDMT (degF) vs governing thickness (in), per curve.
// Curve B is the Table UCS-66 tabular series (COMPRESS-verified: B @ 0.75" = 15°F,
// matching a COMPRESS 2026 calc report to 0.1°F end-to-end). A/C/D remain
// approximate digitizations of Fig. UCS-66 — verify against the code figure.
const UCS66 = {
  A: [[0.394, 18], [0.5, 32], [0.75, 53], [1.0, 68], [1.5, 90], [2.0, 104], [3.0, 122], [4.0, 134]],
  B: [[0.394, -20], [0.5, -7], [0.625, 5], [0.75, 15], [0.875, 23], [1.0, 31],
      [1.25, 42], [1.5, 51], [1.75, 59], [2.0, 66], [2.5, 76], [3.0, 84], [4.0, 96]],
  C: [[0.394, -55], [0.5, -40], [0.75, -22], [1.0, -8], [1.5, 14], [2.0, 30], [3.0, 50], [4.0, 64]],
  D: [[0.394, -55], [0.5, -55], [0.75, -48], [1.0, -35], [1.5, -12], [2.0, 4], [3.0, 28], [4.0, 45]],
};

function interp(tbl, x) {
  if (x <= tbl[0][0]) return tbl[0][1];
  if (x >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [a, va] = tbl[i], [b, vb] = tbl[i + 1];
    if (a <= x && x <= b) return va + (vb - va) * (x - a) / (b - a);
  }
  return tbl[tbl.length - 1][1];
}

// UW-11 / UW-12 designations. Longitudinal (Cat. A) seam = Type 1; circumferential
// (Cat. B) seam = Type 2, per the requested shop convention.
const RT_DESIGNATION = {
  long: {
    none: "No RT — Type 1 (E = 0.70)",
    spot: "Spot UW-11(b), Type 1 (E = 0.85)",
    full: "Full UW-11(a), Type 1 (E = 1.00)",
  },
  circ: {
    none: "No RT — Type 2 (E = 0.65)",
    spot: "Spot UW-11(a)(5)(b), Type 2 (E = 0.80)",
    full: "Full UW-11(a), Type 2 (E = 0.90)",
  },
};
export function rtLevel(E) { return E >= 0.999 ? "full" : (E >= 0.8 ? "spot" : "none"); }

// ---- CATEGORY B CAP-WELD DESIGNATIONS (PIPE PATH) - ROUND 13 ----
//
// The Cat. B line used to be RT_DESIGNATION.circ[rtLevel(joint_eff)], which is
// wrong twice over on a pipe body: it keys on the Cat. A radiography level - a
// control that does not apply and that the UI hides there - and it hardcodes
// the Type 2 column even when the cap weld is Type 1. CAP_EXAM_LEVELS has FOUR
// levels and that table has three, so an A5b selection printed the no-RT line
// and looked like nothing had been ordered at all.
//
// UW-52(b)(4) is why "a5b" and "spot" are different rows and not the same one:
// the radiograph taken to satisfy UW-11(a)(5)(-b) cannot also be counted as a
// spot radiograph, so the A5b level does not earn the RT-3 marking and the
// spot+A5b level has to pay for both films.
const CAP_EXAM_DESIGNATION = {
  none: "No RT",
  a5b: "UW-11(a)(5)(-b) quality spot only - not RT-3 (UW-52(b)(4))",
  spot: "Spot UW-11(b) + UW-11(a)(5)(-b) quality spot",
  full: "Full UW-11(a)",
};
const CAP_WELD_TYPE_LABEL = { type1: "Type 1", type2: "Type 2" };
// There is no Category A shop seam on a pipe body: the long seam is a MILL seam
// whose quality is already inside the SA-53B / SA-312 allowable stress.
const PIPE_NO_CAT_A_LONG = "No Cat. A shop seam - mill pipe body (weld factor in S)";

// Category B line for a cap-to-shell weld: designation, Table UW-12 column, and
// the E_L that column actually yields at this examination.
export function capWeldCircDesignation(capWeldType, capExam) {
  const e = capWeldLongEfficiency(capWeldType, capExam);
  const d = CAP_EXAM_DESIGNATION[capExam] ?? CAP_EXAM_DESIGNATION.none;
  const t = CAP_WELD_TYPE_LABEL[capWeldType] ?? "Type 2";
  return `${d}, ${t} (E = ${e.toFixed(2)})`;
}

// Requested diameter inside the standard-OD product bracket (28" and below,
// inclusive - 30" is plate; on OD basis also >= the smallest stocked pipe OD,
// 6.625" NPS 6). Mirrors the engine's pipe/cap eligibility gate.
function stdOdBracket(inp) {
  let ok = inp.diameter <= 28.0 + 1e-9;
  // THE FLOOR APPLIES ON BOTH BASES (round 9 part 2). It used to be tested only
  // on OD, so the ID path had NO minimum: a 2" ID request was served by NPS 6
  // with a 6.065" as-built bore - three times the requested bore and about nine
  // times the capacity. On ID basis the floor is the LARGEST bore the smallest
  // stocked size can offer (NPS 6 at its thinnest stocked wall,
  // 6.625 - 2 x 0.280 = 6.065").
  if (inp.diameter_basis.toUpperCase() === "OD") ok = ok && inp.diameter >= 2.375 - 1e-9;
  else ok = ok && inp.diameter >= 2.157 - 1e-9;
  return ok;
}

export function assessVessel(res, inp, opts = {}) {
  const a = { notes: [] };
  const bailed = res.plate === null || !ok(res.t_nominal);
  const t = bailed ? null : res.t_nominal;
  const carbon = inp.material === "carbon";
  const reqMdmt = inp.required_mdmt ?? -20;
  const weldPreheat = !!inp.weld_preheat;
  // Standard-OD products (28" and below, carbon AND stainless): pipe SHELL is
  // sized at E = 1.0 (the weld factor lives in the SA-53B / SA-312
  // allowable-stress line); B16.9 cap CLOSURES (head_type "pipecap") are
  // seamless regardless of the head-seam input. The two are independent.
  const small = stdOdBracket(inp);
  const pipe = inp.construction === "pipe" && small;
  const capHeads = inp.head_type === "pipecap" && small;

  // ---- radiography designations (reflect the FINAL, possibly enforced, level) ----
  const lvl = rtLevel(inp.joint_eff);
  const fullThick = FULL_RT_THICK[inp.material] ?? 1.25;
  // UCS-57 tests the thickness AT THE WELDED JOINT: the shell's Cat. A seam is
  // at the shell's own plate; a seamless head has no Cat. A butt weld.
  // STRICTLY exceeds (with epsilon): exactly 1.250" carbon / 1.500" SS equals
  // the limit and does NOT trigger mandatory full RT.
  const seamlessHead = capHeads || inp.head_joint_eff >= 1.0 - 1e-9;
  const tWeld = bailed ? null
    : (seamlessHead ? res.t_shell_nominal : Math.max(res.t_shell_nominal, res.t_head_nominal));
  // ROUND 13. EVERY RADIOGRAPHY FIGURE FOLLOWS THE AXIS THAT EXISTS.
  // On the pipe path the examined weld is the Category B cap-to-shell weld and
  // the control is cap_weld_exam; there is no Category A shop seam and
  // joint_eff describes nothing. Keying these off joint_eff let an invisible
  // control set the Cat. B designation and the whole NDE bill, while the two
  // visible cap controls moved neither.
  const capExamR = inp.cap_weld_exam ?? "none";
  const capTypeR = inp.cap_weld_type ?? "type2";
  // ROUND 15 ITEM 2. "Pipe" is NOT the same question as "no Category A seam".
  // UW-3(a)(1) puts any welded joint WITHIN a formed head in Category A, so a
  // pipe shell closed by a WELDED formed plate head has a real Cat. A
  // meridional seam - its own Table UW-12 efficiency, and Table UCS-57
  // mandatory full RT reaches it. Only the ERW MILL seam has no category.
  // engine.js already sizes that head on joint_eff via pipeHeadEfficiency();
  // this layer did not, so it printed "no Cat. A shop seam", reported the
  // cap-exam level and quoted $0 radiography on a vessel whose head plate is a
  // direct function of that seam's RT - 0.625" at no RT against 0.375" at full
  // RT, a 40% cut, at 12" OD / 600 psi F&D.
  const catASeam = !pipe || (inp.head_type !== "pipecap"
                             && inp.head_joint_eff < 1.0 - 1e-9);
  a.rt = {
    level: catASeam ? lvl : capExamR,
    long: catASeam ? RT_DESIGNATION.long[lvl] : PIPE_NO_CAT_A_LONG,
    circ: pipe ? capWeldCircDesignation(capTypeR, capExamR) : RT_DESIGNATION.circ[lvl],
    fullRequiredAbove: fullThick,
    fullRequired: !bailed && tWeld > fullThick + 1e-9,
    enforcedFull: !!opts.rtEnforced,
    enforcedFrom: opts.rtEnforcedFrom ?? null,
    // The NDE bill the auto-RT selector already pays for this level. It was
    // computed and then thrown away - the selector weighed it against the
    // steel saving but nothing ever showed the user the number, so a level
    // that "buys plate" looked free. Surfaced here with the seam footage
    // behind it so the trade is auditable.
    // (c) A pipe vessel with a WELDED formed head pays for BOTH: the Cat. B
    // cap-weld examination AND the Cat. A head meridional seam. rtSeamFeet
    // already returns that head footage; capExamNdeCost threw it away, so the
    // bill read $0 on a seam the design depends on.
    ndeCost: bailed ? 0.0
      : (pipe ? capExamNdeCost(res, capExamR)
                + (catASeam ? headSeamNdeCost(res, inp.joint_eff) : 0.0)
              : rtNdeCost(res, inp.joint_eff)),
    seamFt: bailed ? [0.0, 0.0] : rtSeamFeet(res),
  };

  // ---- normalizing + PWHT thresholds (carbon PLATE only) ----
  // PLATE-ONLY thickness rules key on the thickest PLATE component. Schedule
  // products - pipe shells, B16.9 caps - are NOT plate: SA-53B / SA-234 WPB /
  // SA-312 / SA-403 are not supplied "normalized" and the SA-516-70 supply
  // rule does not reach them.
  const hasPlate = !(pipe && capHeads);
  const tPlate = (bailed || (pipe && capHeads)) ? null   // no plate component
    : pipe ? res.t_head_nominal                          // formed plate heads
    : capHeads ? res.t_shell_nominal                     // rolled plate shell
    : t;
  // HOUSE CONVENTION (not ASME) - see NORMALIZE_HOUSE_THICK above.
  a.normalizedRequired = carbon && tPlate !== null && tPlate > NORMALIZE_HOUSE_THICK;
  a.normalizedIsHouseRule = true;
  // SA-516-70 PWHT is mandatory above the threshold, EXCEPT when a weld preheat
  // at >= 200°F (95°C) is applied during welding, which satisfies the requirement
  // in lieu of PWHT (so PWHT is not forced/flagged). Normalizing is unaffected.
  // UCS-56 band: preheat can only buy the 1-1/4" -> 1-1/2" window.
  a.pwhtRequired = carbon && tPlate !== null && (
    tPlate > PWHT_MANDATORY_THICK + 1e-9
    || (tPlate > PWHT_EXEMPT_THICK + 1e-9 && !weldPreheat));
  a.pwhtPreheatExemptBand = [PWHT_EXEMPT_THICK, PWHT_MANDATORY_THICK];
  // The thickness the UCS-56 band rules key on, surfaced so the UI can lock the
  // merged PWHT / preheat control to the same bands instead of re-deriving
  // (and drifting from) this logic.
  a.pwhtGoverningThickness = tPlate;
  a.weldPreheat = weldPreheat;
  const userNormalized = inp.material_condition === "normalized";
  // PREHEAT AND PWHT ARE MUTUALLY EXCLUSIVE (round 8). They are alternatives
  // under UCS-56, not a combination, and the rule is enforced HERE rather than
  // only in the widget - otherwise the engine happily builds the very vessel
  // the rule forbids. A preheat selection forbids an ELECTED PWHT; it does NOT
  // override a MANDATED one (above 1-1/2" PWHT is required whatever the
  // preheat, and the mandate wins).
  const userPwht = inp.pwht === "pwht" && !weldPreheat;
  // Baseline treatment from the user's picks + code-required thickness rules.
  // normalizing is meaningful only where a plate component exists
  const baseNorm = carbon && hasPlate && (userNormalized || a.normalizedRequired);
  // UCS-68(c)/68.2 30°F credit applies only to VOLUNTARY PWHT (none when PWHT is
  // code-required by thickness — the job-12071 fix).
  const basePwhtCredit = userPwht && !a.pwhtRequired;
  // Final applied treatment. The carbon MDMT logic below can escalate these
  // (normalize, then PWHT) as a LAST-RESORT alternative to impact testing.
  let aNormalized = baseNorm;
  let aPwht = userPwht || a.pwhtRequired;

  // ---- MDMT / impact testing (UG-20(f), then UCS-66 — COMPRESS methodology) ----
  if (!carbon) {
    a.mdmt = {
      austenitic: true, impactRequired: reqMdmt < -320, allowable: -320,
      normalizeApplied: false, pwhtApplied: false, forceNormalize: false, forcePwht: false,
      summary: `Austenitic SS: impact testing not required for MDMT ≥ -320°F (UHA-51(d); UHA-51(g)(3)(a)(1) in 2021+ editions, C ≤ 0.10%).`,
    };
  } else if (bailed) {
    a.mdmt = { impactRequired: false, allowable: null, normalizeApplied: false, pwhtApplied: false, forceNormalize: false, forcePwht: false, summary: "—" };
  } else {
    // (1) UG-20(f) blanket exemption, checked FIRST (as COMPRESS does): P-No. 1
    // Gr. 1/2 material (SA-516-70), governing thickness <= 1" (Curve B/C/D),
    // design MDMT no colder than -20°F, design temp <= 650°F. (Also assumes the
    // vessel is hydrotested per UG-99(b) and shock/cyclic loads do not govern.)
    const ug20f = t <= 1.0 && reqMdmt >= -20 && inp.temp_F <= 650;

    // (2) UCS-66 + UCS-66.1 stress-ratio reduction, per component (COMPRESS-exact):
    // Rts = tr*E*/(tn - c); TR = (1 - Rts)*100°F; rated = max(curve - TR - TPWHT,
    // -55); full exemption (-155) when Rts <= 0.35.
    // E* = the efficiency USED to size the head, floored at 0.80 (mirrors engine
    // headEfficiency): seamless (incl. pipe caps) = 1.0 spot/full RT, 0.85 no-RT
    // (UW-12(d)); welded = shell RT category.
    const headEStar = seamlessHead
      ? (inp.joint_eff >= 0.85 - 1e-9 ? 1.0 : 0.85)
      : Math.max(inp.joint_eff, 0.80);
    // Rate the whole vessel at a treatment: normalize -> Curve D (else B); PWHT
    // credit -> −30°F. TRULY per component (each read at its OWN as-built plate;
    // each ratio denominator its OWN corroded wall).
    // Normalizing is a PLATE (SA-516-70 supply condition) concept: pipe-shell
    // and cap components are SA-53B / SA-234 WPB / SA-312 / SA-403 product
    // CURVE B BASIS - Figure UCS-66 General Note (2)(c): the Curve B list
    // includes "all pipe, fittings, forgings and tubing not listed for Curves
    // C and D". SA-53 Gr. B Type E is pipe, SA-234 WPB is a fitting, and
    // neither appears in the Curve C or D lists. Corroborated independently by
    // a COMPRESS report assigning Curve B to the WPB cap straight flange.
    // CURVE A WOULD BE THE UNCONSERVATIVE ERROR here and is the one a careless
    // refactor would introduce.
    // forms PINNED to Curve B - a plate-condition toggle must never upgrade
    // them to Curve D.
    const rateAt = (useNorm, useCredit) => {
      const curve = useNorm ? "D" : "B";
      const tpwht = useCredit ? 30 : 0;
      const one = (tg, tr, eStar, pinnedB = false, sched = false) => {
        const baseC = interp(UCS66[pinnedB ? "B" : curve], tg);
        // schedule products: the ratio's available wall carries the 12.5%
        // mill undertolerance (the curve is read at nominal tg)
        const avail = tg * (sched ? PIPE_WALL_AVAIL : 1.0) - inp.corrosion;
        const rts = avail > 0 ? Math.min(Math.max(tr * eStar / avail, 0), 1) : 1;
        const r = rts <= 0.35 ? -155 : Math.max(baseC - (1 - rts) * 100 - tpwht, -55);
        return { rts, rated: r, base: baseC };
      };
      // E* = the efficiency USED TO SIZE the component. A pipe shell is sized
      // at the UW-12(d) circumferential E (FACTOR 2: 1.0 with spot/full RT of
      // the Cat. B seams, 0.85 without); the II-D product factor (FACTOR 1)
      // lives inside S and never enters E*.
      // mirrors the engine's UW-12(d) hoop quality factor, which is keyed to
      // the Cat. B cap-weld examination for BOTH product forms
      const pipeEStar = pipeHoopEfficiency(inp.cap_weld_exam ?? "none");
      const shell = one(res.t_shell_nominal, res.t_shell_required - inp.corrosion,
                        pipe ? pipeEStar : Math.max(inp.joint_eff, 0.80), pipe, pipe);
      const head = one(res.t_head_nominal, res.t_head_required - inp.corrosion,
                       headEStar, capHeads, capHeads);
      const curveRated = Math.max(shell.rated, head.rated);  // warmest component rates the vessel
      const allowable = ug20f ? Math.min(-20, curveRated) : curveRated;
      const governs = shell.rated >= head.rated ? shell : head;
      // an all-pipe/cap vessel is Curve B whatever the toggle says
      return { curve: hasPlate ? curve : "B", tpwht, shell, head, curveRated, allowable, governs };
    };

    // (3) Normalizing + PWHT are tried BEFORE impact testing (impact = LAST
    // resort). Escalation ladder, least-aggressive first: as-selected ->
    // normalize -> normalize + PWHT. The first rung whose rated MDMT meets the
    // requirement wins. If even the top rung fails, impact testing is required
    // (and we commit to normalize + PWHT on top of it).
    // The ladder may elect PWHT for the UCS-68(c) credit ONLY when PWHT is
    // neither already code-required NOR ruled out by a preheat selection.
    // Without the preheat clause the ladder elected PWHT on top of preheat -
    // preheat lifts the UCS-56 mandate, which makes the credit allowable - and
    // the vessel ended up with BOTH treatments, dodging the very cost the
    // mutually-exclusive control was supposed to make us pay.
    const topCredit = (a.pwhtRequired || weldPreheat) ? basePwhtCredit : true;
    // normalizing rungs exist only where a plate component can be normalized;
    // an all-pipe/cap vessel escalates on the PWHT credit alone
    const ladder = hasPlate
      ? [[baseNorm, basePwhtCredit], [true, basePwhtCredit], [true, topCredit]]
      : [[false, basePwhtCredit], [false, topCredit]];
    const base = rateAt(baseNorm, basePwhtCredit);   // as-selected -> curveRated for reporting
    let chosen = null, chosenNorm = true, chosenCredit = topCredit;
    for (let i = 0; i < ladder.length; i++) {
      const cand = rateAt(ladder[i][0], ladder[i][1]);
      if (reqMdmt >= cand.allowable - 1e-9) {
        chosen = cand; chosenNorm = ladder[i][0]; chosenCredit = ladder[i][1];
        break;
      }
    }
    let impactRequired = false;
    if (chosen === null) {
      const tn = hasPlate;   // impact fallback commits to the top rung
      chosen = rateAt(tn, topCredit); chosenNorm = tn; chosenCredit = topCredit;
      impactRequired = true;
    }

    // Treatment the MDMT logic applied beyond the user/code baseline (used for
    // procurement notes + the summary "applied" wording).
    const normalizeApplied = !baseNorm && chosenNorm;
    const pwhtApplied = !basePwhtCredit && !a.pwhtRequired && chosenCredit;
    aNormalized = carbon && (baseNorm || chosenNorm);
    aPwht = userPwht || a.pwhtRequired || pwhtApplied;

    // Selection-independent "is this treatment code-mandated to avoid impact?"
    // signals for the UI to auto-apply + lock the segs. Evaluated at fixed
    // treatments (never keyed on the current seg value), so locking one control
    // can't flip-flop the other: normalizing (B->D) is always a bigger shift than
    // the 30°F PWHT credit, so needing PWHT implies needing normalizing too.
    const forceNormalize = hasPlate
      && (impactRequired || reqMdmt < rateAt(false, basePwhtCredit).allowable - 1e-9);
    const forcePwht = impactRequired || reqMdmt < rateAt(hasPlate, false).allowable - 1e-9;

    const govR = base.governs.rts, govBase = base.governs.base;
    const applied = [normalizeApplied ? "normalized (Curve D)" : "", pwhtApplied ? "PWHT" : ""].filter(Boolean).join(" + ");
    a.mdmt = {
      curve: chosen.curve, exemptTemp: govBase, ratio: govR, allowable: chosen.allowable,
      impactRequired, ug20f, curveRated: base.curveRated,
      normalizeApplied, pwhtApplied, forceNormalize, forcePwht,
      summary: impactRequired
        ? (hasPlate
          ? `Impact test required — even normalized + PWHT rates the vessel to only ${Math.round(chosen.allowable * 10) / 10}°F, warmer than the required MDMT ${reqMdmt}°F (Curve ${chosen.curve}, UCS-66/66.1). Normalizing + PWHT are already applied.`
          : `Impact test required — even with the PWHT credit this pipe/cap vessel rates to only ${Math.round(chosen.allowable * 10) / 10}°F, warmer than the required MDMT ${reqMdmt}°F (Curve B product forms, UCS-66/66.1; normalizing does not apply to pipe or B16.9 fittings).`)
        : (ug20f && base.curveRated > -20
          ? `Impact testing not required — exempt per UG-20(f) at MDMT ${reqMdmt}°F (P-No. 1, tg ${t}" ≤ 1", MDMT ≥ -20°F, hydrotested).`
          : (applied
            ? `Impact testing not required — plate ${applied} rates the vessel to ${Math.round(chosen.allowable * 10) / 10}°F ≥ required ${reqMdmt}°F, avoiding impact testing (UCS-66/66.1).`
            : `Impact testing not required — MDMT ${reqMdmt}°F ≥ rated ${Math.round(chosen.allowable * 10) / 10}°F (Curve ${chosen.curve}${basePwhtCredit ? " + PWHT credit" : ""}, ratio ${govR.toFixed(2)}, UCS-66/66.1).`)),
      remedies: impactRequired
        ? (hasPlate
          ? "The plate is already normalized and PWHT'd; to avoid impact testing, add wall to lower the stress ratio or perform Charpy impact testing per UG-84."
          : "Pipe and B16.9 fittings cannot be normalized to a better UCS-66 curve; to avoid impact testing, add wall to lower the stress ratio or perform Charpy impact testing per UG-84.")
        : "",
    };
  }
  a.normalized = aNormalized;
  a.pwht = aPwht;
  return a;
}

// Apply the code design rule that mandatory full RT (UCS-57) can change the wall.
// UCS-57 applies when the thinner member at the butt weld STRICTLY exceeds the
// threshold (exactly 1.250" carbon / 1.500" SS equals the limit and does not
// count — strict > with epsilon). If the weld at the user's selected RT level
// exceeds the limit, the shell is re-sized at full RT (E=1.0): that is the only
// code-legal design, and it is kept even when the full-RT plate lands exactly
// ON the limit (e.g. 1.375" spot -> 1.250" full). The triggering
// pre-enforcement thickness is passed through so the note reads honestly.
export function designWithCodeRules(design, inp) {
  const EPS = 1e-9;
  let r = design(inp);
  let rtEnforced = false, enforcedFrom = null;
  const fullThick = FULL_RT_THICK[inp.material] ?? 1.25;
  const seamlessHead = (inp.head_type === "pipecap" && stdOdBracket(inp))
    || inp.head_joint_eff >= 1.0 - 1e-9;
  const tWeld = (x) => seamlessHead ? x.t_shell_nominal : Math.max(x.t_shell_nominal, x.t_head_nominal);
  // ROUND 13: THE ESCALATION AXIS FOLLOWS THE PATH. UCS-57 mandates full
  // radiography of the butt welds above the thickness limit. On the plate path
  // those are the Category A shop seams and the lever is joint_eff. On the PIPE
  // path there is no Category A shop seam - the butt welds that exist are the
  // Category B cap-to-shell welds, and their lever is cap_weld_exam. Escalating
  // joint_eff there did nothing to the vessel while still flipping the reported
  // answer, because joint_eff was wired into the closure efficiency. Escalate
  // the control that is actually there.
  // WHICH weld tripped the limit decides which control escalates. On the pipe
  // path with a seamless closure the only butt welds are the Category B cap
  // welds (cap_weld_exam). A WELDED formed head on a pipe shell has its own
  // Category A meridional seam, and that one is on the ordinary Cat. A ladder.
  // ... and a design that FELL BACK to plate is a plate vessel with a real
  // Cat. A seam, so it escalates on the plate axis however it was requested.
  const pipePathE = isPipePath(inp) && seamlessHead && !r.construction_fallback;
  const capExamE = inp.cap_weld_exam ?? "none";
  const canEscalate = pipePathE ? capExamE !== "full" : inp.joint_eff < 1.0;
  if (r.plate !== null && ok(r.t_nominal) && tWeld(r) > fullThick + EPS
      && canEscalate) {
    enforcedFrom = tWeld(r);
    const pre = r;
    r = design(pipePathE ? { ...inp, cap_weld_exam: "full" } : { ...inp, joint_eff: 1.0 });
    rtEnforced = true;
    // BUG-10: the engine derives rt_note from the design it was handed. After
    // enforcement that design is ALREADY at full RT, so it compares the
    // converged state against itself and always says radiography changed
    // nothing - the one case where it demonstrably did. Rewrite it here, where
    // BOTH gauges are known.
    if (ok(r.t_nominal) && r.t_nominal < pre.t_nominal - EPS) {
      r.rt_note = `Full radiography is MANDATORY here (UCS-57: the weld is `
        + `${enforcedFrom.toFixed(4)} in, above the ${fullThick} in limit) and it `
        + `also buys plate: ${r.t_nominal.toFixed(4)} in at full RT instead of `
        + `${pre.t_nominal.toFixed(4)} in at the selected level.`;
    } else if (ok(r.t_nominal)) {
      r.rt_note = `Full radiography is MANDATORY here (UCS-57: the weld is `
        + `${enforcedFrom.toFixed(4)} in, above the ${fullThick} in limit). The `
        + `selected plate stays ${r.t_nominal.toFixed(4)} in.`;
    }
  }
  // ASSESS THE VESSEL THAT WAS ACTUALLY BUILT, not the one that was asked for.
  //
  // When the engine falls back (pipe -> plate, or ID-basis -> plate) it
  // REWRITES r.inp to describe what it built. Assessing against the caller's
  // `inp` ran the whole compliance layer on the ORIGINAL pipe/cap request:
  // capHeads stayed true, so the Curve B pin held, the plate normalizing
  // election never ran, and the MDMT ladder used the pipe branch's inputs. The
  // same physical vessel then got two different ASME answers depending on
  // which button was pressed - at 26" OD / 1600 psi the direct plate path
  // rated -22.2F normalized with no impact testing while the fallback rated
  // +33.7F as-rolled and DEMANDED Charpy testing, 55.9F apart on identical
  // steel. Keying on r.inp makes the two paths identical by construction.
  const built = r.construction_fallback ? r.inp : inp;
  // The enforcement moved whichever control the path actually has, so the
  // assessment has to be handed the escalated one - not joint_eff on a pipe
  // vessel, where it means nothing.
  const eff = !rtEnforced ? built
    : (pipePathE && !r.construction_fallback ? { ...built, cap_weld_exam: "full" }
                                             : { ...built, joint_eff: 1.0 });
  const assessment = assessVessel(r, eff, { rtEnforced, rtEnforcedFrom: enforcedFrom });
  return { result: r, assessment, effectiveJointEff: eff.joint_eff };
}

export const AUTO_RT_LEVELS = [0.70, 0.85, 1.0];   // none / spot / full, ascending inspection

// APPROXIMATE shop radiography (NDE) cost, used ONLY inside the auto-RT
// ranking (never displayed as material cost): full RT shoots 100% of every
// Cat A/B shop butt seam; spot RT is one exposure per started 50 ft of seam
// per category (UW-52 spirit); no RT costs nothing. Rough shop-rate defaults -
// tune these two rates to your NDE vendor.
export const RT_FULL_COST_PER_FT = 75.0;      // $/ft of seam at 100% coverage
export const RT_SPOT_COST_PER_SHOT = 150.0;   // $ per spot exposure
export const RT_SPOT_FT_PER_SHOT = 50.0;      // one spot per started 50 ft of seam

// [cat_a_ft, cat_b_ft] of SHOP butt seams subject to UW-11 radiography.
// Pipe shells carry a mill ERW seam (not a shop weld -> no Cat A length);
// seamless heads and B16.9 caps have no Cat A head seams; welded formed heads
// add ~one meridional seam per head. Cat B girths: one per course joint plus
// the two head attachments.
function rtSeamFeet(res) {
  const p = res.plate;
  const inp = res.inp;
  const od = res.id_inside + 2.0 * res.t_shell_nominal;
  const girthFt = Math.PI * od / 12.0;
  const longFt = p.mode === "pipe" ? 0.0 : p.segments * inp.length / 12.0;
  const headSeamFt = inp.head_joint_eff >= 1.0 - 1e-9 ? 0.0 : 2.0 * od / 12.0;
  // CAT B GIRTHS. Plate: one per course joint plus the two closure welds.
  // PIPE: pipe is bought by the JOINT, so every joint-to-joint splice is an
  // EXTRA Category B butt seam. That was missing entirely - a 600" vessel
  // reported only the two cap welds (12.6 ft) when it actually has three
  // girths, understating the radiography COST and the circ-seam COUNT.
  const girths = p.courses + 1 + (p.shell_girth_welds ?? 0);
  return [longFt + headSeamFt, girths * girthFt];
}

// Approximate radiography cost of examining this design at RT level `eff`.
function rtNdeCost(res, eff) {
  if (res.plate === null || !ok(res.t_nominal)) return 0.0;
  const lvl = rtLevel(eff);
  if (lvl === "none") return 0.0;
  const [aFt, bFt] = rtSeamFeet(res);
  if (lvl === "full") return (aFt + bFt) * RT_FULL_COST_PER_FT;
  const shots = (aFt > 1e-9 ? Math.ceil(aFt / RT_SPOT_FT_PER_SHOT) : 0)
    + (bFt > 1e-9 ? Math.ceil(bFt / RT_SPOT_FT_PER_SHOT) : 0);
  return shots * RT_SPOT_COST_PER_SHOT;
}

// Material-cost part of the RT ranking: purchased shell stock plus the formed-
// closure weight, both at the plate price. Bailed designs rank as infinitely
// expensive. (The NDE term is added by the selector.)
function rtTotalCost(res, price) {
  if (res.plate === null || !ok(res.t_nominal)) return Infinity;
  const headsW = res.weight_empty - res.plate.shell_weight;
  return res.plate.purchased_cost + headsW * price;
}

// Fully automatic longitudinal-seam RT selection: evaluate none / spot / full
// (each through designWithCodeRules, so UCS-57 enforcement holds), rank by
// total material cost, tie-break toward the LOWEST inspection level. A higher
// level is chosen only when it genuinely reduces the cost. When even spot RT
// is UCS-57-enforced to full, full is the only code-legal choice and the
// enforced candidate is returned so the note explains the mandate.
// Returns { result, assessment, effectiveJointEff }.
export function designAutoRt(design, inp) {
  // PIPE PATH: search the Category B CAP-WELD EXAMINATION instead, because
  // that - not the plate path's Cat. A shop-seam RT - is what moves the
  // UW-12(d) hoop quality factor (BUG-13). A pipe vessel has no Cat. A shop
  // seam to radiograph, so searching joint_eff here bought nothing.
  if (isPipePath(inp)) {
    // ROUND 15 ITEM 2(d). A pipe shell closed by a WELDED FORMED PLATE head has
    // BOTH axes: the Cat. B cap-weld examination AND that head's own Cat. A
    // meridional seam. Searching only the cap axis meant joint_eff was echoed
    // back exactly as handed in, which is how a stale RT level reached the head
    // plate. Search both and rank on the same total cost.
    if ((inp.head_type ?? "") !== "pipecap" && inp.head_joint_eff < 1.0 - 1e-9) {
      let best = null;
      AUTO_RT_LEVELS.forEach((lvl, i) => {
        const cand = autoCapExam(design, { ...inp, joint_eff: lvl });
        const cost = rtTotalCost(cand.result, inp.price_per_lb) + cand.assessment.rt.ndeCost;
        const key = [Number.isFinite(cost) ? pyroundCost(cost) : Infinity, i];
        if (best === null || keyLess(key, best[0])) best = [key, cand];
      });
      if (best !== null && !best[1].result.construction_fallback) return best[1];
    }
    const capBest = autoCapExam(design, inp);
    // ROUND 12. If every pipe candidate ran off the end of its schedule table
    // and fell back to PLATE, the vessel that gets built is a plate one - and a
    // plate shell has a real Category A shop seam whose RT level has to be
    // SEARCHED. The cap-weld axis does not exist on it, so returning here left
    // joint_eff at whatever the caller happened to pass in, which is the one
    // input this function is supposed to choose. That is how a stale RT level
    // reached a plate design at all. Fall through to the plate search instead;
    // the engine re-derives the fallback inside each candidate, so the levels
    // being compared are the real ones.
    if (!capBest.result.construction_fallback) return capBest;
  }
  const cands = AUTO_RT_LEVELS.map((lvl) => {
    const { result, assessment, effectiveJointEff } = designWithCodeRules(design, { ...inp, joint_eff: lvl });
    return [lvl, result, assessment, effectiveJointEff];
  });

  // UCS-57 mandate: spot enforced to full -> no lower level is legal.
  if (cands[1][2].rt.enforcedFull) {
    const [, rS, aS, effS] = cands[1];
    return { result: rS, assessment: aS, effectiveJointEff: effS };
  }

  let best = null;
  cands.forEach(([lvl, r, a, eff], i) => {
    // TOTAL cost: plate material + approximate radiography (NDE) labor, so a
    // higher RT level wins only when the steel saving genuinely exceeds the
    // extra inspection cost.
    const cost = rtTotalCost(r, inp.price_per_lb) + rtNdeCost(r, eff);
    const costKey = Number.isFinite(cost) ? pyroundCost(cost) : Infinity;
    const effIdx = eff < 0.8 ? 0 : (eff < 0.999 ? 1 : 2);
    const direct = Math.abs(eff - lvl) < 1e-9 ? 0 : 1;  // prefer un-enforced representation
    const key = [costKey, effIdx, direct, i];
    if (best === null || keyLess(key, best[0])) best = [key, r, a, eff];
  });
  return { result: best[1], assessment: best[2], effectiveJointEff: best[3] };
}
// True when this input actually resolves to the pipe/cap path.
function isPipePath(inp) {
  return (inp.construction ?? "plate") === "pipe" && stdOdBracket(inp);
}

// Cat. B cap-weld examination cost. An A5b quality spot is a small fixed
// programme (one qualifying shot per cap weld); UW-52(b)(4) forbids reusing
// that radiograph for the ordinary spot programme, so "spot" pays for BOTH.
export const CAP_EXAM_A5B_SHOTS = 2;

// Cat. A radiography of the FORMED HEAD's meridional seams only (round 15). On
// a pipe shell there is no Cat. A shop seam in the body, so the Cat. A bill is
// the head seams alone - rtSeamFeet() folds that footage into its first element
// and the pipe shell contributes 0.0 to it.
function headSeamNdeCost(res, eff) {
  if (res.plate === null || !ok(res.t_nominal)) return 0.0;
  const lvl = rtLevel(eff);
  if (lvl === "none") return 0.0;
  const [aFt] = rtSeamFeet(res);
  if (aFt <= 1e-9) return 0.0;
  if (lvl === "full") return aFt * RT_FULL_COST_PER_FT;
  return Math.ceil(aFt / RT_SPOT_FT_PER_SHOT) * RT_SPOT_COST_PER_SHOT;
}

function capExamNdeCost(res, capExam) {
  if (res.plate === null || !ok(res.t_nominal)) return 0.0;
  const a5b = CAP_EXAM_A5B_SHOTS * RT_SPOT_COST_PER_SHOT;
  if (capExam === "none") return 0.0;
  if (capExam === "a5b") return a5b;
  if (capExam === "spot") return a5b + rtNdeCost(res, 0.85);
  return rtNdeCost(res, 1.0);            // full RT subsumes the A5b shot
}

// Pipe path: pick the cap-weld examination that minimises steel + NDE,
// tie-breaking toward LESS examination.
function autoCapExam(design, inp) {
  let best = null;
  CAP_EXAM_LEVELS.forEach((lvl, i) => {
    const { result: r, assessment: a, effectiveJointEff: eff } =
      designWithCodeRules(design, { ...inp, cap_weld_exam: lvl });
    const cost = rtTotalCost(r, inp.price_per_lb) + capExamNdeCost(r, lvl);
    const costKey = Number.isFinite(cost) ? pyroundCost(cost) : Infinity;
    const key = [costKey, i];
    if (best === null || keyLess(key, best[0])) best = [key, r, a, eff];
  });
  return { result: best[1], assessment: best[2], effectiveJointEff: best[3] };
}

function pyroundCost(x) { return parseFloat(x.toFixed(2)); }
function keyLess(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

export const DUAL_RATING_FACTOR = 0.35;   // cold-service pressure = 0.35 x design pressure

// Coldest MDMT the vessel can hold at a reduced 'cold' service pressure of
// 0.35 x the design pressure. The full-pressure plate is under-stressed at the
// reduced pressure, so the UCS-66.1 stress ratio (Rts = tr*E*/(tn - c)) drops
// and the ratio credit allows a colder MDMT. The COLDEST ACHIEVABLE rating
// assumes the vessel is also normalized + PWHT'd -- forced by asking the
// escalation for an unreachably cold MDMT -- floored at the -55°F carbon curve
// floor (austenitic SS keeps its -320°F exemption at any pressure).
// Returns { coldMdmt, coldP }; coldMdmt is null if the vessel is out of range.
export function dualRating(design, inp) {
  const coldP = inp.pressure * DUAL_RATING_FACTOR;
  const full = design(inp);
  // ok(), NOT the global isFinite: isFinite(null) === true, so a bailed design
  // whose plate happened to be non-null would have sailed straight past this.
  if (full.plate === null || !ok(full.t_nominal)) return { coldMdmt: null, coldP };
  const red = design({ ...inp, pressure: coldP });
  // ROUND 16 FOLLOW-UP: THE REDUCED-PRESSURE PROBE CAN ITSELF BAIL.
  // Same shape as the full-RT probe in designVessel: the probe is designed at a
  // RELAXED parameter, so its wall is thinner, so its OD (ID + 2t) is smaller -
  // and PLATE_MIN_ROLL_DIAMETER keys off OD. Reproducer: 10.75 in ID / L 12 /
  // 1305 psi / 800F / carbon / plate / hemispherical, where the 0.35x probe
  // drops below the roll floor and nulls every thickness. 3.55% of buildable
  // vessels on the round-16 sweep grid hit it.
  // THIS IS THE PORT THAT SHIPPED THE BUG. Python raised TypeError; JS coerced
  // `null - corrosion` to 0 (null -> 0, NOT NaN) and rated the vessel at tr = 0.
  // Rts = tr*E*/(tn - c) collapses to zero, the MAXIMUM UCS-66.1 credit, i.e.
  // the coldest claim the rule can make. Non-conservative, and silent.
  // FALL BACK TO THE FULL-PRESSURE REQUIREMENT, do not suppress the rating.
  // The true reduced-pressure requirement is <= the full-pressure one, and the
  // ratio credit is MONOTONE in tr (larger tr -> larger Rts -> less credit ->
  // WARMER MDMT), so substituting the full-pressure tr can only under-claim.
  // Suppressing instead would have thrown away 234 austenitic cases whose
  // -320F is the UCS-66 exemption and does not depend on the ratio at all.
  const reqShell = ok(red.t_shell_required) ? red.t_shell_required : full.t_shell_required;
  const reqHead = ok(red.t_head_required) ? red.t_head_required : full.t_head_required;
  // Hybrid: keep the as-built plate (full-pressure nominal) but rate it against
  // the LOWER required thickness at the reduced pressure -> lower stress ratio.
  const hybrid = { ...full, t_shell_required: reqShell, t_head_required: reqHead };
  const m = assessVessel(hybrid, { ...inp, required_mdmt: -320.0 }).mdmt;
  const allow = m.allowable;
  if (allow === null || allow === undefined) return { coldMdmt: null, coldP };
  const cold = m.austenitic ? allow : Math.max(allow, -55.0);
  return { coldMdmt: cold, coldP };
}
