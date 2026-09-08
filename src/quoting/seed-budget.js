import {numeric} from './ratebook.js';

export const DEFAULT_RATES={steelRate:'',headEach:'',headHours:'',headFreight:0,aiCost:'',ndeCost:'',pwhtCost:'',
  interiorCost:'',exteriorCost:'',freightCost:'',asOf:'',source:'Estimator input',steelMaterial:'',headBasis:''};
export function headKey(v){return v?JSON.stringify([v.D_OD,v.tHead,v.headSpec,v.headType]):'';}
export function designKey(v,product) {
  if(!v)return '';
  return JSON.stringify([product?.id,v.D_ID,v.D_OD,v.tShell,v.tHead,v.shellLength,v.OAL,v.materialId,v.shellSpec,v.headSpec,v.CA,
    v.designPressure,v.designTempF,v.supportType,v.prelim?.result.inp,v.nozzles.map(n=>[n.id,n.size,n.tn,n.nozzleMat,n.connType])]);
}
export function tableHours(row,thickness) {
  if(!row)return '';
  const columns=Object.keys(row).filter(k=>/^\d+(\.\d+)?" Labor Hours$/.test(k)).sort((a,b)=>parseFloat(a)-parseFloat(b));
  const column=columns.find(c=>parseFloat(c)+1e-9>=thickness);
  return column?numeric(row[column]):'';
}
export function fittingAllowance(row,vessel,book) {
  let hours=tableHours(row,vessel.tShell);
  const size=String(row.Size||'').replace(/"/g,'');
  const od=vessel.D_OD;
  const odClass=od<=24?'<=24':od<=48.5?'30-48':od<=72.5?'54-72':od<=108.5?'84-108':od>=120?'120+':null;
  const observed=book.tables['nozzle-hours-observed']?.find(r=>r.size===size&&r.od_class===odClass);
  if(observed&&hours!=='')hours=Math.max(hours,numeric(observed.median_hrs)||0);
  return {unitMaterial:numeric(row['Material Cost']),unitHours:hours,source:'Imported vessel-labor / observed nozzle hours',asOf:'',confidence:'reference',
    notice:'Fitting cost allowance. Confirm material, schedule, end rating and reinforcement against the nozzle specification.'};
}
export function seedBudget(v,product,book,rates={}) {
  if(!v)return [];
  const r={...DEFAULT_RATES,...rates},rows=[],key=designKey(v,product),plate=v.prelim?.result.plate;
  const table=Object.fromEntries((book.tables['vessel-labor']||[]).map(l=>[l.Description?.trim(),l]));
  const operation=(type,size)=>Object.values(table).filter(l=>l.Type===type&&parseFloat(l.Size)>=size-1e-6)
    .sort((a,b)=>parseFloat(a.Size)-parseFloat(b.Size))[0];
  const line=(id,description,category,unitMaterial,unitHours,qty=1,extra={})=>rows.push({id,description,category,unitMaterial,unitHours,qty,
    scope:'base',adderCost:0,source:r.source,asOf:r.asOf,confidence:'estimate',designKey:key,...extra});
  const fromTable=(id,description,tableName,qty=1)=>{
    const item=table[tableName];line(id,description,'Fabrication',item?numeric(item['Material Cost']):'',tableHours(item,v.tShell),qty,
      {source:'Imported vessel-labor table',asOf:'',confidence:'reference'});
  };
  // Use purchased stock, including the selected drops. Never use the legacy
  // quoting-tool pressure key or replace formed heads with cheaper pipe caps.
  const weight=plate?.purchased_weight;
  const steel=r.steelRate===''||r.steelMaterial!==v.materialId?'':Number(r.steelRate);
  line('shell',`${v.shellSpec} shell stock (${Number(weight||0).toFixed(1)} lb purchased)`,'Shell',weight>0&&steel!==''?weight*steel:'',0,1,
    {escalateSteel:true,notice:plate?'Confirm stock purchase price and availability.':'Enter purchased stock cost. This design has no prelim purchase plan.'});
  let headCost=r.headBasis===headKey(v)?r.headEach:'',headSource=r.source,headDate=r.asOf,headNotice='Supplier must guarantee material, geometry and minimum formed thickness.';
  if(r.headEach!==''&&r.headBasis!==headKey(v))headNotice+=' Head geometry or material changed. Re-enter the supplier allowance for this specification.';
  // The small-diameter historical table mixes pipe-cap purchases with heads.
  // It cannot establish the price of a formed head for a pipe-body vessel.
  if(headCost===''&&v.materialId==='CS'&&!v.isPipe&&/2:1/.test(v.headType)) {
    const match=book.tables['head-costs-observed']?.find(h=>Math.abs(Number(h.od)-v.D_OD)<.01&&Math.abs(Number(h.thk)-v.tHead)<1e-6);
    if(match){headCost=numeric(match.median_cost);headSource='Observed CS ellipsoidal head median';headDate='';headNotice+=` Historical range $${match.lo}–$${match.hi}, ${match.n} observations. Obtain a current head quote.`;}
  }
  const landedHead=headCost===''?'':Number(headCost)*(1+Number(r.headFreight));
  const headHours=r.headHours===''||r.headBasis!==headKey(v)?tableHours(operation('Girth Weld',v.D_OD),Math.max(v.tShell,v.tHead)):r.headHours;
  line('heads',`${v.headType} head, ${v.headSpec}, ${v.tHead} in blank`,'Heads',landedHead,headHours,2,
    {source:headSource,asOf:headDate,notice:headNotice});
  const courses=plate?.courses||1,segments=plate?.segments||1;
  if(!v.isPipe){
    const rollHours=tableHours(table['Roll Charge Misc'],v.tShell);
    line('roll','Shell rolling','Fabrication',0,rollHours===''?'':6*rollHours,courses*segments,
      {source:'Imported roll allowance: six hours per piece',asOf:'',confidence:'reference'});
    line('long-seams',`Longitudinal seams (${courses} courses × ${segments} segments)`,'Fabrication',0,
      tableHours(operation('Long Seam Weld',v.shellLength/courses),v.tShell),courses*segments,
      {notice:'Table allowance rounded up to the next weld length and thickness. Confirm the actual procedure.',source:'Imported vessel-labor table',asOf:''});
  }
  if(courses>1)line('girth-seams','Additional shell girth seams','Fabrication',0,tableHours(operation('Girth Weld',v.D_OD),v.tShell),courses-1);
  for(const n of v.nozzles)line(`nozzle-${n.id}`,`${n.id}: ${n.label}${n.size>0?`, NPS ${n.size}, ${n.nozzleMat}`:', supplier assembly'}`,'Nozzle','','',1,
    {notice:n.size>0?'Select a matching fitting allowance or enter its landed cost and installation hours.':'Supplier assembly price and installation scope required.',nozzleId:n.id});
  if(product.internals!=='none')line('membrane',`${product.internals} assembly, seals and installation`,'Internals','','',1,
    {notice:'Use the supplier-rated membrane and matched closure. Check whether air-charge and access items are included to avoid double counting.'});
  if(v.supportType==='clips')fromTable('supports','Mounting clip','Angle Clips Misc',v.clips.count);
  else line('supports',`Skirt and base ring (${Number(v.skirt.weight).toFixed(1)} lb concept)`,'Supports',steel===''?'':v.skirt.weight*steel,'',1,
    {escalateSteel:true,notice:'Approximate attachment weight. Add stock waste, cutting, welding and support design scope.'});
  line('lifting','Engineered lifting attachments','Supports','','',1,{notice:'Select rated lifting geometry and installation hours for the actual lift case.'});
  fromTable('nameplate','ASME nameplate assembly','4" Name Plate');
  fromTable('profile','Profiling / fitting allowance','Profile Misc');
  line('handling','Handling, setup, pressure test and documentation','Fabrication',0,'',1,{notice:'Enter total job hours. Include test preparation, inspection coordination and records.'});
  line('inspection','Authorized inspection expense','Other',r.aiCost,0);
  line('nde','Required NDE and examination','Other',r.ndeCost,0,1,{notice:'Price the selected RT plan and any additional examinations. Zero requires an explicit scope decision.'});
  line('pwht','Postweld heat treatment','Other',r.pwhtCost,0,1,{notice:'Check the prelim PWHT assessment. Enter the supplier cost or explicitly exclude if not required.'});
  line('interior',product.potable?'Potable wetted materials / lining certification':'Interior finish / lining','Finish',r.interiorCost,0);
  line('exterior','Exterior surface preparation and coating','Finish',r.exteriorCost,0);
  line('freight','Packing and outbound freight','Freight',r.freightCost,0);
  return rows;
}
export function applyOverrides(seeds,overrides) {
  return seeds.map(row=>{
    const patch=overrides[row.id];
    if(!patch)return row;
    if(patch.designKey!==row.designKey)return {...row,notice:`Design changed. Prior line edits need review. ${row.notice||''}`,needsReview:true};
    return {...row,...patch,id:row.id};
  });
}
export function scopeIntelligence(rows,v,product,meta={}) {
  const warnings=[];
  if(rows.some(r=>r.needsReview))warnings.push('Design changed. Affected line overrides were suspended. Re-enter or review them against this design.');
  if(!v?.releaseReady)warnings.push('Pressure design remains preliminary. A priced budget does not establish vessel MAWP or ASME release.');
  if(!meta.interior?.trim()||!meta.exterior?.trim())warnings.push('Specify the interior and exterior finish in the customer scope.');
  if(product?.potable)warnings.push('Confirm potable certification for the actual wetted assembly and include its cost.');
  const buyouts=rows.filter(r=>r.scope==='base'&&r.category==='Buyout');
  if(buyouts.some(r=>/pump/i.test(r.description)))warnings.push('Pump package: confirm duty selection, number of duty/standby pumps, motors, drives, panel capacity, guards, base and freight.');
  if(buyouts.some(r=>/valve/i.test(r.description)))warnings.push('Valve train: confirm service selection, bodies, function modules, flanges, mating kits, actuators and required accessories.');
  if(meta.rfq?.trim())warnings.push('RFQ notes are retained for review. They are not automatically interpreted as a complete bill of materials.');
  const exclusions=rows.filter(r=>r.scope==='excluded');
  if(exclusions.length)warnings.push(`Explicit exclusions: ${exclusions.map(r=>r.description).join(', ')}.`);
  return warnings;
}
