import { STD_PIPE, ROLLED_DIAMETERS, NOZZLE_PIPE_DATA, MATERIALS } from './engineering-data.js';
import { finite, positive, temperatureF, waterAtF, waterViscosityCP, GAL_PER_FT3 } from './water.js';

export function fraction(value, name, includeOne = true) {
  positive(value, name);
  if (includeOne ? value > 1 : value >= 1) throw new RangeError(`${name} is outside its allowed range.`);
  return value;
}

// Water volume is specified at the cold endpoint. No system-container expansion
// credit is taken because its materials and temperature distribution are unknown.
export function sizeExpansion({ systemVol, fillTemp, designTemp, minPressure, maxPressure,
  precharge, acceptanceLimit, atmosphericPsia = 14.7, polytropicExponent = 1 }) {
  positive(systemVol, 'System water volume');
  temperatureF(fillTemp); temperatureF(designTemp);
  if (designTemp <= fillTemp) throw new RangeError('Maximum fluid temperature must exceed the minimum fluid temperature. Include chilled-loop shutdown warm-up.');
  positive(minPressure, 'Minimum pressure', true); positive(maxPressure, 'Maximum pressure');
  positive(precharge, 'Precharge', true); positive(atmosphericPsia, 'Atmospheric pressure');
  fraction(acceptanceLimit, 'Supplier maximum water-acceptance fraction');
  finite(polytropicExponent, 'Gas exponent');
  if (polytropicExponent < 1 || polytropicExponent > 1.4) throw new RangeError('Gas exponent must be between 1 and 1.4.');
  if (maxPressure <= minPressure) throw new RangeError('Maximum pressure must exceed minimum pressure.');
  if (precharge > minPressure) throw new RangeError('Precharge must not exceed the minimum system pressure for this sizing model.');
  const first = waterAtF(fillTemp, minPressure, atmosphericPsia);
  const last = waterAtF(designTemp, minPressure, atmosphericPsia);
  // Find the density maximum, including the anomaly near 39 °F. Water density
  // at a fixed liquid pressure is unimodal over this temperature interval.
  let lo = fillTemp, hi = designTemp;
  for (let i = 0; i < 65; i++) {
    const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
    if (waterAtF(a, minPressure, atmosphericPsia).rho < waterAtF(b, minPressure, atmosphericPsia).rho) lo = a;
    else hi = b;
  }
  const maxRho = Math.max(first.rho, last.rho, waterAtF((lo + hi) / 2, minPressure, atmosphericPsia).rho);
  const minRho = Math.min(first.rho, last.rho);
  const netExpansionFactor = first.rho / minRho - first.rho / maxRho;
  const expandedWater = systemVol * netExpansionFactor;
  const p0 = precharge + atmosphericPsia, pc = minPressure + atmosphericPsia, ph = maxPressure + atmosphericPsia;
  const coldWaterFraction = 1 - (p0 / pc) ** (1 / polytropicExponent);
  const pressureWaterFraction = 1 - (p0 / ph) ** (1 / polytropicExponent);
  const hotWaterFraction = Math.min(pressureWaterFraction, acceptanceLimit);
  const acceptanceFactor = hotWaterFraction - coldWaterFraction;
  if (acceptanceFactor <= 0) throw new RangeError('The bladder acceptance limit leaves no usable volume above the cold water charge.');
  return { kind: 'expansion', systemVol, fillTemp, designTemp, minPressure, maxPressure, precharge,
    atmosphericPsia, polytropicExponent, acceptanceLimit, coldWaterFraction, pressureWaterFraction,
    hotWaterFraction, acceptanceFactor, netExpansionFactor, expandedWater,
    grossExpansion: netExpansionFactor, pipingExpansion: 0, dpf: 1 / acceptanceFactor,
    minTankVol: expandedWater / acceptanceFactor, minRho, maxRho, referenceDensity: first.rho };
}

