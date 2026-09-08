import {zipSync,strToU8,strFromU8} from 'fflate';
import {calculateQuote,priceLine,roundPrice,optional,ageDays} from './quote-engine.js';
import {safeUnzip} from './ratebook.js';

const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const escapeXML=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const xml=s=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`;
const money=n=>Number(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
export function column(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
export function cell(ref,value,style=0,formula) {
  if(formula!==undefined)return `<c r="${ref}" s="${style}"${value===''?' t="str"':''}><f>${escapeXML(formula.replace(/^=/,''))}</f><v>${escapeXML(value)}</v></c>`;
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error(`Nonfinite workbook value at ${ref}.`);return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;}
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXML(value)}</t></is></c>`;
}
const xStyles=xml(`<styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00;[Red](&quot;$&quot;#,##0.00)"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><color rgb="FF1463B3"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF183E46"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="7"><xf xfId="0"/><xf fontId="1" fillId="2" applyFill="1" applyFont="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf fontId="2" applyFont="1"/><xf fontId="2" numFmtId="164" applyFont="1" applyNumberFormat="1"/><xf fontId="2" numFmtId="165" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
export function worksheet(rows,widths=[],freeze=1) {
  const height=r=>Math.max(24,...r.map((c,j)=>{const v=c?.v??c;return typeof v==='string'?14*Math.max(1,...v.split('\n').map(s=>Math.ceil(s.length/((widths[j]||20)*.85))))+8:24;}));
  return xml(`<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze?`<pane ySplit="${freeze}" topLeftCell="A${freeze+1}" activePane="bottomLeft" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}" ht="${Math.min(400,height(r))}" customHeight="1">${r.map((v,j)=>typeof v==='object'&&v!==null?cell(`${column(j)}${i+1}`,v.v,v.s??0,v.f):cell(`${column(j)}${i+1}`,v,i===0?1:0)).join('')}</row>`).join('')}</sheetData><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`);
}
function workbookFiles(sheets) {
  const files={};
  files['[Content_Types].xml']=strToU8(xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`));
  files['_rels/.rels']=strToU8(xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'));
  files['xl/workbook.xml']=strToU8(xml(`<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${escapeXML(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1"/></workbook>`));
  files['xl/_rels/workbook.xml.rels']=strToU8(xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`));
  files['xl/styles.xml']=strToU8(xStyles.replace(/<xf([^>]*)\/>/g,'<xf$1 applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'));
  sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=strToU8(s.xml));
  return files;
}
const val=(v,s=4)=>({v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):v??'',s});
const fx=(f,v,s=2)=>({f,v:v??'',s});
export function budgetWorkbook(rows,settings,meta={}) {
  const q=calculateQuote(rows,settings);if(q.error)throw new Error(q.error);
  const s=q.settings;
  const inputs=[['INTERNAL BUDGET INPUTS','Value','Basis'],['Blue values are editable. Blank costs are missing.','','Margins are on sell, not markups.'],
    ['Vessel quantity',val(s.quantity),'Whole vessels / packages'],['Loaded labor $/hr',val(s.laborRate,5),'Direct labor plus burden'],
    ['Material margin',val(s.materialMargin,6),'Cost / (1 - margin)'],['Labor margin',val(s.laborMargin,6),'Separate labor margin'],
    ['Commission what-if',val(s.commission,6),'INTERNAL ONLY, never added to customer price'],['Contingency',val(s.contingency,6),'Fraction of base cost, sold at material margin'],
    ['Discount',val(s.discount,6),'Fraction of calculated base sell'],['Rounding step',val(s.rounding),'USD per vessel'],['Rounding mode',val(s.roundMode),'nearest / down / up'],
    ['Unit price override',val(s.priceOverride,5),'Blank uses calculated quote'],['Steel adjustment',val(s.steelChange,6),'Flagged steel rows only'],['Labor adjustment',val(s.laborChange,6),'All labor costs'],
    ['Price age threshold',val(s.staleDays),'Days'],['Quote number',meta.quoteNo||'',''],['Customer',meta.customer||'',''],['Project',meta.project||'','']];
  const header=['Scope','Description','Category','Qty','Material / unit','Hours / unit','Labor $/hr','Material margin','Labor margin','Extended adder','Steel flag','Cost override','Sell override','Material cost','Hours','Labor cost','Total cost','Sell','Effective margin','Source','Price date','Confidence','Review note','Vendor cents flag'];
  const budget=[header];
  rows.forEach((r,i)=>{
    const n=i+2;let l;
    try{l=priceLine(r,s);}catch{l=null;}
    const valid=l!==null;
    budget.push([r.scope,r.description,r.category,val(r.qty),val(r.unitMaterial,5),val(r.unitHours),
      optional(r.laborRate)?fx(`'Inputs'!B4`,s.laborRate,5):val(r.laborRate,5),
      r.materialMargin==null?fx(`'Inputs'!B5`,s.materialMargin,6):val(r.materialMargin,6),
      r.laborMargin==null?fx(`'Inputs'!B6`,s.laborMargin,6):val(r.laborMargin,6),val(r.adderCost??0,5),val(r.escalateSteel?1:0),val(r.costOverride??'',5),val(r.sellOverride??'',5),
      fx(`IF(OR(D${n}="",E${n}=""),"",IF(X${n}=1,ROUND(D${n}*E${n}*(1+K${n}*'Inputs'!B13),2),D${n}*E${n}*(1+K${n}*'Inputs'!B13)))`,valid?l.materialCost:''),
      fx(`IF(OR(D${n}="",F${n}=""),"",D${n}*F${n})`,valid?l.hours:'',0),
      fx(`IF(OR(O${n}="",AND(O${n}>0,G${n}="")),"",O${n}*G${n}*(1+'Inputs'!B14))`,valid?l.laborCost:''),
      fx(`IF(OR(N${n}="",P${n}=""),"",IF(L${n}="",N${n}+P${n}+J${n},L${n}))`,valid?l.cost:''),
      fx(`IF(Q${n}="","",IF(M${n}<>"",M${n},IF(L${n}<>"",Q${n}/(1-H${n}),(N${n}+J${n})/(1-H${n})+P${n}/(1-I${n}))))`,valid?l.sell:''),
      fx(`IF(OR(R${n}="",R${n}=0),0,1-Q${n}/R${n})`,valid?l.margin:0,3),r.source||'',r.asOf||'',r.confidence||'',r.notice||'',val(r.roundMaterial?1:0)]);
  });
  const end=Math.max(2,budget.length),Q=`'Budget'!Q2:Q${end}`,R=`'Budget'!R2:R${end}`,A=`'Budget'!A2:A${end}`;
  const summary=[['INTERNAL ESTIMATE','Value','Review'],['Quote',meta.quoteNo||'','Customer draft requires engineering and commercial review.'],
    ['Unpriced base rows',fx(`COUNTIFS(${A},"base",${Q},"")`,q.gaps.filter(g=>g.scope==='base').length,0),'Blank rows are excluded from the partial totals below.'],
    ['Base cost',fx(`SUMIF(${A},"base",${Q})`,q.cost),'Excludes optional and excluded scope'],
    ['Contingency cost',fx("B4*'Inputs'!B8",q.allowance),'Included in estimated cost'],
    ['Base calculated sell',fx(`SUMIF(${A},"base",${R})`,q.rawSell),'Separate row material and labor margins'],
    ['Sell after contingency / discount',fx("(B6+B5/(1-'Inputs'!B5))*(1-'Inputs'!B9)",q.unrounded),'Before final rounding'],
    ['Customer unit price',fx(`IF('Inputs'!B12<>"",'Inputs'!B12,IF('Inputs'!B11="down",ROUNDDOWN(B7/'Inputs'!B10,0),IF('Inputs'!B11="up",ROUNDUP(B7/'Inputs'!B10,0),ROUND(B7/'Inputs'!B10,0)))*'Inputs'!B10)`,q.quotePrice),'Preliminary draft only'],
    ['Order total',fx("B8*'Inputs'!B3",q.orderPrice),'Options are not included'],['Estimated cost / unit',fx('B4+B5',q.totalCost),'Includes contingency'],
    ['Gross profit / unit',fx('B8-B10',q.profit),''],['Effective margin',fx('IF(B8=0,0,B11/B8)',q.margin,3),'Reflects discount, rounding and price override'],
    ['Commission-inclusive what-if',fx("B8/(1-'Inputs'!B7)",q.commissionPrice),'INTERNAL ONLY. Does not change customer unit price.'],
    ['Commission difference',fx('B13-B8',q.commissionDollars),'INTERNAL ONLY'],
    ['Status',q.ready?'PRICED BUDGET / DRAFT':'INCOMPLETE BUDGET','No ASME fabrication release is implied.']];
  const review=[['REVIEW ITEMS','Detail'],...q.gaps.map(g=>['Missing cost / hours',`${g.description}: ${g.message}`]),...q.warnings.map(w=>['Pricing review',w]),
    ['Engineering','Use the approved final vessel design and fabrication scope before release.'],['RFQ notes',meta.rfq||''],['Customer notes',meta.notes||''],
    ...rows.filter(r=>r.breakdownJSON).map(r=>[`${r.description} parts`,r.breakdownJSON])];
  return zipSync(workbookFiles([{name:'Summary',xml:worksheet(summary,[38,28,80])},{name:'Inputs',xml:worksheet(inputs,[38,28,85])},
    {name:'Budget',xml:worksheet(budget,[12,62,16,10,18,16,16,18,18,18,12,18,18,18,12,18,18,18,18,55,14,16,90,18])},
    {name:'Review',xml:worksheet(review,[25,130])}]),{level:6});
}

export function quoteSpecification(v,product,inputs,rows,settings,meta) {
  const quote=calculateQuote(rows,settings);if(!v||!quote.ready)throw new Error(quote.error||'Complete every base cost and labor allowance before exporting a customer draft.');
  if(ageDays(meta.date)==null)throw new Error('Enter a valid quote date.');
  for(const [key,label] of [['customer','customer'],['quoteNo','quote number'],['delivery','delivery'],['interior','interior finish'],['exterior','exterior finish']])
    if(!meta[key]?.trim())throw new Error(`Enter ${label} before exporting a customer draft.`);
  if(quote.gaps.some(g=>g.scope==='option'))throw new Error('Price or exclude each optional line before exporting.');
  const scope=id=>rows.find(r=>r.id===id)?.scope;
  return {quote,meta,product:product.name,
    basis:[['Type',product.subtitle],['Material',`${v.shellSpec} shell / ${v.headSpec} heads`],['Outside diameter',`${v.D_OD.toFixed(3)} in`],['Head-to-head length',`${v.OAL.toFixed(2)} in`],
      ['Design pressure',`${v.designPressure} psig @ ${v.designTempF}°F (preliminary)`],['Required MDMT',`${inputs.requiredMDMT}°F @ ${v.designPressure} psig (verification open)`],
      ['External design pressure',Number(inputs.externalPressure)>0?`${inputs.externalPressure} psi @ ${v.designTempF}°F (verification open)`:'Not specified'],
      ['Code basis',`ASME VIII-1, ${v.codeEdition} edition (preliminary)`],['Approximate empty weight',`${v.supportType==='clips'?v.emptyWeightClips:v.emptyWeight} lb`],
      ['Geometric volume',`${(v.actualVolGal/7.48051948).toFixed(2)} ft³ (${v.actualVolGal.toFixed(1)} US gal)`],['Corrosion allowance',`${v.CA} in`],
      ['Radiography plan',v.prelim?.assessment?.rt?.long||`Joint efficiency ${v.shellJointEff}, examination plan to confirm`],
      ['PWHT',scope('pwht')==='excluded'?'Excluded, confirm engineering basis':inputs.heatTreatment==='pwht'||v.prelim?.assessment?.pwht?'Included allowance, procedure to confirm':'Requirement to confirm'],
      ['Interior finish',meta.interior],['Exterior finish',meta.exterior]],
    nozzles:v.nozzles.filter(n=>scope(`nozzle-${n.id}`)==='base').map(n=>({qty:Number(rows.find(r=>r.id===`nozzle-${n.id}`).qty),size:n.size>0?`NPS ${n.size}`:'Supplier assembly',service:`${n.id}: ${n.label}, ${n.connType}`})),
    supports:rows.filter(r=>r.scope==='base'&&['supports','lifting'].includes(r.id)).map(r=>({qty:r.qty,service:r.description})),
    components:rows.filter(r=>r.scope==='base'&&r.customerVisible),
    exclusions:rows.filter(r=>r.scope==='excluded').map(r=>r.description),
    options:quote.options.map(r=>({qty:r.qty,description:r.description,details:r.customerDetails||'',price:roundPrice(r.sell,settings.rounding,settings.roundMode)})),
    nameplate:scope('nameplate')==='base',nameplateQty:Number(rows.find(r=>r.id==='nameplate')?.qty||1)};
}
export function customerHTML(spec) {
  const e=escapeXML,{quote:q,meta:m}=spec;
  const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Draft quote ${e(m.quoteNo)}</title><style>body{font:14px Arial,sans-serif;color:#203239;max-width:950px;margin:40px auto;padding:0 24px}h1{font-size:28px}h2{font-size:18px;margin-top:30px}p{line-height:1.6}.draft{color:#9c4d00;border:2px solid;padding:12px}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{text-align:left;border-bottom:1px solid #cbd5d8;padding:9px;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3f3}.price{font-size:24px;font-weight:bold}@media print{body{margin:0}tr{break-inside:avoid}thead{display:table-header-group}}</style></head><body>
    <p class="draft">DRAFT FOR REVIEW · Preliminary design basis · No fabrication release</p><h1>${e(spec.product)}</h1><p>Quote ${e(m.quoteNo)} · ${e(m.date)}<br>${e(m.customer)}<br>Project: ${e(m.project||'Not provided')}</p>
    <p class="price">${e(money(q.quotePrice))} each · ${q.quantity} × vessels / packages<br>Order total: ${e(money(q.orderPrice))}</p><p>Delivery: ${e(m.delivery)}. Validity: ${e(m.validity)}.</p>
    <h2>Design basis</h2>${table(['Item','Basis'],spec.basis)}<h2>Nozzles and supports</h2>${table(['Qty','Size','Service'],[...spec.nozzles.map(n=>[n.qty,n.size,n.service]),...spec.supports.map(n=>[n.qty,'',n.service])])}
    ${spec.components.length?`<h2>Included components per package</h2>${table(['Qty','Description'],spec.components.map(c=>[c.qty,`${c.description}${c.customerDetails?': '+c.customerDetails:''}`]))}`:''}
    ${spec.options.length?`<h2>Optional additions per vessel / package</h2>${table(['Qty','Description','Add price'],spec.options.map(o=>[o.qty,`${o.description}${o.details?': '+o.details:''}`,money(o.price)]))}<p>Options are excluded from the base order total. Installation and accessories are included only when stated.</p>`:''}
    <h2>Exclusions and review</h2><p>${e(spec.exclusions.join('. ')||'No explicit exclusions entered. Confirm the complete RFQ scope.')}</p><p>Final MAWP, nozzle reinforcement and ratings, external-pressure adequacy, material certification, supports and fabrication requirements remain subject to engineering review.</p><p>${e(m.notes)}</p><p>Commercial terms require approval. Use the imported JWT workbook template for the controlled terms and signature block.</p></body></html>`;
}

// Change values while retaining the actual JWT template's styles, images,
// print areas, page setup and terms. Added text is always inline text, never a
// user-supplied Excel formula. Old shared strings are removed after conversion.
export function setTemplateCells(sheet,values) {
  return sheet.replace(/<sheetData>([\s\S]*?)<\/sheetData>/,(_,data)=>{
    const rows=new Map();for(const m of data.matchAll(/<row\b([^>]*\br="(\d+)"[^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g))rows.set(Number(m[2]),{attrs:m[1],body:m[3]||''});
    for(const [ref,value] of Object.entries(values)) {
      const n=Number(ref.match(/\d+/)[0]),row=rows.get(n)||{attrs:` r="${n}"`,body:''};
      const re=new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`);
      const old=row.body.match(re),style=Number(old?.[1].match(/\bs="(\d+)"/)?.[1]||0),newCell=cell(ref,value,style);
      row.body=old?row.body.replace(re,()=>newCell):row.body+newCell;
      const cells=[...row.body.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map(m=>m[0]);
      const index=c=>c.match(/\br="([A-Z]+)/)[1].split('').reduce((a,l)=>a*26+l.charCodeAt(0)-64,0);
      row.body=cells.sort((a,b)=>index(a)-index(b)).join('');rows.set(n,row);
    }
    return `<sheetData>${[...rows].sort((a,b)=>a[0]-b[0]).map(([,r])=>`<row${r.attrs}>${r.body}</row>`).join('')}</sheetData>`;
  });
}
function appendScope(files,spec) {
  const name='Scope and Review',index=2,path=`xl/worksheets/sheet${index}.xml`;
  if(files[path])throw new Error('Template has additional worksheets. Use the supplied single-sheet quote template.');
  const rows=[['DRAFT SCOPE AND REVIEW','Quantity / value','Description'],['Quote',spec.meta.quoteNo,spec.meta.customer],
    ['Vessel / package quantity',spec.quote.quantity,'All line quantities below are per vessel / package.'],['Unit price',spec.quote.quotePrice,'USD, options excluded'],['Order price',spec.quote.orderPrice,'USD, options excluded'],
    ['Delivery',spec.meta.delivery,''],['Validity',spec.meta.validity,''],['Preliminary status','','Design pressure is not established vessel MAWP. Engineering release remains open.'],
    ...spec.basis.map(([k,v])=>[k,v,'']),...spec.components.map(c=>['Included component',c.qty,`${c.description}${c.customerDetails?': '+c.customerDetails:''}`]),
    ...spec.options.map(o=>['Optional add price USD',o.price,`${o.qty} × ${o.description}${o.details?': '+o.details:''}`]),
    ...spec.exclusions.map(e=>['Excluded','',e]),['Review','','Confirm nozzles, reinforcement, external pressure, MDMT, supports, materials and fabrication requirements.'],['Notes','',spec.meta.notes||'']];
  // The existing template has its own style indexes. Use its default style for
  // the continuation sheet instead of imposing the internal budget styles.
  const scopeStyle=addWrappedStyles(files,[0]).get(0);
  files[path]=strToU8(worksheet(rows,[34,48,85]).replace(/ s="[01]"/g,` s="${scopeStyle}"`));
  const edit=(path,fn)=>files[path]=strToU8(fn(strFromU8(files[path])));
  edit('xl/workbook.xml',x=>x.replace('</sheets>',`<sheet name="${name}" sheetId="2" r:id="rIdJWTScope"/></sheets>`));
  edit('xl/_rels/workbook.xml.rels',x=>x.replace('</Relationships>','<Relationship Id="rIdJWTScope" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'));
  edit('[Content_Types].xml',x=>x.replace('</Types>','<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
}
function addWrappedStyles(files,indexes) {
  let styles=strFromU8(files['xl/styles.xml']);const map=new Map();
  styles=styles.replace(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/,(_,body)=>{
    const xfs=[...body.matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map(m=>m[0]);
    for(const index of new Set(indexes)) {
      let xf=xfs[index]||xfs[0];
      if(xf.endsWith('/>'))xf=xf.slice(0,-2)+'></xf>';
      xf=xf.replace(/<xf([^>]*)>/,(_,attrs)=>`<xf${attrs.replace(/\sapplyAlignment="[^"]*"/g,'')} applyAlignment="1">`);
      xf=xf.replace(/<alignment\b[^>]*\/>/g,'').replace('</xf>','<alignment vertical="top" wrapText="1"/></xf>');
      map.set(index,xfs.length);xfs.push(xf);
    }
    return `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`;
  });files['xl/styles.xml']=strToU8(styles);return map;
}
export function customerWorkbook(template,spec,kind='bare') {
  if(!template)throw new Error('Import the quoting ZIP to use the actual JWT quote template.');
  if(!['bare','package'].includes(kind))throw new Error('Unknown quote template.');
  const files=safeUnzip(template);
  for(const path of Object.keys(files))if(/vbaProject|externalLinks|embeddings\//i.test(path))throw new Error('Unsupported executable or externally linked template.');
  const ss=files['xl/sharedStrings.xml']?strFromU8(files['xl/sharedStrings.xml']):'';
  const strings=[...ss.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>m[1]);
  for(const path of Object.keys(files).filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
    const sheet=strFromU8(files[path]).replace(/<c\b([^>]*\bt="s"[^>]*)>([\s\S]*?)<\/c>/g,(_,attrs,body)=>{
      const i=Number(body.match(/<v>(\d+)<\/v>/)?.[1]);if(strings[i]===undefined)throw new Error('Invalid template shared-string reference.');
      return `<c${attrs.replace(/\bt="s"/,'t="inlineStr"')}><is>${strings[i]}</is></c>`;
    });files[path]=strToU8(sheet);
  }
  if(files['xl/sharedStrings.xml'])files['xl/sharedStrings.xml']=strToU8(xml(`<sst xmlns="${NS}" count="0" uniqueCount="0"/>`));
  const {quote:q,meta:m}=spec,pack=kind==='package',maxNozzles=pack?13:11;
  const nozzles=[...spec.nozzles,...(spec.nameplate?[{qty:spec.nameplateQty||1,size:'',service:'ASME nameplate assembly'}]:[])];
  if(nozzles.length>maxNozzles)throw new Error(`Template supports ${maxNozzles} nozzle rows. Use the complete printable draft or extend the controlled template.`);
  if(spec.supports.length>3)throw new Error('Template supports three support rows.');
  if(spec.options.length>(pack?4:5))throw new Error('Too many options for this template. Use the complete printable draft or group the options.');
  if(pack&&spec.components.length>14)throw new Error('Package template supports 14 component rows. Use the complete printable draft or extend the controlled template.');
  const edits={A4:(Date.parse(m.date)-Date.UTC(1899,11,30))/86400000,K4:m.quoteNo,C7:m.customer,C8:m.project||'Not provided',B10:'DRAFT FOR REVIEW. Preliminary design and commercial scope. See Scope and Review sheet.',
    C20:'Design pressure (preliminary)',C21:'Required MDMT',C22:'External design pressure',C23:'Code design basis',C27:'Radiography plan'};
  spec.basis.forEach(([,value],i)=>edits[`G${16+i}`]=value);
  for(let i=0;i<maxNozzles;i++){edits[`C${36+i}`]=nozzles[i]?`${nozzles[i].qty}ea`:'';edits[`D${36+i}`]=nozzles[i]?.size||'';edits[`E${36+i}`]=nozzles[i]?.service||'';}
  for(let i=0;i<3;i++){edits[`C${52+i}`]=spec.supports[i]?`${spec.supports[i].qty}ea`:'';edits[`D${52+i}`]=spec.supports[i]?.service||'';}
  edits[pack?'C74':'C56']=`${money(q.quotePrice)}/ea`;edits[pack?'C77':'C59']=m.delivery;
  const slots=pack?[79,81,83,85]:[62,67,69,71,73];
  for(const [i,row] of slots.entries()){edits[`C${row}`]=spec.options[i]?.price??'';edits[`D${row}`]=spec.options[i]?`${spec.options[i].qty} × ${spec.options[i].description}`:'';edits[`D${row+1}`]='';}
  if(!pack){edits.D63='';edits.C78='See Scope and Review sheet for the complete included and excluded scope.';edits.C79='Engineering verification and fabrication release remain open.';edits.C86='DRAFT. See Scope and Review sheet. No fabrication release.';
    edits.C90=`Quoted pricing is valid for acceptance within ${m.validity||'10 days'} from the date of this quotation and shipment within six (6) months from the date an order is placed.`;}
  if(pack){edits.A57='Package components (per package)';for(let i=0;i<14;i++){edits[`C${59+i}`]=spec.components[i]?`${spec.components[i].qty}ea`:'';edits[`D${59+i}`]=spec.components[i]?.description||'';}
    edits.C97='DRAFT. Complete scope, exclusions, quantity and validity are on the Scope and Review sheet.';
    edits.C90='See Scope and Review sheet for the complete included and excluded scope.';edits.C91='Engineering verification and fabrication release remain open.';
    edits.C101=`Quoted pricing is valid for acceptance within ${m.validity||'10 days'} from the date of this quotation and shipment within six (6) months from the date an order is placed.`;}
  let sheet=setTemplateCells(strFromU8(files['xl/worksheets/sheet1.xml']),edits);
  if(pack)sheet=sheet.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{
    const merges=[...body.matchAll(/<mergeCell ref="([^"]+)"\s*\/>/g)].map(m=>m[1]).filter(ref=>!/^D(?:59|6\d|7[0-2]):/.test(ref));
    for(let r=59;r<=72;r++)merges.push(`D${r}:H${r}`);
    return `<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  });
  // Give variable-length descriptions real cell space, including option rows
  // that the original handwritten template left unmerged.
  sheet=sheet.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{
    const refs=[...body.matchAll(/<mergeCell ref="([^"]+)"\s*\/>/g)].map(m=>m[1]).filter(ref=>!slots.some(r=>ref.startsWith(`D${r}:`)));
    for(const r of slots)refs.push(`D${r}:J${r}`);
    if(pack)for(const r of [47,48])if(!refs.includes(`E${r}:H${r}`))refs.push(`E${r}:H${r}`);
    return `<mergeCells count="${refs.length}">${refs.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  });
  const textCells=Object.keys(edits).filter(ref=>typeof edits[ref]==='string'),styleIndexes=[];
  for(const ref of textCells){const attrs=sheet.match(new RegExp(`<c\\b([^>]*\\br="${ref}"[^>]*)>`))?.[1];styleIndexes.push(Number(attrs?.match(/\bs="(\d+)"/)?.[1]||0));}
  const styleMap=addWrappedStyles(files,styleIndexes),heights=new Map();
  for(let i=0;i<textCells.length;i++) {
    const ref=textCells[i],n=Number(ref.match(/\d+/)[0]),capacity=ref[0]==='G'?42:ref[0]==='E'?38:ref[0]==='D'?65:ref==='B10'?120:90;
    const height=Math.max(16,14*Math.ceil(edits[ref].length/capacity)+3);heights.set(n,Math.max(heights.get(n)||16,height));
    sheet=sheet.replace(new RegExp(`(<c\\b[^>]*\\br="${ref}"[^>]*\\bs=")[0-9]+("[^>]*>)`),(_,before,after)=>before+styleMap.get(styleIndexes[i])+after);
  }
  sheet=sheet.replace(/<row\b([^>]*\br="(\d+)"[^>]*)>/g,(all,attrs,n)=>{
    if(!heights.has(Number(n)))return all;const height=Math.max(Number(attrs.match(/\bht="([\d.]+)"/)?.[1]||0),heights.get(Number(n)));
    return `<row${attrs.replace(/\s(?:ht|customHeight)="[^"]*"/g,'')} ht="${height}" customHeight="1">`;
  });
  files['xl/worksheets/sheet1.xml']=strToU8(sheet);
  // Rebuild descriptive metadata so the template's previous customer/job
  // cannot remain hidden in file properties or unused shared-string records.
  if(files['docProps/core.xml'])files['docProps/core.xml']=strToU8(xml('<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>JWT draft quote</dc:title><dc:creator>JWT Tank Designer</dc:creator></cp:coreProperties>'));
  appendScope(files,spec);
  return zipSync(files,{level:6});
}
export function download(data,name,type='application/octet-stream') {
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
