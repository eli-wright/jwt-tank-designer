import { useState, useMemo, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   JWT EXPANSION TANK DESIGNER & SIZER v2.0
   Joe White Tank Company, Inc. — Fort Worth, Texas
   Professional Engineering Tool
   ═══════════════════════════════════════════════════════════════ */

// ─── JWT LOGO (embedded base64) ──────────────────────────────────
const JWT_LOGO = "data:image/jpeg;base64,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";

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
// For sizes ≤24": Use standard pipe + pipe caps
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

// For sizes ≥30": Rolled plate shell IDs
const ROLLED_DIAMETERS = [30, 36, 42, 48, 54, 60, 66, 72, 84, 96];

// ─── NOZZLE PIPE DATA (per ASME B36.10M / B36.19M) ─────────────
// Standard pipe dimensions for nozzle necks
const NOZZLE_PIPE_DATA = {
  0.25: { od: 0.540, sch40: 0.088, sch80: 0.119, sch160: 0.188 },
  0.5:  { od: 0.840, sch40: 0.109, sch80: 0.147, sch160: 0.187 },
  0.75: { od: 1.050, sch40: 0.113, sch80: 0.154, sch160: 0.219 },
  1.0:  { od: 1.315, sch40: 0.133, sch80: 0.179, sch160: 0.250 },
  1.25: { od: 1.660, sch40: 0.140, sch80: 0.191, sch160: 0.250 },
  1.5:  { od: 1.900, sch40: 0.145, sch80: 0.200, sch160: 0.281 },
  2.0:  { od: 2.375, sch40: 0.154, sch80: 0.218, sch160: 0.343 },
  3.0:  { od: 3.500, sch40: 0.216, sch80: 0.300, sch160: 0.437 },
  4.0:  { od: 4.500, sch40: 0.237, sch80: 0.337, sch160: 0.531 },
};

// ─── NOZZLE REINFORCEMENT CALCULATION (ASME VIII-1 UG-37) ───────
// Area replacement method per UG-37
function calcNozzleReinforcement(params) {
  const {
    P,          // Design pressure (psig)
    S_v,        // Allowable stress of vessel shell (psi)
    S_n,        // Allowable stress of nozzle material (psi)
    E_v,        // Joint efficiency of vessel shell
    E_n,        // Joint efficiency of nozzle (1.0 for seamless pipe)
    t_vessel,   // Nominal thickness of vessel shell (in)
    t_nozzle,   // Nominal thickness of nozzle neck wall (in)
    R_vessel,   // Inside radius of vessel shell (in)
    d,          // Finished diameter of opening in corroded condition (in)
    nozzleOD,   // Nozzle pipe OD (in)
    CA,         // Corrosion allowance (in)
    inHead,     // Boolean: true if nozzle is in the head
    headD,      // Vessel ID (for head t_r calculation)
    weldLeg,    // Fillet weld leg size (in)
  } = params;

  // f_r1 = S_n / S_v — strength reduction factor (nozzle vs shell)
  const f_r1 = Math.min(1.0, S_n / S_v);
  // f_r2 = S_n / S_v for nozzle outward
  const f_r2 = f_r1;
  // F = correction factor = 1.0 for nozzles perpendicular to shell
  const F = 1.0;

  // Required thickness of shell (corroded), per UG-27
  const t_r_shell = (P * R_vessel) / (S_v * E_v - 0.6 * P);
  // Required thickness of head (corroded), per UG-32(d) for 2:1 SE
  const t_r_head = (P * headD) / (2 * S_v * E_v - 0.2 * P);
  // Use appropriate t_r
  const t_r = inHead ? t_r_head : t_r_shell;

  // Required thickness of nozzle wall (as a cylinder), per UG-27
  const R_n = (nozzleOD / 2 - t_nozzle); // nozzle inside radius (uncorroded)
  const t_rn = (P * (R_n + CA)) / (S_n * E_n - 0.6 * P);

  // Corroded thicknesses
  const t_c = t_vessel - CA;     // corroded vessel thickness
  const t_nc = t_nozzle - CA;    // corroded nozzle thickness

  // UG-40: Limits of reinforcement
  // Parallel to vessel: d or R_n + t_nc + t_c, whichever is larger
  const limit_parallel = Math.max(d, R_n + t_nc + t_c);
  // Perpendicular (outward): smaller of 2.5*t_c or 2.5*t_nc + t_e
  const limit_perp = Math.min(2.5 * t_c, 2.5 * t_nc);

  // A_required = d × t_r × F + 2 × t_nc × t_r × F × (1 - f_r1)
  // When f_r1 = 1.0 (same material): A_required = d × t_r × F
  const A_req = d * t_r * F + 2 * t_nc * t_r * F * (1 - f_r1);

  // A1: Excess thickness in vessel wall (larger of two methods)
  const A1_a = d * (E_v * t_c - F * t_r) - 2 * t_nc * (E_v * t_c - F * t_r) * (1 - f_r1);
  const A1_b = 2 * (E_v * t_c - F * t_r) * (t_c + t_nc);
  const A1 = Math.max(0, Math.max(A1_a, A1_b));

  // A2: Excess thickness in nozzle wall (outward, smaller of two methods)
  const A2_a = 5 * (t_nc - t_rn) * f_r2 * t_c;
  const A2_b = 5 * (t_nc - t_rn) * f_r2 * t_nc;
  const A2 = Math.max(0, Math.min(A2_a, A2_b));

  // A3: Area of fillet welds
  // Two fillet welds: one inner (shell-to-nozzle), one outer
  // A3 = 2 × (0.5 × weldLeg²) for each weld
  const A3 = 2 * 0.5 * weldLeg * weldLeg;

  const A_available = A1 + A2 + A3;
  const passes = A_available >= A_req;

  // If pad is needed
  const A_pad_needed = passes ? 0 : A_req - A_available;
  // Pad width: extend to limit_parallel or use standard 2×d pad OD
  const padOD = passes ? 0 : Math.min(2 * nozzleOD + 2, limit_parallel * 2 + nozzleOD);
  const padThk = passes ? 0 : (A_pad_needed > 0 ? Math.ceil(A_pad_needed / (padOD - nozzleOD) * 16) / 16 : 0);

  // UG-36(c)(3) exemption check: small nozzle exemption
  // NPS ≤ 3.5" and shell OD ≤ 60", or NPS ≤ 2-3/8" and shell OD > 60"
  const npsSize = (nozzleOD < 1) ? 0.25 : // approximate NPS from OD
    (nozzleOD < 1.2) ? 0.5 : (nozzleOD < 1.4) ? 0.75 :
    (nozzleOD < 1.7) ? 1.0 : (nozzleOD < 2) ? 1.25 :
    (nozzleOD < 2.5) ? 1.5 : (nozzleOD < 3) ? 2.0 :
    (nozzleOD < 4) ? 3.0 : 4.0;
  const shellOD = 2 * R_vessel + 2 * t_vessel;
  const exemptSmall = (shellOD <= 60 && npsSize <= 3.5) || (shellOD > 60 && npsSize <= 2.375);
  // Exemption only applies if: opening is in shell/head, nozzle wall is Sch40 min,
  // and the opening is reinforced by excess shell thickness
  const exemptCondition = exemptSmall && t_nc >= t_rn && (E_v * t_c >= t_r);

  return {
    d, t_r, t_rn, t_c, t_nc, f_r1, f_r2, F,
    A_req: Math.round(A_req * 10000) / 10000,
    A1: Math.round(A1 * 10000) / 10000,
    A2: Math.round(A2 * 10000) / 10000,
    A3: Math.round(A3 * 10000) / 10000,
    A_available: Math.round(A_available * 10000) / 10000,
    passes, A_pad_needed: Math.round(A_pad_needed * 10000) / 10000,
    padOD, padThk,
    exemptSmall, exemptCondition,
    npsSize, t_r_shell, t_r_head, nozzleOD, weldLeg,
    E_v, E_n, S_v, S_n, P,
  };
}
const MATERIALS = {
  "CS": {
    id: "CS", label: "Carbon Steel",
    shell: { spec: "SA-516 Gr. 70", S: 20000, uts: 70000, ys: 38000 },
    head: { spec: "SA-516 Gr. 70", S: 20000, uts: 70000, ys: 38000 },
    pipe: { spec: "SA-106 Gr. B (Seamless) / SA-53 Gr. B (ERW)", S: 20000, uts: 60000, ys: 35000 },
    pipeCap: { spec: "SA-234 WPB", S: 20000 },
    density: 0.2836, // lb/in³
  },
  "SS": {
    id: "SS", label: "Stainless Steel",
    shell: { spec: "SA-240 Type 304/304L", S: 20000, uts: 75000, ys: 30000 },
    head: { spec: "SA-240 Type 304/304L", S: 20000, uts: 75000, ys: 30000 },
    pipe: { spec: "SA-312 TP304/304L (Seamless)", S: 20000, uts: 75000, ys: 30000 },
    pipeCap: { spec: "SA-403 WP304", S: 20000 },
    density: 0.289, // lb/in³
  },
};

// ─── PRODUCT DEFINITIONS ─────────────────────────────────────────
const PRODUCTS = [
  {
    id: "hgd", name: "JWT HydroGuard-D",
    subtitle: "Diaphragm Hydronic Expansion Tank",
    desc: "A fixed-diaphragm expansion tank for closed-loop hydronic heating and chilled water systems. A permanently sealed Butyl/EPDM membrane separates the pre-charged air cushion from system water, preventing waterlogging and air absorption. The diaphragm is factory-installed and does not require replacement — making these tanks virtually maintenance-free for the life of the system.",
    examples: "Office buildings & schools with hot water baseboard or fan-coil heating · Chilled water loops for rooftop air handlers · Radiant floor heating systems in warehouses · Campus central plant distribution loops · Closed-loop snow-melt systems",
    prefix: "JWT-HGD", maxTemp: 240, potable: false, internals: "diaphragm",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#C0392B",
    howItWorks: `This tank uses a permanently sealed, heavy-duty Butyl/EPDM diaphragm to separate the air cushion from system water. When the heating system warms up, water expands and pushes against the diaphragm, compressing the pre-charged air cushion. When the system cools, the air cushion pushes the water back out. Because air and water never mix, there is no waterlogging and no air absorption — the tank maintains proper pressurization indefinitely without air replenishment.\n\nThe diaphragm is factory-installed and is not field-replaceable. It is a fixed membrane clamped between the shell and head during fabrication. For small tanks (≤24" diameter), the vessel is made from standard pipe with welded pipe caps, making it compact and economical. Larger sizes use rolled plate shells with formed 2:1 semi-ellipsoidal heads.\n\nInstallation: Mount vertically with the system connection at the bottom. Connect on the suction side of the circulator pump to ensure all pump pressure effects are additive. Pre-charge must be set to match the system fill pressure before filling with water. A Schrader-type air valve on the top provides the air charge connection.`,
  },
  {
    id: "hgfb", name: "JWT HydroGuard-FB",
    subtitle: "Full-Acceptance Bladder Expansion Tank",
    desc: "A large-capacity expansion tank with a field-replaceable Butyl rubber bladder that occupies the full internal volume. 100% of the tank volume is available to accept expanded water. Designed for large commercial and institutional hydronic systems where decades of service life and easy bladder replacement are essential — no need to replace the entire ASME vessel when the bladder eventually wears.",
    examples: "Hospital campus heating plants (500+ gallon systems) · High-rise hot water distribution · University central heating plants · District energy systems · Large industrial process cooling loops · Data center chilled water systems",
    prefix: "JWT-HGFB", maxTemp: 240, potable: false, internals: "full-bladder",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#2980B9",
    howItWorks: `This tank uses a heavy-duty replaceable Butyl rubber bladder that occupies the full internal volume of the vessel. System water enters the bladder through the bottom system connection, while the pre-charged air cushion surrounds the bladder between its outer surface and the steel shell. As the system heats, expanding water inflates the bladder, compressing the surrounding air. When the system cools, air pressure forces the water back out.\n\nThe key advantage of the full-acceptance design is that 100% of the tank volume is available for water acceptance, and the bladder is field-replaceable — extending the service life of the vessel by decades. The bladder is installed through the bottom flanged opening.\n\nBladder Sizing: The bladder is matched to the tank shell diameter and length. Standard Butyl bladders are available from established expansion tank manufacturers. Contact JWT engineering for OEM bladder sourcing.\n\nBladder Installation: Drain the tank, bleed air, unbolt the bottom blind flange, extract the old bladder, fold the new bladder and insert through the flange opening, re-bolt to 40-50 ft-lbs in a cross pattern, and re-charge with dry air or nitrogen.\n\nInstallation: Floor-standing vertical on integral welded ring base. Connect to suction side of pump. Pre-charge to system fill pressure while tank is empty of water.`,
  },
  {
    id: "hgrb", name: "JWT HydroGuard-RB",
    subtitle: "Partial-Acceptance Bladder Expansion Tank",
    desc: "A compact expansion tank with a field-replaceable Butyl rubber bladder that occupies a portion of the internal volume. The partial-acceptance design is more space-efficient when the required water acceptance volume is significantly less than the total tank volume — the remaining space is permanent air cushion. Ideal for mid-size commercial systems where bladder replaceability is desired but full-acceptance capacity is not needed.",
    examples: "Medium office buildings (100–500 gallon systems) · Retail and restaurant hydronic heating · Multi-family residential boiler rooms · Small industrial process heating · Church and community center heating systems · Gymnasium and recreation facility HVAC",
    prefix: "JWT-HGRB", maxTemp: 240, potable: false, internals: "partial-bladder",
    mawpOptions: [100, 125, 150, 175, 250, 300], defaultMawp: 150,
    precharge: 12, color: "#8E44AD",
    howItWorks: `This tank uses a replaceable Butyl rubber bladder that occupies a portion of the internal volume. The bladder hangs from a support pipe connected to the bottom blind flange. System water enters the bladder, while the pre-charged air cushion occupies the space above and around it.\n\nThe partial-acceptance design means the bladder volume is less than the total tank volume — the remainder is the permanent air cushion space. This design is more compact for applications where the required acceptance volume is significantly less than the total tank volume.\n\nBladder Sizing: The bladder assembly (bladder + support pipe + blind flange) is a matched set specific to each tank diameter. Standard replacement kits include all three components. Contact JWT engineering for compatible replacement bladder sourcing.\n\nBladder Installation: Same procedure as full-acceptance bladder — isolate, drain, bleed air, unbolt blind flange, swap bladder assembly, re-bolt in cross pattern, and re-charge.\n\nInstallation: Floor-standing vertical. Connect to suction side of pump. Pre-charge to system fill pressure before introducing water.`,
  },
  {
    id: "as", name: "JWT AquaShield",
    subtitle: "Thermal Expansion Tank — Potable Water",
    desc: "Protects domestic hot water systems from dangerous pressure spikes caused by thermal expansion in closed plumbing systems. Required by code whenever a backflow preventer (BFP), check valve, or pressure reducing valve (PRV) is installed on the cold water supply — which is virtually every modern building. Without this tank, heated water has nowhere to expand, causing relief valve dripping, premature water heater failure, and potential pipe damage. All wetted surfaces are NSF/ANSI 61 certified for safe contact with drinking water.",
    examples: "Hotels and dormitories with central water heaters · Commercial kitchens and restaurants · Apartment buildings with master BFP · Hospitals and healthcare facilities · Schools with domestic hot water recirculation · Any building where code requires a backflow preventer on the water main",
    prefix: "JWT-AS", maxTemp: 200, potable: true, internals: "diaphragm",
    mawpOptions: [100, 125, 150], defaultMawp: 150,
    precharge: 55, color: "#27AE60",
    howItWorks: `When a backflow preventer, check valve, or pressure reducing valve is installed on the cold water supply, the plumbing system becomes "closed." As the water heater heats water, it expands — but with nowhere to go, pressure rises rapidly. Without a thermal expansion tank, this pressure spike can exceed the T&P relief valve setting, causing dripping, premature valve failure, and damage to the water heater's heat exchanger.\n\nThe JWT AquaShield absorbs this expanded water. A heavy-duty Butyl/EPDM diaphragm (meeting NSF/ANSI 61 for potable water contact) separates the pre-charged air cushion from the water side. The factory pre-charge is 55 psig — it must be adjusted in the field to match the incoming static water supply pressure before installation.\n\nCritical: If the pre-charge is left lower than supply pressure, the supply pressure will push the diaphragm and take up space before the water even heats, reducing the tank's effective capacity.\n\nInstallation: Mount vertically on the cold water supply line between the backflow preventer and the water heater. Never install on the hot water outlet — this would cause cooled water from the tank to mix with the hot supply, reducing delivery temperature.`,
  },
  {
    id: "cv", name: "JWT ChillVault",
    subtitle: "Chilled Water Buffer Tank",
    desc: "A plain ASME pressure vessel that adds thermal mass (water volume) to chilled water loops. When the system water volume is too small relative to the chiller's capacity, the compressor reaches setpoint too quickly and short-cycles — turning on and off every few minutes. This destroys compressor contactors, wastes energy, and shortens equipment life. The ChillVault adds enough water volume to extend run times to manufacturer-recommended minimums. No internal bladder or diaphragm — this is purely a volume vessel. A separate HydroGuard expansion tank is still required in the system for pressure control.",
    examples: "Office building with VRF-to-water chiller and low system volume · Data centers with precision cooling and tight temperature control · Medical imaging suites (MRI cooling) · Brewery and winery glycol chiller loops · Pharmaceutical clean rooms · Retrofit projects where existing piping volume is too low for new high-efficiency chillers",
    prefix: "JWT-CV", maxTemp: 450, potable: false, internals: "none",
    mawpOptions: [100, 125, 150, 175, 250], defaultMawp: 150,
    precharge: 0, color: "#2C3E50",
    howItWorks: `A buffer tank is simply an ASME pressure vessel added to the piping loop to increase the total system water volume. In chilled water systems, the chiller compressor will short-cycle (turn on and off rapidly) if the system water volume is too small relative to the chiller capacity — the water reaches setpoint too quickly. Short-cycling causes excessive wear on compressor contactors, reduces efficiency, and shortens equipment life.\n\nThe JWT ChillVault adds thermal mass (water volume) to the loop, increasing the time between compressor cycles. It has no internal diaphragm or bladder — it is a plain ASME vessel with inlet, outlet, and drain connections.\n\nSizing Rule of Thumb: 3-10 gallons of buffer per ton of cooling capacity, depending on system design and minimum run-time requirements. Consult the chiller manufacturer for specific recommendations.\n\nInstallation: Install in series or parallel with the chiller, typically on the return side. Inlet and outlet connections are on opposite ends to maximize thermal stratification. A separate expansion tank (HydroGuard series) is still required in the system for pressure control.`,
  },
  {
    id: "hv", name: "JWT HeatVault",
    subtitle: "Hot Water Buffer Tank",
    desc: "A plain ASME pressure vessel that adds thermal mass to closed-loop hot water heating systems. Modern high-efficiency modulating and condensing boilers are prone to short-cycling during mild weather and low-load conditions — the building only needs a fraction of the boiler's output, so it fires briefly and shuts down, over and over. This wastes fuel, reduces condensing efficiency, and causes thermal fatigue. The HeatVault absorbs excess heat and extends boiler run times, allowing the burner to operate in its efficient steady-state range. No bladder or diaphragm — a separate HydroGuard expansion tank is still needed for pressurization.",
    examples: "Schools and churches with oversized boilers and intermittent occupancy · Multi-boiler cascade systems where the lead boiler needs extended run time · Retrofit projects replacing atmospheric boilers with modulating condensing units · Radiant floor heating with high thermal lag · Industrial process heating with variable demand · Snow-melt systems with intermittent operation",
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

// ASME UG-27(c)(1): Circumferential stress in cylindrical shells
function calcShellThickness(P, R, S, E, CA) {
  const t = (P * R) / (S * E - 0.6 * P);
  return t + CA;
}

// ASME UG-32(d): 2:1 Semi-Ellipsoidal heads
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
  const E = 1.0; // Seamless pipe E=1.0
  const R = pipeData.od / 2;
  const tReq = (mawp * R) / (S * E - 0.6 * mawp);

  // Find lightest schedule that meets requirement
  const sortedScheds = Object.entries(pipeData.schedules).sort((a, b) => a[1] - b[1]);
  for (const [sch, tw] of sortedScheds) {
    if (tw >= tReq) {
      return { schedule: sch, tw, od: pipeData.od, id: pipeData.od - 2 * tw, tReq };
    }
  }
  // If nothing works, use heaviest available
  const heaviest = sortedScheds[sortedScheds.length - 1];
  return { schedule: heaviest[0], tw: heaviest[1], od: pipeData.od, id: pipeData.od - 2 * heaviest[1], tReq };
}

function selectDiameter(targetVolGal) {
  // Try pipe sizes first (≤24")
  for (const p of STD_PIPE) {
    const approxID = p.od - 0.75; // rough
    const headVol2 = 2 * (Math.PI / 6) * Math.pow(approxID / 2, 3) / 231; // pipe cap ≈ hemisphere
    const remainVol = targetVolGal - headVol2;
    if (remainVol <= 0) continue;
    const shellLen = (remainVol * 231 * 4) / (Math.PI * approxID * approxID);
    const ratio = shellLen / approxID;
    if (ratio >= 0.8 && ratio <= 5.0) return { type: "pipe", nps: p.nps };
  }

  // Try rolled diameters (≥30")
  for (const D of ROLLED_DIAMETERS) {
    const headVol2 = 2 * (Math.PI * Math.pow(D, 3)) / (24 * 231);
    const remainVol = targetVolGal - headVol2;
    if (remainVol <= 0) continue;
    const shellLen = (remainVol * 231 * 4) / (Math.PI * D * D);
    const ratio = shellLen / D;
    if (ratio >= 0.8 && ratio <= 5.0) return { type: "rolled", id: D };
  }

  // Fallback: find closest to 2:1 L/D
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
  const E_rolled = 0.85; // Spot RT for rolled shells
  const E_pipe = 1.0;    // Seamless pipe
  const dimChoice = selectDiameter(targetVolGal);
  const isPipe = dimChoice.type === "pipe";
  const isBuffer = product.id === "cv" || product.id === "hv";

  let D_ID, D_OD, tShell, tHead, tShellCalc, tHeadCalc, shellJointEff;
  let pipeSchedule = null;
  let constructionType, headType, shellSpec, headSpec;

  if (isPipe) {
    // PIPE CONSTRUCTION (≤24")
    pipeSchedule = selectPipeSchedule(dimChoice.nps, mawp, mat);
    D_OD = pipeSchedule.od;
    tShell = pipeSchedule.tw;
    D_ID = pipeSchedule.id;
    tShellCalc = pipeSchedule.tReq + CA;
    shellJointEff = E_pipe;
    constructionType = `NPS ${dimChoice.nps} ${pipeSchedule.schedule} Pipe`;
    shellSpec = mat.pipe.spec;

    // Pipe cap: use hemispherical approximation
    // UG-32(a): t = PR/(2SE - 0.2P)  for hemi, but for std pipe caps
    // we'll use the pipe wall thickness as minimum
    tHeadCalc = tShellCalc;
    tHead = tShell; // Pipe caps match pipe schedule
    headType = "Standard Pipe Cap (ASME B16.9)";
    headSpec = mat.pipeCap.spec;
  } else {
    // ROLLED SHELL + 2:1 SE HEADS (≥30")
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

  // Calculate volumes and lengths
  let headVol2Gal, headDepthID, shellLength;
  if (isPipe) {
    // Pipe cap volume ≈ approximate as 2:1 SE for simplicity
    headDepthID = D_ID / 4;
    headVol2Gal = 2 * (Math.PI * Math.pow(D_ID, 3)) / (24 * 231);
  } else {
    headDepthID = D_ID / 4;
    headVol2Gal = 2 * (Math.PI * Math.pow(D_ID, 3)) / (24 * 231);
  }

  const shellVolNeeded = Math.max(0, targetVolGal - headVol2Gal);
  shellLength = Math.max(isPipe ? 4 : 6, (shellVolNeeded * 231 * 4) / (Math.PI * D_ID * D_ID));
  // Round shell length to nearest 0.5"
  shellLength = Math.ceil(shellLength * 2) / 2;

  const actualVolGal = (Math.PI * D_ID * D_ID * shellLength / 4 + 2 * Math.PI * Math.pow(D_ID, 3) / 24) / 231;
  const OAL = shellLength + 2 * headDepthID + (isPipe ? 0 : 2 * tHead);

  // Nozzles — initial selection
  const nozzlesRaw = [];
  if (isBuffer) {
    nozzlesRaw.push({ id: "N1", ...selectNozzleSize(targetVolGal, "buffer-in"), position: "top-head", label: "Inlet", service: "buffer-in" });
    nozzlesRaw.push({ id: "N2", ...selectNozzleSize(targetVolGal, "buffer-out"), position: "bottom-head", label: "Outlet", service: "buffer-out" });
    nozzlesRaw.push({ id: "N3", ...selectNozzleSize(targetVolGal, "drain"), position: "bottom-side", label: "Drain", service: "drain" });
    nozzlesRaw.push({ id: "N4", size: 0.75, label: '3/4" NPT', position: "top-side", label2: "Vent / Gauge", service: "vent" });
  } else {
    nozzlesRaw.push({ id: "N1", ...selectNozzleSize(targetVolGal, "system"), position: "bottom-head", label: "System Conn.", service: "system" });
    nozzlesRaw.push({ id: "N2", ...selectNozzleSize(targetVolGal, "drain"), position: "bottom-side", label: "Drain", service: "drain" });
    nozzlesRaw.push({ id: "N3", ...selectNozzleSize(targetVolGal, "airvalve"), position: "top-head", label: "Air Charge Valve", service: "airvalve" });
  }

  // Nozzle pipe data, schedule selection, and UG-37 reinforcement
  const S_v = mat.shell.S;
  const S_n = mat.pipe ? mat.pipe.S : mat.shell.S;
  const nozzles = nozzlesRaw.map(n => {
    const pipeD = NOZZLE_PIPE_DATA[n.size];
    if (!pipeD) {
      // Schrader valves or very small — no reinforcement calc needed
      return { ...n, nozzleOD: 0.540, tn: 0.088, schedule: "N/A", d_opening: 0.364, reinf: null, sizingBasis: "Standard Schrader valve port, 1/4\" NPT tapped hole per manufacturer standard." };
    }

    // Select nozzle schedule: use Sch80 minimum for ASME nozzles (industry best practice)
    const tn = pipeD.sch80;
    const nozzleOD = pipeD.od;
    const d_opening = nozzleOD - 2 * tn + 2 * CA; // corroded bore diameter
    const schedule = "Sch. 80";

    // Determine if nozzle is in head or shell
    const inHead = n.position.includes("head");

    // Fillet weld leg: typically equal to nozzle wall thickness, min 0.25"
    const weldLeg = Math.max(0.25, Math.min(tn, 0.375));

    // Run UG-37 reinforcement calculation
    const reinf = calcNozzleReinforcement({
      P: mawp,
      S_v, S_n,
      E_v: shellJointEff,
      E_n: 1.0, // seamless nozzle pipe
      t_vessel: inHead ? tHead : tShell,
      t_nozzle: tn,
      R_vessel: D_ID / 2,
      d: d_opening,
      nozzleOD,
      CA,
      inHead,
      headD: D_ID,
      weldLeg,
    });

    // Sizing basis explanation
    let sizingBasis = "";
    if (n.service === "system") {
      sizingBasis = `System connection sized per industry convention for expansion tanks. For a ${targetVolGal.toFixed(0)}-gallon system volume, ${n.label} provides adequate flow area for water displacement during thermal expansion/contraction cycles without creating excessive velocity or pressure drop. Selection follows ASHRAE Handbook guidance and standard manufacturer practice for diaphragm/bladder expansion tanks.`;
    } else if (n.service === "drain") {
      sizingBasis = `Drain connection sized to allow reasonable tank drain-down time for maintenance and bladder service. Minimum 1/2\" NPT per industry practice; larger sizes for tanks over 100 gallons to keep drain time under 30 minutes.`;
    } else if (n.service === "buffer-in" || n.service === "buffer-out") {
      sizingBasis = `Buffer tank ${n.label.toLowerCase()} sized to match system piping velocity requirements. At design flow, the connection maintains fluid velocity below 8 ft/s per ASHRAE recommendations for closed hydronic systems, minimizing erosion and pressure drop through the tank.`;
    } else if (n.service === "vent") {
      sizingBasis = `Vent/gauge connection per standard practice. 3/4\" NPT provides port for pressure gauge, temperature gauge, or manual air vent. Sized per ASME B16.11 for instrument connections.`;
    }

    return { ...n, nozzleOD, tn, schedule, d_opening, reinf, sizingBasis, weldLeg };
  });

  // Weight estimate
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
  const isBuffer = product.id === "cv" || product.id === "hv";

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

  // Head curve: pipe caps are more hemispherical, SE heads are flatter
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

      {/* === VESSEL BODY === */}
      {/* Top Head */}
      <path d={`M ${cx - sw/2} ${shellTop} Q ${cx - sw/2} ${headCurve}, ${cx} ${topY} Q ${cx + sw/2} ${headCurve}, ${cx + sw/2} ${shellTop}`}
        fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />
      {/* Shell */}
      <rect x={cx - sw/2} y={shellTop} width={sw} height={sh} fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />
      {/* Bottom Head */}
      <path d={`M ${cx - sw/2} ${shellBot} Q ${cx - sw/2} ${botY + (isPipe ? 2 : 0)}, ${cx} ${botY} Q ${cx + sw/2} ${botY + (isPipe ? 2 : 0)}, ${cx + sw/2} ${shellBot}`}
        fill="url(#sg)" stroke="#2C2C2C" strokeWidth="2.5" />

      {/* === INTERNALS === */}
      {product.internals !== "none" && (
        <>
          {/* Air cushion (top) */}
          <rect x={cx - sw/2 + 8} y={shellTop + 4} width={sw - 16}
            height={(sh) * (1 - bladderFrac) - 4} fill="url(#ag)" rx="3" />
          <text x={cx} y={shellTop + (sh) * (1 - bladderFrac) / 2 + 2}
            textAnchor="middle" fill="#85C1E9" fontSize="8" fontWeight="700" letterSpacing="1">
            PRE-CHARGED AIR
          </text>

          {/* Diaphragm line */}
          {product.internals === "diaphragm" && (
            <>
              <path d={`M ${cx - sw/2 + 5} ${shellTop + sh * (1 - bladderFrac)} Q ${cx} ${shellTop + sh * (1 - bladderFrac) + 8} ${cx + sw/2 - 5} ${shellTop + sh * (1 - bladderFrac)}`}
                fill="none" stroke={ic} strokeWidth="3" strokeDasharray="8,4" filter="url(#glow)" />
              <text x={cx} y={shellTop + sh * (1 - bladderFrac) - 6}
                textAnchor="middle" fill={ic} fontSize="7.5" fontWeight="800" letterSpacing="1.5">DIAPHRAGM</text>
            </>
          )}

          {/* Bladder outline */}
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

          {/* Water in the bottom */}
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

      {/* Buffer tank: full of water */}
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

      {/* === NOZZLES === */}
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

      {/* === DIMENSION ANNOTATIONS === */}
      {/* OAL */}
      <line x1={cx - sw/2 - 28} y1={topY} x2={cx - sw/2 - 28} y2={botY}
        stroke="#D4A017" strokeWidth="0.8" />
      <line x1={cx - sw/2 - 34} y1={topY} x2={cx - sw/2 - 22} y2={topY} stroke="#D4A017" strokeWidth="0.5" />
      <line x1={cx - sw/2 - 34} y1={botY} x2={cx - sw/2 - 22} y2={botY} stroke="#D4A017" strokeWidth="0.5" />
      <text x={cx - sw/2 - 32} y={(topY + botY) / 2 - 4} fontSize="7.5" fill="#D4A017"
        fontWeight="700" textAnchor="end" transform={`rotate(-90, ${cx - sw/2 - 32}, ${(topY + botY) / 2})`}>
        {vessel.OAL}" OAL
      </text>

      {/* Diameter */}
      <line x1={cx - sw/2} y1={botY + 28} x2={cx + sw/2} y2={botY + 28} stroke="#D4A017" strokeWidth="0.8" />
      <line x1={cx - sw/2} y1={botY + 22} x2={cx - sw/2} y2={botY + 34} stroke="#D4A017" strokeWidth="0.5" />
      <line x1={cx + sw/2} y1={botY + 22} x2={cx + sw/2} y2={botY + 34} stroke="#D4A017" strokeWidth="0.5" />
      <text x={cx} y={botY + 42} fontSize="8" fill="#D4A017" textAnchor="middle" fontWeight="700">
        {vessel.D_ID}" ID / {vessel.D_OD}" OD
      </text>

      {/* Construction type label */}
      <text x={cx} y={botY + 56} fontSize="7" fill="#888" textAnchor="middle" fontWeight="500">
        {vessel.constructionType}
      </text>
      <text x={cx} y={botY + 66} fontSize="7" fill="#888" textAnchor="middle" fontWeight="500">
        {vessel.headType}
      </text>

      {/* Shell thickness callout */}
      <text x={cx + sw/2 + 8} y={(shellTop + shellBot) / 2}
        fontSize="7" fill="#999" fontWeight="500"
        transform={`rotate(90, ${cx + sw/2 + 8}, ${(shellTop + shellBot) / 2})`}
        textAnchor="middle">
        t(shell) = {vessel.tShell}"
      </text>

      {/* Support legs */}
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
// REPORT GENERATOR (writes to iframe instead of window.open)
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

  // HEADER
  h += `<div class="hdr"><div>
    <img src="${JWT_LOGO}" alt="JWT" style="height:52px;margin-bottom:8px;display:block">
    <h1>JOE WHITE TANK COMPANY, INC.</h1>
    <div class="mdl">${modelNum}</div>
    <div class="sub">${product.name} — ${product.subtitle}</div>
  </div><div class="hdr-r">
    <strong>Engineering Design Report</strong><br>Date: ${now}<br>Fort Worth, Texas<br>ASME Section VIII, Division 1
  </div></div>`;

  // 1. DESIGN INPUTS
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

  // 2. SIZING CALCULATIONS
  if (!isBuffer) {
    h += `<h2>2. Expansion Tank Sizing Calculations</h2>`;
    if (!isPotable) {
      h += `<h3>2.1 Method: Critical Sizing Method (Recommended)</h3>`;
      h += `<p class="ref">References: ASHRAE Handbook, HVAC Systems & Equipment, Chapter 15; Smithsonian Physical Tables for Relative Density & Volume of Water.</p>`;

      h += `<h3>Step 1 — Net Expansion Factor of Water</h3>`;
      h += `<span class="eq">Net Expansion = Gross Water Expansion − Piping Expansion<br>
Gross Expansion = (V<sub>final</sub> − V<sub>initial</sub>) / V<sub>initial</sub><br>
Piping Expansion = 3 × α × ΔT&emsp;where α = 6.8 × 10<sup>−6</sup> in/in/°F (carbon steel)</span>`;
      h += `<div class="cs">
        From Smithsonian Tables:<br>
        &emsp;V<sub>final</sub> at ${inputs.designTemp}°F = <b>${sizing.vFinal?.toFixed(6)}</b><br>
        &emsp;V<sub>initial</sub> at ${inputs.fillTemp}°F = <b>${sizing.vInitial?.toFixed(6)}</b><br>
        Gross Water Expansion = (${sizing.vFinal?.toFixed(6)} − ${sizing.vInitial?.toFixed(6)}) / ${sizing.vInitial?.toFixed(6)} = <b>${sizing.grossExpansion?.toFixed(6)}</b><br>
        Piping Expansion = 3 × 6.8×10<sup>−6</sup> × (${inputs.designTemp} − ${inputs.fillTemp}) = <b>${sizing.pipingExpansion?.toFixed(6)}</b><br>
        <b>Net Expansion Factor = ${sizing.grossExpansion?.toFixed(6)} − ${sizing.pipingExpansion?.toFixed(6)} = ${sizing.netExpansionFactor?.toFixed(6)}</b>
      </div>`;

      h += `<h3>Step 2 — Amount of Expanded Water</h3>`;
      h += `<span class="eq">Expanded Water = V<sub>s</sub> × Net Expansion Factor</span>`;
      h += `<div class="cs">= ${inputs.systemVol} gal × ${sizing.netExpansionFactor?.toFixed(6)} = <b>${sizing.expandedWater?.toFixed(2)} gallons</b></div>`;

      h += `<h3>Step 3 — Acceptance Factor (Boyle's Law)</h3>`;
      h += `<span class="eq">Acceptance Factor = 1 − (P<sub>f</sub> + 14.7) / (P<sub>o</sub> + 14.7)</span>`;
      h += `<p class="ref">This factor represents the fraction of total tank volume available to accept expanded water, derived from the isothermal gas law (Boyle's Law: P₁V₁ = P₂V₂).</p>`;
      h += `<div class="cs">
        P<sub>f,abs</sub> = ${inputs.minPressure} + 14.7 = <b>${(inputs.minPressure + 14.7).toFixed(1)} psia</b><br>
        P<sub>o,abs</sub> = ${inputs.maxPressure} + 14.7 = <b>${(inputs.maxPressure + 14.7).toFixed(1)} psia</b><br>
        <b>Acceptance Factor = 1 − ${(inputs.minPressure + 14.7).toFixed(1)} / ${(inputs.maxPressure + 14.7).toFixed(1)} = ${sizing.acceptanceFactor?.toFixed(4)}</b>
      </div>`;

      h += `<h3>Step 4 — Minimum Tank Volume Required</h3>`;
      h += `<span class="eq">V<sub>t,min</sub> = Expanded Water / Acceptance Factor</span>`;
      h += `<div class="rb">V<sub>t,min</sub> = ${sizing.expandedWater?.toFixed(2)} / ${sizing.acceptanceFactor?.toFixed(4)} = <span class="v">${sizing.minTankVol?.toFixed(1)} gallons</span><br>
      <span style="font-size:9pt;color:#666">Selected tank volume includes ≥5% margin: <b>${vessel.actualVolGal} gallons</b></span></div>`;
    } else {
      h += `<h3>2.1 Method: Thermal Expansion DPF Sizing</h3>`;
      h += `<p class="ref">Reference: ASHRAE Handbook; Industry Standard DPF Thermal Expansion Sizing Method.</p>`;
      h += `<h3>Step 1 — Water Expansion Factor</h3>`;
      h += `<span class="eq">From Net Expansion Table at initial temp = 40°F, operating temp = ${inputs.designTemp}°F</span>`;
      h += `<div class="cs">Expansion Factor = <b>${sizing.netExpansionFactor?.toFixed(4)}</b></div>`;
      h += `<h3>Step 2 — Expanded Water</h3>`;
      h += `<span class="eq">= Heater Volume × Expansion Factor = ${inputs.systemVol} × ${sizing.netExpansionFactor?.toFixed(4)} = <b>${sizing.expandedWater?.toFixed(2)} gallons</b></span>`;
      h += `<h3>Step 3 — Design Pressure Factor</h3>`;
      h += `<span class="eq">DPF = (P<sub>max</sub> + 14.7) / (P<sub>max</sub> − P<sub>line</sub>) = (${inputs.maxPressure} + 14.7) / (${inputs.maxPressure} − ${inputs.minPressure}) = <b>${sizing.dpf?.toFixed(3)}</b></span>`;
      h += `<h3>Step 4 — Required Tank Volume</h3>`;
      h += `<div class="rb">V<sub>t</sub> = ${sizing.expandedWater?.toFixed(2)} × ${sizing.dpf?.toFixed(3)} = <span class="v">${sizing.minTankVol?.toFixed(1)} gallons</span></div>`;
    }
  } else {
    h += `<h2>2. Buffer Tank Volume Selection</h2>`;
    h += `<div class="rb">Required Buffer Volume: <span class="v">${inputs.systemVol} gallons</span><br>
    <span style="font-size:9pt;color:#666">Per system design requirements. Typical sizing: ${product.id === "cv" ? "3-10 gal/ton of cooling" : "5-10 gal/boiler HP"}.</span></div>`;
  }

  // 3. VESSEL DESIGN
  h += `<h2>3. Pressure Vessel Mechanical Design</h2>`;
  h += `<p class="ref">Reference: ASME Boiler & Pressure Vessel Code, Section VIII, Division 1 (2023 Edition)</p>`;

  h += `<h3>3.1 Construction Method</h3>`;
  if (vessel.isPipe) {
    h += `<p><b>Pipe Construction (NPS ≤ 24"):</b> ${vessel.constructionType} per ${vessel.shellSpec}. Heads: ${vessel.headType} per ${vessel.headSpec}. Pipe is assumed seamless with E = 1.0 per UW-12.</p>`;
    h += `<table>
      <tr><th>Component</th><th>Specification</th><th>Wall / Thickness</th></tr>
      <tr><td>Shell (Pipe)</td><td>${vessel.shellSpec}</td><td>${vessel.tShell}" (${vessel.pipeSchedule?.schedule})</td></tr>
      <tr><td>Heads (Pipe Caps)</td><td>${vessel.headSpec}</td><td>${vessel.tHead}" (matches pipe)</td></tr>
    </table>`;
    h += `<h3>3.2 Shell Adequacy Check — UG-27</h3>`;
    h += `<span class="eq">t<sub>req</sub> = P × R / (S × E − 0.6P) + CA = ${inputs.mawp} × ${(vessel.D_OD / 2).toFixed(3)} / (${mat.pipe.S.toLocaleString()} × 1.0 − 0.6 × ${inputs.mawp}) + ${vessel.CA} = <b>${vessel.tShellCalc.toFixed(4)}"</b></span>`;
    h += `<div class="cs">Pipe wall provided: <b>${vessel.tShell}"</b> ≥ ${vessel.tShellCalc.toFixed(4)}" required ✓</div>`;
  } else {
    h += `<p><b>Rolled Plate Construction (≥ 30" ID):</b> ${vessel.constructionType}, ${vessel.shellSpec}. Heads: ${vessel.headType}, ${vessel.headSpec}. Joint efficiency E = ${vessel.shellJointEff} (Spot Radiography per UW-12(b)).</p>`;
    h += `<table>
      <tr><th>Parameter</th><th>Value</th></tr>
      <tr><td>Allowable Stress (S)</td><td>${mat.shell.S.toLocaleString()} psi (at design temperature)</td></tr>
      <tr><td>Joint Efficiency (E)</td><td>${vessel.shellJointEff} — Spot RT per UW-12(b)</td></tr>
      <tr><td>Corrosion Allowance</td><td>${vessel.CA > 0 ? vessel.CA + '"' : "None"}</td></tr>
    </table>`;

    h += `<h3>3.2 Cylindrical Shell — UG-27(c)(1)</h3>`;
    h += `<span class="eq">t = PR / (SE − 0.6P) + CA = ${inputs.mawp} × ${(vessel.D_ID / 2).toFixed(1)} / (${mat.shell.S.toLocaleString()} × ${vessel.shellJointEff} − 0.6 × ${inputs.mawp}) + ${vessel.CA} = <b>${vessel.tShellCalc.toFixed(4)}"</b></span>`;
    h += `<div class="cs">Selected: <b>${vessel.tShell}"</b> (${(vessel.tShell * 25.4).toFixed(1)} mm) — next standard plate thickness ✓</div>`;

    h += `<h3>3.3 2:1 Semi-Ellipsoidal Head — UG-32(d)</h3>`;
    h += `<span class="eq">t = PD / (2SE − 0.2P) + CA = ${inputs.mawp} × ${vessel.D_ID} / (2 × ${mat.shell.S.toLocaleString()} × ${vessel.shellJointEff} − 0.2 × ${inputs.mawp}) + ${vessel.CA} = <b>${vessel.tHeadCalc.toFixed(4)}"</b></span>`;
    h += `<div class="cs">Selected: <b>${vessel.tHead}"</b> (${(vessel.tHead * 25.4).toFixed(1)} mm) ✓</div>`;
  }

  // 4. FINAL SPECS
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

  // Nozzle Schedule
  h += `<h3>4.1 Nozzle Schedule</h3><table>
    <tr><th>Tag</th><th>Service</th><th>Size</th><th>Pipe Spec</th><th>Schedule</th><th>Position</th></tr>`;
  vessel.nozzles.forEach((n) => {
    h += `<tr><td>${n.id}</td><td>${n.label2 || n.label}</td><td>${n.label.includes("Schrader") ? "Schrader" : n.size + '"'}</td><td>${n.label.includes("Schrader") ? "—" : (vessel.materialId === "SS" ? "SA-312 TP304" : "SA-106 Gr. B")}</td><td>${n.schedule || "N/A"}</td><td>${n.position.replace(/-/g, " ").toUpperCase()}</td></tr>`;
  });
  h += `</table>`;

  // ═══ SECTION 5: NOZZLE DESIGN CALCULATIONS ═══
  h += `<h2>5. Nozzle Design Calculations</h2>`;
  h += `<p class="ref">Reference: ASME BPVC Section VIII, Division 1 — UG-36 (Openings in Pressure Vessels), UG-37 (Reinforcement Required for Openings), UG-40 (Limits of Reinforcement), UG-41 (Strength of Reinforcement). Nozzle pipe dimensions per ASME B36.10M (carbon steel) / B36.19M (stainless steel). Nozzle forging/fitting per ASME B16.11 (forged fittings) and B16.9 (factory-made wrought fittings). Weld design per UW-16.</p>`;

  h += `<h3>5.1 Nozzle Sizing Rationale</h3>`;
  h += `<p>Nozzle sizes for expansion tanks are selected based on the following engineering criteria:</p>`;
  h += `<p><b>System Connection:</b> Sized to match standard hydronic piping at the point of installation. The expansion tank does not see continuous design flow — it only displaces water during thermal expansion and contraction cycles. The connection must be large enough to avoid excessive velocity (< 8 ft/s per ASHRAE) during rapid temperature changes, but need not be sized for full system flow. Industry convention, validated by decades of installed systems, establishes the size ranges shown in the schedule above.</p>`;
  h += `<p><b>Drain:</b> Sized for reasonable tank drain-down time during maintenance (target < 30 minutes for tanks up to 500 gallons). Minimum 1/2" NPT.</p>`;
  h += `<p><b>Air Charge Valve:</b> Standard Schrader-type valve, 1/4" NPT tapped port. This is an industry-universal fitting compatible with standard tire-type pressure gauges and air chuck equipment for field pre-charge adjustment.</p>`;
  h += `<p><b>Nozzle Neck Schedule:</b> All nozzle necks are specified as <b>Schedule 80 minimum</b> per ASME VIII-1 best practice. Sch. 80 provides substantial excess wall thickness beyond the minimum required by pressure, ensuring adequate reinforcement contribution and resistance to mechanical abuse during field installation.</p>`;

  h += `<h3>5.2 Nozzle Reinforcement — Area Replacement Method (UG-37)</h3>`;
  h += `<p>Every opening in a pressure vessel removes load-carrying material from the shell or head. Per UG-36, each opening must be evaluated for adequate reinforcement. The area replacement method (UG-37) verifies that sufficient excess material exists in the vessel wall, nozzle neck, and welds to compensate for the removed material.</p>`;
  h += `<span class="eq"><b>Required Reinforcement Area:</b><br>
A<sub>req</sub> = d × t<sub>r</sub> × F + 2 × t<sub>n</sub> × t<sub>r</sub> × F × (1 − f<sub>r1</sub>)<br><br>
<b>Available Reinforcement Areas:</b><br>
A<sub>1</sub> = Excess thickness in vessel wall = max of [d(E₁t − Ft<sub>r</sub>) − 2t<sub>n</sub>(E₁t − Ft<sub>r</sub>)(1−f<sub>r1</sub>)] &nbsp;or&nbsp; [2(E₁t − Ft<sub>r</sub>)(t + t<sub>n</sub>)]<br>
A<sub>2</sub> = Excess thickness in nozzle wall = min of [5(t<sub>n</sub> − t<sub>rn</sub>)f<sub>r2</sub> × t] &nbsp;or&nbsp; [5(t<sub>n</sub> − t<sub>rn</sub>)f<sub>r2</sub> × t<sub>n</sub>]<br>
A<sub>3</sub> = Fillet weld area = 2 × (0.5 × w²) &emsp;where w = weld leg size<br><br>
<b>Acceptance:</b>&emsp;A<sub>1</sub> + A<sub>2</sub> + A<sub>3</sub> ≥ A<sub>req</sub>&emsp;→ PASS (no reinforcement pad required)</span>`;
  h += `<p class="ref">Where: d = corroded opening diameter; t<sub>r</sub> = required shell/head thickness (corroded, per UG-27 or UG-32); t<sub>n</sub> = corroded nozzle wall thickness; t<sub>rn</sub> = required nozzle wall thickness (per UG-27 applied to nozzle as cylinder); F = 1.0 (nozzle normal to surface); f<sub>r1</sub> = S<sub>n</sub>/S<sub>v</sub> (nozzle-to-shell stress ratio); E₁ = joint efficiency of shell seam.</p>`;

  // Individual nozzle calculations
  vessel.nozzles.forEach((n, idx) => {
    h += `<h3>5.${idx + 3} Nozzle ${n.id} — ${n.label2 || n.label} (${n.label.includes("Schrader") ? "Schrader" : n.size + '" ' + (n.schedule || "")})</h3>`;

    // Sizing basis
    if (n.sizingBasis) {
      h += `<p><i>Sizing Basis:</i> ${n.sizingBasis}</p>`;
    }

    if (!n.reinf) {
      h += `<p>No reinforcement calculation required — Schrader valve is a standard tapped port (1/4" NPT) with negligible opening diameter relative to shell thickness. Per UG-36(c)(3)(a), openings not larger than 2-3/8" in vessels meeting all conditions of that paragraph are exempt from the area replacement calculation when the opening is in pipe or tube with adequate wall thickness.</p>`;
    } else {
      const r = n.reinf;
      const inHead = n.position.includes("head");
      const componentName = inHead ? "head" : "shell";
      const tVessel = inHead ? vessel.tHead : vessel.tShell;

      h += `<table>
        <tr><th style="width:60%">Parameter</th><th>Value</th></tr>
        <tr><td>Nozzle Pipe OD</td><td>${r.nozzleOD.toFixed(3)}"</td></tr>
        <tr><td>Nozzle Wall Thickness (t<sub>n</sub>, nominal)</td><td>${n.tn.toFixed(3)}" (${n.schedule})</td></tr>
        <tr><td>Corroded Nozzle Wall (t<sub>nc</sub> = t<sub>n</sub> − CA)</td><td>${r.t_nc.toFixed(4)}"</td></tr>
        <tr><td>Corroded Opening Diameter (d)</td><td>${r.d.toFixed(4)}"</td></tr>
        <tr><td>Installed In</td><td>${componentName.charAt(0).toUpperCase() + componentName.slice(1)}</td></tr>
        <tr><td>${componentName.charAt(0).toUpperCase() + componentName.slice(1)} Nominal Thickness</td><td>${tVessel}"</td></tr>
        <tr><td>Corroded ${componentName} Thickness (t<sub>c</sub>)</td><td>${r.t_c.toFixed(4)}"</td></tr>
        <tr><td>Fillet Weld Leg (w)</td><td>${r.weldLeg.toFixed(3)}"</td></tr>
        <tr><td>f<sub>r1</sub> = S<sub>n</sub>/S<sub>v</sub></td><td>${r.f_r1.toFixed(2)}</td></tr>
        <tr><td>F (correction factor)</td><td>${r.F.toFixed(1)}</td></tr>
      </table>`;

      h += `<div class="cs"><b>Step 1: Required thickness of ${componentName} (corroded)</b><br>`;
      if (inHead) {
        h += `&emsp;t<sub>r</sub> = PD / (2SE − 0.2P) = ${r.P} × ${vessel.D_ID} / (2 × ${r.S_v.toLocaleString()} × ${r.E_v} − 0.2 × ${r.P}) = <b>${r.t_r.toFixed(4)}"</b><br>`;
      } else {
        h += `&emsp;t<sub>r</sub> = PR / (SE − 0.6P) = ${r.P} × ${(vessel.D_ID / 2).toFixed(1)} / (${r.S_v.toLocaleString()} × ${r.E_v} − 0.6 × ${r.P}) = <b>${r.t_r.toFixed(4)}"</b><br>`;
      }
      h += `</div>`;

      h += `<div class="cs"><b>Step 2: Required thickness of nozzle wall (as cylinder)</b><br>`;
      h += `&emsp;t<sub>rn</sub> = P × R<sub>n</sub> / (S<sub>n</sub>E<sub>n</sub> − 0.6P) = ${r.P} × ${((r.nozzleOD / 2 - n.tn) + vessel.CA).toFixed(3)} / (${r.S_n.toLocaleString()} × 1.0 − 0.6 × ${r.P}) = <b>${r.t_rn.toFixed(4)}"</b></div>`;

      h += `<div class="cs"><b>Step 3: Required reinforcement area</b><br>`;
      h += `&emsp;A<sub>req</sub> = d × t<sub>r</sub> × F + 2 × t<sub>nc</sub> × t<sub>r</sub> × F × (1 − f<sub>r1</sub>)<br>`;
      h += `&emsp;A<sub>req</sub> = ${r.d.toFixed(4)} × ${r.t_r.toFixed(4)} × ${r.F.toFixed(1)} + 2 × ${r.t_nc.toFixed(4)} × ${r.t_r.toFixed(4)} × ${r.F.toFixed(1)} × (1 − ${r.f_r1.toFixed(2)})<br>`;
      h += `&emsp;<b>A<sub>req</sub> = ${r.A_req.toFixed(4)} in²</b></div>`;

      h += `<div class="cs"><b>Step 4: Available reinforcement areas</b><br>`;
      h += `&emsp;A<sub>1</sub> (excess ${componentName} material) = <b>${r.A1.toFixed(4)} in²</b><br>`;
      h += `&emsp;A<sub>2</sub> (excess nozzle material) = <b>${r.A2.toFixed(4)} in²</b><br>`;
      h += `&emsp;A<sub>3</sub> (fillet weld area) = 2 × 0.5 × ${r.weldLeg.toFixed(3)}² = <b>${r.A3.toFixed(4)} in²</b><br>`;
      h += `&emsp;<b>A<sub>available</sub> = ${r.A1.toFixed(4)} + ${r.A2.toFixed(4)} + ${r.A3.toFixed(4)} = ${r.A_available.toFixed(4)} in²</b></div>`;

      h += `<div class="rb">`;
      if (r.passes) {
        h += `<b>A<sub>available</sub> = ${r.A_available.toFixed(4)} in² &nbsp;≥&nbsp; A<sub>req</sub> = ${r.A_req.toFixed(4)} in²</b><br>`;
        h += `<span class="v" style="color:#27AE60">✓ PASS — No reinforcement pad required</span><br>`;
        h += `<span style="font-size:9pt;color:#666">Margin: ${((r.A_available / r.A_req - 1) * 100).toFixed(1)}% excess reinforcement area</span>`;
      } else {
        h += `<b>A<sub>available</sub> = ${r.A_available.toFixed(4)} in² &nbsp;<&nbsp; A<sub>req</sub> = ${r.A_req.toFixed(4)} in²</b><br>`;
        h += `<span class="v" style="color:#C0392B">REINFORCEMENT PAD REQUIRED</span><br>`;
        h += `<span style="font-size:9pt;color:#666">Additional area needed: ${r.A_pad_needed.toFixed(4)} in². Provide a reinforcement pad of OD ≈ ${r.padOD.toFixed(1)}" × ${r.padThk.toFixed(4)}" thick, same material as ${componentName}.</span>`;
      }
      h += `</div>`;

      // UG-36(c)(3) exemption note
      if (r.exemptCondition) {
        h += `<p class="ref"><b>Note:</b> This nozzle (NPS ${r.npsSize}) qualifies for the small opening exemption per UG-36(c)(3) — the opening is ≤ 3-1/2" in a shell ≤ 60" OD, the nozzle wall exceeds the required thickness, and the vessel wall has adequate excess thickness. The full UG-37 calculation above is provided for documentation completeness, but is technically not required by Code for this opening.</p>`;
      }
    }
  });

  // HOW IT WORKS section
  h += `<h2>6. How This Vessel Works</h2>`;
  h += `<div class="hiw"><h4>${product.name} — ${product.subtitle}</h4>`;
  product.howItWorks.split('\n\n').forEach(para => {
    h += `<p style="margin-bottom:10px">${para}</p>`;
  });
  h += `</div>`;

  // Stamp
  h += `<div class="stamp"><div class="stamp-t">PROFESSIONAL ENGINEER APPROVAL</div>
    Name: ___________________________<br>PE License No.: ____________________<br>
    State: _________ Date: ____________<br>Signature: ______________________</div>`;

  h += `<div class="ft">
    <img src="${JWT_LOGO}" alt="JWT" style="height:36px;margin-bottom:8px;opacity:0.6"><br>
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

  // ═══ PRODUCT SELECTION SCREEN ═══
  if (!selProduct) {
    return (
      <div style={{ background: "linear-gradient(160deg, #080810 0%, #12121E 40%, #0A0A14 100%)", minHeight: "100vh", padding: "24px 20px", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44, paddingTop: 24 }}>
            <img src={JWT_LOGO} alt="Joe White Tank Company" style={{ height: 70, marginBottom: 16, filter: "brightness(1.1)", display: "block", marginLeft: "auto", marginRight: "auto" }} />
            <div style={{ display: "inline-block", paddingBottom: 14, marginBottom: 10, borderBottom: "2px solid #B8860B" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#F0E6D3", letterSpacing: 0.5, lineHeight: 1.1 }}>EXPANSION TANK</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#B8860B", letterSpacing: 0.5 }}>DESIGNER & SIZER</div>
            </div>
            <div style={{ fontSize: 11, color: "#5A5A6E", marginTop: 10, letterSpacing: 3, fontWeight: 500 }}>FORT WORTH, TEXAS &nbsp;·&nbsp; ASME U-STAMP CERTIFIED</div>
            <div style={{ fontSize: 11, color: "#444", marginTop: 14, maxWidth: 600, margin: "14px auto 0" }}>Select a product line below to begin your engineering design and sizing calculation.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
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
                borderRadius: 10, padding: "22px 20px", textAlign: "left", cursor: "pointer",
                transition: "all 0.25s ease", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = p.color + "88"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${p.color}18`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.color + "25"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${p.color}, ${p.color}66)` }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F0E6D3", marginBottom: 3, letterSpacing: 0.3 }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: p.color, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>{p.subtitle}</div>
                <div style={{ fontSize: 10.5, color: "#8A8A9E", lineHeight: 1.6, marginBottom: 12 }}>{p.desc}</div>
                {/* Usage examples */}
                <div style={{ background: "#12121E", borderRadius: 6, padding: "10px 12px", marginBottom: 14, borderLeft: `3px solid ${p.color}44` }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, color: "#6A6A7A", letterSpacing: 2, marginBottom: 5 }}>TYPICAL APPLICATIONS</div>
                  <div style={{ fontSize: 9.5, color: "#7A7A90", lineHeight: 1.7 }}>
                    {p.examples.split(" · ").map((ex, i) => (
                      <span key={i}>
                        <span style={{ color: p.color, marginRight: 4 }}>›</span>{ex}
                        {i < p.examples.split(" · ").length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8.5, background: `${p.color}18`, color: p.color, padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>{p.maxTemp}°F max</span>
                  <span style={{ fontSize: 8.5, background: "#B8860B18", color: "#B8860B", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>{Math.max(...p.mawpOptions)} psig</span>
                  {p.potable && <span style={{ fontSize: 8.5, background: "#27AE6018", color: "#27AE60", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>NSF/ANSI 61</span>}
                  {p.internals === "full-bladder" && <span style={{ fontSize: 8.5, background: "#2980B918", color: "#85C1E9", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>Replaceable Bladder</span>}
                  {p.internals === "partial-bladder" && <span style={{ fontSize: 8.5, background: "#8E44AD18", color: "#BB8FCE", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>Replaceable Bladder</span>}
                  {p.internals === "none" && <span style={{ fontSize: 8.5, background: "#55555518", color: "#999", padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>No Internals</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ═══ MAIN DESIGN INTERFACE ═══
  const modelNum = results?.vessel ? `${product.prefix}-${Math.round(results.vessel.actualVolGal)}` : "—";

  return (
    <div style={{ background: "#0D0D16", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", color: "#E0DAD0", display: "flex", flexDirection: "column" }}>
      {/* TOP BAR */}
      <div style={{ background: "#08080E", borderBottom: "1px solid #B8860B22", padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={handleReset} style={{ background: "none", border: "1px solid #B8860B44", color: "#B8860B", padding: "4px 14px", borderRadius: 5, cursor: "pointer", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5 }}>← PRODUCTS</button>
          <img src={JWT_LOGO} alt="JWT" style={{ height: 26, opacity: 0.85 }} />
          <div><span style={{ fontSize: 9, letterSpacing: 4, color: "#6A6A7A", fontWeight: 700 }}>TANK DESIGNER</span></div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: product.color }}>{product.name}</div>
      </div>

      {/* MAIN 3-COLUMN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr 290px", flex: 1, minHeight: 0 }}>

        {/* LEFT: INPUTS */}
        <div style={{ background: "#10101A", borderRight: "1px solid #1E1E30", padding: "16px 16px 100px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#B8860B", letterSpacing: 3, marginBottom: 14 }}>DESIGN INPUTS</div>

          {/* Material Selection */}
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

          {/* Corrosion Allowance Toggle */}
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

          {/* MAWP Selection */}
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

          {/* RESULTS SUMMARY */}
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

          {/* HOW IT WORKS - below inputs */}
          <div style={{ marginTop: 20, background: "#0C0C16", border: "1px solid #1E1E30", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, color: product.color, fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>HOW THIS VESSEL WORKS</div>
            <div style={{ fontSize: 10, color: "#8A8A9E", lineHeight: 1.65 }}>
              {product.howItWorks.split('\n\n').map((p, i) => (
                <p key={i} style={{ marginBottom: 10 }}>{p}</p>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: VESSEL VISUALIZATION */}
        <div style={{ background: "linear-gradient(180deg, #0A0A14, #0D0D18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, #1A1A2A 0.5px, transparent 0.5px)", backgroundSize: "18px 18px", opacity: 0.4 }} />

          {/* Model Badge */}
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

        {/* RIGHT: SPECIFICATIONS */}
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

      {/* BOTTOM ACTION BAR */}
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

      {/* ═══ FULL-SCREEN REPORT OVERLAY ═══ */}
      {showReport && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column",
          animation: "fadeIn 0.2s ease",
        }}>
          {/* Report Toolbar */}
          <div style={{
            background: "#1A1A1A", borderBottom: "2px solid #B8860B",
            padding: "10px 24px", display: "flex", justifyContent: "space-between",
            alignItems: "center", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={JWT_LOGO} alt="JWT" style={{ height: 24, opacity: 0.9 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#B8860B", letterSpacing: 1 }}>
                ENGINEERING REPORT
              </span>
              <span style={{ fontSize: 10, color: "#666" }}>
                {product.prefix}-{results?.vessel ? Math.round(results.vessel.actualVolGal) : ""}
              </span>
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

          {/* Report Content in iframe with srcdoc */}
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
            transition: "border-color 0.2s",
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
