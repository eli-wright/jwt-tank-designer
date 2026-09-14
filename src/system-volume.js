// System volume estimator.
//
// Expansion sizing is proportional to system volume, so an assumed system
// volume is the largest single error source in a tank selection. This builds
// the volume from pipe bore geometry plus entered equipment volumes.
//
// Pipe volume is calculated, not tabulated: gal/ft = pi/4 x bore^2 x 12 / 231.
// Equipment volume is entered from submittal data. No gallons-per-ton or
// gallons-per-MBH rule of thumb is applied, because those vary by several
// hundred percent between equipment types and none is established here.
import { NOZZLE_PIPE_DATA } from './engineering-data.js';
import { finite, positive } from './water.js';

const CUBIC_IN_PER_GAL = 231;

export function gallonsPerFoot(boreIn) {
  positive(boreIn, 'Pipe bore');
  return Math.PI / 4 * boreIn * boreIn * 12 / CUBIC_IN_PER_GAL;
}

// Steel bores are derived from the B36.10 outside diameters and Schedule 40
// walls already carried in engineering-data.js, so there is one pipe dimension
// source in the application.
const STEEL_40 = Object.fromEntries(Object.entries(NOZZLE_PIPE_DATA)
  .filter(([nps]) => Number(nps) >= 0.5)
  .map(([nps, p]) => [Number(nps), p.od - 2 * p.sch40]));

// ASTM B88 Type L drawn copper water tube: outside diameter is the nominal size
// plus 1/8 in, and the listed inside diameters follow.
const COPPER_L = { 0.5:0.545, 0.75:0.785, 1:1.025, 1.25:1.265, 1.5:1.505,
  2:1.985, 2.5:2.465, 3:2.945, 4:3.905 };

export const PIPE_CATALOGS = {
  steel40: { id:'steel40', label:'Steel pipe, Schedule 40',
    basis:'B36.10 outside diameter less two Schedule 40 walls. NPS 2-1/2 and 5 are not carried.',
    bores: STEEL_40 },
  copperL: { id:'copperL', label:'Copper tube, Type L',
    basis:'ASTM B88 Type L drawn tube inside diameter.',
    bores: COPPER_L },
};

// Rows are {catalog, size, feet} for pipe and {label, quantity, gallonsEach}
// for equipment. The allowance is an explicit uncertainty margin on the
// takeoff, not a hidden safety factor inside the sizing.
export function estimateSystemVolume({ pipeRows = [], equipmentRows = [], allowancePercent = 0 }) {
  finite(allowancePercent, 'Takeoff allowance');
  if (allowancePercent < 0 || allowancePercent > 100) throw new RangeError('Takeoff allowance must be from 0 to 100%.');
  if (!Array.isArray(pipeRows) || !Array.isArray(equipmentRows)) throw new RangeError('Estimator rows must be lists.');

  const pipe = pipeRows.map((row, i) => {
    const catalog = PIPE_CATALOGS[row.catalog];
    if (!catalog) throw new RangeError(`Pipe line ${i + 1}: select a supported pipe catalog.`);
    const bore = catalog.bores[Number(row.size)];
    if (!bore) throw new RangeError(`Pipe line ${i + 1}: size is not in the ${catalog.label} catalog.`);
    positive(row.feet, `Pipe line ${i + 1} length`, true);
    const perFoot = gallonsPerFoot(bore);
    return { catalog: catalog.id, catalogLabel: catalog.label, size: Number(row.size),
      bore, feet: Number(row.feet), gallonsPerFoot: perFoot, gallons: perFoot * Number(row.feet) };
  });
  const equipment = equipmentRows.map((row, i) => {
    positive(row.quantity, `Equipment line ${i + 1} quantity`, true);
    positive(row.gallonsEach, `Equipment line ${i + 1} volume`, true);
    return { label: String(row.label ?? '').trim() || `Equipment ${i + 1}`,
      quantity: Number(row.quantity), gallonsEach: Number(row.gallonsEach),
      gallons: Number(row.quantity) * Number(row.gallonsEach) };
  });

  const pipeVolume = pipe.reduce((s, r) => s + r.gallons, 0);
  const equipmentVolume = equipment.reduce((s, r) => s + r.gallons, 0);
  const subtotal = pipeVolume + equipmentVolume;
  if (subtotal <= 0) throw new RangeError('Enter at least one pipe run or equipment volume.');
  const allowance = subtotal * allowancePercent / 100;
  return { pipe, equipment, pipeVolume, equipmentVolume, subtotal,
    allowancePercent: Number(allowancePercent), allowance, total: subtotal + allowance };
}

// Minimum stable source output for buffer sizing. A source that unloads in
// equal steps holds its smallest step until the load falls below it, and that
// step is what the buffer must absorb.
export const BTUH_PER_TON = 12000;
export function minimumStepOutput({ capacity, unit = 'btuh', steps = 1 }) {
  positive(capacity, 'Source capacity');
  finite(steps, 'Capacity steps');
  if (!Number.isInteger(steps) || steps < 1 || steps > 100) throw new RangeError('Capacity steps must be a whole number from 1 to 100.');
  if (!['btuh', 'tons'].includes(unit)) throw new RangeError('Select a supported capacity unit.');
  const btuh = unit === 'tons' ? capacity * BTUH_PER_TON : capacity;
  return { capacity: Number(capacity), unit, steps, totalBtuh: btuh, stepBtuh: btuh / steps };
}
