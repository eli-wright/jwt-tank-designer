import { useState, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   JWT EXPANSION TANK DESIGNER & SIZER v2.0
   Joe White Tank Company, Inc. — Fort Worth, Texas
   Professional Engineering Tool
   ═══════════════════════════════════════════════════════════════ */

// ─── SMITHSONIAN TABLE: Water Relative Volume vs Temperature ─────
const WATER_VOLUME_DATA = [
  { tempF: 32, vol: 1.00013 }, { tempF: 39.2, vol: 1.00000 },
  { tempF: 41, vol: 1.00001 }, { tempF: 50, vol: 1.00027 },
  { tempF: 59, vol: 1.00087 }, { tempF: 68, vol: 1.00177 },
  { tempF: 77, vol: 1.00294 }, { tempF: 86, vol: 1.00435 },
  { tempF: 95, vol: 1.00598 }, { tempF: 104, vol: 1.00782 },
  { tempF: 113, vol: 1.00985 }, { tempF: 122, vol: 1.01207 },
  { tempF: 131, vol: 1.01448 }, { tempF: 140, vol: 1.01705 },
  { tempF: 149, vol: 1.01979 }, { tempF: 158, vol: 1.02270 },
  { tempF: 167, vol: 1.02576 }, { tempF: 176, vol: 1.02899 },
  { tempF: 185, vol: 1.03237 }, { tempF: 194, vol: 1.03590 },
  { tempF: 203, vol: 1.03959 }, { tempF: 212, vol: 1.04342 },
  { tempF: 230, vol: 1.0515 },  { tempF: 248, vol: 1.0601 },
  { tempF: 266, vol: 1.0693 },  { tempF: 284, vol: 1.0794 },
  { tempF: 302, vol: 1.0902 },  { tempF: 320, vol: 1.1019 },
];

// ─── STANDARD PIPE DATA (NPS, per ASME B36.10M) ─────────────────
const STD_PIPE = [
  { nps: 8, od: 8.625, schedules: { "Std": 0.322, "XS": 0.500, "Sch40": 0.322, "Sch80": 0.500, "Sch120": 0.718, "Sch160": 0.906 }},
  { nps: 10, od: 10.75, schedules: { "Std": 0.365, "XS": 0.500, "Sch40": 0.365, "Sch60": 0.500, "Sch80": 0.593, "Sch120": 0.843 }},
  { nps: 12, od: 12.75, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.406, "Sch60": 0.562, "Sch80": 0.687, "Sch120": 1.000 }},
  { nps: 14, od: 14.0, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.437, "Sch60": 0.593, "Sch80": 0.750, "Sch120": 1.093 }},
  { nps: 16, od: 16.0, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.500, "Sch60": 0.656, "Sch80": 0.843, "Sch120": 1.218 }},
  { nps: 18, od: 18.0, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.562, "Sch60": 0.750, "Sch80": 0.937 }},
  { nps: 20, od: 20.0, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.593, "Sch60": 0.812, "Sch80": 1.031 }},
  { nps: 24, od: 24.0, schedules: { "Std": 0.375, "XS": 0.500, "Sch40": 0.687, "Sch60": 0.968, "Sch80": 1.218 }},
];

const ROLLED_DIAMETERS = [30, 36, 42, 48, 54, 60, 66, 72, 84, 96];

// ─── MATERIAL PROPERTIES ─────────────────────────────────────────
const MATERIALS = {
  "CS": {
    id: "CS", label: "Carbon Steel",
    shell: { spec: "SA-516 Gr. 70", S: 20000, uts: 70000, ys: 38000 },
    head: { spec: "SA-516 Gr. 70", S: 20000, uts: 70000, ys: 38000 },
    pipe: { spec: "SA-106 Gr. B (Seamless) / SA-53 Gr. B (ERW)", S: 20000, uts: 60000, ys: 35000 },
    pipeCap: { spec: "SA-234 WPB", S: 20000 },
    density: 0.2836,
  },
  "SS": {
    id: "SS", label: "Stainless Steel",
    shell: { spec: "SA-240 Type 304/304L", S: 20000, uts: 75000, ys: 30000 },
    head: { spec: "SA-240 Type 304/304L", S: 20000, uts: 75000, ys: 30000 },
    pipe: { spec: "SA-312 TP304/304L (Seamless)", S: 20000, uts: 75000, ys: 30000 },
    pipeCap: { spec: "SA-403 WP304", S: 20000 },
    density: 0.289,
  },
};

