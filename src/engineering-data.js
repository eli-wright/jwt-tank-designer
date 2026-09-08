// Material design-temperature stresses must be supplied from the project code basis.
export const STD_PIPE = [
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
export const ROLLED_DIAMETERS = [30, 36, 42, 48, 54, 60, 66, 72, 84, 96];

// ─── NOZZLE PIPE DATA (B36.10 nominal walls, including stainless orders to these dimensions) ─────────────
// Standard pipe dimensions for nozzle necks
export const NOZZLE_PIPE_DATA = {
  0.25: { od: 0.540, sch40: 0.088, sch80: 0.119, sch160: 0.188 },
  0.5:  { od: 0.840, sch40: 0.109, sch80: 0.147, sch160: 0.187 },
  0.75: { od: 1.050, sch40: 0.113, sch80: 0.154, sch160: 0.219 },
  1.0:  { od: 1.315, sch40: 0.133, sch80: 0.179, sch160: 0.250 },
  1.25: { od: 1.660, sch40: 0.140, sch80: 0.191, sch160: 0.250 },
  1.5:  { od: 1.900, sch40: 0.145, sch80: 0.200, sch160: 0.281 },
  2.0:  { od: 2.375, sch40: 0.154, sch80: 0.218, sch160: 0.343 },
  3.0:  { od: 3.500, sch40: 0.216, sch80: 0.300, sch160: 0.437 },
  6.0:  { od: 6.625, sch40: 0.280, sch80: 0.432 },
  8.0:  { od: 8.625, sch40: 0.322, sch80: 0.500 },
  10.0: { od: 10.75, sch40: 0.365, sch80: 0.593 },
  12.0: { od: 12.75, sch40: 0.406, sch80: 0.687 },
  4.0:  { od: 4.500, sch40: 0.237, sch80: 0.337, sch160: 0.531 },
};

export const MATERIALS = {
  "CS": {
    id: "CS", label: "Carbon Steel",
    shell: { spec: "SA-516 Gr. 70" },
    head: { spec: "SA-516 Gr. 70" },
    pipe: { spec: "SA-106 Gr. B (Seamless)" },
    nozzleForging: "SA-105",
    density: 0.2836,
  },
  "SS304": {
    id: "SS304", label: "304L SS",
    shell: { spec: "SA-240 Type 304L" },
    head: { spec: "SA-240 Type 304L" },
    pipe: { spec: "SA-312 TP304L (Seamless)" },
    nozzleForging: "SA-182 F304L",
    density: 0.289,
  },
  "SS316": {
    id: "SS316", label: "316L SS",
    shell: { spec: "SA-240 Type 316L" },
    head: { spec: "SA-240 Type 316L" },
    pipe: { spec: "SA-312 TP316L (Seamless)" },
    nozzleForging: "SA-182 F316L",
    density: 0.289,
  },
};

