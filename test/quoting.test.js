import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8,strFromU8,unzipSync} from 'fflate';
import {DEFAULT_QUOTE,priceLine,calculateQuote,roundPrice,catalogCost,ageDays,scenarioComparison} from '../src/quoting/quote-engine.js';
import {parseCSV,EMPTY_BOOK,importPackage,parsePriceFeed,mergePriceFeed,fetchPriceFeed,catalogRow,refreshCatalogRows,safeUnzip} from '../src/quoting/ratebook.js';
import {seedBudget,headKey,applyOverrides,tableHours,fittingAllowance,designKey} from '../src/quoting/seed-budget.js';
import {newSession,saveProject,loadProject} from '../src/quoting/project.js';
import {levelColumn,pumpPackageScope,COLUMN_DEFAULTS} from '../src/quoting/assemblies.js';
import {budgetWorkbook,customerWorkbook,customerHTML,quoteSpecification,setTemplateCells,worksheet} from '../src/quoting/exports.js';
import {DEFAULT_INPUTS,evaluateDesign} from '../src/design-state.js';
import {PRODUCTS} from '../src/products.js';

const row=(patch={})=>({id:'one',scope:'base',description:'Synthetic component',category:'Fabrication',qty:2,unitMaterial:100,unitHours:3,
  adderCost:20,source:'Synthetic test data',asOf:'2026-09-01',confidence:'confirmed',...patch});
const settings={...DEFAULT_QUOTE,laborRate:175,materialMargin:.2,laborMargin:.25};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
export function sampleDesign(extra={}) {
  const design={productId:'cv',product:PRODUCTS[4],inputs:{...DEFAULT_INPUTS,operatingTemp:180,designTemp:240,minPressure:12,maxPressure:25,
    reliefPressure:30,mawp:150,mechanicalDiameter:48,designFlowGPM:100},sizingMode:'tank',tankVol:1000,materialId:'CS',CA:.0625,supportType:'skirt',...extra};
  const state=evaluateDesign(design);assert.equal(state.error,null);assert.ok(state.vessel);return {design,vessel:state.vessel};
}