// ─── PRODUCT DEFINITIONS ─────────────────────────────────────────
const PRODUCTS = [
  {
    id: "hgd", name: "JWT HydroGuard-D",
    subtitle: "Diaphragm Hydronic Expansion Tank",
    desc: "Fixed diaphragm design for closed-loop hydronic heating & chilled water systems. The sealed air cushion never contacts system water.",
    prefix: "JWT-HGD", maxTemp: 240, potable: false, internals: "diaphragm",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#C0392B",
    howItWorks: `This tank uses a permanently sealed, heavy-duty Butyl/EPDM diaphragm to separate the air cushion from system water. When the heating system warms up, water expands and pushes against the diaphragm, compressing the pre-charged air cushion. When the system cools, the air cushion pushes the water back out. Because air and water never mix, there is no waterlogging and no air absorption — the tank maintains proper pressurization indefinitely without air replenishment.\n\nThe diaphragm is factory-installed and is not field-replaceable. It is a fixed membrane clamped between the shell and head during fabrication. For small tanks (≤24" diameter), the vessel is made from standard pipe with welded pipe caps, making it compact and economical. Larger sizes use rolled plate shells with formed 2:1 semi-ellipsoidal heads.\n\nInstallation: Mount vertically with the system connection at the bottom. Connect on the suction side of the circulator pump to ensure all pump pressure effects are additive. Pre-charge must be set to match the system fill pressure before filling with water. A Schrader-type air valve on the top provides the air charge connection.`,
  },
  {
    id: "hgfb", name: "JWT HydroGuard-FB",
    subtitle: "Full-Acceptance Bladder Expansion Tank",
    desc: "Replaceable full-acceptance bladder for large commercial hydronic systems. The bladder occupies the full tank volume.",
    prefix: "JWT-HGFB", maxTemp: 240, potable: false, internals: "full-bladder",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#2980B9",
    howItWorks: `This tank uses a heavy-duty replaceable Butyl rubber bladder that occupies the full internal volume of the vessel. System water enters the bladder through the bottom system connection, while the pre-charged air cushion surrounds the bladder between its outer surface and the steel shell. As the system heats, expanding water inflates the bladder, compressing the surrounding air. When the system cools, air pressure forces the water back out.\n\nThe key advantage of the full-acceptance design is that 100% of the tank volume is available for water acceptance, and the bladder is field-replaceable — extending the service life of the vessel by decades. The bladder is installed through the bottom flanged opening.\n\nBladder Sizing: The bladder is matched to the tank shell diameter and length. Standard Butyl bladders are available from established expansion tank manufacturers. Contact JWT engineering for OEM bladder sourcing.\n\nBladder Installation: Drain the tank, bleed air, unbolt the bottom blind flange, extract the old bladder, fold the new bladder and insert through the flange opening, re-bolt to 40-50 ft-lbs in a cross pattern, and re-charge with dry air or nitrogen.\n\nInstallation: Floor-standing vertical on integral welded ring base. Connect to suction side of pump. Pre-charge to system fill pressure while tank is empty of water.`,
  },
  {
    id: "hgrb", name: "JWT HydroGuard-RB",
    subtitle: "Partial-Acceptance Bladder Expansion Tank",
    desc: "Replaceable partial-acceptance bladder for mid-size commercial hydronic systems.",
    prefix: "JWT-HGRB", maxTemp: 240, potable: false, internals: "partial-bladder",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#8E44AD",
    howItWorks: `This tank uses a replaceable Butyl rubber bladder that occupies a portion of the internal volume. The bladder hangs from a support pipe connected to the bottom blind flange. System water enters the bladder, while the pre-charged air cushion occupies the space above and around it.\n\nThe partial-acceptance design means the bladder volume is less than the total tank volume — the remainder is the permanent air cushion space. This design is more compact for applications where the required acceptance volume is significantly less than the total tank volume.\n\nBladder Sizing: The bladder assembly (bladder + support pipe + blind flange) is a matched set specific to each tank diameter. Standard replacement kits include all three components. Contact JWT engineering for compatible replacement bladder sourcing.\n\nBladder Installation: Same procedure as full-acceptance bladder — isolate, drain, bleed air, unbolt blind flange, swap bladder assembly, re-bolt in cross pattern, and re-charge.\n\nInstallation: Floor-standing vertical. Connect to suction side of pump. Pre-charge to system fill pressure before introducing water.`,
  },
  {
    id: "as", name: "JWT AquaShield",
    subtitle: "Thermal Expansion Tank — Potable Water",
    desc: "For domestic hot water systems with backflow preventers, check valves, or PRVs. NSF/ANSI 61 compliant wetted surfaces.",
    prefix: "JWT-AS", maxTemp: 200, potable: true, internals: "diaphragm",
    mawpOptions: [100, 125, 150], defaultMawp: 150,
    precharge: 55, color: "#27AE60",
    howItWorks: `When a backflow preventer, check valve, or pressure reducing valve is installed on the cold water supply, the plumbing system becomes "closed." As the water heater heats water, it expands — but with nowhere to go, pressure rises rapidly. Without a thermal expansion tank, this pressure spike can exceed the T&P relief valve setting, causing dripping, premature valve failure, and damage to the water heater's heat exchanger.\n\nThe JWT AquaShield absorbs this expanded water. A heavy-duty Butyl/EPDM diaphragm (meeting NSF/ANSI 61 for potable water contact) separates the pre-charged air cushion from the water side. The factory pre-charge is 55 psig — it must be adjusted in the field to match the incoming static water supply pressure before installation.\n\nCritical: If the pre-charge is left lower than supply pressure, the supply pressure will push the diaphragm and take up space before the water even heats, reducing the tank's effective capacity.\n\nInstallation: Mount vertically on the cold water supply line between the backflow preventer and the water heater. Never install on the hot water outlet — this would cause cooled water from the tank to mix with the hot supply, reducing delivery temperature.`,
  },
  {
    id: "cv", name: "JWT ChillVault",
    subtitle: "Chilled Water Buffer Tank",
    desc: "Adds thermal mass to chilled water systems to reduce compressor short-cycling and improve temperature control.",
    prefix: "JWT-CV", maxTemp: 450, potable: false, internals: "none",
    mawpOptions: [100, 125, 150, 175, 250], defaultMawp: 150,
    precharge: 0, color: "#2C3E50",
    howItWorks: `A buffer tank is simply an ASME pressure vessel added to the piping loop to increase the total system water volume. In chilled water systems, the chiller compressor will short-cycle (turn on and off rapidly) if the system water volume is too small relative to the chiller capacity — the water reaches setpoint too quickly. Short-cycling causes excessive wear on compressor contactors, reduces efficiency, and shortens equipment life.\n\nThe JWT ChillVault adds thermal mass (water volume) to the loop, increasing the time between compressor cycles. It has no internal diaphragm or bladder — it is a plain ASME vessel with inlet, outlet, and drain connections.\n\nSizing Rule of Thumb: 3-10 gallons of buffer per ton of cooling capacity, depending on system design and minimum run-time requirements. Consult the chiller manufacturer for specific recommendations.\n\nInstallation: Install in series or parallel with the chiller, typically on the return side. Inlet and outlet connections are on opposite ends to maximize thermal stratification. A separate expansion tank (HydroGuard series) is still required in the system for pressure control.`,
  },
  {
    id: "hv", name: "JWT HeatVault",
    subtitle: "Hot Water Buffer Tank",
    desc: "Adds thermal mass to heating systems to minimize boiler short-cycling during low/no-load conditions.",
    prefix: "JWT-HV", maxTemp: 450, potable: false, internals: "none",
    mawpOptions: [100, 125, 150, 175, 250], defaultMawp: 150,
    precharge: 0, color: "#D35400",
    howItWorks: `Similar to the ChillVault, the HeatVault adds thermal mass to a hot water heating loop. Modern modulating/condensing boilers are highly efficient but can short-cycle during low-load conditions — particularly during mild weather when the building needs very little heat. Short-cycling reduces boiler efficiency and causes thermal stress.\n\nThe JWT HeatVault provides additional water volume that absorbs excess heat during light loads, extending boiler run times and improving combustion efficiency.\n\nSizing Rule of Thumb: 5-10 gallons per boiler horsepower, or as recommended by the boiler manufacturer. For systems with multiple boilers, the buffer should be sized to the lead boiler.\n\nInstallation: Typically piped as a 2-port or 4-port configuration. In the 2-port (series) arrangement, the buffer is in-line with the boiler loop. In the 4-port arrangement, the buffer acts as a hydraulic separator between the boiler loop and the system loop. A separate expansion tank (HydroGuard series) is still required for pressurization.`,
  },
];

// ═══════════════════════════════════════════════════════════════
// ENGINEERING CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════

function interpolateWaterVolume(tempF) {
  if (tempF <= WATER_VOLUME_DATA[0].tempF) return WATER_VOLUME_DATA[0].vol;
  if (tempF >= WATER_VOLUME_DATA[WATER_VOLUME_DATA.length - 1].tempF)
    return WATER_VOLUME_DATA[WATER_VOLUME_DATA.length - 1].vol;
  for (let i = 0; i < WATER_VOLUME_DATA.length - 1; i++) {
    const a = WATER_VOLUME_DATA[i], b = WATER_VOLUME_DATA[i + 1];
    if (tempF >= a.tempF && tempF <= b.tempF) {
      const frac = (tempF - a.tempF) / (b.tempF - a.tempF);
      return a.vol + frac * (b.vol - a.vol);
    }
  }
  return 1.0;
}

function calcNetExpansionFactor(fillTempF, designTempF) {
  const vFinal = interpolateWaterVolume(designTempF);
  const vInitial = interpolateWaterVolume(fillTempF);
  const grossExpansion = (vFinal - vInitial) / vInitial;
  const pipingExpansion = 3 * 6.8e-6 * (designTempF - fillTempF);
  return Math.max(0, grossExpansion - pipingExpansion);
}

function calcAcceptanceFactor(pFillPsig, pMaxPsig) {
  const pFillAbs = pFillPsig + 14.7;
  const pMaxAbs = pMaxPsig + 14.7;
  if (pMaxAbs <= pFillAbs) return 0;
  return 1 - pFillAbs / pMaxAbs;
}

function calcDPF(linePressPsig, maxAllowPressPsig) {
  const denom = maxAllowPressPsig - linePressPsig;
  if (denom <= 0) return 999;
  return (maxAllowPressPsig + 14.7) / denom;
}

function calcShellThickness(P, R, S, E, CA) {
  const t = (P * R) / (S * E - 0.6 * P);
  return t + CA;
}

function calcHead21SE(P, D, S, E, CA) {
  const t = (P * D) / (2 * S * E - 0.2 * P);
  return t + CA;
}

function roundUpToStdThickness(t) {
  const stds = [0.1875, 0.25, 0.3125, 0.375, 0.4375, 0.5, 0.5625, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25];
  for (const s of stds) { if (s >= t - 0.001) return s; }
  return Math.ceil(t * 8) / 8;
}

function selectPipeSchedule(nps, mawp, mat) {
  const pipeData = STD_PIPE.find(p => p.nps === nps);
  if (!pipeData) return null;
  const S = mat.pipe.S;
  const E = 1.0;
  const R = pipeData.od / 2;
  const tReq = (mawp * R) / (S * E - 0.6 * mawp);
  const sortedScheds = Object.entries(pipeData.schedules).sort((a, b) => a[1] - b[1]);
  for (const [sch, tw] of sortedScheds) {
    if (tw >= tReq) {
      return { schedule: sch, tw, od: pipeData.od, id: pipeData.od - 2 * tw, tReq };
    }
  }
  const heaviest = sortedScheds[sortedScheds.length - 1];
  return { schedule: heaviest[0], tw: heaviest[1], od: pipeData.od, id: pipeData.od - 2 * heaviest[1], tReq };
}

function selectDiameter(targetVolGal) {
  for (const p of STD_PIPE) {
    const approxID = p.od - 0.75;
    const headVol2 = 2 * (Math.PI / 6) * Math.pow(approxID / 2, 3) / 231;
    const remainVol = targetVolGal - headVol2;
    if (remainVol <= 0) continue;
    const shellLen = (remainVol * 231 * 4) / (Math.PI * approxID * approxID);
    const ratio = shellLen / approxID;
    if (ratio >= 0.8 && ratio <= 5.0) return { type: "pipe", nps: p.nps };
  }
  for (const D of ROLLED_DIAMETERS) {
    const headVol2 = 2 * (Math.PI * Math.pow(D, 3)) / (24 * 231);
    const remainVol = targetVolGal - headVol2;
    if (remainVol <= 0) continue;
    const shellLen = (remainVol * 231 * 4) / (Math.PI * D * D);
    const ratio = shellLen / D;
    if (ratio >= 0.8 && ratio <= 5.0) return { type: "rolled", id: D };
  }
  let best = { type: "rolled", id: 36 };
  let bestDiff = Infinity;
  const allOptions = [
    ...STD_PIPE.map(p => ({ type: "pipe", nps: p.nps, approxID: p.od - 0.75 })),
    ...ROLLED_DIAMETERS.map(d => ({ type: "rolled", id: d, approxID: d })),
  ];
  for (const opt of allOptions) {
    const D = opt.approxID;
    const headVol2 = opt.type === "pipe" ?
      2 * (Math.PI / 6) * Math.pow(D / 2, 3) / 231 :
      2 * (Math.PI * Math.pow(D, 3)) / (24 * 231);
    const remainVol = targetVolGal - headVol2;
    if (remainVol <= 0) continue;
    const shellLen = (remainVol * 231 * 4) / (Math.PI * D * D);
    const ratio = shellLen / D;
    const diff = Math.abs(ratio - 2.5);
    if (diff < bestDiff) { bestDiff = diff; best = opt; }
  }
  return best;
}

