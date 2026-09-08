import { STD_PIPE } from './engineering-data.js';
import { DEFAULT_INPUT, designVessel, MATERIALS, SA53_B_SMLS, SA312_SMLS,
  SA234_WPB, SA403_CAP, headInsideDepth, pipeHeadEfficiency, HEAD_FORMING_THINNING,
  stainlessPlatePrice, ok } from './prelim/engine.js';
import { designWithCodeRules, designAutoRt, dualRating } from './prelim/assessment.js';

export const PRELIM_REVISION = '60df2ff88bbe40e8f33d0dd4bfbd732ea501ec08';
export const PRELIM_DEFAULTS = {
  mechanicalMethod:'prelim', mechanicalDiameter:'', diameterBasis:'OD', construction:'auto',
  headType:'ellipsoidal', pipeProductForm:'seamless', rtMode:'auto', rtEfficiency:0.85,
  headConstruction:'seamless', capWeldExam:'none', capWeldType:'type2', externalPressure:0,
  requiredMDMT:-20, materialCondition:'as_rolled', heatTreatment:'none', steelPrice:0.86,
};
const materialKeys = {CS:'carbon',SS304:'stainless',SS316:'stainless316L'};
export function prelimNumber(x,label,min=-Infinity,max=Infinity) {
  if ((typeof x === 'string' && x.trim() === '') || x == null || typeof x === 'boolean' || !Number.isFinite(Number(x)) || Number(x)<min || Number(x)>max)
    throw new RangeError(`${label} must be a number from ${min} to ${max}.`);
  return Number(x);
}
function choice(x,values,label) { if (!values.includes(x)) throw new RangeError(`Select a valid ${label}.`); return x; }
export function sizeWithPrelim(targetVolGal, pressure, tempF, materialId, corrosion, inputs, autoChoice) {
  prelimNumber(targetVolGal,'Required tank volume',0.01,1000000);
  const q={...PRELIM_DEFAULTS,...inputs};
  const material=materialKeys[materialId];
  if (!material) throw new RangeError('Unsupported prelim material mapping.');
  const requestedDiameter=q.mechanicalDiameter === '' ? (STD_PIPE.find(p=>p.nps===autoChoice.nps)?.od ?? autoChoice.id) : prelimNumber(q.mechanicalDiameter,'Mechanical diameter',2.375,192);
  const construction=choice(q.construction,['auto','pipe','plate'],'construction') === 'auto' ? (requestedDiameter<=28?'pipe':'plate') : q.construction;
  const headType=choice(q.headType,['ellipsoidal','hemispherical','torispherical','pipecap'],'head type');
  // Do not silently exceed the shop forming envelope on a small automatic selection.
  const diameter=q.mechanicalDiameter === '' && (construction==='plate'||headType!=='pipecap') ? Math.max(12.75,requestedDiameter) : requestedDiameter;
  const inp={...DEFAULT_INPUT,diameter,diameter_basis:choice(q.diameterBasis,['OD','ID'],'diameter basis'),
    pressure:prelimNumber(pressure,'Design pressure',0.01,300),temp_F:prelimNumber(tempF,'Design temperature',32,450),
    material,corrosion:prelimNumber(corrosion,'Corrosion allowance',0,0.5),orientation:'vertical',
    fluid_sg:62.5/62.4,fill_fraction:1,liquid_level_in:null,construction,head_type:headType,
    pipe_product_form:choice(q.pipeProductForm,['seamless','welded'],'pipe product form'),
    cap_weld_exam:choice(q.capWeldExam,['none','a5b','spot','full'],'Category B examination'),
    cap_weld_type:choice(q.capWeldType,['type1','type2'],'Category B weld type'),
    joint_eff:prelimNumber(q.rtEfficiency,'Category A efficiency',0.7,1),
    head_joint_eff:choice(q.headConstruction,['seamless','welded'],'head construction')==='seamless'?1:0.85,
    ext_pressure:prelimNumber(q.externalPressure,'External design pressure',0,15),
    required_mdmt:prelimNumber(q.requiredMDMT,'Required MDMT',-320,200),
    material_condition:choice(q.materialCondition,['as_rolled','normalized'],'material condition'),
    pwht:choice(q.heatTreatment,['none','preheat','pwht'],'heat treatment')==='pwht'?'pwht':'none',
    weld_preheat:q.heatTreatment==='preheat',price_per_lb:prelimNumber(q.steelPrice,'Base steel price',0.01,100),
  };
  if (![0.7,0.85,1].includes(inp.joint_eff)) throw new RangeError('Category A efficiency must be 0.70, 0.85, or 1.00.');
  const run=choice(q.rtMode,['auto','manual'],'radiography mode')==='auto'?designAutoRt:designWithCodeRules;
  // Re-evaluate diameter, schedule, radiography, head thickness and static head
  // at each length. A fixed nominal bore conversion can undersize a pipe tank.
  let length=Math.max(6,diameter*0.6), found;
  for(let i=0;i<60;i++) {
    const candidate=run(designVessel,{...inp,length});
    const r=candidate.result;
    if (!r.plate || !ok(r.t_nominal) || !ok(r.volume_gal)) throw new RangeError(`Prelim cannot size this vessel. ${r.notes.join(' ')}`);
    found=candidate;
    if (r.volume_gal+1e-8>=targetVolGal) break;
    const add=(targetVolGal-r.volume_gal)*231/(Math.PI*r.id_inside**2/4);
    length=Math.ceil((length+Math.max(0.5,add))*2)/2;
    if(length>960) throw new RangeError('Required vessel length exceeds the 960 in integration envelope.');
  }
  const r=found.result;
  if(r.volume_gal+1e-8<targetVolGal) throw new RangeError('Prelim volume sizing did not converge.');
  const pipe=r.plate.mode==='pipe', cap=r.plate.cap_nps!=null;
  const headMat=cap?(material==='carbon'?SA234_WPB:SA403_CAP[material]):MATERIALS[material];
  const nozzleMat=material==='carbon'?SA53_B_SMLS:SA312_SMLS[material];
  const headE=pipe?pipeHeadEfficiency(r.inp.cap_weld_exam,r.inp.head_joint_eff,r.inp.joint_eff)
    : r.inp.head_joint_eff>=1?(r.inp.joint_eff>=0.85?1:0.85):r.inp.joint_eff;
  const od=r.id_inside+2*r.t_shell_nominal;
  const geom=cap?'ellipsoidal':r.inp.head_type;
  const headDepth=headInsideDepth(geom,od-2*r.t_head_nominal);
  // The inherited nominal-head capacity is conditional. Do not turn a forming
  // allowance into a guaranteed nominal wall: procurement must guarantee at
  // least the calculated required minimum after forming.
  const S=headMat.allowableStress(tempF), Ph=r.p_local_head;
  const odRequired=corrosion+(geom==='ellipsoidal'?Ph*od/(2*S*headE+1.8*Ph)
    :geom==='hemispherical'?Ph*od/(4*S*headE+1.6*Ph):0.885*Ph*od/(S*headE+1.685*Ph));
  // ID-basis source sizing uses the shell ID. The selected shell/head stock
  // can differ, so independently check the actual common outside diameter.
  const headMin=cap?r.t_head_design:Math.max(r.t_head_required,odRequired);
  if (headMin>r.t_head_design+1e-8) throw new RangeError('Selected head stock cannot provide the required final minimum wall.');
  const t=headMin-corrosion;
  const headLocalCapacity=geom==='ellipsoidal'?2*S*headE*t/(od-1.8*t)
    :geom==='hemispherical'?4*S*headE*t/(od-1.6*t):S*headE*t/(0.885*od-1.685*t);
  const longE=pipe?r.e_long:({0.7:0.65,0.85:0.8,1:0.9})[r.inp.joint_eff];
  const R=r.id_inside/2+r.t_shell_nominal-r.t_shell_design+corrosion;
  const shellNet=r.t_shell_design-corrosion;
  const shellLongCapacity=2*r.s_longitudinal*longE*shellNet/(R-0.4*shellNet);
  const shellCapacity=Math.min(r.mawp_shell,shellLongCapacity)-r.static_head_psi;
  const headCapacity=headLocalCapacity-r.static_head_head_psi;
  if(shellCapacity+1e-6<pressure || headCapacity+1e-6<pressure) throw new RangeError('Prelim component back-check does not cover the design pressure on the available-wall basis.');
  return {...found,revision:PRELIM_REVISION,dual:dualRating(designVessel,r.inp),pipe,cap,
    shellCapacity,shellLongCapacity,longE,headCapacity,headMin,headE,headDepth,od,headStress:S,
    headSpec:headMat.name,nozzleStress:nozzleMat.allowableStress(tempF),nozzleSpec:nozzleMat.name,
    headFormingLoss:cap?0:HEAD_FORMING_THINNING[geom],
    price:stainlessPlatePrice(material,inp.price_per_lb,r.t_shell_nominal,r.plate.purchased_weight),
    sourceBasis:`prelim ${PRELIM_REVISION}: built-in preliminary stress curves at ${tempF} F. Verify exact Section II-D row, product form, thickness and project edition.`,
  };
}