test('Separate on-sell margins, quantity and extended adder reconcile by hand',()=>{
  const l=priceLine(row(),settings);
  close(l.materialCost,200);close(l.laborCost,1050);close(l.hours,6);close(l.adderCost,20);close(l.cost,1270);close(l.sell,1675);
});
test('Contingency, discount, order quantity, rounding and internal commission reconcile',()=>{
  const q=calculateQuote([row()],{...settings,quantity:3,contingency:.1,discount:.05,commission:.1},'2026-09-08');
  close(q.allowance,127);close(q.unrounded,1742.0625);close(q.quotePrice,1740);close(q.orderPrice,5220);close(q.profit,343);
  close(q.commissionPrice,1740/.9);close(q.margin,343/1740);assert.equal(q.ready,true);
});
test('Optional and excluded scope never double-count in the base budget',()=>{
  const q=calculateQuote([row(),row({id:'opt',scope:'option'}),row({id:'ex',scope:'excluded',unitMaterial:1e9})],settings);
  close(q.cost,1270);close(q.options[0].cost,1270);assert.equal(q.lines.length,1);
  const selected=calculateQuote([row(),row({id:'opt'})],settings);close(selected.cost,2540);
});
test('Per-row margins, cost and selling-price overrides take precedence',()=>{
  const l=priceLine(row({materialMargin:.1,laborMargin:.1,costOverride:900,sellOverride:800}),settings);
  close(l.cost,900);close(l.sell,800);assert.ok(calculateQuote([l],settings).warnings.some(x=>x.includes('below cost')));
  close(priceLine(row({costOverride:900,materialMargin:.1}),settings).sell,1000);
  close(calculateQuote([row()],{...settings,priceOverride:1600,commission:.2}).quotePrice,1600);
});
test('Blank and invalid costs cannot become a complete quote through a sell override',()=>{
  for(const invalid of ['',null,undefined,NaN,Infinity,-1,true]) {
    const q=calculateQuote([row({unitMaterial:invalid})],{...settings,priceOverride:10000});assert.equal(q.ready,false);assert.equal(q.gaps.length,1);
  }
  assert.equal(calculateQuote([row({unitHours:''})],settings).ready,false);
  assert.equal(calculateQuote([row()],{...settings,laborRate:''}).ready,false);
  assert.equal(calculateQuote([row({unitHours:0})],{...settings,laborRate:''}).ready,true);
});
test('Invalid global inputs and duplicate IDs fail explicitly',()=>{
  for(const patch of [{quantity:1.5},{quantity:0},{commission:1},{discount:-1},{materialMargin:1},{roundMode:'bankers'},{rounding:0}])assert.equal(calculateQuote([row()],{...settings,...patch}).ready,false);
  assert.match(calculateQuote([row(),row()],settings).error,/unique/);
  assert.match(calculateQuote([row({scope:'ignored'})],settings).error,/scope/);
});
test('Commercial rounding is half-up, with selectable direction',()=>{
  close(roundPrice(102.5,5),105);close(roundPrice(104.99,5,'down'),100);close(roundPrice(100.01,5,'up'),105);
  close(roundPrice(100.005,.01),100.01);
});
test('Steel adjustments only apply to flagged rows, labor changes apply to labor',()=>{
  const q=calculateQuote([row({escalateSteel:true}),row({id:'buyout',unitHours:0,adderCost:0})],{...settings,steelChange:.1,laborChange:.2});
  close(q.materialCost,420);close(q.laborCost,1260);
  const scenarios=scenarioComparison([row({escalateSteel:true})],{...settings,priceOverride:1});assert.ok(scenarios[0].result.quotePrice>1);assert.ok(scenarios[1].result.cost>scenarios[0].result.cost);
});
test('Price ages reject malformed calendar dates, report stale and future prices',()=>{
  assert.equal(ageDays('2026-02-30'),null);assert.equal(ageDays('2026-09-01','2026-09-08'),7);assert.equal(ageDays(''),null);
  const q=calculateQuote([row({asOf:'2025-01-01'}),row({id:'future',asOf:'2027-01-01'})],settings,'2026-09-08');
  assert.ok(q.warnings.some(w=>w.includes('days old')));assert.ok(q.warnings.some(w=>w.includes('future-dated')));
});
test('Catalog pricing distinguishes list from net and requires a multiplier',()=>{
  close(catalogCost({price:100,basis:'list'},.5,1.1,.1),60.5);
  close(catalogCost({price:100,basis:'net'},.5,1.1,.1),121);
  assert.throws(()=>catalogCost({price:100,basis:'list'},''),/multiplier/);
  assert.throws(()=>catalogCost({price:'Consult vendor',basis:'net'}),/price/);
});
test('Vendor extended material rounds once to cents, fabrication keeps full precision',()=>{
  const vendor=priceLine(row({unitMaterial:1.234,qty:3,unitHours:0,adderCost:0,roundMaterial:true}),settings);
  close(vendor.materialCost,3.7);close(priceLine(row({unitMaterial:1.234,qty:3}),settings).materialCost,3.702);
});
test('Catalog refresh keeps quantity, scope, row margins and manual overrides',()=>{
  const part={id:'V:A',price:100,basis:'list',description:'Part',source:'Vendor reference',asOf:'2026-09-01'};
  const rows=[{id:'extra-1',...catalogRow(part,{multiplier:.5}),qty:3,scope:'option',materialMargin:.3,unitHours:2},
    {id:'extra-2',...catalogRow(part,{multiplier:.5}),unitMaterial:42,manualPrice:true}];
  const next=refreshCatalogRows(rows,{...EMPTY_BOOK,catalog:[{...part,price:200}]});
  close(next[0].unitMaterial,100);close(next[0].qty,3);close(next[0].materialMargin,.3);close(next[0].unitHours,2);assert.equal(next[0].scope,'option');close(next[1].unitMaterial,42);
  assert.equal(refreshCatalogRows(rows,EMPTY_BOOK)[0].unitMaterial,'');
});
test('CSV supports quoted commas, newlines, escaped quotes and duplicate blank headers',()=>{
  const r=parseCSV('\uFEFFname,value,,\r\n"A, B","two\nlines",1,2\r\n"3"" nozzle",4,5,6');
  assert.equal(r[0].name,'A, B');assert.equal(r[0].value,'two\nlines');assert.equal(r[1].name,'3" nozzle');assert.equal(r[0]._column_4,'2');
  assert.throws(()=>parseCSV('a,b\n"unfinished'),/Unclosed/);
});
test('Level-column quantities and labor remain explicit, including float pairs and full trim',()=>{
  const prices=Object.fromEntries(['pipe_per_ft','cap','conn_pipe_ea','probe_conn','drain_conn','float_conn','float_switch','level_eye_fs','iso_valve','drain_valve','probe_aks4100u','flanged_union','finish_epoxy','finish_primer'].map(k=>[k,10]));
  const hours=Object.fromEntries(['cap','handling','profile','conn_pipe','small_conn','float_conn_pair','float_switch','eye','iso_valve','drain_valve','probe','flanged_union'].map(k=>[k,1]));
  const lc=levelColumn({...COLUMN_DEFAULTS,length:60,eyes:5},{prices,hours});
  close(lc.unitMaterial,200);close(lc.unitHours,15);close(lc.materialMargin,.12);
  assert.throws(()=>levelColumn({hlSwitch:true,hlConnections:false},{prices,hours}),/requires/);
  assert.throws(()=>levelColumn({eyes:1.5},{prices,hours}),/whole/);
  const full=levelColumn({...COLUMN_DEFAULTS,isolation:true,drainValve:true,probe:true,unions:true},{prices,hours});close(full.unitMaterial-lc.unitMaterial,60);close(full.unitHours-lc.unitHours,6);
});
test('Three-pump scope carries all three drives, guards and valve trains',()=>{
  const rows=pumpPackageScope(3);for(const r of rows.slice(0,4))assert.equal(r.qty,3);for(const r of rows.slice(4))assert.equal(r.qty,1);
  assert.ok(rows.every(r=>r.unitMaterial===''));assert.throws(()=>pumpPackageScope(1.5),/whole/);
});
test('Runtime ZIP import selects tables/templates and preserves fractional profile margins',()=>{
  const zip=zipSync({'skill/references/rate-tables/rates-history.csv':strToU8('period,labor_burden_hr,margin_mode,margin_range,plate_lb_typical,ai_expense_unit,notes\n2026-Q3,100-200,0.18,0.1-0.2,1-2,100,synthetic'),
    'skill/references/rate-tables/vessel-labor.csv':strToU8('Description,Material Cost\nTest,100'),
    'skill/assets/quote-template-bare.xlsx':new Uint8Array([1,2]),'skill/scripts/malicious.py':strToU8('throw new Error("never execute")')});
  const b=importPackage(zip);close(b.profiles[0].margin,.18);close(b.profiles[0].laborRate,200);assert.equal(b.profiles[0].asOf,'2026-07-01');assert.equal(Object.keys(b.tables).length,2);
  assert.throws(()=>safeUnzip(zipSync({'../bad':strToU8('x')})),/Unsafe/);
  assert.throws(()=>safeUnzip(zipSync({'big':new Uint8Array(16e6)})),/limits/);
});
const feed=patch=>JSON.stringify({version:1,currency:'USD',parts:[{id:'V:A',description:'Synthetic part',price:123,basis:'net',source:'Synthetic source',asOf:'2026-09-01',...patch}]});
test('Price feed validates atomically and refuses stale overwrites',()=>{
  const parts=parsePriceFeed(feed(),'2026-09-08');assert.equal(parts[0].price,123);
  for(const patch of [{basis:''},{asOf:'2027-01-01'},{asOf:'2026-02-31'},{price:-1},{source:''}])assert.throws(()=>parsePriceFeed(feed(patch),'2026-09-08'));
  const old={...EMPTY_BOOK,catalog:[{...parts[0],price:200,asOf:'2026-09-05'}]};const merged=mergePriceFeed(old,parts);assert.equal(merged.skipped,1);close(merged.book.catalog[0].price,200);close(old.catalog[0].price,200);
});
test('Live feed uses HTTPS without credentials, redirects or cached responses',async()=>{
  let called;const parts=await fetchPriceFeed('https://prices.example.test/feed',{fetcher:async(u,o)=>{called={u,o};return new Response(feed());}});
  assert.equal(parts.length,1);assert.equal(called.o.credentials,'omit');assert.equal(called.o.redirect,'error');assert.equal(called.o.cache,'no-store');
  await assert.rejects(fetchPriceFeed('http://prices.example.test/feed'),/HTTPS/);
  await assert.rejects(fetchPriceFeed('https://user:secret@prices.example.test/feed'),/credentials/);
  await assert.rejects(fetchPriceFeed('https://prices.example.test/feed',{fetcher:async()=>new Response('fail',{status:503})}),/503/);
});
test('Quote uses prelim stock weight, actual heads and explicit missing scope',()=>{
  const {vessel:v,design:d}=sampleDesign();const b={...EMPTY_BOOK,tables:{}};
  const rates={steelRate:2,steelMaterial:'CS',headEach:100,headHours:3,headFreight:.1,headBasis:headKey(v)};
  const rows=seedBudget(v,d.product,b,rates);
  close(rows.find(r=>r.id==='shell').unitMaterial,v.prelim.result.plate.purchased_weight*2);
  close(rows.find(r=>r.id==='heads').unitMaterial,110);close(rows.find(r=>r.id==='heads').qty,2);
  assert.ok(rows.some(r=>r.id==='nde'&&r.unitMaterial===''));assert.equal(calculateQuote(rows,settings).ready,false);
  assert.equal(seedBudget({...v,materialId:'SS316'},d.product,b,rates).find(r=>r.id==='shell').unitMaterial,'');
  assert.equal(seedBudget({...v,D_OD:54},d.product,b,rates).find(r=>r.id==='heads').unitMaterial,'');
});
test('Head cap history cannot price formed pipe-body heads',()=>{
  const {vessel:v,design:d}=sampleDesign({inputs:{...DEFAULT_INPUTS,operatingTemp:180,designTemp:200,minPressure:12,maxPressure:25,reliefPressure:30,mawp:150,mechanicalDiameter:24,designFlowGPM:100},tankVol:100});
  const b={...EMPTY_BOOK,tables:{'head-costs-observed':[{od:v.D_OD,thk:v.tHead,median_cost:10}]}};
  assert.equal(seedBudget(v,d.product,b).find(r=>r.id==='heads').unitMaterial,'');
});
test('Diaphragm products add supplier assembly cost, without fabricated prices',()=>{
  const {vessel:v}=sampleDesign();const rows=seedBudget(v,PRODUCTS[0],EMPTY_BOOK);
  assert.ok(rows.some(r=>r.id==='membrane'&&r.unitMaterial===''));
});
test('Thickness labor lookup rounds up and refuses unsupported thicknesses',()=>{
  const row={'0.25" Labor Hours':'1','0.375" Labor Hours':'2','0.5" Labor Hours':'3',Size:'1"','Material Cost':'10'};
  close(tableHours(row,.3),2);assert.equal(tableHours(row,1),'');
  const allowance=fittingAllowance(row,{tShell:.3,D_OD:48},{...EMPTY_BOOK,tables:{'nozzle-hours-observed':[{size:'1',od_class:'30-48',median_hrs:4}]}});close(allowance.unitHours,4);
});
test('Design changes suspend line overrides instead of carrying stale quantities/costs',()=>{
  const {vessel:v,design:d}=sampleDesign();const seeds=seedBudget(v,d.product,EMPTY_BOOK);
  const overrides={shell:{id:'shell',designKey:designKey(v,d.product),unitMaterial:123}};
  close(applyOverrides(seeds,overrides)[0].unitMaterial,123);
  const changed=seedBudget({...v,D_OD:54},d.product,EMPTY_BOOK);assert.equal(applyOverrides(changed,overrides)[0].unitMaterial,'');assert.equal(applyOverrides(changed,overrides)[0].needsReview,true);
});
test('Private project round-trip retains edits but omits templates and unrelated records',()=>{
  const s=newSession();s.settings=settings;s.extras=[row({id:'extra-1'})];s.book={...EMPTY_BOOK,templates:{bare:new Uint8Array([1])},history:[{customer:'UNRELATED CUSTOMER'}],catalog:[{id:'unrelated'}]};
  const {design}=sampleDesign();const saved=saveProject(s,design,s.extras),loaded=loadProject(saved);
  assert.ok(!saved.includes('UNRELATED CUSTOMER'));assert.ok(!saved.includes('unrelated'));assert.deepEqual(loaded.session.book.templates,{});close(calculateQuote(loaded.session.extras,loaded.session.settings).cost,1270);
  assert.throws(()=>loadProject('{"__proto__":{}}'),/Invalid/);
  assert.throws(()=>loadProject(JSON.stringify({...JSON.parse(saved),version:2})),/version 1/);
});