function selectNozzleSize(tankVolGal, type) {
  if (type === "system") {
    if (tankVolGal <= 15) return { size: 0.5, label: '1/2" NPT' };
    if (tankVolGal <= 45) return { size: 0.75, label: '3/4" NPT' };
    if (tankVolGal <= 100) return { size: 1.0, label: '1" NPT' };
    if (tankVolGal <= 200) return { size: 1.25, label: '1-1/4" NPT' };
    if (tankVolGal <= 500) return { size: 1.5, label: '1-1/2" NPT' };
    if (tankVolGal <= 1000) return { size: 2.0, label: '2" NPT' };
    return { size: 3.0, label: '3" 150# RF Flange' };
  }
  if (type === "drain") {
    if (tankVolGal <= 100) return { size: 0.5, label: '1/2" NPT' };
    if (tankVolGal <= 500) return { size: 0.75, label: '3/4" NPT' };
    return { size: 1.0, label: '1" NPT' };
  }
  if (type === "airvalve") return { size: 0.25, label: 'Schrader Valve' };
  if (type === "buffer-in" || type === "buffer-out") {
    if (tankVolGal <= 200) return { size: 2.0, label: '2" NPT' };
    if (tankVolGal <= 500) return { size: 3.0, label: '3" 150# RF Flange' };
    return { size: 4.0, label: '4" 150# RF Flange' };
  }
  return { size: 1.0, label: '1" NPT' };
}

function designVessel(targetVolGal, mawp, product, materialId, CA) {
  const mat = MATERIALS[materialId];
  const E_rolled = 0.85;
  const E_pipe = 1.0;
  const dimChoice = selectDiameter(targetVolGal);
  const isPipe = dimChoice.type === "pipe";
  const isBuffer = product.id === "cv" || product.id === "hv";

  let D_ID, D_OD, tShell, tHead, tShellCalc, tHeadCalc, shellJointEff;
  let pipeSchedule = null;
  let constructionType, headType, shellSpec, headSpec;

  if (isPipe) {
    pipeSchedule = selectPipeSchedule(dimChoice.nps, mawp, mat);
    D_OD = pipeSchedule.od;
    tShell = pipeSchedule.tw;
    D_ID = pipeSchedule.id;
    tShellCalc = pipeSchedule.tReq + CA;
    shellJointEff = E_pipe;
    constructionType = `NPS ${dimChoice.nps} ${pipeSchedule.schedule} Pipe`;
    shellSpec = mat.pipe.spec;
    tHeadCalc = tShellCalc;
    tHead = tShell;
    headType = "Standard Pipe Cap (ASME B16.9)";
    headSpec = mat.pipeCap.spec;
  } else {
    D_ID = dimChoice.id;
    shellJointEff = E_rolled;
    const S = mat.shell.S;
    tShellCalc = calcShellThickness(mawp, D_ID / 2, S, E_rolled, CA);
    tHeadCalc = calcHead21SE(mawp, D_ID, S, E_rolled, CA);
    const minPractical = D_ID <= 36 ? 0.25 : D_ID <= 48 ? 0.3125 : D_ID <= 60 ? 0.375 : 0.5;
    tShell = roundUpToStdThickness(Math.max(tShellCalc, minPractical));
    tHead = roundUpToStdThickness(Math.max(tHeadCalc, minPractical));
    D_OD = D_ID + 2 * tShell;
    constructionType = `${D_ID}" ID Rolled Plate Shell`;
    headType = "2:1 Semi-Ellipsoidal (ASME)";
    shellSpec = mat.shell.spec;
    headSpec = mat.head.spec;
  }

  let headVol2Gal, headDepthID, shellLength;
  headDepthID = D_ID / 4;
  headVol2Gal = 2 * (Math.PI * Math.pow(D_ID, 3)) / (24 * 231);

  const shellVolNeeded = Math.max(0, targetVolGal - headVol2Gal);
  shellLength = Math.max(isPipe ? 4 : 6, (shellVolNeeded * 231 * 4) / (Math.PI * D_ID * D_ID));
  shellLength = Math.ceil(shellLength * 2) / 2;

  const actualVolGal = (Math.PI * D_ID * D_ID * shellLength / 4 + 2 * Math.PI * Math.pow(D_ID, 3) / 24) / 231;
  const OAL = shellLength + 2 * headDepthID + (isPipe ? 0 : 2 * tHead);

  const nozzles = [];
  if (isBuffer) {
    nozzles.push({ id: "N1", ...selectNozzleSize(targetVolGal, "buffer-in"), position: "top-head", label: "Inlet" });
    nozzles.push({ id: "N2", ...selectNozzleSize(targetVolGal, "buffer-out"), position: "bottom-head", label: "Outlet" });
    nozzles.push({ id: "N3", ...selectNozzleSize(targetVolGal, "drain"), position: "bottom-side", label: "Drain" });
    nozzles.push({ id: "N4", size: 0.75, label: '3/4" NPT', position: "top-side", label2: "Vent / Gauge" });
  } else {
    nozzles.push({ id: "N1", ...selectNozzleSize(targetVolGal, "system"), position: "bottom-head", label: "System Conn." });
    nozzles.push({ id: "N2", ...selectNozzleSize(targetVolGal, "drain"), position: "bottom-side", label: "Drain" });
    nozzles.push({ id: "N3", ...selectNozzleSize(targetVolGal, "airvalve"), position: "top-head", label: "Air Charge Valve" });
  }

  const rho = mat.density;
  const shellWeight = Math.PI * ((D_OD/2)**2 - (D_ID/2)**2) * shellLength * rho;
  const headWeight = 2 * (isPipe ? shellWeight * headDepthID / shellLength :
    0.35 * Math.PI * ((D_OD/2)**2 - (D_ID/2)**2) * headDepthID * rho * 2.5);
  const nozzleWeight = nozzles.length * (isPipe ? 3 : 15);
  const emptyWeight = Math.round(shellWeight + headWeight + nozzleWeight + (isPipe ? 5 : 30));
  const waterWeight = Math.round(actualVolGal * 8.34);

  return {
    isPipe, constructionType, headType, shellSpec, headSpec,
    D_ID: Math.round(D_ID * 100) / 100,
    D_OD: Math.round(D_OD * 100) / 100,
    tShell, tHead, tShellCalc, tHeadCalc,
    shellJointEff,
    shellLength: Math.round(shellLength * 10) / 10,
    headDepthID: Math.round(headDepthID * 100) / 100,
    OAL: Math.round(OAL * 10) / 10,
    actualVolGal: Math.round(actualVolGal * 10) / 10,
    nozzles, emptyWeight, waterWeight,
    operatingWeight: emptyWeight + waterWeight,
    material: mat, materialId, CA,
    pipeSchedule,
  };
}

// ═══════════════════════════════════════════════════════════════
// VESSEL SVG VISUALIZATION
// ═══════════════════════════════════════════════════════════════

