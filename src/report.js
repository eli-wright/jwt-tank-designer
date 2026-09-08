import { prelimSections } from './prelim-summary.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f = (n,d = 3) => Number.isFinite(n) ? n.toFixed(d) : 'Not evaluated';
const table = rows => `<table><tbody>${rows.map(([a,b]) => `<tr><th>${escapeHTML(a)}</th><td>${escapeHTML(b)}</td></tr>`).join('')}</tbody></table>`;
export function generateReportHTML(product, inputs, sizing, v, logo, diagram = '') {
  if (!v || !v.pressureScreenPass) throw new RangeError('A valid pressure-wall calculation is required for a report.');
  const model = `${product.prefix}-${Math.round(v.actualVolGal)}`, isBuffer = product.internals === 'none';
  const selectedEmpty = v.supportType === 'clips' ? v.emptyWeightClips : v.emptyWeight;
  let body = `<div class="hdr"><div><img src="${logo}" alt="JWT" style="height:42px"><h1>JOE WHITE TANK COMPANY</h1><div class="mdl">${escapeHTML(model)}</div><p>${escapeHTML(product.subtitle)}</p></div><div>${new Date().toISOString().slice(0,10)}<br>Engineering calculation review</div></div>
    <div class="rb"><b>Preliminary sizing and pressure-wall calculation</b><br>Shell and head internal-pressure checks pass on the entered basis. Vessel MAWP, opening reinforcement and fabrication release remain unevaluated.</div>
    <h2>1. Design basis and geometry</h2><div class="ga">${diagram}</div>`;
  body += table([
    ['Required tank volume',`${f(v.targetVolGal)} US gal`],['Geometric volume',`${f(v.actualVolGal)} US gal before internal displacement`],
    ['Construction',v.constructionType],['Heads',`${v.headType}, ${v.headSpec}`],['Shell material',v.shellSpec],
    ['Shell ID / OD',`${f(v.D_ID)} / ${f(v.D_OD)} in`],['Shell tangent length',`${f(v.shellLength)} in`],
    ['Head inside depth',`${f(v.headDepthID)} in each`],['Vessel body length',`${f(v.OAL)} in, excludes supports, nozzles and head straight flanges`],
    ['Top design pressure',`${f(v.designPressure)} psig`],['Maximum operating pressure',`${inputs.maxPressure} psig`],
    ['Relief set pressure / margin',`${inputs.reliefPressure} / ${inputs.reliefMargin} psi at tank datum`],
    ['Design metal / maximum fluid temperature',`${v.designTempF} / ${v.operatingTempF} °F`],
    ['Code edition entered',v.codeEdition],['Allowable-stress table basis entered',v.stressBasis],
    ['Shell / head / nozzle allowable stress',`${v.shellStress} / ${v.headStress} / ${v.nozzleStress} psi at design metal temperature`],
    ['Joint efficiency, shell longitudinal / circumferential / head',`${v.shellJointEff} / ${v.circumferentialE} / ${v.headE}`],
    ['Corrosion allowance',`${v.CA} in, internal corrosion assumed`],
    ['Empty precharge',isBuffer ? 'Not applicable' : sizing.kind === 'expansion' ? `${sizing.precharge} psig` : 'Not specified for direct-volume selection'],
  ]);
  if (!v.prelim) body += '<p>Geometry uses a cylinder and two ideal 2:1 ellipsoidal heads. Each head volume is πD³/24. Formed head straight flanges, fabrication tolerances, internal displacement and the installation envelope require the supplier drawings.</p>';
  body += '<h2>2. Thermal sizing</h2>';
  if (sizing.kind === 'expansion') {
    body += `<p>Pure water, IAPWS-IF97 Region 1. Density is evaluated across the entered temperature range at minimum pressure. Pressure-compression credit and container expansion credit are omitted. The density maximum near 39 °F is included when it lies in the range.</p>`;
    body += table([
      ['System volume at cold endpoint',`${sizing.systemVol} US gal`],['Minimum / maximum fluid temperature',`${sizing.fillTemp} / ${sizing.designTemp} °F`],
      ['Minimum / maximum pressure',`${sizing.minPressure} / ${sizing.maxPressure} psig`],['Atmospheric pressure',`${sizing.atmosphericPsia} psia`],
      ['Density, cold endpoint / maximum / minimum',`${f(sizing.referenceDensity,6)} / ${f(sizing.maxRho,6)} / ${f(sizing.minRho,6)} lb/ft³`],
      ['Expansion fraction',f(sizing.netExpansionFactor,8)],['Expanded water',`${f(sizing.expandedWater,6)} US gal`],
      ['Gas exponent n',sizing.polytropicExponent],['Supplier maximum water fraction',f(sizing.acceptanceLimit,6)],
      ['Cold water fraction',f(sizing.coldWaterFraction,6)],['Pressure-limited final water fraction',f(sizing.pressureWaterFraction,6)],
      ['Usable acceptance fraction',f(sizing.acceptanceFactor,6)],['Minimum nominal tank volume',`${f(sizing.minTankVol,6)} US gal`],
      ['Sizing allowance',`5% before upward volume rounding. Selected ${f(v.targetVolGal)} US gal`],
    ]);
    body += `<div class="eq">ΔV = Vsystem × (ρcold / ρmin − ρcold / ρmax)<br>
      fcold = 1 − (Pprecharge,abs / Pmin,abs)^(1/n)<br>
      fhot = min[1 − (Pprecharge,abs / Pmax,abs)^(1/n), supplier acceptance fraction]<br>
      Vtank ≥ ΔV / (fhot − fcold)</div><p>n = 1 assumes isothermal gas. The gas model, precharge at the minimum-volume state, and supplier acceptance limit must match the installation. Maximum operating pressure includes the entered margin below relief.</p>`;
  } else if (sizing.kind === 'buffer') {
    body += '<p>Energy balance for minimum source run time. Use the minimum stable source output and coincident minimum load. Temperatures are the tank control deadband. Existing volume includes only the water participating in this cycle.</p>';
    body += table([
      ['Source output / coincident load',`${sizing.sourceOutput} / ${sizing.minimumLoad} Btu/hr`],['Minimum run time',`${sizing.runtimeMin} min`],
      ['Control temperatures',`${sizing.lowTemp} to ${sizing.highTemp} °F`],['Excess source energy',`${f(sizing.energyBtu)} Btu`],
      ['Water energy capacity',`${f(sizing.btuPerGal,6)} Btu/US gal`],['Total active volume required',`${f(sizing.totalActiveVolume)} US gal`],
      ['Existing active water volume',`${sizing.existingVolume} US gal`],['Usable buffer fraction',sizing.utilization],
      ['Additional tank volume required',`${f(sizing.minTankVol)} US gal`],['Selected volume including 5% allowance',`${f(v.targetVolGal)} US gal`],
    ]);
    body += '<div class="eq">Energy = max(Qsource − Qload, 0) × runtime / 60<br>Capacity per gallon = ρhot / 7.48051948 × (hhot − hcold)<br>Vtotal = Energy / Capacity per gallon<br>Vbuffer = max(Vtotal − Vexisting, 0) / usable fraction</div><p>Enthalpy and density use IAPWS-IF97 at minimum operating pressure. For near-ambient water this approaches V = runtime × (Qsource − Qload) / (500 × ΔT). This is a cycling-volume calculation. Ride-through or stratified thermal storage needs a separate operating case.</p>';
  } else {
    body += `<p>Volume entered directly: ${f(v.targetVolGal)} US gal. System expansion, membrane acceptance and buffer run time have not been sized in this mode.</p>`;
  }
  if (!v.prelim) {
  body += '<h2>3. Internal-pressure wall calculations</h2><p>All components conservatively use the bottom pressure from a full-water column at 62.5 lb/ft³. The top-to-bottom head allowance is recalculated as wall thickness and geometry change.</p>';
  body += table([
    ['Static head allowance',`${f(v.staticHeadPsi,6)} psi`],['Component calculation pressure',`${f(v.componentPressure,6)} psig`],
    ['Shell pressure thickness + corrosion',`${f(v.tShellCalc,6)} in`],['Shell nominal / minimum delivered wall',`${f(v.tShell,6)} / ${f(v.shellMin,6)} in`],
    ['Pipe wall tolerance',v.isPipe ? '12.5% negative mill tolerance included' : `Plate deduction ${v.plateTolerance} in`],
    ['Head pressure thickness + corrosion',`${f(v.tHeadCalc,6)} in`],['Head blank nominal / minimum after forming',`${f(v.tHead,6)} / ${f(v.headMin,6)} in`],
    ['Head forming allowance / plate deduction',`${f(v.headFormingLoss*100,1)}% / ${v.plateTolerance} in. Verify manufacturing guarantees.`],
    ['Shell-only top pressure capacity',`${f(v.shellCapacity)} psig`],['Head-only top pressure capacity',`${f(v.headCapacity)} psig`],
    ['Shell/head pressure screen','Pass on entered material and joint basis. Component capacities do not establish vessel MAWP.'],
  ]);
  body += `<div class="eq">Rc = Rnew + CA<br>
    Shell hoop: t = P Rc / (S E_long − 0.6 P) + CA<br>
    Shell longitudinal: t = P Rc / (2 S E_circ + 0.4 P) + CA<br>
    Required shell wall = max(hoop, longitudinal)<br>
    2:1 head: t = P (Dnew + 2 CA) / (2 S E_head − 0.2 P) + CA</div>
    <p>For a pipe shell, Rnew uses the largest bore at minimum delivered wall. Both pipe selection and pressure capacity include mill tolerance and corrosion. Selected head thickness is a starting blank allowance. Minimum thickness after forming is the acceptance requirement. B16.9 pipe caps are not substituted for these formed heads.</p>`;
  } else {
    body += '<h2>3. Prelim mechanical sizing and code assessment</h2><p>Required volume is passed to prelim, which iterates shell length with the selected schedule, head geometry, radiography and full-water static head. Component capacities are referenced to the vessel top. These are preliminary calculations, not vessel MAWP or fabrication approval. A formed head must be guaranteed to retain at least the calculated required thickness after forming. B16.9 caps require supplier geometry and pressure-temperature rating confirmation.</p>';
    body += table([['Shell required / nominal wall',`${f(v.tShellCalc,6)} / ${f(v.tShell,6)} in`],['Head required / blank wall',`${f(v.tHeadCalc,6)} / ${f(v.tHead,6)} in`],['Shell-only top capacity',`${f(v.shellCapacity)} psig`],['Head-only top capacity at required minimum',`${f(v.headCapacity)} psig`]]);
    for (const [title,rows] of prelimSections(v.prelim)) body += `<h3>${escapeHTML(title)}</h3>` + table(rows);
  }
  body += '<h2>4. Nozzle pressure and hydraulic screening</h2>';
  for (const n of v.nozzles) {
    body += `<h3>${escapeHTML(n.id)}: ${escapeHTML(n.label)}</h3>`;
    body += table([['Size',n.size > 0 ? `NPS ${n.size}` : 'Supplier selection required'],['Connection',n.connType],
      ['Rating / attachment','Not evaluated'],['Pressure-required neck wall',n.pressureRequired ? `${f(n.pressureRequired,6)} in` : 'Not evaluated'],
      ['Minimum neck wall',n.minWall ? `${f(n.minWall,6)} in including 12.5% mill tolerance` : 'Supplier dimensions required']]);
    body += `<p>${escapeHTML(n.sizingBasis)}</p>`;
    if (n.flow) {
      const q = n.flow;
      body += table([['Specified flow',`${f(q.Q_gpm)} GPM`],['Nominal neck bore / screening length',`${f(q.d_in)} / ${f(q.nozzleLength)} in`],
        ['Velocity / selected target',`${f(q.v_fps)} / ${q.velocityLimit} ft/s`],['Reynolds number / regime',`${f(q.Re,0)} / ${q.flowRegime}`],
        ['Darcy friction factor',f(q.f_darcy,6)],['Vessel-interface K',q.K_total],['Port pressure loss estimate',`${f(q.dP_total_psi,6)} psi`]]);
    }
  }
  body += '<p>ΔP = [f(L/D) + K] ρv²/(2gc × 144). Laminar f = 64/Re. Turbulent f solves Colebrook. Transition flow and the retained viscosity table are approximate. Losses exclude end fittings, valves and external piping. The velocity target is a project input, not a universal ASHRAE limit. No nozzle heat-transfer coefficient is inferred from a short developing-flow passage.</p>';
  body += '<h2>5. Supports and weight estimates</h2>';
  body += table([['Support shown',v.supportType],['Empty weight estimate',`${selectedEmpty} lb`],['Full-water contents allowance',`${v.waterWeight} lb`],
    ['Full-water gross weight estimate',`${selectedEmpty + v.waterWeight} lb`],['Structural status','Supports, anchors, lifting and nozzle loads require analysis']]);
  body += '<p>Weights include geometric shell/head estimates and approximate attachments. They exclude final bladder/access assemblies, detailed bolting, insulation and piping. Full-water weight is a load case, not an expansion-tank operating liquid level.</p>';
  body += '<h2>6. Outstanding design requirements</h2><ul>' + v.requirements.map(s => `<li>${escapeHTML(s)}</li>`).join('') + '</ul>';
  body += `<h2>7. References and scope</h2><p><a href="https://iapws.org/technical-guidance/release/IF97-Rev.download">IAPWS-IF97, Regions 1 and 4</a>. <a href="https://www.watts.com/resources/planning/etp">Watts expansion-tank volume and acceptance selection</a>. <a href="https://www.caleffi.com/en-us/blog/design-details-air-water-heat-pump">Caleffi buffer energy-balance sizing</a>. <a href="https://www.asme.org/codes-standards/find-codes-standards/bpvc-viii-1-bpvc-section-viii-rules-construction-pressure-vessels-division-1">ASME VIII-1 scope</a>. <a href="https://www.codeware.com/products/compress/nozzles/">Codeware nozzle design scope</a>.</p><p>The project ASME edition is entered by the designer. Allowable stresses use either the identified prelim reference curves or the entered project values, as recorded in the calculation basis. Licensed code tables, exemptions and full code compliance have not been independently established by this app.</p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>JWT calculation review ${escapeHTML(model)}</title><style>
    *{box-sizing:border-box}body{font-family:Aptos,'Segoe UI',sans-serif;color:#222;background:white;margin:32px;line-height:1.5;font-size:10pt}
    h1{font-size:20pt;color:#8B6914}h2{font-size:13pt;border-left:4px solid #B8860B;padding-left:10px;margin-top:24px}h3{font-size:11pt}
    table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#F5F0E0;width:48%}
    .hdr{display:flex;justify-content:space-between}.mdl{font-size:16pt;font-weight:bold}.rb,.eq{background:#FFFBF0;border:1px solid #B8860B;padding:14px;margin:12px 0}
    .ga{max-width:300px;margin:auto;background:#0D0D16;border-radius:8px;padding:8px}.ga svg{width:100%}li{margin:8px 0}a{color:#326183}
    @media print{body{margin:18px}tr,.rb{break-inside:avoid}h2,h3{break-after:avoid}}
    </style></head><body>${body}</body></html>`;
}
