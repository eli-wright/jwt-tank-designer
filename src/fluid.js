// Fluid property model for expansion, buffer and drawdown sizing.
//
// Water uses the existing IAPWS-IF97 formulation in water.js, unchanged.
//
// Aqueous ethylene glycol (MEG) and propylene glycol (MPG) density and specific
// heat are the CoolProp 7.2.0 INCOMP incompressible-solution correlations
// (Melinder aqueous-solution polynomials), re-expressed below as the same
// degree-5 bivariate polynomial in normalized temperature and mass fraction.
// This is a change of basis, not a fit of a fit: the coefficients were solved
// against engine values and then validated against engine values that were NOT
// in that sample. Maximum relative deviation over the whole validity domain is
// 3.0e-13 in density, 3.0e-13 in specific heat, 1.6e-11 in the expansion factor
// ratio, and 2.4e-12 K on the freeze curve — that is double-precision rounding,
// so the two polynomials are the same polynomial.
//
// Source: CoolProp 7.2.0, git 98b3523d5daa98454618d381d2ae53f7471d216b,
// wasm sha256 cb77d0381fbe639bffb65a3e8fa44ff8e2a110f21c18125c89a9b336135bd194.
// https://coolprop.github.io/CoolProp/fluid_properties/Incompressibles.html
//
// The incompressible model carries no pressure dependence. Density and specific
// heat were verified identical at 101325 Pa and 3.0 MPa, so glycol properties
// here are a function of temperature and concentration only. Enthalpy is the
// analytic integral of that specific heat from 273.15 K, which reproduces the
// engine's own enthalpy difference to 1.4e-4 relative; only differences are used.
import { saturationPressureMPa, finite, positive, PSI_TO_MPA,
  KG_M3_TO_LB_FT3, KJ_KG_TO_BTU_LB, waterAtF, waterViscosityCP } from './water.js';

const DEG = 5, TMIN_K = 255.15, TMAX_K = 373.15, XMAX = 0.6, TREF_K = 273.15;

