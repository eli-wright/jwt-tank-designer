import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FLUIDS, fluidAtF, fluidBasis, fluidLabel, fluidTemperatureF, fluidViscosityCP,
  freezePointF, maxDensityBetween } from '../src/fluid.js';
import { gallonsPerFoot, estimateSystemVolume, minimumStepOutput, PIPE_CATALOGS } from '../src/system-volume.js';

// Reference values produced by the bundled CoolProp 7.2.0 engine itself, not by
// this module. See the fixture header for the engine revision and hashes.
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/glycol-coolprop.json', import.meta.url)), 'utf8'));

test('glycol density, specific heat and viscosity reproduce the CoolProp engine', () => {
  let density = 0, cp = 0, viscosity = 0, freeze = 0, checked = 0;
  for (const point of fixture.points) {
    if (point.freezeF !== undefined) {
      if (point.pct === 0) continue;
      freeze = Math.max(freeze, Math.abs(freezePointF(point.id, point.pct) - point.freezeF));
      checked++;
      continue;
    }
    if (point.pct === 0) continue;  // 0% is water and uses the IAPWS model instead
    if (point.viscosityCP !== undefined) {
      viscosity = Math.max(viscosity, Math.abs(fluidViscosityCP(point.id, point.pct, point.tempF) - point.viscosityCP) / point.viscosityCP);
      checked++;
      continue;
    }
    const state = fluidAtF(point.id, point.pct, point.tempF, 40);
    density = Math.max(density, Math.abs(state.rho - point.rho) / point.rho);
    cp = Math.max(cp, Math.abs(state.cp - point.cp) / point.cp);
    checked++;
  }
  // Every reference point at a real glycol concentration must be exercised, so
  // the comparison cannot silently check nothing.
  assert.equal(checked, fixture.points.filter(point => point.pct > 0).length);
  // These are double-precision rounding, so the correlation is reproduced exactly.
  assert.ok(density < 1e-10, `density ${density}`);
  assert.ok(cp < 1e-10, `specific heat ${cp}`);
  assert.ok(viscosity < 1e-9, `viscosity ${viscosity}`);
  assert.ok(freeze < 1e-9, `freeze point ${freeze}`);
});

test('specific heat and enthalpy are mutually consistent', () => {
  // Enthalpy is the analytic integral of the same specific-heat polynomial, so a
  // numerical integration of cp must return the reported enthalpy difference.
  for (const [id, pct] of [['eg', 30], ['pg', 45]]) {
    const lo = 60, hi = 180, n = 4000;
    let integral = 0;
    for (let i = 0; i < n; i++) {
      const a = lo + (hi - lo) * i / n, b = lo + (hi - lo) * (i + 1) / n;
      integral += (fluidAtF(id, pct, a, 40).cp + fluidAtF(id, pct, b, 40).cp) / 2 * (b - a);
    }
    const reported = fluidAtF(id, pct, hi, 40).h - fluidAtF(id, pct, lo, 40).h;
    assert.ok(Math.abs(reported - integral) / reported < 1e-9, `${id} ${pct}%: ${reported} vs ${integral}`);
  }
});

test('glycol is denser, less absorbent of heat and far more viscous than water', () => {
  const water = fluidAtF('water', 0, 100, 40), glycol = fluidAtF('pg', 50, 100, 40);
  assert.ok(glycol.rho > water.rho);
  assert.ok(glycol.cp < water.cp * 0.9);
  assert.ok(fluidViscosityCP('pg', 50, 70) > 4 * fluidViscosityCP('water', 0, 70));
});

test('freeze point falls with concentration and matches published glycol behavior', () => {
  let previous = 33;
  for (const pct of [10, 20, 30, 40, 50, 60]) {
    const freeze = freezePointF('pg', pct);
    assert.ok(freeze < previous, `${pct}% did not depress the freeze point`);
    previous = freeze;
  }
  // Published freeze points for these two common mixes, to about a degree.
  assert.ok(Math.abs(freezePointF('eg', 50) - (-33)) < 3, String(freezePointF('eg', 50)));
  assert.ok(Math.abs(freezePointF('pg', 30) - 9) < 3, String(freezePointF('pg', 30)));
  assert.equal(freezePointF('water', 0), 32);
});