// Source output and load are positive magnitudes for both heating and cooling.
// Existing volume must be active during the controlling minimum-load cycle.
export function sizeBuffer({ sourceOutput, minimumLoad, runtimeMin, lowTemp, highTemp,
  minPressure, existingVolume = 0, utilization = 1, atmosphericPsia = 14.7 }) {
  positive(sourceOutput, 'Minimum stable source output'); positive(minimumLoad, 'Coincident minimum load', true);
  positive(runtimeMin, 'Minimum run time'); positive(existingVolume, 'Active existing water volume', true);
  fraction(utilization, 'Usable buffer fraction');
  if (highTemp <= lowTemp) throw new RangeError('Upper buffer control temperature must exceed the lower control temperature.');
  const cold = waterAtF(lowTemp, minPressure, atmosphericPsia), hot = waterAtF(highTemp, minPressure, atmosphericPsia);
  const netOutput = Math.max(0, sourceOutput - minimumLoad);
  const energyBtu = netOutput * runtimeMin / 60;
  const btuPerGal = hot.rho / GAL_PER_FT3 * (hot.h - cold.h);
  positive(btuPerGal, 'Water heat-storage capacity');
  const totalActiveVolume = energyBtu / btuPerGal;
  const minTankVol = Math.max(0, totalActiveVolume - existingVolume) / utilization;
  return { kind: 'buffer', sourceOutput, minimumLoad, runtimeMin, lowTemp, highTemp, minPressure,
    existingVolume, utilization, netOutput, energyBtu, btuPerGal, totalActiveVolume, minTankVol };
}

function pressureInputs(P, R, S, E, CA) {
  positive(P, 'Design pressure'); positive(R, 'Inside radius'); positive(S, 'Design-temperature allowable stress');
  fraction(E, 'Joint efficiency'); positive(CA, 'Corrosion allowance', true);
  if (P > 0.385 * S * E) throw new RangeError('Pressure exceeds the supported UG-27 thin-shell equation range.');
}
// R and D are NEW-condition inside dimensions. Corrosion increases the bore.
export function calcShellThickness(P, R, S, E, CA, circumferentialJointE = E) {
  pressureInputs(P, R, S, E, CA); fraction(circumferentialJointE, 'Circumferential joint efficiency');
  const Rc = R + CA;
  const hoop = P * Rc / (S * E - 0.6 * P);
  const longitudinal = P * Rc / (2 * S * circumferentialJointE + 0.4 * P);
  const net = Math.max(hoop, longitudinal);
  if (net > Rc / 2) throw new RangeError('Required shell thickness exceeds the supported UG-27 range.');
  return net + CA;
}
export function calcHead21SE(P, D, S, E, CA) {
  pressureInputs(P, D / 2, S, E, CA);
  return P * (D + 2 * CA) / (2 * S * E - 0.2 * P) + CA;
}
export function shellPressureCapacity(R, tMin, S, E, CA, circumferentialJointE = E) {
  positive(R, 'Inside radius'); positive(S, 'Allowable stress'); fraction(E, 'Joint efficiency');
  fraction(circumferentialJointE, 'Circumferential joint efficiency'); positive(CA, 'Corrosion allowance', true);
  positive(tMin, 'Minimum shell thickness');
  const t = tMin - CA, Rc = R + CA;
  if (t <= 0 || t > Rc / 2) throw new RangeError('Corroded shell thickness is outside the supported range.');
  return Math.min(S * E * t / (Rc + 0.6 * t), 2 * S * circumferentialJointE * t / (Rc - 0.4 * t), 0.385 * S * E);
}
export function headPressureCapacity(D, tMin, S, E, CA) {
  positive(D, 'Head inside diameter'); positive(tMin, 'Minimum formed head thickness');
  positive(S, 'Head allowable stress'); fraction(E, 'Head efficiency'); positive(CA, 'Corrosion allowance', true);
  const t = tMin - CA;
  if (t <= 0) throw new RangeError('Corrosion consumes the head wall.');
  return 2 * S * E * t / (D + 2 * CA + 0.2 * t);
}
export function roundUpToStdThickness(t) {
  positive(t, 'Required thickness');
  const stds = [0.1875,0.25,0.3125,0.375,0.4375,0.5,0.5625,0.625,0.75,0.875,1,1.125,1.25];
  return stds.find(s => s >= t) ?? Math.ceil(t * 8) / 8;
}
export function selectPipeSchedule(nps, P, S, CA, millTolerance = 0.125, circumferentialJointE = 1) {
  const data = STD_PIPE.find(p => p.nps === nps);
  if (!data) throw new RangeError('Pipe size is not in the supported catalog.');
  positive(millTolerance, 'Mill tolerance', true);
  if (millTolerance >= 1) throw new RangeError('Mill tolerance must be less than one.');
  const sorted = Object.entries(data.schedules).sort((a,b) => a[1] - b[1]);
  for (const [schedule, tw] of sorted) {
    const minWall = tw * (1 - millTolerance), R = data.od / 2 - minWall;
    const tReq = calcShellThickness(P, R, S, 1, CA, circumferentialJointE);
    if (minWall >= tReq) return { schedule, tw, minWall, od: data.od, id: data.od - 2 * tw,
      designRadius: R, tReq, nominalRequired: tReq / (1 - millTolerance), millTolerance };
  }
  throw new RangeError(`No NPS ${nps} schedule meets pressure, corrosion, and mill-tolerance requirements.`);
}