// Coefficients are ordered c[i * 6 + j] for temperature power i and concentration power j.
const GLYCOL = {
  eg: {
    density: [
      1028.2810762838574, 37.496411770202045, 0.9078535296709788, -2.427986881899985,
      -1.4886521234247092, 1.1885129992799695, -30.779699892510482, -10.798453705536485,
      3.6925535994699765, 2.0060101112639375, -3.446136899364741, 2.284704324534932e-9,
      -9.056889985931198, 5.110480911597678, -0.725738248179308, -1.0836701152576702,
      -1.094648076870662e-8, 5.173088934263106e-9, 0.9682113601959905, 0.05217733409178719,
      0.9208783623116673, 1.0072591145022105e-8, -1.5334831088620358e-9, -1.0731903515057095e-8,
      1.3926787610863775e-9, -7.011034901558109e-10, -1.1568768534061837e-8, 6.317311787358664e-9,
      1.2332490212194346e-8, -6.889822803003238e-9, 3.6612176235554926e-10, 7.131344346649506e-10,
      -1.576332887931853e-10, -1.0094835923525848e-8, -8.571459644191864e-10, 1.1457687534682487e-8,
    ],
    cp: [
      3778.116395024951, -506.6457203520726, -91.97165116238908, 68.43548989859677, 14.78635528356352,
      -39.31739999712499, 162.72128112388265, 170.31850460887884, 23.196694745742448,
      -4.444139684251547, -20.4158879978341, 9.274612306691626e-9, -16.404060749946527,
      -43.359495698078625, 11.092301609158282, -15.4420640752407, -4.617492402386128e-8,
      -1.3474086524063054e-8, -2.8953109656375986, 1.8823201726521093, -13.193957711999738,
      3.647195641223956e-8, -2.363015038068362e-9, -4.34045149091898e-8, 4.900690446152935e-9,
      1.1461337210988326e-8, -4.9560458584863686e-8, -2.0580771898045027e-8, 5.5835917773423456e-8,
      3.831402162177496e-9, 2.0426393748776344e-9, -1.443385902880438e-9, 4.253154522120568e-9,
      -3.6042303306707527e-8, -1.1446697804733871e-8, 4.8611841949678317e-8,
    ],
    freeze: [258.5742221392163, -23.567474546152685, -11.835490234457202, -2.0608275360255988, 0.8109530946042002, 0.027701999984781425],
  },
  pg: {
    density: [
      1012.858631501887, 20.664494772295104, -1.8227725119153848, -3.4619818360570336,
      -1.131968252777917, 0.5691059999732314, -33.98434880072046, -15.194283402342451,
      0.8098282771876438, 4.416556676278091, -1.0614159024482561, -3.9487761524211156e-9,
      -8.24195301511749, 5.483155007282854, -0.9482894755889731, -0.6743567273503364,
      1.2819390821395484e-8, 1.6766354907864e-10, 2.786191080036564, -0.8567220522257037,
      0.6240235433476153, -1.7978585846111748e-8, 7.1127599856706636e-9, 1.761793495641626e-8,
      -5.427491371856985e-10, -2.4829387200888973e-9, 1.1486256514002287e-8, 2.93425275637511e-9,
      -1.47366323785414e-8, 1.571330888660221e-9, -2.5091870353868296e-9, -1.161670120120965e-9,
      5.897035878042537e-9, 1.5115944683041466e-8, -1.6037552104181797e-9, -1.7495837190632363e-8,
    ],
    cp: [
      3913.0554726567907, -371.96058097359526, -143.41377828055465, 12.538628475535397,
      37.12003887519628, -12.05036999827618, 155.4162856420257, 88.27616404936772, 11.766730871492822,
      44.81832925022155, -34.098165008275004, -1.8566467081287322e-8, -6.626592717221297,
      -2.590329346301516, 34.715120138571805, -27.72616500070894, 5.187108775915264e-8,
      -7.185544900471034e-9, -2.344235539504788, 9.799547725004299, -9.001761602862743,
      -8.767256055871323e-8, 2.1031466536107565e-8, 8.408573354045432e-8, -2.4023565212575364e-9,
      -9.118457196869205e-9, 4.859444698763075e-8, 3.3342336742777666e-9, -6.109768504715017e-8,
      1.420551169865185e-8, -8.858513699968334e-9, -7.415027783680776e-9, 1.4949528725900823e-8,
      7.638340144845917e-8, 1.3835958954190403e-9, -8.392818195108384e-8,
    ],
    freeze: [260.36089594153043, -19.441499837526973, -9.421748241289784, -5.903282866899798, -2.8030066807457574, 0.35599499998471534],
  },
};

// Dynamic viscosity in Pa·s. ln(viscosity) is the same degree-5 bivariate
// polynomial in the same normalized variables, reproducing the engine to
// 2.2e-12 relative on points outside the solve sample.
const GLYCOL_VISCOSITY = {
  eg: [
    -6.679029959687927, 0.7104585880329701, 0.008605435061279672, 0.04318768896304206,
    0.0327875997286536, -0.04531950000499353, -1.3160723436356019, -0.18349342746016878,
    0.05774870037694957, 0.016044170820849944, 0.008750348997348481, -5.471272370089718e-12,
    0.5442776701373793, 0.06381234983656399, -0.026730821380327584, 0.038186918056919955,
    8.303290917869271e-11, 2.1941082600736112e-11, -0.15476062155579598, -0.09392497789046218,
    -0.11968461225520936, -8.719162324068074e-13, -2.008718734882535e-12, 2.9145488439549034e-11,
    -8.346839700542678e-12, -2.134186417491251e-11, 8.995949942090136e-11, 3.4831788322730754e-11,
    -1.0284176150563206e-10, -2.5005197663463577e-12, -3.4390152160933256e-12, 1.913596782524839e-11,
    -1.4080930449081953e-11, 8.64705221757096e-12, 2.8675693272771867e-11, -4.667724397136422e-11,
  ],
  pg: [
    -6.481226198762659, 0.90555264833776, 0.05333496766256846, -0.08325413035594335,
    -0.0199978520454219, 0.08660519999477738, -1.552829713726126, -0.5837019505564156,
    -0.027866540725359643, 0.12392015240872122, 0.02138602500893677, 2.951401861294809e-11,
    0.7483152423668725, 0.4063297332266346, -0.04288625396642271, -0.149345343012898,
    -9.609116802916377e-11, 2.6021516974067944e-11, -0.2846438775511714, -0.11421462912754919,
    -0.00825315508536458, 1.359432012360067e-10, -1.0410535683833498e-11, -1.364606429848757e-10,
    5.127211120816155e-12, 1.435344966600559e-11, -9.564565549395534e-11, 1.1614497611993318e-11,
    1.1799135665173633e-10, -4.274583368495165e-11, 1.1533828205861821e-11, 6.8813453656419726e-12,
    2.6304915925792466e-12, -1.2350926582595031e-10, -3.0429991121794506e-11, 1.4372653060772903e-10,
  ],
};

