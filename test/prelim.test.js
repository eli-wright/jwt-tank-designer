import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PRELIM_DEFAULTS, PRELIM_REVISION, sizeWithPrelim, prelimNumber } from '../src/prelim-adapter.js';
import { DEFAULT_INPUTS, evaluateDesign } from '../src/design-state.js';
import { PRODUCTS } from '../src/products.js';
import { generateReportHTML } from '../src/report.js';
import { designVessel, DEFAULT_INPUT, MATERIALS } from '../src/prelim/engine.js';
import { designWithCodeRules, designAutoRt } from '../src/prelim/assessment.js';

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const base={...DEFAULT_INPUTS,operatingTemp:180,designTemp:200,minPressure:12,maxPressure:25,
  reliefPressure:30,mawp:150,designFlowGPM:100};
const evaluate=(inputs={},product=PRODUCTS[0],materialId='CS',tankVol=100)=>evaluateDesign({
  product,inputs:{...base,...inputs},sizingMode:'tank',tankVol,materialId,CA:.0625,supportType:'skirt'});

test('vendored engines are byte-identical to the pinned prelim Git blobs',async()=>{
  for(const [file,sha] of [['engine.js','db5241006cd9ec23bf430bd37e4155495058f40e'],['assessment.js','584795d4441aba365e772a9655317147bdd17cb4']]) {
    const data=await readFile(new URL(`../src/prelim/${file}`,import.meta.url));
    const hash=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
    assert.equal(hash,sha);
  }
});
for(const product of PRODUCTS) for(const material of ['CS','SS304','SS316']) for(const volume of [25,500]) {
  test(`JWT prelim integration ${product.id}, ${material}, ${volume} gal`,()=>{
    const {vessel:v,error}=evaluate({},product,material,volume);
    assert.equal(error,null);assert.ok(v?.prelim);assert.ok(v.actualVolGal>=volume);
    near(v.D_OD,v.D_ID+2*v.tShell);near(v.shellLength,v.prelim.result.inp.length);
    assert.ok(v.shellCapacity+1e-6>=v.designPressure);assert.ok(v.headCapacity+1e-6>=v.designPressure);
    assert.equal(v.releaseReady,false);assert.equal(v.prelim.revision,PRELIM_REVISION);
    assert.match(v.shellSpec,material==='CS'?/SA-(53|516)/:/SA-(240|312).*L/);
    for(const n of v.nozzles) if(n.flow) assert.ok(n.flow.velocityOK);
    const html=generateReportHTML(product,base,{kind:'direct'},v,'');
    assert.ok(!/undefined|NaN|Infinity/.test(html));
    assert.ok(html.includes('Prelim mechanical sizing'));assert.ok(html.includes(PRELIM_REVISION));
  });
}
for(const material of ['CS','SS304','SS316']) for(const headType of ['ellipsoidal','hemispherical','torispherical','pipecap'])
for(const construction of ['pipe','plate']) for(const diameterBasis of ['OD','ID']) for(const externalPressure of [0,15]) {
  test(`Prelim geometry ${material}/${headType}/${construction}/${diameterBasis}/vacuum ${externalPressure}`,()=>{
    const p=sizeWithPrelim(100,150,200,material,.0625,{headType,construction,diameterBasis,externalPressure,mechanicalDiameter:24},{nps:24});
    const r=p.result;
    assert.ok(r.volume_gal>=100);assert.ok(p.headMin<=r.t_head_design+1e-8);
    assert.ok(p.shellCapacity+1e-6>=150);assert.ok(p.headCapacity+1e-6>=150);
    assert.equal(r.inp.ext_pressure,externalPressure);
    if(externalPressure===0) assert.equal(r.t_shell_external,0);
    else assert.ok(r.t_shell_external>0);
  });
}
test('independent UG-27 and head inverse pressure checks on a corroded pipe vessel',()=>{
  const p=sizeWithPrelim(100,150,200,'CS',.0625,{rtMode:'manual',capWeldExam:'full',mechanicalDiameter:24},{nps:24});
  const r=p.result,net=r.t_shell_nominal*.875-.0625;
  const radius=p.od/2-r.t_shell_nominal*.875+.0625;
  const hoop=r.S*r.e_circ*net/(radius+.6*net);
  const longitudinal=2*r.s_longitudinal*p.longE*net/(radius-.4*net);
  near(p.shellCapacity,Math.min(hoop,longitudinal)-r.static_head_psi);
  near(p.headCapacity,2*p.headStress*p.headE*(p.headMin-.0625)/(p.od-1.8*(p.headMin-.0625))-r.static_head_head_psi);
  assert.ok(p.headMin<r.t_head_nominal);
  assert.ok(p.headCapacity<r.mawp_head-r.static_head_head_psi);
});
test('automatic sizing matches a fresh source-engine solve at its final geometry',()=>{
  const p=sizeWithPrelim(100,150,200,'CS',.0625,{}, {nps:24});
  const r=designVessel(p.result.inp);
  for(const k of ['volume_gal','t_shell_nominal','t_head_nominal','S','static_head_psi']) near(p.result[k],r[k]);
});
test('manual and automatic radiography preserve input state',()=>{
  const input=Object.freeze({...DEFAULT_INPUT,diameter:96,pressure:300,temp_F:200,joint_eff:.7,required_mdmt:-55});
  const before=JSON.stringify(input);
  for(const run of [designWithCodeRules,designAutoRt]) {
    const a=run(designVessel,input);run(designVessel,{...input,diameter:24,construction:'pipe'});
    assert.deepEqual(run(designVessel,input),a);
  }
  assert.equal(JSON.stringify(input),before);
});
test('material change uses the actual grade and pipe product form',()=>{
  const a=evaluate({pipeProductForm:'seamless'}).vessel.prelim;
  const b=evaluate({pipeProductForm:'welded'}).vessel.prelim;
  assert.equal(a.result.s_product_factor,1);assert.equal(b.result.s_product_factor,.85);
  const s=evaluate({},PRODUCTS[0],'SS316').vessel.prelim;
  assert.equal(s.result.inp.material,'stainless316L');
  near(s.headStress,MATERIALS.stainless316L.allowableStress(200));
});
test('thermal volume feeds prelim without a stale direct-volume fallback',()=>{
  const request={product:PRODUCTS[0],inputs:{...base,systemVol:100,fillTemp:40,precharge:12,acceptancePercent:100},
    sizingMode:'system',tankVol:999,materialId:'CS',CA:.0625,supportType:'clips'};
  const s=evaluateDesign(request);
  assert.equal(s.error,null);assert.equal(s.effectiveTankVol,10);assert.ok(s.vessel.actualVolGal>=10 && s.vessel.actualVolGal<20);
  assert.equal(evaluateDesign({...request,inputs:{...request.inputs,maxPressure:10}}).vessel,null);
});
test('buffer thermal energy result sizes the actual prelim vessel',()=>{
  const s=evaluateDesign({product:PRODUCTS[4],inputs:{...base,sourceOutput:48000,minimumLoad:2000,bufferLowTemp:100,bufferHighTemp:120},
    sizingMode:'system',tankVol:999,materialId:'SS304',CA:0,supportType:'skirt'});
  assert.equal(s.error,null);assert.equal(s.sizing.kind,'buffer');
  assert.ok(s.vessel.actualVolGal>=s.sizing.minTankVol*1.05);assert.ok(s.vessel.actualVolGal<100);
});
test('invalid prelim fields reject cleanly and clear the result',()=>{
  for(const inputs of [{externalPressure:-1},{externalPressure:16},{requiredMDMT:''},{mechanicalDiameter:' '},
    {construction:'invalid'},{headType:'cone'},{mechanicalMethod:'invalid'},{rtEfficiency:.95},{steelPrice:0},{designTemp:''}]) {
    const s=evaluate(inputs);assert.equal(s.vessel,null,JSON.stringify(inputs));assert.ok(s.error);
  }
  for(const x of ['',null,undefined,true,NaN,Infinity,' ']) assert.throws(()=>prelimNumber(x,'test',0,10),RangeError);
  assert.throws(()=>sizeWithPrelim(-1,150,200,'CS',0,{}, {nps:24}),RangeError);
});
test('report keeps source assumptions and escapes user text',()=>{
  const s=evaluate({codeEdition:'<script>bad</script>',headType:'torispherical',externalPressure:15});
  const html=generateReportHTML(PRODUCTS[0],base,{kind:'direct'},s.vessel,'');
  assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!html.includes('<script>bad'));
  assert.ok(html.includes('Provisional elastic model'));assert.ok(html.includes('ASME F&amp;D'));
  assert.ok(!html.includes('Geometry uses a cylinder and two ideal 2:1'));
  assert.ok(!html.includes('All components conservatively use the bottom pressure'));
  assert.ok(html.includes('supplier guarantee'));assert.ok(html.includes('not a formed-wall guarantee'));
});
test('prelim is the default and the entered-stress mode remains explicit',()=>{
  assert.equal(PRELIM_DEFAULTS.mechanicalMethod,'prelim');
  assert.ok(evaluate().vessel);
  assert.equal(evaluate({mechanicalMethod:'entered'}).vessel,null);
  assert.ok(evaluate({shellE:'',circumferentialE:'',headE:'',headFormingPercent:'',plateTolerance:''}).vessel);
});

test('JavaScript sizing and assessment match 12 pinned Python reference cases',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/prelim-python.json',import.meta.url),'utf8'));
  assert.equal(fixture.revision,PRELIM_REVISION);
  for(const c of fixture.cases) {
    const {result:r,assessment:a}=designAutoRt(designVessel,c.input);
    for(const [key,value] of Object.entries(c.result)) near(r[key],value,1e-7);
    near(a.mdmt.allowable,c.assessment.mdmt);
    assert.equal(a.mdmt.impactRequired,c.assessment.impact);
    assert.equal(a.normalized,c.assessment.normalized);
    assert.equal(a.pwht,c.assessment.pwht);assert.equal(a.rt.level,c.assessment.rt);
  }
});