export function calcFrictionFactor(Re, epsilon, D) {
  positive(Re, 'Reynolds number', true); positive(epsilon, 'Roughness', true); positive(D, 'Bore');
  if (epsilon >= D) throw new RangeError('Roughness must be smaller than the bore.');
  if (Re === 0) return 0;
  if (Re < 2300) return 64 / Re;
  // Colebrook fixed-point iteration. Transition flow is explicitly a screening estimate.
  const turbulentRe = Math.max(4000, Re);
  let x = 7;
  for (let i = 0; i < 60; i++) {
    const next = -2 * Math.log10(epsilon / D / 3.7 + 2.51 * x / turbulentRe);
    if (Math.abs(next - x) < 1e-12) { x = next; break; }
    x = next;
  }
  const ft = 1 / (x * x);
  return Re < 4000 ? (1 - (Re - 2300) / 1700) * 64 / 2300 + (Re - 2300) / 1700 * ft : ft;
}
export function calcNozzleFlow({ Q_gpm, d_in, tempF, pressurePsig, atmosphericPsia = 14.7,
  materialId, nozzleLength, service, velocityLimit = 8 }) {
  positive(Q_gpm, 'Nozzle flow', true); positive(d_in, 'Nozzle bore'); positive(nozzleLength, 'Nozzle length', true);
  positive(velocityLimit, 'Velocity target');
  if (!MATERIALS[materialId]) throw new RangeError('Unknown nozzle material.');
  const water = waterAtF(tempF, pressurePsig, atmosphericPsia), mu_cP = waterViscosityCP(tempF);
  const mu_lbfts = mu_cP * 0.000671968975;
  const A_in2 = Math.PI * d_in * d_in / 4, A_ft2 = A_in2 / 144, D_ft = d_in / 12;
  const v_fps = Q_gpm / (60 * GAL_PER_FT3) / A_ft2;
  const Re = water.rho * v_fps * D_ft / mu_lbfts;
  const epsilon = materialId.startsWith('SS') ? 0.00006 : 0.0018;
  const f_darcy = calcFrictionFactor(Re, epsilon, d_in);
  // One vessel/pipe interface, not two reservoir losses at every nozzle.
  const K_total = service === 'buffer-out' || service === 'drain' ? 0.5 : 1;
  const dynamicPsi = water.rho * v_fps ** 2 / (2 * 32.174048556 * 144);
  const dP_friction_psi = f_darcy * nozzleLength / 12 / D_ft * dynamicPsi;
  const dP_minor_psi = K_total * dynamicPsi;
  return { Q_gpm, d_in, tempF, rho: water.rho, mu_cP, mu_lbfts, A_in2, A_ft2, v_fps, Re, epsilon,
    flowRegime: Re === 0 ? 'No flow' : Re < 2300 ? 'Laminar' : Re < 4000 ? 'Transitional estimate' : 'Turbulent',
    f_darcy, K_total, dP_friction_psi, dP_minor_psi, dP_total_psi: dP_friction_psi + dP_minor_psi,
    nozzleLength, velocityOK: v_fps <= velocityLimit, velocityLimit };
}