export const FLUIDS = {
  water: { id:'water', label:'Water', glycol:false, minTempF:32, maxTempF:450, maxConcentration:0 },
  eg: { id:'eg', label:'Ethylene glycol', glycol:true, minTempF:0, maxTempF:212, maxConcentration:60 },
  pg: { id:'pg', label:'Propylene glycol', glycol:true, minTempF:0, maxTempF:212, maxConcentration:60 },
};

const normT = T => (2 * T - (TMIN_K + TMAX_K)) / (TMAX_K - TMIN_K);
const normX = x => (2 * x - XMAX) / XMAX;
function poly(c, U, V) {
  let s = 0;
  for (let i = 0; i <= DEG; i++) for (let j = 0; j <= DEG; j++) s += c[i * (DEG + 1) + j] * U ** i * V ** j;
  return s;
}
// Analytic ∫cp dT between two normalized temperatures, in J/kg.
function cpIntegral(c, U0, U, V) {
  let s = 0;
  for (let i = 0; i <= DEG; i++) for (let j = 0; j <= DEG; j++)
    s += c[i * (DEG + 1) + j] * (U ** (i + 1) - U0 ** (i + 1)) / (i + 1) * V ** j;
  return s * (TMAX_K - TMIN_K) / 2;
}

// A fluid selection is the fluid identifier plus its glycol mass percentage.
// Water takes no concentration. A glycol selection requires a real concentration:
// 0% glycol is water and must be selected as water so the IAPWS model is used.
export function fluidBasis(fluidId, concentrationPercent = 0) {
  const fluid = FLUIDS[fluidId];
  if (!fluid) throw new RangeError('Select a supported heat-transfer fluid.');
  if (!fluid.glycol) {
    if (Number(concentrationPercent) > 0) throw new RangeError('Water carries no glycol concentration. Select a glycol fluid to enter one.');
    return { fluid, x: 0, concentrationPercent: 0 };
  }
  finite(concentrationPercent, 'Glycol concentration');
  if (concentrationPercent <= 0 || concentrationPercent > fluid.maxConcentration)
    throw new RangeError(`${fluid.label} concentration must be above 0 and at most ${fluid.maxConcentration} mass %. Select water for an uninhibited system.`);
  return { fluid, x: concentrationPercent / 100, concentrationPercent: Number(concentrationPercent) };
}

// Solution freeze point. This is the freeze point of the correlation, not a
// burst-protection temperature and not an inhibitor or corrosion qualification.
export function freezePointF(fluidId, concentrationPercent = 0) {
  const { fluid, x } = fluidBasis(fluidId, concentrationPercent);
  if (!fluid.glycol) return 32;
  const V = normX(x);
  const K = GLYCOL[fluid.id].freeze.reduce((s, c, k) => s + c * V ** k, 0);
  return (K - 273.15) * 9 / 5 + 32;
}