export function sampleSpec() {
  const {vessel,design}=sampleDesign();const meta={customer:'SYNTHETIC CUSTOMER',project:'Test project',quoteNo:'TEST-001',date:'2026-09-08',delivery:'10 weeks after approval',validity:'10 days',interior:'None',exterior:'Primer',notes:'Customer scope only',rfq:'INTERNAL SECRET'};
  const rows=[row({id:'nozzle-N1',customerVisible:true}),row({id:'option',scope:'option',unitMaterial:200,description:'Optional synthetic equipment'})];
  return {spec:quoteSpecification(vessel,design.product,design.inputs,rows,settings,meta),rows,meta,design,vessel};
}
test('Customer output uses actual design temperature, does not fabricate vacuum rating or leak internal data',()=>{
  const {spec}=sampleSpec();const html=customerHTML(spec);
  assert.equal(spec.nozzles[0].qty,2);
  assert.ok(html.includes('150 psig @ 240°F'));assert.ok(html.includes('Not specified'));assert.ok(!html.includes('15 psig @ 200'));
  assert.ok(!html.includes('INTERNAL SECRET'));assert.ok(!html.includes('Synthetic test data'));assert.ok(html.includes('DRAFT FOR REVIEW'));assert.ok(html.includes('Optional synthetic equipment'));
  spec.meta.customer='<img src=x onerror=alert(1)>';
  assert.ok(!customerHTML(spec).includes('<img'));assert.ok(customerHTML(spec).includes('&lt;img'));
});
test('Incomplete base scope and optional prices block customer export',()=>{
  const {vessel,design,meta}=sampleSpec();
  assert.throws(()=>quoteSpecification(vessel,design.product,design.inputs,[row({unitMaterial:''})],settings,meta),/Complete/);
  assert.throws(()=>quoteSpecification(vessel,design.product,design.inputs,[row(),row({id:'bad',scope:'option',unitMaterial:''})],settings,meta),/optional/);
});
test('Internal XLSX retains formulas, numeric inputs, cached totals and source notes',()=>{
  const {rows,meta}=sampleSpec();const files=unzipSync(budgetWorkbook(rows,settings,meta));
  const summary=strFromU8(files['xl/worksheets/sheet1.xml']),budget=strFromU8(files['xl/worksheets/sheet3.xml']);
  assert.match(summary,/<c r="B8"[^>]*><f>[\s\S]*?<\/f><v>1675<\/v><\/c>/);
  assert.ok(budget.includes('Synthetic test data'));assert.ok(budget.includes('<f>'));assert.ok(!/NaN|Infinity|#REF!/.test(summary+budget));
  const blank=strFromU8(unzipSync(budgetWorkbook([row({unitMaterial:''})],settings,meta))['xl/worksheets/sheet3.xml']);assert.match(blank,/<c r="Q2"[^>]*t="str"/);
});
function syntheticTemplate() {
  const files=unzipSync(budgetWorkbook([row()],settings));
  files['xl/workbook.xml']=strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>');
  delete files['xl/worksheets/sheet2.xml'];delete files['xl/worksheets/sheet3.xml'];delete files['xl/worksheets/sheet4.xml'];
  files['xl/worksheets/sheet1.xml']=strToU8(worksheet([['Template']],[]).replace('</sheetData>','<row r="7"><c r="C7" t="s"><v>0</v></c></row></sheetData>'));
  files['xl/sharedStrings.xml']=strToU8('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>OLD CUSTOMER</t></si><si><t>UNUSED PRIVATE PRICE</t></si></sst>');
  files['xl/media/logo.png']=new Uint8Array([1,2,3]);return zipSync(files);
}
test('Template edits retain style, remove formulas and escape spreadsheet injection as text',()=>{
  const sheet='<worksheet><sheetData><row r="7"><c r="C7" s="42" t="s"><v>1</v></c><c r="F7"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>';
  const changed=setTemplateCells(sheet,{C7:'=HYPERLINK("x")',F7:'<&>',A4:'2026-09-08'});
  assert.ok(changed.includes('r="C7" s="42" t="inlineStr"'));assert.ok(!changed.includes('<f>'));assert.ok(changed.includes('&lt;&amp;&gt;'));assert.ok(changed.indexOf('r="4"')<changed.indexOf('r="7"'));
});
test('Template replacement preserves literal dollar amounts and neighboring empty cells',()=>{
  const sheet='<worksheet><sheetData><row r="4"/><row r="56"><c r="A56" s="1"/><c r="B56" s="2"/><c r="C56" s="3"><v>0</v></c><c r="D56" s="4"/></row></sheetData></worksheet>';
  const replaced=setTemplateCells(sheet,{C56:'$19,720/ea',A4:'Literal $1 and $&'});
  assert.ok(replaced.includes('$19,720/ea'));assert.ok(replaced.includes('Literal $1 and $&amp;'));assert.ok(!replaced.includes('Literal  r='));
  assert.ok(replaced.includes('<c r="A56" s="1"/>'));assert.ok(replaced.includes('<c r="B56" s="2"/>'));assert.ok(replaced.includes('<c r="D56" s="4"/>'));
});
test('Customer XLSX removes old customer strings and keeps original image bytes',()=>{
  const {spec}=sampleSpec();const input=syntheticTemplate();const files=unzipSync(customerWorkbook(input,spec));
  const text=Object.entries(files).filter(([p])=>p.endsWith('.xml')).map(([,v])=>strFromU8(v)).join('');
  assert.ok(!text.includes('OLD CUSTOMER'));assert.ok(!text.includes('UNUSED PRIVATE PRICE'));assert.ok(!text.includes('INTERNAL SECRET'));
  assert.ok(text.includes('SYNTHETIC CUSTOMER'));assert.ok(text.includes('Scope and Review'));assert.deepEqual(files['xl/media/logo.png'],new Uint8Array([1,2,3]));
  assert.throws(()=>customerWorkbook(input,{...spec,options:Array.from({length:6},()=>spec.options[0])}),/Too many/);
});