export function ellipsoidalHeadVolume(D) { positive(D, 'Head diameter'); return Math.PI * D ** 3 / 24 / 231; }
export function selectDiameter(volume) {
  positive(volume, 'Tank volume');
  const options = [...STD_PIPE.map(p => ({ type: 'pipe', nps: p.nps, approxID: p.od - 2 * p.schedules.Std })),
    ...ROLLED_DIAMETERS.map(id => ({ type: 'rolled', id, approxID: id }))];
  let best, score = Infinity;
  for (const opt of options) {
    const D = opt.approxID, L = (volume - 2 * ellipsoidalHeadVolume(D)) * 231 * 4 / (Math.PI * D * D);
    if (L < 4 || L / D < 0.6 || L / D > 5) continue;
    const s = Math.abs(L / D - 1.5) + (opt.type === 'rolled' ? 0.05 : 0);
    if (s < score) { best = opt; score = s; }
  }
  if (!best) throw new RangeError('Requested volume is outside the supported diameter and length catalog.');
  return best;
}

function selectFlowNozzle(minSize, flow, P, S, CA, limit) {
  for (const size of Object.keys(NOZZLE_PIPE_DATA).map(Number).sort((a,b) => a - b)) {
    if (size < minSize) continue;
    const p = NOZZLE_PIPE_DATA[size], minWall = p.sch80 * 0.875;
    const pressureRequired = calcShellThickness(P, p.od / 2 - minWall, S, 1, CA);
    const bore = p.od - 2 * p.sch80, v = flow / (60 * GAL_PER_FT3) / (Math.PI * (bore / 12) ** 2 / 4);
    if (minWall >= pressureRequired && v <= limit) return { size, ...p, minWall, bore, pressureRequired };
  }
  throw new RangeError('No supported nozzle meets the pressure-wall and velocity requirements. Specify a larger bore or heavier neck.');
}