export function fluidTemperatureF(fluidId, concentrationPercent, value, name = 'Fluid temperature') {
  const { fluid } = fluidBasis(fluidId, concentrationPercent);
  finite(value, name);
  if (value < fluid.minTempF || value > fluid.maxTempF)
    throw new RangeError(`${fluid.label} sizing supports ${fluid.minTempF} to ${fluid.maxTempF} °F. ${fluid.glycol ? 'The aqueous-glycol correlation is not defined above its 212 °F limit.' : 'Other fluids require a separate property model.'}`);
  if (fluid.glycol) {
    const freeze = freezePointF(fluidId, concentrationPercent);
    if (value < freeze) throw new RangeError(`${name} of ${value} °F is below the ${freeze.toFixed(1)} °F freeze point of ${concentrationPercent}% ${fluid.label}.`);
  }
  return (value - 32) * 5 / 9 + 273.15;
}

// Density (lb/ft³), enthalpy (Btu/lb) and specific heat (Btu/lb-°F).
export function fluidAtF(fluidId, concentrationPercent, tempF, pPsig, atmosphericPsia = 14.7) {
  const { fluid, x } = fluidBasis(fluidId, concentrationPercent);
  if (!fluid.glycol) return waterAtF(tempF, pPsig, atmosphericPsia);
  const T = fluidTemperatureF(fluidId, concentrationPercent, tempF);
  positive(pPsig, 'Fluid gauge pressure', true);
  positive(atmosphericPsia, 'Atmospheric pressure');
  // Aqueous glycol boils above water at the same pressure, so the water
  // saturation pressure is a conservative liquid-phase screen. Below 32 °F the
  // IAPWS saturation line is outside its own range and is far below one
  // atmosphere, so no screen is needed and none is claimed.
  if (T >= 273.15 && (pPsig + atmosphericPsia) * PSI_TO_MPA <= saturationPressureMPa(T))
    throw new RangeError(`Pressure must exceed the water saturation pressure at ${tempF} °F.`);
  const c = GLYCOL[fluid.id], U = normT(T), V = normX(x);
  const rhoSI = poly(c.density, U, V), cpSI = poly(c.cp, U, V);
  positive(rhoSI, 'Solution density'); positive(cpSI, 'Solution specific heat');
  return {
    v: 1 / rhoSI,
    rho: rhoSI * KG_M3_TO_LB_FT3,
    h: cpIntegral(c.cp, normT(TREF_K), U, V) / 1000 * KJ_KG_TO_BTU_LB,
    cp: cpSI / 1000 * KJ_KG_TO_BTU_LB / 1.8,
  };
}

// Largest liquid density in a temperature interval, at a fixed pressure. Water
// density is unimodal over the supported range and peaks near 39 °F; glycol
// solutions fall monotonically. A ternary search covers both without assuming
// which endpoint governs.
export function maxDensityBetween(fluidId, concentrationPercent, tLoF, tHiF, pPsig, atmosphericPsia = 14.7) {
  if (tHiF < tLoF) throw new RangeError('Density interval is reversed.');
  const at = t => fluidAtF(fluidId, concentrationPercent, t, pPsig, atmosphericPsia).rho;
  let lo = tLoF, hi = tHiF;
  for (let i = 0; i < 65 && hi - lo > 1e-9; i++) {
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
    if (at(a) < at(b)) lo = a; else hi = b;
  }
  return Math.max(at(tLoF), at(tHiF), at((lo + hi) / 2));
}

// Dynamic viscosity in centipoise, for the nozzle hydraulic screen only. The
// water branch keeps the existing approximate table in water.js; the glycol
// branch is the engine correlation, which is several times more viscous than
// water at the same temperature and must not be replaced by the water value.
export function fluidViscosityCP(fluidId, concentrationPercent, tempF) {
  const { fluid, x } = fluidBasis(fluidId, concentrationPercent);
  if (!fluid.glycol) return waterViscosityCP(tempF);
  const T = fluidTemperatureF(fluidId, concentrationPercent, tempF);
  return Math.exp(poly(GLYCOL_VISCOSITY[fluid.id], normT(T), normX(x))) * 1000;
}

export function fluidLabel(fluidId, concentrationPercent = 0) {
  const { fluid, concentrationPercent: pct } = fluidBasis(fluidId, concentrationPercent);
  return fluid.glycol ? `${pct}% ${fluid.label}` : fluid.label;
}