function VesselSVG({ vessel, product, sizing }) {
  if (!vessel) return null;
  const { D_ID, shellLength, headDepthID, isPipe, nozzles } = vessel;

  const totalH = shellLength + 2 * headDepthID;
  const scaleX = 300 / (D_ID + 80);
  const scaleY = 440 / (totalH + 80);
  const scale = Math.min(scaleX, scaleY);
  const sw = D_ID * scale;
  const sh = shellLength * scale;
  const hd = headDepthID * scale;
  const cx = 200, topY = 50;
  const shellTop = topY + hd;
  const shellBot = shellTop + sh;
  const botY = shellBot + hd;

  const acceptVol = sizing?.expandedWater || sizing?.acceptanceVolGal || 0;
  const totalVol = vessel.actualVolGal || 1;
  const bladderFrac = product.internals === "none" ? 0.85 :
    product.internals === "full-bladder" ? 0.85 :
    product.internals === "partial-bladder" ? 0.55 :
    Math.min(0.7, Math.max(0.3, acceptVol / totalVol + 0.15));

  const iColors = {
    "diaphragm": "#E8D44D",
    "full-bladder": "#5DADE2",
    "partial-bladder": "#48C9B0",
    "none": "transparent",
  };
  const ic = iColors[product.internals];
  const headCurve = isPipe ? topY - 2 : topY;

  return (
    <svg viewBox="0 0 400 560" className="w-full h-full" style={{ maxHeight: 500 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4A4A4A" /><stop offset="25%" stopColor="#6A6A6A" />
          <stop offset="45%" stopColor="#8A8A8A" /><stop offset="55%" stopColor="#9A9A9A" />
          <stop offset="75%" stopColor="#7A7A7A" /><stop offset="100%" stopColor="#4A4A4A" />
        </linearGradient>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#AED6F1" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#AED6F1" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E86C1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1B4F72" stopOpacity="0.35" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="g"/>
          <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <path d={`M ${cx - sw/2} ${shellTop} Q ${cx - sw/2} ${headCurve}, ${cx} ${topY} Q ${cx + sw/2} ${headCurve}, ${cx + sw/2} ${shellTop}`}
        fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />
      <rect x={cx - sw/2} y={shellTop} width={sw} height={sh} fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />
      <path d={`M ${cx - sw/2} ${shellBot} Q ${cx - sw/2} ${botY + (isPipe ? 2 : 0)}, ${cx} ${botY} Q ${cx + sw/2} ${botY + (isPipe ? 2 : 0)}, ${cx + sw/2} ${shellBot}`}
        fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />

      {product.internals !== "none" && (
        <>
          <rect x={cx - sw/2 + 8} y={shellTop + 4} width={sw - 16}
            height={(sh) * (1 - bladderFrac) - 4} fill="url(#ag)" rx="3" />
          <text x={cx} y={shellTop + (sh) * (1 - bladderFrac) / 2 + 2}
            textAnchor="middle" fill="#85C1E9" fontSize="8" fontWeight="700" letterSpacing="1">
            PRE-CHARGED AIR
          </text>

          {product.internals === "diaphragm" && (
            <>
              <path d={`M ${cx - sw/2 + 5} ${shellTop + sh * (1 - bladderFrac)} Q ${cx} ${shellTop + sh * (1 - bladderFrac) + 8} ${cx + sw/2 - 5} ${shellTop + sh * (1 - bladderFrac)}`}
                fill="none" stroke={ic} strokeWidth="3" strokeDasharray="8,4" filter="url(#glow)" />
              <text x={cx} y={shellTop + sh * (1 - bladderFrac) - 6}
                textAnchor="middle" fill={ic} fontSize="7.5" fontWeight="800" letterSpacing="1.5">DIAPHRAGM</text>
            </>
          )}

          {(product.internals === "full-bladder" || product.internals === "partial-bladder") && (
            <>
              <rect x={cx - sw/2 + 12} y={shellTop + sh * (1 - bladderFrac) + 4}
                width={sw - 24} height={sh * bladderFrac + hd - 12}
                fill="none" stroke={ic} strokeWidth="2.5" strokeDasharray="6,3" rx="6" filter="url(#glow)" />
              <text x={cx} y={shellTop + sh * (1 - bladderFrac / 2) + 4}
                textAnchor="middle" fill={ic} fontSize="7.5" fontWeight="800" letterSpacing="1.5">
                {product.internals === "full-bladder" ? "REPLACEABLE BLADDER" : "PARTIAL BLADDER"}
              </text>
            </>
          )}

          <rect x={cx - sw/2 + (product.internals === "diaphragm" ? 8 : 14)}
            y={shellTop + sh * (1 - bladderFrac) + (product.internals === "diaphragm" ? 6 : 6)}
            width={sw - (product.internals === "diaphragm" ? 16 : 28)}
            height={sh * bladderFrac + hd - 14}
            fill="url(#wg)" rx="3" />
          <text x={cx} y={shellBot + hd/2 - 2}
            textAnchor="middle" fill="#5DADE2" fontSize="7" fontWeight="600" opacity="0.8">
            SYSTEM WATER
          </text>
        </>
      )}

      {product.internals === "none" && (
        <>
          <rect x={cx - sw/2 + 8} y={shellTop + 6} width={sw - 16} height={sh - 12}
            fill="url(#wg)" rx="3" />
          <text x={cx} y={(shellTop + shellBot) / 2}
            textAnchor="middle" fill="#5DADE2" fontSize="9" fontWeight="700" letterSpacing="1">
            SYSTEM WATER
          </text>
        </>
      )}

      {nozzles.map((n) => {
        const nLen = 18, nThk = Math.max(8, Math.min(16, n.size * 8));
        let nx, ny, isVert = false, isTop = false;
        if (n.position === "top-head") { nx = cx; ny = topY; isVert = true; isTop = true; }
        else if (n.position === "bottom-head") { nx = cx; ny = botY; isVert = true; }
        else if (n.position === "bottom-side") { nx = cx + sw/2; ny = shellBot - 20; }
        else if (n.position === "top-side") { nx = cx + sw/2; ny = shellTop + 20; }
        else { nx = cx + sw/2; ny = (shellTop + shellBot) / 2; }

        return (
          <g key={n.id}>
            {isVert ? (
              <>
                <rect x={nx - nThk/2} y={isTop ? ny - nLen : ny}
                  width={nThk} height={nLen} fill="#5A5A5A" stroke="#2C2C2C" strokeWidth="1.5" rx="1.5" />
                <rect x={nx - nThk/2 - 3} y={isTop ? ny - nLen - 3 : ny + nLen}
                  width={nThk + 6} height={4} fill="#4A4A4A" stroke="#2C2C2C" strokeWidth="1" rx="1" />
              </>
            ) : (
              <>
                <rect x={nx} y={ny - nThk/2} width={nLen} height={nThk}
                  fill="#5A5A5A" stroke="#2C2C2C" strokeWidth="1.5" rx="1.5" />
                <rect x={nx + nLen} y={ny - nThk/2 - 3} width={4} height={nThk + 6}
                  fill="#4A4A4A" stroke="#2C2C2C" strokeWidth="1" rx="1" />
              </>
            )}
            <text x={isVert ? nx + nThk/2 + 6 : nx + nLen + 10}
              y={isVert ? (isTop ? ny - nLen + 6 : ny + nLen) : ny + 3}
              fontSize="7.5" fill="#B0B0B0" fontWeight="600">{n.label2 || n.label}</text>
            <text x={isVert ? nx + nThk/2 + 6 : nx + nLen + 10}
              y={isVert ? (isTop ? ny - nLen + 15 : ny + nLen + 9) : ny + 12}
              fontSize="6.5" fill="#888" fontWeight="500">
              {n.id}: {n.size >= 1 && !n.label.includes("Schrader") ? n.label : (n.label.includes("Schrader") ? "Schrader" : n.label)}
            </text>
          </g>
        );
      })}

      <line x1={cx - sw/2 - 28} y1={topY} x2={cx - sw/2 - 28} y2={botY}
        stroke="#D4A017" strokeWidth="0.8" />
      <line x1={cx - sw/2 - 34} y1={topY} x2={cx - sw/2 - 22} y2={topY} stroke="#D4A017" strokeWidth="0.5" />
      <line x1={cx - sw/2 - 34} y1={botY} x2={cx - sw/2 - 22} y2={botY} stroke="#D4A017" strokeWidth="0.5" />
      <text x={cx - sw/2 - 32} y={(topY + botY) / 2 - 4} fontSize="7.5" fill="#D4A017"
        fontWeight="700" textAnchor="end" transform={`rotate(-90, ${cx - sw/2 - 32}, ${(topY + botY) / 2})`}>
        {vessel.OAL}" OAL
      </text>

      <line x1={cx - sw/2} y1={botY + 28} x2={cx + sw/2} y2={botY + 28} stroke="#D4A017" strokeWidth="0.8" />
      <line x1={cx - sw/2} y1={botY + 22} x2={cx - sw/2} y2={botY + 34} stroke="#D4A017" strokeWidth="0.5" />
      <line x1={cx + sw/2} y1={botY + 22} x2={cx + sw/2} y2={botY + 34} stroke="#D4A017" strokeWidth="0.5" />
      <text x={cx} y={botY + 42} fontSize="8" fill="#D4A017" textAnchor="middle" fontWeight="700">
        {vessel.D_ID}" ID / {vessel.D_OD}" OD
      </text>

      <text x={cx} y={botY + 56} fontSize="7" fill="#888" textAnchor="middle" fontWeight="500">
        {vessel.constructionType}
      </text>
      <text x={cx} y={botY + 66} fontSize="7" fill="#888" textAnchor="middle" fontWeight="500">
        {vessel.headType}
      </text>

      <text x={cx + sw/2 + 8} y={(shellTop + shellBot) / 2}
        fontSize="7" fill="#999" fontWeight="500"
        transform={`rotate(90, ${cx + sw/2 + 8}, ${(shellTop + shellBot) / 2})`}
        textAnchor="middle">
        t(shell) = {vessel.tShell}"
      </text>

      {vessel.actualVolGal > 15 && (
        <>
          <rect x={cx - sw/2 + 4} y={botY} width={10} height={18} fill="#3A3A3A" rx="1" stroke="#222" strokeWidth="1" />
          <rect x={cx + sw/2 - 14} y={botY} width={10} height={18} fill="#3A3A3A" rx="1" stroke="#222" strokeWidth="1" />
          <rect x={cx - sw/2} y={botY + 18} width={sw} height={3} fill="#333" rx="1" />
        </>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateReportHTML(product, inputs, sizing, vessel) {
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const modelNum = `${product.prefix}-${Math.round(vessel.actualVolGal)}`;
  const isBuffer = product.id === "cv" || product.id === "hv";
  const isPotable = product.potable;
  const mat = vessel.material;

  let h = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>JWT Engineering Report — ${modelNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;900&family=Source+Code+Pro:wght@400;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Source Sans 3',sans-serif;color:#1a1a1a;background:#fff;padding:40px 52px;font-size:10.5pt;line-height:1.55}
  h1{font-size:20pt;font-weight:900;color:#8B6914;border-bottom:3px solid #8B6914;padding-bottom:6px;margin-bottom:2px;letter-spacing:0.5px}
  h2{font-size:13pt;font-weight:700;color:#222;margin-top:26px;margin-bottom:8px;border-left:4px solid #B8860B;padding-left:12px}
  h3{font-size:11pt;font-weight:700;color:#444;margin-top:16px;margin-bottom:5px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
  .hdr-r{text-align:right;font-size:8.5pt;color:#666;line-height:1.6}
  .mdl{font-size:15pt;font-weight:900;color:#333;margin-top:2px}
  .sub{font-size:9.5pt;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin:8px 0 14px 0;font-size:9.5pt}
  th{background:#F5F0E0;color:#333;font-weight:700;text-align:left;padding:5px 10px;border:1px solid #D4C89A}
  td{padding:4px 10px;border:1px solid #ddd}
  tr:nth-child(even) td{background:#FAFAF5}
  .eq{font-family:'Source Code Pro',monospace;background:#F9F7F0;padding:7px 14px;margin:6px 0;border-left:3px solid #B8860B;font-size:9.5pt;display:block;line-height:1.7}
  .ref{font-size:8.5pt;color:#999;font-style:italic;margin:2px 0}
  .cs{margin:4px 0 4px 14px;line-height:1.7}
  .cs b{color:#8B6914}
  .rb{background:#FFFBF0;border:2px solid #B8860B;padding:12px 16px;margin:12px 0;border-radius:5px}
  .rb .v{font-size:16pt;font-weight:900;color:#8B6914}
  .ft{margin-top:36px;padding-top:14px;border-top:2px solid #B8860B;font-size:7.5pt;color:#aaa;text-align:center;line-height:1.6}
  .stamp{border:2px solid #333;padding:12px;margin-top:28px;font-size:8.5pt;width:280px;line-height:1.8}
  .stamp-t{font-weight:900;margin-bottom:4px;font-size:9pt}
  .hiw{background:#F5F5F0;border:1px solid #E0DCC8;border-radius:6px;padding:16px 20px;margin:20px 0;font-size:9.5pt;line-height:1.7;color:#444}
  .hiw h4{color:#8B6914;font-size:10.5pt;margin-bottom:8px}
  @media print{body{padding:20px 30px}}
</style></head><body>`;

  h += `<div class="hdr"><div>
    <h1>JOE WHITE TANK COMPANY, INC.</h1>
    <div class="mdl">${modelNum}</div>
    <div class="sub">${product.name} — ${product.subtitle}</div>
  </div><div class="hdr-r">
    <strong>Engineering Design Report</strong><br>Date: ${now}<br>Fort Worth, Texas<br>ASME Section VIII, Division 1
  </div></div>`;

  h += `<h2>1. Design Input Parameters</h2><table>
    <tr><th style="width:50%">Parameter</th><th>Value</th><th>Unit</th></tr>`;
  if (!isBuffer) {
    h += `<tr><td>${isPotable ? "Water Heater Volume" : "Total System Water Volume (V<sub>s</sub>)"}</td><td>${inputs.systemVol}</td><td>gallons</td></tr>`;
    if (!isPotable) {
      h += `<tr><td>System Fill Water Temperature (T<sub>f</sub>)</td><td>${inputs.fillTemp}</td><td>°F</td></tr>`;
    }
    h += `<tr><td>${isPotable ? "Operating Temperature (Aquastat)" : "Maximum Average Design Temperature (t)"}</td><td>${inputs.designTemp}</td><td>°F</td></tr>`;
    h += `<tr><td>${isPotable ? "Static Line Pressure" : "Minimum Operating Pressure at Tank (P<sub>f</sub>)"}</td><td>${inputs.minPressure}</td><td>psig</td></tr>`;
    h += `<tr><td>${isPotable ? "Maximum Allowable Pressure" : "Maximum Operating Pressure at Tank (P<sub>o</sub>)"}</td><td>${inputs.maxPressure}</td><td>psig</td></tr>`;
  } else {
    h += `<tr><td>Required Buffer Volume</td><td>${inputs.systemVol}</td><td>gallons</td></tr>`;
    h += `<tr><td>Maximum Operating Temperature</td><td>${inputs.designTemp}</td><td>°F</td></tr>`;
  }
  h += `<tr><td>Design Pressure (MAWP)</td><td>${inputs.mawp}</td><td>psig</td></tr>`;
  h += `<tr><td>Shell Material</td><td colspan="2">${vessel.shellSpec}</td></tr>`;
  h += `<tr><td>Head Material</td><td colspan="2">${vessel.headSpec}</td></tr>`;
  h += `<tr><td>Corrosion Allowance</td><td>${vessel.CA > 0 ? vessel.CA + '"' : "None (0)"}</td><td>${vessel.CA > 0 ? "inches" : "—"}</td></tr>`;
  h += `</table>`;

  if (!isBuffer) {
    h += `<h2>2. Expansion Tank Sizing Calculations</h2>`;
    if (!isPotable) {
      h += `<h3>2.1 Method: Critical Sizing Method (Recommended)</h3>`;
      h += `<p class="ref">References: ASHRAE Handbook, HVAC Systems & Equipment, Chapter 15; Smithsonian Physical Tables.</p>`;
      h += `<h3>Step 1 — Net Expansion Factor of Water</h3>`;
      h += `<span class="eq">Net Expansion = Gross Water Expansion − Piping Expansion<br>
Gross Expansion = (V<sub>final</sub> − V<sub>initial</sub>) / V<sub>initial</sub><br>
Piping Expansion = 3 × α × ΔT&emsp;where α = 6.8 × 10<sup>−6</sup> in/in/°F</span>`;
      h += `<div class="cs">
        V<sub>final</sub> at ${inputs.designTemp}°F = <b>${sizing.vFinal?.toFixed(6)}</b><br>
        V<sub>initial</sub> at ${inputs.fillTemp}°F = <b>${sizing.vInitial?.toFixed(6)}</b><br>
        Gross Water Expansion = <b>${sizing.grossExpansion?.toFixed(6)}</b><br>
        Piping Expansion = <b>${sizing.pipingExpansion?.toFixed(6)}</b><br>
        <b>Net Expansion Factor = ${sizing.netExpansionFactor?.toFixed(6)}</b>
      </div>`;
      h += `<h3>Step 2 — Amount of Expanded Water</h3>`;
      h += `<span class="eq">Expanded Water = V<sub>s</sub> × Net Expansion Factor = ${inputs.systemVol} × ${sizing.netExpansionFactor?.toFixed(6)} = <b>${sizing.expandedWater?.toFixed(2)} gal</b></span>`;
      h += `<h3>Step 3 — Acceptance Factor (Boyle's Law)</h3>`;
      h += `<span class="eq">Acceptance Factor = 1 − (P<sub>f</sub> + 14.7) / (P<sub>o</sub> + 14.7) = <b>${sizing.acceptanceFactor?.toFixed(4)}</b></span>`;
      h += `<h3>Step 4 — Minimum Tank Volume Required</h3>`;
      h += `<div class="rb">V<sub>t,min</sub> = ${sizing.expandedWater?.toFixed(2)} / ${sizing.acceptanceFactor?.toFixed(4)} = <span class="v">${sizing.minTankVol?.toFixed(1)} gallons</span><br>
      <span style="font-size:9pt;color:#666">Selected: <b>${vessel.actualVolGal} gallons</b> (≥5% margin)</span></div>`;
    } else {
      h += `<h3>2.1 Method: Thermal Expansion DPF Sizing</h3>`;
      h += `<h3>Step 1 — Water Expansion Factor</h3>`;
      h += `<div class="cs">Expansion Factor = <b>${sizing.netExpansionFactor?.toFixed(4)}</b></div>`;
      h += `<h3>Step 2 — Expanded Water = <b>${sizing.expandedWater?.toFixed(2)} gallons</b></h3>`;
      h += `<h3>Step 3 — Design Pressure Factor = <b>${sizing.dpf?.toFixed(3)}</b></h3>`;
      h += `<div class="rb">V<sub>t</sub> = <span class="v">${sizing.minTankVol?.toFixed(1)} gallons</span></div>`;
    }
  } else {
    h += `<h2>2. Buffer Tank Volume Selection</h2>`;
    h += `<div class="rb">Required Buffer Volume: <span class="v">${inputs.systemVol} gallons</span></div>`;
  }

  h += `<h2>3. Pressure Vessel Mechanical Design</h2>`;
  h += `<p class="ref">Reference: ASME BPVC Section VIII, Division 1 (2023 Edition)</p>`;
  h += `<h3>3.1 Construction Method: ${vessel.constructionType}</h3>`;

  if (vessel.isPipe) {
    h += `<h3>3.2 Shell Adequacy Check — UG-27</h3>`;
    h += `<span class="eq">t<sub>req</sub> = P × R / (S × E − 0.6P) + CA = <b>${vessel.tShellCalc.toFixed(4)}"</b></span>`;
    h += `<div class="cs">Pipe wall provided: <b>${vessel.tShell}"</b> ≥ ${vessel.tShellCalc.toFixed(4)}" required ✓</div>`;
  } else {
    h += `<h3>3.2 Cylindrical Shell — UG-27(c)(1)</h3>`;
    h += `<span class="eq">t = PR / (SE − 0.6P) + CA = <b>${vessel.tShellCalc.toFixed(4)}"</b> → Selected: <b>${vessel.tShell}"</b> ✓</span>`;
    h += `<h3>3.3 2:1 Semi-Ellipsoidal Head — UG-32(d)</h3>`;
    h += `<span class="eq">t = PD / (2SE − 0.2P) + CA = <b>${vessel.tHeadCalc.toFixed(4)}"</b> → Selected: <b>${vessel.tHead}"</b> ✓</span>`;
  }

  h += `<h2>4. Final Vessel Dimensions & Specifications</h2>`;
  h += `<div class="rb"><strong>Model Designation: ${modelNum}</strong></div>`;
  h += `<table>
    <tr><th>Specification</th><th>Value</th></tr>
    <tr><td>Construction</td><td>${vessel.constructionType}</td></tr>
    <tr><td>Head Type</td><td>${vessel.headType}</td></tr>
    <tr><td>Inside Diameter</td><td>${vessel.D_ID}"</td></tr>
    <tr><td>Outside Diameter</td><td>${vessel.D_OD}"</td></tr>
    <tr><td>Shell Thickness</td><td>${vessel.tShell}"</td></tr>
    <tr><td>Head Thickness</td><td>${vessel.tHead}"</td></tr>
    <tr><td>Straight Shell Length (S/S)</td><td>${vessel.shellLength}"</td></tr>
    <tr><td>Overall Length</td><td>${vessel.OAL}"</td></tr>
    <tr><td>Actual Volume</td><td>${vessel.actualVolGal} gallons</td></tr>
    <tr><td>Empty Weight (est.)</td><td>~${vessel.emptyWeight} lbs</td></tr>
    <tr><td>Operating Weight</td><td>~${vessel.operatingWeight} lbs</td></tr>
    <tr><td>Design Pressure (MAWP)</td><td>${inputs.mawp} psig</td></tr>
    <tr><td>Max Operating Temperature</td><td>${product.maxTemp}°F</td></tr>
    <tr><td>Factory Pre-charge</td><td>${product.precharge > 0 ? product.precharge + " psig" : "N/A (buffer tank)"}</td></tr>
    <tr><td>Code</td><td>ASME Section VIII, Division 1</td></tr>
    <tr><td>Material (Shell)</td><td>${vessel.shellSpec}</td></tr>
    <tr><td>Material (Head)</td><td>${vessel.headSpec}</td></tr>
  </table>`;

  h += `<h3>4.1 Nozzle Schedule</h3><table>
    <tr><th>Tag</th><th>Service</th><th>Size</th><th>Position</th></tr>`;
  vessel.nozzles.forEach((n) => {
    h += `<tr><td>${n.id}</td><td>${n.label2 || n.label}</td><td>${n.label.includes("Schrader") ? "Schrader Valve" : n.label}</td><td>${n.position.replace(/-/g, " ").toUpperCase()}</td></tr>`;
  });
  h += `</table>`;

  h += `<h2>5. How This Vessel Works</h2>`;
  h += `<div class="hiw"><h4>${product.name} — ${product.subtitle}</h4>`;
  product.howItWorks.split('\n\n').forEach(para => {
    h += `<p style="margin-bottom:10px">${para}</p>`;
  });
  h += `</div>`;

  h += `<div class="stamp"><div class="stamp-t">PROFESSIONAL ENGINEER APPROVAL</div>
    Name: ___________________________<br>PE License No.: ____________________<br>
    State: _________ Date: ____________<br>Signature: ______________________</div>`;

  h += `<div class="ft">
    Joe White Tank Company, Inc. — Fort Worth, Texas — ASME U-Stamp Certified<br>
    Generated by JWT Expansion Tank Designer v2.0. Calculations per ASME BPVC VIII-1 &amp; ASHRAE methodology.<br>
    PE verification required prior to fabrication. This report does not constitute a stamped engineering drawing.
  </div></body></html>`;
  return h;
}

// ═══════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [selProduct, setSelProduct] = useState(null);
  const [materialId, setMaterialId] = useState("CS");
  const [useCA, setUseCA] = useState(true);
  const [caValue, setCaValue] = useState(0.0625);
  const [showReport, setShowReport] = useState(false);
  const [reportHTML, setReportHTML] = useState("");
  const [inputs, setInputs] = useState({
    systemVol: 1000, fillTemp: 40, designTemp: 180,
    minPressure: 12, maxPressure: 30, mawp: 150,
  });

  const product = PRODUCTS.find(p => p.id === selProduct);
  const isBuffer = product?.id === "cv" || product?.id === "hv";
  const isPotable = product?.potable;
  const CA = useCA ? caValue : 0;

  const updateInput = (key, val) => setInputs(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));

  const results = useMemo(() => {
    if (!product) return null;
    const { systemVol, fillTemp, designTemp, minPressure, maxPressure, mawp } = inputs;
    if (systemVol <= 0 || mawp <= 0) return null;

    if (isBuffer) {
      const vessel = designVessel(systemVol, mawp, product, materialId, CA);
      return { sizing: { minTankVol: systemVol, acceptanceVolGal: systemVol }, vessel };
    }

    const fillT = isPotable ? 40 : fillTemp;
    const vFinal = interpolateWaterVolume(designTemp);
    const vInitial = interpolateWaterVolume(fillT);
    const grossExpansion = (vFinal - vInitial) / vInitial;
    const pipingExpansion = 3 * 6.8e-6 * (designTemp - fillT);
    const netExpansionFactor = Math.max(0, grossExpansion - pipingExpansion);
    const expandedWater = systemVol * netExpansionFactor;

    let acceptanceFactor, minTankVol, dpf;
    if (isPotable) {
      dpf = calcDPF(minPressure, maxPressure);
      minTankVol = expandedWater * dpf;
      acceptanceFactor = 1 / dpf;
    } else {
      acceptanceFactor = calcAcceptanceFactor(minPressure, maxPressure);
      minTankVol = acceptanceFactor > 0 ? expandedWater / acceptanceFactor : 9999;
    }

    const selectedVol = Math.max(minTankVol * 1.05, 2);
    const vessel = designVessel(selectedVol, mawp, product, materialId, CA);

    return {
      sizing: { vFinal, vInitial, grossExpansion, pipingExpansion, netExpansionFactor, expandedWater, acceptanceFactor, dpf, minTankVol },
      vessel,
    };
  }, [product, inputs, isBuffer, isPotable, materialId, CA]);

  const handleReport = useCallback(() => {
    if (!results || !product) return;
    const html = generateReportHTML(product, inputs, results.sizing, results.vessel);
    setReportHTML(html);
    setShowReport(true);
  }, [results, product, inputs]);

  const handleReset = () => {
    setSelProduct(null);
    setMaterialId("CS");
    setUseCA(true);
    setCaValue(0.0625);
    setShowReport(false);
    setReportHTML("");
    setInputs({ systemVol: 1000, fillTemp: 40, designTemp: 180, minPressure: 12, maxPressure: 30, mawp: 150 });
  };

  if (!selProduct) {
    return (
      <div style={{ background: "linear-gradient(160deg, #080810 0%, #12121E 40%, #0A0A14 100%)", minHeight: "100vh", padding: "24px 20px", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44, paddingTop: 24 }}>
            <div style={{ display: "inline-block", paddingBottom: 14, marginBottom: 10, borderBottom: "2px solid #B8860B" }}>
              <div style={{ fontSize: 10, letterSpacing: 8, color: "#8B7D6B", fontWeight: 600, marginBottom: 6 }}>JOE WHITE TANK COMPANY, INC.</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#F0E6D3", letterSpacing: 0.5, lineHeight: 1.1 }}>EXPANSION TANK</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#B8860B", letterSpacing: 0.5 }}>DESIGNER & SIZER</div>
            </div>
            <div style={{ fontSize: 11, color: "#5A5A6E", marginTop: 10, letterSpacing: 3, fontWeight: 500 }}>FORT WORTH, TEXAS &nbsp;·&nbsp; ASME U-STAMP CERTIFIED</div>
            <div style={{ fontSize: 11, color: "#444", marginTop: 14, maxWidth: 600, margin: "14px auto 0" }}>Select a product line below to begin your engineering design and sizing calculation.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
            {PRODUCTS.map(p => (
              <button key={p.id} onClick={() => {
                setSelProduct(p.id);
                if (p.id === "as") setInputs({ systemVol: 80, fillTemp: 40, designTemp: 150, minPressure: 60, maxPressure: 125, mawp: 150 });
                else if (p.id === "cv") setInputs({ systemVol: 200, fillTemp: 40, designTemp: 45, minPressure: 12, maxPressure: 30, mawp: 150 });
                else if (p.id === "hv") setInputs({ systemVol: 200, fillTemp: 40, designTemp: 200, minPressure: 12, maxPressure: 30, mawp: 150 });
                else setInputs({ systemVol: 1000, fillTemp: 40, designTemp: 180, minPressure: 12, maxPressure: 30, mawp: 150 });
                setMaterialId(p.potable ? "SS" : "CS");
              }}
              style={{
                background: "linear-gradient(150deg, #18182A 0%, #1E1E32 100%)", border: `1px solid ${p.color}25`,
                borderRadius: 10, padding: "20px 18px", textAlign: "left", cursor: "pointer",
                transition: "all 0.25s ease", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = p.color + "88"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${p.color}18`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.color + "25"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${p.color}, ${p.color}66)` }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: "#F0E6D3", marginBottom: 3, letterSpacing: 0.3 }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: p.color, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>{p.subtitle}</div>
                <div style={{ fontSize: 10, color: "#7A7A8E", lineHeight: 1.55 }}>{p.desc}</div>
                <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8.5, background: `${p.color}18`, color: p.color, padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>{p.maxTemp}°F max</span>
                  <span style={{ fontSize: 8.5, background: "#B8860B18", color: "#B8860B", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>{Math.max(...p.mawpOptions)} psig</span>
                  {p.potable && <span style={{ fontSize: 8.5, background: "#27AE6018", color: "#27AE60", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>NSF/ANSI 61</span>}
                  {p.internals === "full-bladder" && <span style={{ fontSize: 8.5, background: "#2980B918", color: "#85C1E9", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>Replaceable Bladder</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const modelNum = results?.vessel ? `${product.prefix}-${Math.round(results.vessel.actualVolGal)}` : "—";

  return (
    <div style={{ background: "#0D0D16", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: "#E0DAD0", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#08080E", borderBottom: "1px solid #B8860B22", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={handleReset} style={{ background: "none", border: "1px solid #B8860B44", color: "#B8860B", padding: "4px 14px", borderRadius: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5 }}>← PRODUCTS</button>
          <div><span style={{ fontSize: 9, letterSpacing: 4, color: "#6A6A7A", fontWeight: 700 }}>JWT TANK DESIGNER</span></div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: product.color }}>{product.name}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr 290px", flex: 1, minHeight: 0 }}>

        <div style={{ background: "#10101A", borderRight: "1px solid #1E1E30", padding: "16px 16px 100px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#B8860B", letterSpacing: 3, marginBottom: 14 }}>DESIGN INPUTS</div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>MATERIAL</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.values(MATERIALS).map(m => (
                <button key={m.id} onClick={() => setMaterialId(m.id)}
                  style={{ flex: 1, padding: "7px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    background: materialId === m.id ? "#B8860B" : "#1A1A2A",
                    color: materialId === m.id ? "#0D0D16" : "#888",
                    border: materialId === m.id ? "none" : "1px solid #2A2A3A",
                  }}>{m.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ ...lbl, marginBottom: 0, flex: 1 }}>CORROSION ALLOWANCE</label>
            <button onClick={() => setUseCA(!useCA)}
              style={{ width: 42, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative",
                background: useCA ? "#B8860B" : "#2A2A3A", transition: "background 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 3,
                left: useCA ? 23 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
          {useCA && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[0.0625, 0.125].map(v => (
                  <button key={v} onClick={() => setCaValue(v)}
                    style={{ flex: 1, padding: "5px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                      background: caValue === v ? "#B8860B33" : "#1A1A2A",
                      color: caValue === v ? "#B8860B" : "#666",
                      border: `1px solid ${caValue === v ? "#B8860B44" : "#2A2A3A"}`,
                    }}>{v}" ({v === 0.0625 ? "1/16" : "1/8"}")</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid #1E1E30", margin: "12px 0", paddingTop: 12 }} />

          <InputField label={isBuffer ? "Required Buffer Volume" : (isPotable ? "Water Heater Volume" : "System Water Volume (Vs)")}
            unit="gal" value={inputs.systemVol} onChange={v => updateInput("systemVol", v)} />

          {!isBuffer && !isPotable && (
            <InputField label="Fill Water Temperature (Tf)" unit="°F" value={inputs.fillTemp}
              onChange={v => updateInput("fillTemp", v)} />
          )}

          <InputField label={isBuffer ? "Max Operating Temperature" : (isPotable ? "Aquastat Temperature" : "Max Design Temperature (t)")}
            unit="°F" value={inputs.designTemp} onChange={v => updateInput("designTemp", v)} />

          {!isBuffer && (
            <>
              <InputField label={isPotable ? "Static Line Pressure (Pf)" : "Min Operating Pressure (Pf)"}
                unit="psig" value={inputs.minPressure} onChange={v => updateInput("minPressure", v)} />
              <InputField label={isPotable ? "Max Allowable Pressure (Po)" : "Max Operating Pressure (Po)"}
                unit="psig" value={inputs.maxPressure} onChange={v => updateInput("maxPressure", v)} />
            </>
          )}

          <div style={{ marginTop: 4, marginBottom: 14 }}>
            <label style={lbl}>DESIGN PRESSURE (MAWP)</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {product.mawpOptions.map(p => (
                <button key={p} onClick={() => updateInput("mawp", p)}
                  style={{ padding: "5px 9px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    background: inputs.mawp === p ? product.color : "#1A1A2A",
                    color: inputs.mawp === p ? "#fff" : "#666",
                    border: inputs.mawp === p ? "none" : "1px solid #2A2A3A",
                  }}>{p}</button>
              ))}
              <span style={{ fontSize: 9, color: "#555", alignSelf: "center", marginLeft: 2 }}>psig</span>
            </div>
          </div>

          {results && (
            <div style={{ background: "#08080E", borderRadius: 8, padding: 14, border: "1px solid #B8860B22", marginTop: 8 }}>
              <div style={{ fontSize: 9, color: "#B8860B", fontWeight: 800, letterSpacing: 3, marginBottom: 10 }}>SIZING RESULTS</div>
              {!isBuffer && (
                <>
                  <RR label="Net Expansion Factor" value={results.sizing.netExpansionFactor?.toFixed(5)} />
                  <RR label="Expanded Water" value={`${results.sizing.expandedWater?.toFixed(2)} gal`} />
                  {!isPotable && <RR label="Acceptance Factor" value={results.sizing.acceptanceFactor?.toFixed(4)} />}
                  {isPotable && <RR label="Design Pressure Factor" value={results.sizing.dpf?.toFixed(3)} />}
                </>
              )}
              <div style={{ borderTop: "1px solid #B8860B33", paddingTop: 8, marginTop: 8 }}>
                <RR label="Min Tank Volume" value={`${results.sizing.minTankVol?.toFixed(1)} gal`} hl />
                <RR label="Selected Volume" value={`${results.vessel.actualVolGal} gal`} hl />
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, background: "#0C0C16", border: "1px solid #1E1E30", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, color: product.color, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>HOW THIS VESSEL WORKS</div>
            <div style={{ fontSize: 10, color: "#8A8A9E", lineHeight: 1.65 }}>
              {product.howItWorks.split('\n\n').map((p, i) => (
                <p key={i} style={{ marginBottom: 10 }}>{p}</p>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: "linear-gradient(180deg, #0A0A14, #0D0D18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, #1A1A2A 0.5px, transparent 0.5px)", backgroundSize: "18px 18px", opacity: 0.4 }} />

          <div style={{ position: "relative", zIndex: 2, background: "#B8860B12", border: "1px solid #B8860B33", borderRadius: 8, padding: "8px 22px", marginBottom: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#B8860B", letterSpacing: 2.5, textAlign: "center" }}>{modelNum}</div>
            <div style={{ fontSize: 9, color: "#6A6A7A", textAlign: "center", letterSpacing: 1 }}>{product.subtitle}</div>
            {results?.vessel && (
              <div style={{ fontSize: 8.5, color: "#555", textAlign: "center", marginTop: 2 }}>
                {results.vessel.constructionType} · {MATERIALS[materialId].label}
              </div>
            )}
          </div>

          {results?.vessel && (
            <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
              <VesselSVG vessel={results.vessel} product={product} sizing={results.sizing} />
            </div>
          )}
        </div>

        <div style={{ background: "#10101A", borderLeft: "1px solid #1E1E30", padding: "16px 14px 100px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#B8860B", letterSpacing: 3, marginBottom: 14 }}>SPECIFICATIONS</div>

          {results?.vessel && (
            <>
              <SS title="CONSTRUCTION">
                <SR label="Type" value={results.vessel.isPipe ? "Pipe + Caps" : "Rolled + 2:1 SE"} />
                <SR label="Shell" value={results.vessel.constructionType} />
                <SR label="Head" value={results.vessel.headType} />
                <SR label="Material" value={MATERIALS[materialId].label} />
              </SS>
              <SS title="DIMENSIONS">
                <SR label="ID" value={`${results.vessel.D_ID}"`} />
                <SR label="OD" value={`${results.vessel.D_OD}"`} />
                <SR label="Shell Length" value={`${results.vessel.shellLength}"`} />
                <SR label="OAL" value={`${results.vessel.OAL}"`} />
              </SS>
              <SS title="THICKNESS">
                <SR label="Shell" value={`${results.vessel.tShell}"`} />
                <SR label="Head" value={`${results.vessel.tHead}"`} />
                <SR label="Corr. Allow." value={CA > 0 ? `${CA}"` : "None"} />
              </SS>
              <SS title="WEIGHTS (EST.)">
                <SR label="Empty" value={`${results.vessel.emptyWeight} lbs`} />
                <SR label="Water" value={`${results.vessel.waterWeight} lbs`} />
                <SR label="Operating" value={`${results.vessel.operatingWeight} lbs`} />
              </SS>
              <SS title="NOZZLE SCHEDULE">
                {results.vessel.nozzles.map((n) => (
                  <SR key={n.id} label={`${n.id} — ${n.label2 || n.label}`}
                    value={n.label.includes("Schrader") ? "Schrader" : `${n.size}"`} />
                ))}
              </SS>
              <SS title="DESIGN DATA">
                <SR label="MAWP" value={`${inputs.mawp} psig`} />
                <SR label="Max Temp" value={`${product.maxTemp}°F`} />
                <SR label="Joint Eff." value={`${results.vessel.shellJointEff} ${results.vessel.isPipe ? "(seamless)" : "(Spot RT)"}`} />
                <SR label="Pre-charge" value={product.precharge > 0 ? `${product.precharge} psig` : "N/A"} />
                <SR label="Code" value="ASME VIII-1" />
              </SS>
            </>
          )}
        </div>
      </div>

      <div style={{ background: "#08080E", borderTop: "1px solid #B8860B22", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={handleReset} style={{
          background: "transparent", border: "1px solid #444", color: "#777", padding: "10px 26px",
          borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#C0392B"; e.currentTarget.style.color = "#C0392B"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#777"; }}>
          ↻ RESET ALL
        </button>

        <button onClick={handleReport} style={{
          background: "linear-gradient(135deg, #8B6914, #B8860B, #D4A017)", border: "none",
          color: "#0A0A0A", padding: "11px 32px", borderRadius: 6, cursor: "pointer",
          fontSize: 12, fontWeight: 900, letterSpacing: 2,
          boxShadow: "0 4px 20px #B8860B33", transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 28px #B8860B55"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px #B8860B33"; }}>
          📄 GENERATE ENGINEERING REPORT
        </button>
      </div>

      {showReport && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            background: "#1A1A1A", borderBottom: "2px solid #B8860B",
            padding: "10px 24px", display: "flex", justifyContent: "space-between",
            alignItems: "center", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#B8860B", letterSpacing: 1 }}>ENGINEERING REPORT</span>
              <span style={{ fontSize: 10, color: "#666" }}>{product.prefix}-{results?.vessel ? Math.round(results.vessel.actualVolGal) : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  const printWindow = document.getElementById("jwt-report-frame");
                  if (printWindow && printWindow.contentWindow) {
                    printWindow.contentWindow.print();
                  }
                }}
                style={{
                  background: "linear-gradient(135deg, #B8860B, #D4A017)",
                  border: "none", color: "#0A0A0A", padding: "8px 22px",
                  borderRadius: 5, cursor: "pointer", fontSize: 11,
                  fontWeight: 800, letterSpacing: 1,
                }}>
                🖨 PRINT / SAVE PDF
              </button>
              <button
                onClick={() => setShowReport(false)}
                style={{
                  background: "transparent", border: "1px solid #555",
                  color: "#999", padding: "8px 18px", borderRadius: 5,
                  cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1,
                }}>
                ✕ CLOSE
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "center", overflow: "auto", padding: "20px" }}>
            <iframe
              id="jwt-report-frame"
              srcDoc={reportHTML}
              title="JWT Engineering Report"
              style={{
                width: "8.5in", maxWidth: "100%", minHeight: "100%",
                border: "none", borderRadius: 6,
                background: "#fff",
                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STYLE CONSTANTS ─────────────────────────────────────────────
const lbl = { fontSize: 9.5, color: "#6A6A7A", fontWeight: 700, display: "block", marginBottom: 4, letterSpacing: 1.5 };

// ─── REUSABLE COMPONENTS ─────────────────────────────────────────

function InputField({ label, unit, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      <div style={{ display: "flex" }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          style={{
            background: "#16162A", border: "1px solid #2A2A3A", borderRight: "none",
            borderRadius: "5px 0 0 5px", color: "#F0E6D3", padding: "7px 11px",
            fontSize: 13, fontWeight: 700, width: "100%", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = "#B8860B"}
          onBlur={e => e.target.style.borderColor = "#2A2A3A"} />
        <div style={{
          background: "#1E1E32", border: "1px solid #2A2A3A", borderRadius: "0 5px 5px 0",
          padding: "7px 10px", fontSize: 10, color: "#666", fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center",
        }}>{unit}</div>
      </div>
    </div>
  );
}

function RR({ label, value, hl }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, padding: "1px 0" }}>
      <span style={{ fontSize: 9.5, color: "#777" }}>{label}</span>
      <span style={{ fontSize: hl ? 11.5 : 10, color: hl ? "#B8860B" : "#C8BFA0", fontWeight: hl ? 800 : 600, fontFamily: "'Courier New', monospace" }}>{value}</span>
    </div>
  );
}

function SS({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 8.5, color: "#555", fontWeight: 800, letterSpacing: 2.5, marginBottom: 5, paddingBottom: 3, borderBottom: "1px solid #1E1E30" }}>{title}</div>
      {children}
    </div>
  );
}

function SR({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 0", borderBottom: "1px solid #13131E" }}>
      <span style={{ fontSize: 9.5, color: "#777" }}>{label}</span>
      <span style={{ fontSize: 9.5, color: "#D0CAB8", fontWeight: 600, fontFamily: "'Courier New', monospace", textAlign: "right", maxWidth: "55%" }}>{value}</span>
    </div>
  );
}