export function designVessel(targetVolGal, designPressure, product, materialId, CA, params = {}) {
  positive(targetVolGal, 'Tank volume'); positive(designPressure, 'Top design pressure');
  const { designTempF, operatingTempF = designTempF, minPressure, shellStress: plateStress, pipeStress, headStress, nozzleStress,
    shellE, circumferentialE, headE, headFormingLoss = 0.1, plateTolerance = 0.01,
    codeEdition, stressBasis, designFlowGPM = 0, expansionFlowGPM = 0, velocityLimit = 8,
    atmosphericPsia = 14.7, supportType = 'skirt' } = params;
  const material = MATERIALS[materialId];
  if (!material || !product) throw new RangeError('Select a supported material and product.');
  if (designPressure > Math.max(...product.mawpOptions)) throw new RangeError('Design pressure exceeds the selected product calculation envelope.');
  temperatureF(designTempF); temperatureF(operatingTempF);
  if (designTempF < operatingTempF) throw new RangeError('Design metal temperature must cover the operating fluid temperature.');
  if (operatingTempF > product.maxTemp) throw new RangeError('Fluid temperature exceeds the selected product envelope.');
  if (product.internals !== 'none' && designTempF > product.maxTemp) throw new RangeError('Design temperature exceeds the membrane product envelope.');
  waterAtF(operatingTempF, minPressure, atmosphericPsia);
  if (minPressure > designPressure) throw new RangeError('Operating pressure exceeds top design pressure.');
  for (const [value, name] of [[plateStress,'Plate-shell allowable stress'],[pipeStress,'Pipe-shell allowable stress'],[headStress,'Head allowable stress'],[nozzleStress,'Nozzle allowable stress']]) positive(value,name);
  fraction(shellE,'Shell longitudinal-seam efficiency'); fraction(circumferentialE,'Circumferential-seam efficiency'); fraction(headE,'Head efficiency');
  positive(CA,'Corrosion allowance',true); positive(plateTolerance,'Plate thickness deduction',true);
  positive(headFormingLoss,'Head forming-loss fraction',true);
  if (headFormingLoss >= 1) throw new RangeError('Forming loss must be less than one.');
  if (!String(codeEdition ?? '').trim() || !String(stressBasis ?? '').trim()) throw new RangeError('Enter the project code edition and the material allowable-stress table basis.');
  if (!['skirt','clips'].includes(supportType)) throw new RangeError('Unknown support type.');
  positive(designFlowGPM,'Buffer design flow',true); positive(expansionFlowGPM,'Peak expansion connection flow',true);
  const isBuffer = product.internals === 'none';
  if (isBuffer && designFlowGPM <= 0) throw new RangeError('Buffer nozzle sizing requires the actual design flow.');
  positive(velocityLimit,'Nozzle velocity target');
  const choice = selectDiameter(targetVolGal), isPipe = choice.type === 'pipe';
  const shellStress = isPipe ? pipeStress : plateStress;
  let P = designPressure, pipeSchedule, D_ID, D_OD, tShell, tHead, tShellCalc, tHeadCalc,
    shellMin, headMin, shellLength, headDepthID, OAL, staticHeadPsi, shellRadius;
  let converged = false;
  for (let i = 0; i < 40; i++) {
    if (isPipe) {
      pipeSchedule = selectPipeSchedule(choice.nps, P, shellStress, CA, 0.125, circumferentialE);
      D_ID = pipeSchedule.id; D_OD = pipeSchedule.od; tShell = pipeSchedule.tw;
      shellMin = pipeSchedule.minWall; shellRadius = pipeSchedule.designRadius; tShellCalc = pipeSchedule.tReq;
    } else {
      D_ID = choice.id; shellRadius = D_ID / 2;
      tShellCalc = calcShellThickness(P,shellRadius,shellStress,shellE,CA,circumferentialE);
      tShell = roundUpToStdThickness(Math.max(tShellCalc + plateTolerance, D_ID <= 36 ? 0.25 : D_ID <= 60 ? 0.375 : 0.5));
      shellMin = tShell - plateTolerance; D_OD = D_ID + 2 * tShell;
    }
    // Formed 2:1 heads are specified for BOTH pipe and rolled shells. B16.9 cap
    // depth, volume, and rating cannot be inferred from the matching pipe schedule.
    tHeadCalc = calcHead21SE(P,D_ID,headStress,headE,CA);
    tHead = roundUpToStdThickness(Math.max(tHeadCalc / (1 - headFormingLoss) + plateTolerance,0.25));
    headMin = (tHead - plateTolerance) * (1 - headFormingLoss);
    headDepthID = D_ID / 4;
    shellLength = Math.ceil(Math.max(isPipe ? 4 : 6,(targetVolGal - 2 * ellipsoidalHeadVolume(D_ID)) * 231 * 4 / (Math.PI * D_ID * D_ID)) * 2) / 2;
    OAL = shellLength + 2 * headDepthID + 2 * tHead;
    // Conservative full-water head on every pressure part at 62.5 lb/ft³.
    staticHeadPsi = 62.5 * OAL / 12 / 144;
    const next = designPressure + staticHeadPsi;
    if (Math.abs(next - P) < 1e-8) { converged = true; break; }
    P = next;
  }
  if (!converged) throw new RangeError('Pressure and geometry iteration did not converge.');
  if (shellLength / D_ID > 5 || shellLength / D_ID < 0.6) throw new RangeError('Final pressure-sized geometry is outside the supported length/diameter range.');
  const actualVolGal = Math.PI * D_ID ** 2 * shellLength / 4 / 231 + 2 * ellipsoidalHeadVolume(D_ID);
  const shellCapacity = shellPressureCapacity(shellRadius,shellMin,shellStress,isPipe ? 1 : shellE,CA,circumferentialE) - staticHeadPsi;
  const headCapacity = headPressureCapacity(D_ID,headMin,headStress,headE,CA) - staticHeadPsi;
  const pressureScreenPass = shellCapacity >= designPressure && headCapacity >= designPressure;
  if (!pressureScreenPass) throw new RangeError('Selected shell or head does not meet the pressure-wall check.');
  const requirements = [
    'Complete UG-36/37/40/41 opening reinforcement, UG-45 neck requirements, UW-16 attachment and nozzle-load checks with actual fabrication details. No opening exemption is assumed.',
    'Select flanges, couplings, valves, gaskets and bolting for the material group and coincident pressure/temperature. Flange class and bolt torque are not determined here.',
    'Complete external pressure, MDMT/impact testing, cyclic service, supports/anchors, wind/seismic, inspection, relief protection and hydrotest checks. Vessel MAWP is not established by the shell/head screen.',
    'Verify formed head dimensions and minimum thickness after forming. Drawing geometry and support dimensions are preliminary.',
  ];
  if (!isBuffer) requirements.push('Use the supplier membrane acceptance rating, temperature rating, compatible port arrangement and installation procedure. Shell-side drains must not be connected as water drains across the membrane.');
  if (!isBuffer && expansionFlowGPM === 0) requirements.push('Peak expansion/displacement flow was not supplied. The system port has a preliminary minimum size and no velocity verification.');
  if (product.potable) requirements.push('Confirm potable-water certification for the actual wetted assembly.');
  const defs = isBuffer ? [
    ['N1','Inlet','buffer-in','top-head',2,designFlowGPM], ['N2','Outlet','buffer-out','bottom-head',2,designFlowGPM],
    ['N3','Drain','drain','bottom-side',0.5,0], ['N4','Vent / Gauge','vent','top-side',0.75,0],
  ] : [
    ['N1','System / Water Drain','system','bottom-head',product.potable ? 0.75 : 0.5,expansionFlowGPM],
    ['N2','Air Charge Valve','airvalve','top-side',0.25,0],
  ];
  const nozzles = defs.map(([id,label,service,position,minSize,Q]) => {
    if (service === 'airvalve') return { id,label,service,position,size:0.25,nozzleOD:0,tn:0,
      rating:'TBD',connType:'Rated NPT air-charge valve assembly',connSpec:'Supplier pressure/temperature rating required',
      nozzleMat:material.nozzleForging,flow:null,reinf:null,sizingBasis:'Use a complete rated valve with a compatible NPT adapter. A tire-valve core is not an NPT fitting.' };
    const n = selectFlowNozzle(minSize,Q,P,nozzleStress,CA,velocityLimit);
    const nozzleLength = (position.includes('head') ? tHead : tShell) + 2;
    const flow = Q > 0 ? calcNozzleFlow({Q_gpm:Q,d_in:n.bore,tempF:operatingTempF,pressurePsig:minPressure,
      atmosphericPsia,materialId,nozzleLength,service,velocityLimit}) : null;
    return {id,label,service,position,size:n.size,nozzleOD:n.od,tn:n.sch80,d_opening:n.od - 2*n.minWall + 2*CA,
      minWall:n.minWall,pressureRequired:n.pressureRequired,schedule:'Sch. 80 (B36.10 wall)',rating:'TBD',
      connType:'Pipe neck with rated end fitting TBD',connSpec:'End fitting / flange class requires selection',nozzleMat:material.pipe.spec,
      flow,flowQ_gpm:Q,reinf:null,nozzleLength,sizingBasis:Q > 0 ? 'Sized to entered flow and velocity target. Hydraulic loss is one vessel-port estimate, excluding downstream piping and valves.' : 'Service port size is preliminary. Drain time and flow capacity are not calculated.'};
  });
  if (product.internals.includes('bladder')) nozzles.push({id:'N3',label:'Bladder Access TBD',service:'bladder-flange',
    position:'top-head',size:0,blFlangeSize:0,flow:null,reinf:null,rating:'TBD',connType:'Supplier matched access assembly',
    sizingBasis:'Access bore, flange, bladder dimensions and bolting require the supplier assembly drawing.'});
  const shellSpec = isPipe ? material.pipe.spec : material.shell.spec, headSpec = material.head.spec;
  const shellWeight = Math.PI / 4 * (D_OD ** 2 - D_ID ** 2) * shellLength * material.density;
  // Surface area of two oblate half-spheroids, evaluated at mid-wall radii.
  const a = D_ID / 2 + tHead / 2, c = headDepthID + tHead / 2, e = Math.sqrt(1 - c*c/(a*a));
  const headWeight = 2 * Math.PI * a*a * (1 + (1-e*e)/e * Math.atanh(e)) * tHead * material.density;
  const nozzleWeight = nozzles.length * (isPipe ? 3 : 15);
  const skirtHeight = D_OD <= 24 ? 8 : D_OD <= 48 ? 12 : 16;
  const skirtThk = roundUpToStdThickness(Math.max(0.25,Math.min(tShell,0.375)));
  const baseRingW = Math.max(1.5,Math.ceil(D_OD*0.04*4)/4), baseRingThk = Math.max(0.375,skirtThk);
  const openingW = Math.max(4,Math.round(D_OD*0.2)), openingH = skirtHeight-2;
  const skirtWeight = (Math.PI*(D_OD-skirtThk)*skirtHeight - 2*openingW*openingH)*skirtThk*material.density +
    Math.PI/4*((D_OD+2*baseRingW)**2-D_OD**2)*baseRingThk*material.density;
  const clipCount = D_OD <= 20 ? 3 : 4, clipH = Math.max(3,Math.round(skirtHeight*0.6)), clipW = Math.max(2,Math.round(D_OD*0.08));
  const clipWeight = clipCount*clipH*clipW*skirtThk*material.density*2;
  const emptyWeight = Math.ceil(shellWeight+headWeight+nozzleWeight+skirtWeight), emptyWeightClips = Math.ceil(shellWeight+headWeight+nozzleWeight+clipWeight);
  const waterWeight = Math.ceil(actualVolGal/GAL_PER_FT3*62.5);
  return {isPipe,constructionType:isPipe ? `NPS ${choice.nps} ${pipeSchedule.schedule} Seamless Pipe Shell` : `${D_ID}" ID Rolled Plate Shell`,
    headType:'Formed 2:1 Ellipsoidal',shellSpec,headSpec,D_ID,D_OD,tShell,tHead,tShellCalc,tHeadCalc,shellMin,headMin,
    shellJointEff:isPipe ? 1 : shellE,circumferentialE,headE,shellLength,headDepthID,OAL,actualVolGal,targetVolGal,
    nozzles,emptyWeight,emptyWeightClips,waterWeight,operatingWeight:emptyWeight+waterWeight,operatingWeightClips:emptyWeightClips+waterWeight,
    material,materialId,CA,pipeSchedule,designPressure,componentPressure:P,staticHeadPsi,designTempF,operatingTempF,minPressure,
    shellStress,headStress,nozzleStress,headFormingLoss,plateTolerance,codeEdition:String(codeEdition),stressBasis:String(stressBasis),
    shellCapacity,headCapacity,pressureScreenPass,requirements,releaseReady:false,supportType,
    skirt:{OD:D_OD,thk:skirtThk,height:skirtHeight,openingW,openingH,baseRingThk,baseRingW,weight:skirtWeight,matSpec:shellSpec},
    clips:{count:clipCount,thk:skirtThk,H:clipH,W:clipW,weight:clipWeight}};
}
