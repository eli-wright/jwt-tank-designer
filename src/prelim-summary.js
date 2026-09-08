const f=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'Not evaluated';
export function prelimSections(p) {
  const r=p.result,a=p.assessment,b=r.plate,i=r.inp;
  return [
    ['Prelim sizing basis',[
      ['Source revision',p.revision],['Shell material / stress',`${r.material.name} / ${f(r.S,1)} psi`],
      ['Head material / stress',`${p.headSpec} / ${f(p.headStress,1)} psi`],
      ['Nozzle material / stress',`${p.nozzleSpec} / ${f(p.nozzleStress,1)} psi`],
      ['Geometry basis',`${i.diameter} in ${i.diameter_basis}, vertical, full water at 62.5 lb/ft³`],
      ['Governing requirement',`${r.governing}, nominal driven by ${r.drives_nominal}`],
      ['Product weld factor / hoop E / longitudinal E',`${r.s_product_factor} / ${r.e_circ} / ${p.longE}`],
      ['Shell / head local design pressure',`${f(r.p_local_design)} / ${f(r.p_local_head)} psig`],
      ['Shell / head static head',`${f(r.static_head_psi)} / ${f(r.static_head_head_psi)} psi`],
      ['Longitudinal shell local capacity',`${f(p.shellLongCapacity)} psig, checked separately from hoop stress`],
      ['Plate minimum delivered wall',p.pipe?'Pipe mill tolerance applied':`${f(r.t_shell_nominal,6)} in must be guaranteed. No automatic plate undertolerance credit.`],
      ['Head minimum after forming or product tolerance',`${f(p.headMin,6)} in. Required supplier guarantee.`],
      ['Nominal-head local capacity from source',`${f(r.mawp_head)} psig. Conditional on nominal available wall, not a formed-wall guarantee.`],
      ['Construction fallback',r.construction_fallback ?? 'None'],
    ]],
    ['External pressure screen',[
      ['External design pressure',`${i.ext_pressure} psi differential`],
      ['Shell / head external thickness',`${f(r.t_shell_external,6)} / ${f(r.t_head_external,6)} in`],
      ['Unsupported length',`${f(r.ext_length_used)} in`],
      ['Status',i.ext_pressure>0?'Provisional elastic model. Verify UG-28/UG-33 charts, inelastic range and fabrication tolerances.':'Not requested. Vacuum capability is not established.'],
    ]],
    ['Radiography and heat-treatment screen',[
      ['Category A',a.rt.long],['Category B',a.rt.circ],
      ['Automatic full RT enforcement',a.rt.enforcedFull?`Applied from ${f(a.rt.enforcedFrom)} in`:'Not triggered'],
      ['Radiography selection',r.rt_note],
      ['Estimated examination cost',`$${f(a.rt.ndeCost,2)}. Source estimating rates, confirm current quote.`],
      ['Normalizing',a.normalized?'Selected or escalated by the preliminary screen':'Not selected by screen'],
      ['Shop normalizing threshold',a.normalizedRequired?'Triggered above 1.375 in plate. House practice, not a universal ASME rule.':'Not triggered'],
      ['PWHT',a.pwht?'Selected or required by preliminary screen':'Not selected by screen'],
      ['PWHT thickness trigger',a.pwhtRequired?'Triggered':'Not triggered'],
      ['Weld preheat ≥ 200 °F',i.weld_preheat?'Selected. Thickness-band exemption only.':'Not selected'],
    ]],
    ['MDMT and reduced-pressure screen',[
      ['Required MDMT',`${i.required_mdmt} °F`],['Screened exemption temperature',`${f(a.mdmt.allowable,1)} °F`],
      ['Impact-test screen',a.mdmt.impactRequired?'Impact testing indicated':'Potential exemption. Verify material, welds, service and code conditions.'],
      ['Treatment assumptions',`Normalized: ${a.normalized?'yes':'no'}, PWHT: ${a.pwht?'yes':'no'}`],
      ['Reduced-pressure case',`${f(p.dual.coldP)} psig / ${f(p.dual.coldMdmt,1)} °F. Source assumes available normalizing and PWHT credits. Not an approved dual rating.`],
      ['Scope','Approximate UCS-66 curves and reductions. UG-20(f) assumes qualifying hydrotest and service. Austenitic screens require UHA-51 conditions.'],
    ]],
    ['Shell procurement estimate',[
      ['Stock / quantity',`${b.stock.join(' × ')} in / ${b.n_plates} ${p.pipe?'pipe joint(s)':'plate(s)'}`],
      ['Courses / segments',`${b.courses} / ${b.segments}`],
      ['Blank / piece',`${b.blank.join(' × ')} / ${b.piece.join(' × ')} in`],
      ['Largest drop',`${b.drop.join(' × ')} in, ${f(b.drop_weight,1)} lb`],
      ['Purchased shell stock weight',`${f(b.purchased_weight,1)} lb`],
      ['Base-price shell stock cost',`$${f(b.purchased_cost,2)} at $${f(i.price_per_lb,2)}/lb. Shell stock only.`],
      ['Stainless plate price model',p.price==null?'Not applicable':`$${f(p.price,3)}/lb. Separate estimate using source July 2026 alloy surcharge constants. Not a current quote.`],
      ['Source notes',r.notes.join('\n')],
    ]],
  ];
}
