import {number} from './quote-engine.js';

export const COLUMN_DEFAULTS={length:60,eyes:5,hlConnections:true,hlSwitch:true,olConnections:false,olSwitch:false,llConnections:false,llSwitch:false,
  isolation:false,drainValve:false,probe:false,unions:false,finish:'Primer',margin:.12};
export function levelColumn(config,reference) {
  if(!reference)throw new Error('Import the quoting ZIP to load level-column reference prices.');
  const c={...COLUMN_DEFAULTS,...config},P=reference.prices,H=reference.hours;
  const length=number(c.length,'Column length',12,240),eyes=number(c.eyes,'Level eyes',0,20);
  if(!Number.isInteger(eyes))throw new Error('Level-eye quantity must be a whole number.');
  if(!['Bare','Primer','Epoxy'].includes(c.finish))throw new Error('Unknown column finish.');
  const lines=[],p=k=>number(P[k],`Column ${k} price`),h=k=>number(H[k],`Column ${k} hours`);
  const add=(description,qty,cost,hours)=>lines.push({description,qty,unitMaterial:cost,unitHours:hours});
  add('NPS 4 CS seamless S/40 pipe, ft',length/12,p('pipe_per_ft'),0);
  add('Pipe cap',2,p('cap'),h('cap'));add('Handling',1,0,h('handling'));add('Profiling',1,0,h('profile'));
  add('NPS 1-1/2 CS seamless connection',2,p('conn_pipe_ea'),h('conn_pipe'));
  add('3/4 in probe connection',1,p('probe_conn'),h('small_conn'));add('3/4 in drain connection',1,p('drain_conn'),h('small_conn'));
  for(const key of ['hl','ol','ll']) {
    if(c[`${key}Switch`]&&!c[`${key}Connections`])throw new Error(`${key.toUpperCase()} float switch requires its connection pair.`);
    if(c[`${key}Connections`])add(`${key.toUpperCase()} float connection`,2,p('float_conn'),h('float_conn_pair')/2);
    if(c[`${key}Switch`])add(`${key.toUpperCase()} AKS38 float switch`,1,p('float_switch'),h('float_switch'));
  }
  if(eyes)add('Level eye with frost shield',eyes,p('level_eye_fs'),h('eye'));
  if(c.isolation)add('NPS 1-1/2 isolation valve',2,p('iso_valve'),h('iso_valve'));
  if(c.drainValve)add('Drain valve',1,p('drain_valve'),h('drain_valve'));
  if(c.probe)add('AKS4100U probe',1,p('probe_aks4100u'),h('probe'));
  if(c.unions)add('NPS 1-1/2 flanged union',2,p('flanged_union'),h('flanged_union'));
  if(c.finish!=='Bare')add(`${c.finish} finish`,1,p(c.finish==='Epoxy'?'finish_epoxy':'finish_primer'),0);
  const material=lines.reduce((a,l)=>a+l.qty*l.unitMaterial,0),hours=lines.reduce((a,l)=>a+l.qty*l.unitHours,0),margin=number(c.margin,'Column margin',0,.95);
  return {description:`NPS 4 CS level column, ${length} in, ${eyes} eyes with frost shields`,category:'Level column',qty:1,scope:'option',
    unitMaterial:material,unitHours:hours,materialMargin:margin,laborMargin:margin,source:reference.source,asOf:reference.asOf,
    confidence:'reference',customerVisible:true,customerDetails:lines.map(l=>`${l.qty} × ${l.description}`).join('; '),
    assemblyConfig:JSON.stringify(c),breakdownJSON:JSON.stringify(lines),
    notice:'Costed reference assembly only. Confirm pressure, fluid service, component ratings and current supplier prices. Reference supports NPS 4 carbon steel seamless pipe only.'};
}
export function pumpPackageScope(count) {
  const qty=number(count,'Pump count',1,12);if(!Number.isInteger(qty))throw new Error('Pump count must be a whole number.');
  return [['Selected pump and motor',qty],['Drive / starter allowance',qty],['Coupling, guard and local accessories',qty],
    ['Valve and instrument train',qty],['Control panel sized for all pumps',1],['Structural skid and base',1],['Package assembly, test and documentation',1],['Package coating and freight',1]]
    .map(([description,qty])=>({description,qty,category:'Buyout',scope:'base',unitMaterial:'',unitHours:'',customerVisible:true,
      notice:'Enter supplier cost and installation hours. Review inclusions to prevent duplicate costs. Pump duty and valve sizing are not established by this allowance.'}));
}
