// IAPWS R7-97(2012), Region 1 Eq. (7), Tables 2-5 and Region 4 Eq. (30).
// Source: https://iapws.org/technical-guidance/release/IF97-Rev.download
// Coefficients and thermodynamic relations attributed to IAPWS.
export const PSI_TO_MPA = 0.006894757293168;
export const KG_M3_TO_LB_FT3 = 0.062427960576145;
export const KJ_KG_TO_BTU_LB = 0.429922613929492;
export const GAL_PER_FT3 = 1728 / 231;

export function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number.`);
  return value;
}
export function positive(value, name, allowZero = false) {
  finite(value, name);
  if (allowZero ? value < 0 : value <= 0) throw new RangeError(`${name} must be ${allowZero ? 'nonnegative' : 'positive'}.`);
  return value;
}
export function temperatureF(value) {
  finite(value, 'Water temperature');
  if (value < 32 || value > 450) throw new RangeError('Liquid-water sizing supports 32 to 450 °F. Glycol and other fluids require a separate property model.');
  return (value - 32) * 5 / 9 + 273.15;
}

const REGION1 = [
  [0,-2,0.14632971213167], [0,-1,-0.84548187169114], [0,0,-3.756360367204],
  [0,1,3.3855169168385], [0,2,-0.95791963387872], [0,3,0.15772038513228],
  [0,4,-0.016616417199501], [0,5,0.00081214629983568],
  [1,-9,0.00028319080123804], [1,-7,-0.00060706301565874],
  [1,-1,-0.018990068218419], [1,0,-0.032529748770505], [1,1,-0.021841717175414],
  [1,3,-0.000052838357969930], [2,-3,-0.00047184321073267],
  [2,0,-0.00030001780793026], [2,1,0.000047661393906987],
  [2,3,-0.0000044141845330846], [2,17,-7.2694996297594e-16],
  [3,-4,-0.000031679644845054], [3,0,-0.0000028270797985312],
  [3,6,-8.5205128120103e-10], [4,-5,-0.0000022425281908],
  [4,-2,-6.5171222895601e-7], [4,10,-1.4341729937924e-13],
  [5,-8,-4.0516996860117e-7], [8,-11,-1.2734301741641e-9],
  [8,-6,-1.7424871230634e-10], [21,-29,-6.8762131295531e-19],
  [23,-31,1.4478307828521e-20], [29,-38,2.6335781662795e-23],
  [30,-39,-1.1947622640071e-23], [31,-40,1.8228094581404e-24],
  [32,-41,-9.3537087292458e-26],
];

export function saturationPressureMPa(T) {
  finite(T, 'Absolute temperature');
  if (T < 273.15 || T > 647.096) throw new RangeError('Saturation equation is outside its temperature range.');
  const n = [0,1167.0521452767,-724213.16703206,-17.073846940092,
    12020.82470247,-3232555.0322333,14.91510861353,-4823.2657361591,
    405113.40542057,-0.23855557567849,650.17534844798];
  const theta = T + n[9] / (T - n[10]);
  const A = theta ** 2 + n[1] * theta + n[2];
  const B = n[3] * theta ** 2 + n[4] * theta + n[5];
  const C = n[6] * theta ** 2 + n[7] * theta + n[8];
  return (2 * C / (-B + Math.sqrt(B * B - 4 * A * C))) ** 4;
}

export function waterRegion1(T, pMPa) {
  finite(T, 'Absolute temperature');
  positive(pMPa, 'Absolute water pressure');
  if (T < 273.15 || T > 623.15 || pMPa > 100 || pMPa < saturationPressureMPa(T)) {
    throw new RangeError('State is outside the IAPWS-IF97 liquid-water region.');
  }
  const pi = pMPa / 16.53, tau = 1386 / T;
  let gp = 0, gt = 0, gtt = 0;
  for (const [I, J, n] of REGION1) {
    if (I !== 0) gp -= n * I * (7.1 - pi) ** (I - 1) * (tau - 1.222) ** J;
    if (J !== 0) gt += n * (7.1 - pi) ** I * J * (tau - 1.222) ** (J - 1);
    if (J !== 0 && J !== 1) gtt += n * (7.1 - pi) ** I * J * (J - 1) * (tau - 1.222) ** (J - 2);
  }
  const R = 0.461526;
  const v = R * T * gp / 16530;
  return { v, rho: 1 / v, h: R * T * tau * gt, cp: -R * tau * tau * gtt };
}

export function waterAtF(tempF, pPsig, atmosphericPsia = 14.7) {
  const T = temperatureF(tempF);
  positive(pPsig, 'Water gauge pressure', true);
  positive(atmosphericPsia, 'Atmospheric pressure');
  const pMPa = (pPsig + atmosphericPsia) * PSI_TO_MPA;
  if (pMPa <= saturationPressureMPa(T)) throw new RangeError(`Pressure must exceed water saturation pressure at ${tempF} °F.`);
  const w = waterRegion1(T, pMPa);
  return { ...w, rho: w.rho * KG_M3_TO_LB_FT3, h: w.h * KJ_KG_TO_BTU_LB, cp: w.cp * KJ_KG_TO_BTU_LB / 1.8 };
}

// Existing approximate liquid-water viscosity data, used ONLY for hydraulic screening.
// No heat-transfer coefficient is claimed for short, developing-flow nozzles.
const VISCOSITY = [[32,1.792],[40,1.546],[50,1.310],[60,1.124],[70,0.978],
  [80,0.862],[90,0.764],[100,0.682],[110,0.612],[120,0.556],[130,0.506],
  [140,0.463],[150,0.425],[160,0.392],[170,0.363],[180,0.338],[190,0.315],
  [200,0.295],[210,0.277],[220,0.261],[230,0.247],[240,0.233],[250,0.221],
  [300,0.179],[350,0.146],[400,0.122],[450,0.104]];
export function waterViscosityCP(tempF) {
  temperatureF(tempF);
  for (let i = 1; i < VISCOSITY.length; i++) {
    const [t0, m0] = VISCOSITY[i - 1], [t1, m1] = VISCOSITY[i];
    if (tempF <= t1) return m0 + (m1 - m0) * (tempF - t0) / (t1 - t0);
  }
  throw new RangeError('Viscosity temperature is outside the table.');
}
