import test from 'node:test';
import assert from 'node:assert/strict';
import { waterRegion1, saturationPressureMPa, waterAtF, waterViscosityCP } from '../src/water.js';
import { sizeExpansion, sizeBuffer, sizeDrawdown, designLiquidDensity, calcShellThickness,
  calcHead21SE, shellPressureCapacity, headPressureCapacity, roundUpToStdThickness,
  selectPipeSchedule, calcFrictionFactor, calcNozzleFlow, ellipsoidalHeadVolume,
  selectDiameter, designVessel } from '../src/engineering.js';
import { DEFAULT_INPUTS, evaluateDesign, numberInput } from '../src/design-state.js';
import { generateReportHTML } from '../src/report.js';
import { PRODUCTS } from '../src/products.js';

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tol ${tolerance})`);
}
const expansion = {systemVol:100,fillTemp:40,designTemp:180,minPressure:12,maxPressure:25,precharge:12,acceptanceLimit:1};
const buffer = {sourceOutput:48000,minimumLoad:2000,runtimeMin:10,lowTemp:100,highTemp:120,minPressure:20};
// These stresses are explicit test inputs, not a material-property database.
const basis = {designTempF:200,operatingTempF:180,minPressure:20,shellStress:20000,pipeStress:17100,
  headStress:20000,nozzleStress:17100,shellE:0.85,circumferentialE:0.85,headE:0.85,
  codeEdition:'2025',stressBasis:'Synthetic regression fixture. Verify actual material rows.'};

// Independent published check values, IAPWS-IF97 Tables 5 and 35.
for (const [T,p,v,h,cp] of [[300,3,0.00100215168,115.331273,4.17301218],
  [300,80,0.000971180894,184.142828,4.01008987],[500,3,0.00120241800,975.542239,4.65580682]]) {
  test(`IAPWS Table 5 at ${T} K / ${p} MPa`,() => {
    const w = waterRegion1(T,p); near(w.v,v,5e-12); near(w.h,h,5e-7); near(w.cp,cp,5e-9);
  });
}
for (const [T,p] of [[300,0.00353658941],[500,2.63889776],[600,12.3443146]]) {
  test(`IAPWS Table 35 saturation at ${T} K`,() => near(saturationPressureMPa(T),p,5e-8));
}
test('water phase and property ranges fail explicitly',() => {
  for (const args of [[180,-1],[450,150],[31,20],[451,1000],[NaN,20]]) assert.throws(() => waterAtF(...args),RangeError);
  assert.throws(() => waterRegion1(500,0.1),RangeError);
  assert.throws(() => waterViscosityCP(451),RangeError);
  assert.ok(waterAtF(70,20).rho > 62 && waterAtF(70,20).rho < 63);
});
test('expansion matches water-density and Boyle-law benchmark',() => {
  const s = sizeExpansion(expansion);
  near(s.acceptanceFactor,13/39.7);
  assert.ok(s.expandedWater > 3.04 && s.expandedWater < 3.06);
  assert.ok(s.minTankVol > 9.29 && s.minTankVol < 9.32);
  assert.equal(s.pipingExpansion,0);
});
test('water anomaly is included across the density maximum',() => {
  const s = sizeExpansion({...expansion,fillTemp:32,designTemp:45});
  const endpointOnly = Math.abs(waterAtF(32,12).rho / waterAtF(45,12).rho - 1);
  assert.ok(s.netExpansionFactor > endpointOnly);
  assert.ok(s.expandedWater > 0);
});
test('partial acceptance and low precharge increase required volume',() => {
  const normal = sizeExpansion(expansion);
  const partial = sizeExpansion({...expansion,acceptanceLimit:0.2});
  near(partial.acceptanceFactor,0.2);
  assert.ok(partial.minTankVol > normal.minTankVol);
  const low = sizeExpansion({...expansion,precharge:5});
  assert.ok(low.coldWaterFraction > 0 && low.minTankVol > normal.minTankVol);
  assert.ok(sizeExpansion({...expansion,polytropicExponent:1.4}).minTankVol > normal.minTankVol);
});
for (const change of [{maxPressure:12},{maxPressure:5},{precharge:13},{acceptanceLimit:0},
  {acceptanceLimit:1.1},{acceptanceLimit:0.1,precharge:0},{designTemp:35},{fillTemp:0},
  {systemVol:-1},{systemVol:Infinity},{polytropicExponent:0.9},{atmosphericPsia:0}]) {
  test(`invalid expansion input ${JSON.stringify(change)} is rejected`,() => assert.throws(() => sizeExpansion({...expansion,...change}),RangeError));
}
test('buffer energy balance agrees with Caleffi 46-gallon example within variable-property correction',() => {
  const s = sizeBuffer(buffer);
  near(s.energyBtu,7666.666666666667);
  assert.ok(s.minTankVol > 46 && s.minTankVol < 47);
  near(sizeBuffer({...buffer,runtimeMin:20}).minTankVol,2*s.minTankVol);
  near(sizeBuffer({...buffer,existingVolume:10,utilization:0.5}).minTankVol,(s.minTankVol-10)*2);
  assert.equal(sizeBuffer({...buffer,existingVolume:100}).minTankVol,0);
  assert.equal(sizeBuffer({...buffer,minimumLoad:50000}).minTankVol,0);
});
test('buffer invalid control band, runtime and volume do not create a vessel',() => {
  for (const change of [{highTemp:100},{lowTemp:130},{runtimeMin:0},{utilization:0},{existingVolume:-1},{minimumLoad:-1}]) {
    assert.throws(() => sizeBuffer({...buffer,...change}),RangeError);
  }
});
test('shell and head hand-calculation fixtures and inverse pressure checks',() => {
  near(calcShellThickness(100,10,10000,1,0),0.10060362173038229);
  near(calcHead21SE(100,20,10000,1,0),0.1001001001001001);
  const shell = calcShellThickness(150,15,20000,0.85,0.125);
  assert.ok(shell > calcShellThickness(150,15,20000,0.85,0)+0.125);
  near(shellPressureCapacity(15,shell,20000,0.85,0.125),150);
  const head = calcHead21SE(150,30,20000,0.85,0.125);
  near(headPressureCapacity(30,head,20000,0.85,0.125),150);
  assert.ok(calcShellThickness(100,10,10000,1,0,0.3) > calcShellThickness(100,10,10000,1,0,1));
});
test('invalid pressure-wall inputs cannot yield passing results',() => {
  for (const args of [[0,10,10000,1,0],[100,10,0,1,0],[100,10,10000,0,0],[4000,10,10000,1,0],[100,10,10000,1,-0.1]]) {
    assert.throws(() => calcShellThickness(...args),RangeError);
  }
  assert.throws(() => shellPressureCapacity(10,0.1,20000,1,0.125),RangeError);
});
test('standard plate rounding never rounds down near a thickness boundary',() => {
  assert.equal(roundUpToStdThickness(0.25001),0.3125);
  assert.equal(roundUpToStdThickness(0.25),0.25);
  assert.throws(() => roundUpToStdThickness(NaN),RangeError);
});
test('pipe schedule includes corrosion and mill tolerance and never falls back to an inadequate wall',() => {
  const p = selectPipeSchedule(24,1200,17100,0.125);
  assert.equal(p.schedule,'Sch80');
  near(p.minWall,1.218*0.875);
  assert.ok(p.minWall >= p.tReq);
  assert.throws(() => selectPipeSchedule(24,5000,17100,0.125),/No NPS/);
  assert.throws(() => selectPipeSchedule(99,150,17100,0),RangeError);
});
test('ellipsoidal head volume and unavailable vessel sizes',() => {
  near(ellipsoidalHeadVolume(24),7.833581681678445,1e-10);
  assert.throws(() => selectDiameter(0),RangeError);
  assert.throws(() => selectDiameter(1e9),RangeError);
});
test('Colebrook result satisfies independent implicit equation',() => {
  const f = calcFrictionFactor(100000,0.0018,2);
  near(1/Math.sqrt(f)+2*Math.log10(0.0018/2/3.7+2.51/(100000*Math.sqrt(f))),0,1e-10);
  near(calcFrictionFactor(1000,0,2),0.064);
  assert.equal(calcFrictionFactor(0,0,2),0);
});
const flow = {Q_gpm:50,d_in:2,tempF:70,pressurePsig:20,materialId:'CS',nozzleLength:3,service:'buffer-in'};
test('nozzle flow conserves volume and handles zero, transition and stainless roughness',() => {
  const q = calcNozzleFlow(flow);
  // 50 US gal/min * 231 in³/gal / 60 / (π in²) / 12 in/ft.
  near(q.v_fps,5.106221090864975,1e-8);
  assert.ok(q.dP_total_psi > 0);
  const zero = calcNozzleFlow({...flow,Q_gpm:0});
  assert.equal(zero.dP_total_psi,0); assert.equal(zero.flowRegime,'No flow');
  assert.equal(calcNozzleFlow({...flow,materialId:'SS316'}).epsilon,0.00006);
  assert.equal(calcNozzleFlow({...flow,service:'buffer-out'}).K_total,0.5);
  assert.throws(() => calcNozzleFlow({...flow,d_in:0}),RangeError);
});

for (const product of PRODUCTS) for (const volume of [25,500]) for (const material of ['CS','SS304','SS316']) {
  test(`design integration ${product.id} ${volume} gal ${material}`,() => {
    const v = designVessel(volume,150,product,material,0.125,{...basis,designFlowGPM:250});
    assert.ok(v.actualVolGal >= volume);
    assert.ok(v.componentPressure > v.designPressure && v.staticHeadPsi > 0);
    assert.ok(v.shellMin >= v.tShellCalc && v.headMin >= v.tHeadCalc);
    assert.ok(v.shellCapacity >= 150 && v.headCapacity >= 150);
    assert.equal(v.headType,'Formed 2:1 Ellipsoidal');
    assert.equal(v.releaseReady,false);
    assert.equal(v.shellStress,v.isPipe ? basis.pipeStress : basis.shellStress);
    for (const n of v.nozzles) { assert.equal(n.reinf,null); if (n.flow) assert.ok(n.flow.velocityOK); }
    if (product.internals !== 'none') assert.ok(!v.nozzles.some(n => n.service === 'drain'));
  });
}
test('buffer nozzles upsize to actual flow and reject unsupported duty',() => {
  const v = designVessel(100,150,PRODUCTS[4],'CS',0.0625,{...basis,designFlowGPM:500});
  assert.ok(v.nozzles[0].size > 4);
  assert.throws(() => designVessel(100,150,PRODUCTS[4],'CS',0.0625,basis),/actual design flow/);
  assert.throws(() => designVessel(100,150,PRODUCTS[4],'CS',0.0625,{...basis,designFlowGPM:100000}),/No supported nozzle/);
});
const ui = {product:PRODUCTS[0],inputs:{...DEFAULT_INPUTS,mechanicalMethod:"entered",systemVol:100,fillTemp:40,operatingTemp:180,designTemp:200,
  minPressure:12,maxPressure:25,precharge:12,acceptancePercent:100,reliefPressure:30,mawp:150,
  shellStress:20000,pipeStress:17100,headStress:20000,nozzleStress:17100,stressBasis:basis.stressBasis},
  sizingMode:'system',tankVol:500,materialId:'CS',CA:0.0625,supportType:'clips'};
test('invalid UI state clears the vessel rather than using old manual volume',() => {
  assert.ok(evaluateDesign(ui).vessel);
  const invalid = evaluateDesign({...ui,inputs:{...ui.inputs,maxPressure:10}});
  assert.equal(invalid.vessel,null); assert.match(invalid.error,/Maximum pressure/);
  for (const key of ['designTemp','operatingTemp','shellStress','pipeStress','reliefPressure']) {
    const s = evaluateDesign({...ui,inputs:{...ui.inputs,[key]:''}});
    assert.equal(s.vessel,null); assert.ok(s.error);
  }
  const overRelief = evaluateDesign({...ui,inputs:{...ui.inputs,maxPressure:29}});
  assert.equal(overRelief.vessel,null); assert.match(overRelief.error,/margin/);
  assert.throws(() => numberInput(' ','temperature'),RangeError);
});
test('report uses actual inputs, selected support, escaped text and unresolved design status',() => {
  const {vessel,sizing} = evaluateDesign({...ui,inputs:{...ui.inputs,stressBasis:'<script>unsafe</script>'}});
  const h = generateReportHTML(ui.product,ui.inputs,sizing,vessel,'data:image/png;base64,');
  assert.ok(h.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(h.includes('200 / 180 °F'));
  assert.ok(h.includes(`${vessel.emptyWeightClips} lb`));
  assert.ok(h.includes('clips'));
  for (const old of ['40-50 ft-lbs','ENGINEERING APPROVAL','automotive tire','2023 Edition','qualifies for the small opening exemption']) assert.ok(!h.includes(old));
  assert.ok(h.includes('Vessel MAWP'));
  assert.ok(!h.includes('undefined') && !h.includes('NaN') && !h.includes('Infinity'));
});

// ── Glycol fluids, pump drawdown and the estimators that feed them ──────────
test('glycol expands more and stores less energy than water, so tanks grow',() => {
  const water = sizeExpansion(expansion);
  const glycol = sizeExpansion({...expansion,fluidId:'pg',concentrationPercent:40});
  assert.ok(glycol.netExpansionFactor > water.netExpansionFactor * 1.2);
  assert.ok(glycol.minTankVol > water.minTankVol);
  // Acceptance is a gas-law property of the pressures, so it must not move.
  near(glycol.acceptanceFactor,water.acceptanceFactor);
  assert.equal(glycol.fluidLabel,'40% Propylene glycol');
  assert.ok(glycol.freezePointF < 20);

  const waterBuffer = sizeBuffer(buffer);
  const glycolBuffer = sizeBuffer({...buffer,fluidId:'eg',concentrationPercent:50});
  assert.ok(glycolBuffer.btuPerGal < waterBuffer.btuPerGal);
  assert.ok(glycolBuffer.minTankVol > waterBuffer.minTankVol);
});
test('glycol selection is validated wherever it is used',() => {
  for (const change of [{fluidId:'diesel'},{fluidId:'eg',concentrationPercent:0},{fluidId:'eg',concentrationPercent:75},
    {fluidId:'water',concentrationPercent:30},{fluidId:'pg',concentrationPercent:30,designTemp:240}])
    assert.throws(() => sizeExpansion({...expansion,...change}),RangeError,JSON.stringify(change));
  // 50% propylene glycol freezes near -26 °F, so a -40 °F buffer low is rejected.
  assert.throws(() => sizeBuffer({...buffer,fluidId:'pg',concentrationPercent:50,lowTemp:-40,highTemp:0}),RangeError);
});
const drawdown = {pumpFlow:10,cutIn:40,cutOut:60,runtimeMin:1,precharge:38,acceptanceLimit:1};
test('drawdown reproduces the published 40/60 multiplier and cycling rule',() => {
  const d = sizeDrawdown(drawdown);
  // P0 (1/P1 - 1/P2) in absolute pressures, the published drawdown coefficient.
  near(d.drawdownFactor,52.7*(1/54.7-1/74.7),1e-12);
  assert.ok(d.drawdownFactor > 0.25 && d.drawdownFactor < 0.27);
  near(d.requiredDrawdown,10);
  near(d.minTankVol,10/d.drawdownFactor,1e-9);
  // A one-minute minimum run is the familiar 15 starts per hour worst case.
  near(d.maxStartsPerHour,15);
  near(sizeDrawdown({...drawdown,runtimeMin:2}).maxStartsPerHour,7.5);
  // A larger pressure band and a higher precharge both free up more drawdown.
  assert.ok(sizeDrawdown({...drawdown,cutOut:80}).drawdownFactor > d.drawdownFactor);
  assert.ok(sizeDrawdown({...drawdown,precharge:20}).drawdownFactor < d.drawdownFactor);
  // The supplier acceptance limit still caps the usable fraction.
  near(sizeDrawdown({...drawdown,acceptanceLimit:0.1}).drawdownFactor,0.1-d.lowWaterFraction,1e-12);
});
test('drawdown inputs fail explicitly',() => {
  for (const change of [{cutOut:40},{cutOut:30},{precharge:41},{pumpFlow:0},{runtimeMin:0},
    {acceptanceLimit:0},{acceptanceLimit:1.2},{polytropicExponent:1.5},{acceptanceLimit:0.02},{cutIn:0}])
    assert.throws(() => sizeDrawdown({...drawdown,...change}),RangeError,JSON.stringify(change));
});
test('fill density keeps the water floor and follows a heavier glycol',() => {
  const water = designLiquidDensity({hotTempF:180,minPressure:20});
  near(water,62.5);
  near(designLiquidDensity({fluidId:'water',coldTempF:40,hotTempF:180,minPressure:20}),62.5);
  const glycol = designLiquidDensity({fluidId:'eg',concentrationPercent:50,coldTempF:40,hotTempF:180,minPressure:20});
  assert.ok(glycol > 66 && glycol < 72,String(glycol));
});
const drawdownUI = {product:PRODUCTS[3],inputs:{...DEFAULT_INPUTS,mechanicalMethod:'entered',
  pumpFlowGPM:20,pumpRuntimeMin:1,cutInPressure:40,cutOutPressure:60,precharge:38,acceptancePercent:100,
  operatingTemp:140,designTemp:200,minPressure:40,maxPressure:60,reliefPressure:100,mawp:150,
  shellStress:20000,pipeStress:17100,headStress:20000,nozzleStress:17100,stressBasis:basis.stressBasis},
  sizingMode:'drawdown',tankVol:'',materialId:'CS',CA:0.0625,supportType:'skirt'};
test('drawdown mode sizes a real vessel and appears in the report',() => {
  const s = evaluateDesign(drawdownUI);
  assert.equal(s.error,null);
  assert.equal(s.sizing.kind,'drawdown');
  assert.equal(s.effectiveTankVol,Math.ceil(s.sizing.minTankVol*1.05));
  assert.ok(s.vessel.actualVolGal >= s.effectiveTankVol);
  const h = generateReportHTML(drawdownUI.product,drawdownUI.inputs,s.sizing,s.vessel,'data:image/png;base64,');
  assert.ok(h.includes('Required drawdown'));
  assert.ok(h.includes('Worst-case starts per hour'));
  assert.ok(h.includes('38 psig'));
  assert.ok(!h.includes('undefined') && !h.includes('NaN') && !h.includes('Infinity'));
  // The pressure basis must bracket the switch settings, and a buffer has no gas charge.
  assert.match(evaluateDesign({...drawdownUI,inputs:{...drawdownUI.inputs,maxPressure:50,reliefPressure:100}}).error,/bracket the switch settings/);
  assert.match(evaluateDesign({...drawdownUI,product:PRODUCTS[4]}).error,/membrane tank/);
});
test('a glycol design reaches the vessel, its loads and its report',() => {
  const glycolUI = {...ui,inputs:{...ui.inputs,fluidId:'eg',concentrationPercent:50}};
  const s = evaluateDesign(glycolUI);
  assert.equal(s.error,null);
  const water = evaluateDesign(ui);
  assert.equal(water.error,null);
  // Heavier fill raises static head and the full-liquid load case.
  assert.ok(s.vessel.liquidDensity > water.vessel.liquidDensity);
  assert.ok(s.vessel.waterWeight > water.vessel.waterWeight);
  // Glycol is far more viscous, so the nozzle screen must not reuse water viscosity.
  const glycolFlow = calcNozzleFlow({Q_gpm:20,d_in:2,tempF:100,pressurePsig:40,materialId:'CS',
    nozzleLength:3,service:'system',fluidId:'pg',concentrationPercent:50});
  const waterFlow = calcNozzleFlow({Q_gpm:20,d_in:2,tempF:100,pressurePsig:40,materialId:'CS',nozzleLength:3,service:'system'});
  assert.ok(glycolFlow.mu_cP > 3 * waterFlow.mu_cP);
  assert.ok(glycolFlow.Re < waterFlow.Re);
  const h = generateReportHTML(ui.product,glycolUI.inputs,s.sizing,s.vessel,'data:image/png;base64,');
  assert.ok(h.includes('50% Ethylene glycol'));
  assert.ok(h.includes('freeze point'));
  assert.ok(h.includes('inhibitor'));
  assert.ok(!h.includes('undefined') && !h.includes('NaN') && !h.includes('Infinity'));
});