test('fluid selection and range limits fail explicitly', () => {
  assert.throws(() => fluidBasis('mineral-oil', 30), RangeError);
  assert.throws(() => fluidBasis('water', 30), RangeError);   // water takes no concentration
  assert.throws(() => fluidBasis('eg', 0), RangeError);       // 0% glycol must be selected as water
  assert.throws(() => fluidBasis('eg', 70), RangeError);      // above the correlation limit
  assert.throws(() => fluidAtF('eg', 30, 250, 40), RangeError);  // above the 212 °F model limit
  assert.throws(() => fluidAtF('pg', 20, -20, 40), RangeError);  // below 0 °F
  // 20% propylene glycol freezes near 19 °F, so 10 °F must be rejected.
  assert.throws(() => fluidTemperatureF('pg', 20, 10), RangeError);
  assert.throws(() => fluidAtF('water', 0, 220, 0), RangeError); // below saturation pressure
  assert.ok(fluidAtF('eg', 40, 10, 40).rho > 0);  // valid below freezing water
  assert.equal(fluidLabel('eg', 35), '35% Ethylene glycol');
  assert.equal(fluidLabel('water'), 'Water');
  assert.equal(FLUIDS.pg.maxConcentration, 60);
});

test('maximum density covers the water anomaly and the glycol cold endpoint', () => {
  // Water is densest near 39 °F, inside the interval.
  const water = maxDensityBetween('water', 0, 32, 120, 20);
  assert.ok(water > fluidAtF('water', 0, 32, 20).rho);
  assert.ok(water > fluidAtF('water', 0, 120, 20).rho);
  // Glycol falls monotonically, so the cold endpoint governs.
  const glycol = maxDensityBetween('eg', 40, 20, 180, 20);
  assert.ok(Math.abs(glycol - fluidAtF('eg', 40, 20, 20).rho) < 1e-9);
});

test('pipe volume matches published gallons per foot', () => {
  // Schedule 40 steel: 1/2 in is ~1.6 gal per 100 ft, 2 in ~17.4, 4 in ~66.
  for (const [nps, per100] of [[0.5, 1.58], [2, 17.4], [4, 66.1]]) {
    const gallons = gallonsPerFoot(PIPE_CATALOGS.steel40.bores[nps]) * 100;
    assert.ok(Math.abs(gallons - per100) < 0.1, `NPS ${nps}: ${gallons}`);
  }
  // 1 in Type L copper is about 0.043 gal/ft.
  assert.ok(Math.abs(gallonsPerFoot(PIPE_CATALOGS.copperL.bores[1]) - 0.0429) < 0.0005);
  assert.throws(() => gallonsPerFoot(0), RangeError);
});

test('system volume estimator sums pipe geometry, equipment and allowance', () => {
  const estimate = estimateSystemVolume({
    pipeRows: [{ catalog:'steel40', size:4, feet:200 }, { catalog:'copperL', size:1, feet:150 }],
    equipmentRows: [{ label:'AHU coils', quantity:4, gallonsEach:12 }, { label:'Chiller barrel', quantity:1, gallonsEach:30 }],
    allowancePercent: 10,
  });
  const expected = gallonsPerFoot(PIPE_CATALOGS.steel40.bores[4]) * 200 + gallonsPerFoot(PIPE_CATALOGS.copperL.bores[1]) * 150;
  assert.ok(Math.abs(estimate.pipeVolume - expected) < 1e-9);
  assert.equal(estimate.equipmentVolume, 78);
  assert.ok(Math.abs(estimate.total - estimate.subtotal * 1.1) < 1e-9);
  assert.equal(estimate.pipe.length, 2);
  assert.throws(() => estimateSystemVolume({ pipeRows: [] }), RangeError);
  assert.throws(() => estimateSystemVolume({ pipeRows: [{ catalog:'steel40', size:5, feet:10 }] }), RangeError);
  assert.throws(() => estimateSystemVolume({ pipeRows: [{ catalog:'pex', size:1, feet:10 }] }), RangeError);
  assert.throws(() => estimateSystemVolume({ pipeRows: [{ catalog:'steel40', size:4, feet:10 }], allowancePercent: 150 }), RangeError);
});

test('minimum step output converts capacity and steps', () => {
  const step = minimumStepOutput({ capacity: 100, unit: 'tons', steps: 4 });
  assert.equal(step.totalBtuh, 1200000);
  assert.equal(step.stepBtuh, 300000);
  assert.equal(minimumStepOutput({ capacity: 500000, unit: 'btuh', steps: 1 }).stepBtuh, 500000);
  for (const bad of [{ capacity:0, steps:1 }, { capacity:10, steps:0 }, { capacity:10, steps:2.5 }, { capacity:10, steps:1, unit:'kW' }])
    assert.throws(() => minimumStepOutput(bad), RangeError);
});
