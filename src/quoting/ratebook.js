import {unzipSync,strFromU8} from 'fflate';
import {ageDays,catalogCost,number,optional} from './quote-engine.js';

export const EMPTY_BOOK = {version:1,name:'No price package imported',tables:{},catalog:[],profiles:[],history:[],templates:{},levelColumn:null};
export const todayISO = () => new Date().toISOString().slice(0,10);

// Quoted fields may contain commas, newlines and doubled quotes. No eval or
// spreadsheet formula execution occurs when reading the reference tables.
export function parseCSV(text) {
  if(typeof text!=='string' || text.length>12e6) throw new Error('CSV exceeds the supported size.');
  const records=[];let record=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {
      if(quoted&&text[i+1]==='"'){field+='"';i++;}
      else if(quoted||!field) quoted=!quoted;
      else field+=c;
    } else if(!quoted&&(c===','||c==='\n'||c==='\r')) {
      record.push(field.trim());field='';
      if(c!==',') {if(record.some(Boolean))records.push(record);record=[];if(c==='\r'&&text[i+1]==='\n')i++;}
    } else field+=c;
  }
  if(quoted)throw new Error('Unclosed quoted CSV field.');
  record.push(field.trim());if(record.some(Boolean))records.push(record);
  const seen=new Map();
  const headers=(records.shift()||[]).map((h,i)=>{h=h||`_column_${i+1}`;const n=seen.get(h)||0;seen.set(h,n+1);return n?`${h} [${n+1}]`:h;});
  return records.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}
export function numeric(value) {
  if(optional(value))return '';
  const cleaned=String(value).replace(/[$,\s]/g,'');
  return /^\d+(\.\d+)?$/.test(cleaned)?Number(cleaned):'';
}
function upperRange(value) {
  const values=String(value??'').match(/\d+(?:\.\d+)?/g)?.map(Number);
  return values?.length?Math.max(...values):'';
}
function periodDate(period) {
  const match=/^(\d{4})-(Q[1-4]|H[12])/.exec(period??'');
  return match?`${match[1]}-${String(match[2][0]==='Q'?(Number(match[2][1])-1)*3+1:match[2][1]==='1'?1:7).padStart(2,'0')}-01`:'';
}
export function safeUnzip(data,accept=()=>true) {
  const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
  if(bytes.length>20e6)throw new Error('ZIP must be smaller than 20 MB.');
  let count=0,total=0;
  return unzipSync(bytes,{filter:f=>{
    if(++count>5000 || f.originalSize>15e6 || (total+=f.originalSize)>60e6)throw new Error('Expanded ZIP exceeds the supported limits.');
    if(/(^\/|\\|(^|\/)\.\.(\/|$))/.test(f.name))throw new Error('Unsafe ZIP path.');
    return accept(f.name);
  }});
}
export function importPackage(data,name='Pressure-vessel quoting package') {
  const files=safeUnzip(data,n=>/\/(?:rate-tables\/[^/]+\.csv|quote-template-(?:bare|package)\.xlsx|scripts\/level_column\.py)$/.test(n));
  const tables={},templates={};let levelColumn=null;
  for(const [path,bytes] of Object.entries(files)) {
    const file=path.split('/').at(-1);
    if(file.endsWith('.csv')) {
      const key=file.slice(0,-4);
      if(tables[key])throw new Error(`Duplicate price table: ${key}`);
      tables[key]=parseCSV(strFromU8(bytes));
    }else if(file.endsWith('.xlsx'))templates[file.includes('-bare.')?'bare':'package']=bytes;
    else {const text=strFromU8(bytes);levelColumn={prices:readNumericDictionary(text,'PRICES'),hours:readNumericDictionary(text,'HOURS'),source:'Imported level-column reference constants',asOf:''};}
  }
  if(!tables['vessel-labor'] || !tables['rates-history'])throw new Error('This ZIP does not contain the quoting skill rate tables.');
  const profiles=tables['rates-history'].map(r=>({id:r.period,label:r.period,asOf:periodDate(r.period),
    laborRate:upperRange(r.labor_burden_hr),steelRate:upperRange(r.plate_lb_typical),aiCost:upperRange(r.ai_expense_unit),
    margin:upperRange(r.margin_mode),
    rounding:/PolkCommercial/.test(r.period)?10:5,roundMode:/PolkCommercial/.test(r.period)?'down':'nearest',
    notes:`${r.notes||''} Range inputs use the high endpoint. Historical profile, confirm current terms.`}));
  const catalog=[];
  const add=(vendor,id,description,price,basis,source,asOf='',extra={})=>{
    if(!id)return;
    catalog.push({id:`${vendor}:${id}`,vendor,partNumber:id,description,price:numeric(price),basis,source,asOf,...extra});
  };
  for(const r of tables['danfoss-dirquote-catalog']||[])add('Danfoss',r.part_number,r.part_name||r.type,r.list_price,'list','Imported Danfoss catalog','',{
    tariff:numeric(r.tariff_pct)===''?0:numeric(r.tariff_pct)/100,requiredAccessories:r.required_accessories||'',category:r.category});
  for(const r of tables['hansen-valve-list-lp0226']||[])add('Hansen',r.Item,r.Description,r['List Price (LP0226)'],'list','Hansen LP0226','2026-02-01');
  for(const r of tables['parker-rs-ilp27-bare-valves']||[])add('Parker',r['Part Number'],r.Description,r['List Price (ILP-27.00)'],'list','Parker ILP-27.00');
  for(const r of tables['nikkiso-pump-pricing-2025-09']||[])add('Nikkiso',r['Pump Model'],`${r['Pump Model']} ${r.Hp||''} HP ${r['Imp Dia']||''} impeller`,r['OEM Price'],'net','Nikkiso OEM September 2025','2025-09-01');
  // Same model can have several impellers. Preserve every row, never overwrite.
  const counts=new Map();
  for(const p of catalog){const base=p.id,n=counts.get(base)||0;counts.set(base,n+1);if(n)p.id=`${base}#${n+1}`;}
  const history=(tables['quote-history-2025-26']||[]).map(r=>({quote:r.quote_no,date:r.date,customer:r.customer,type:r.vessel_type,
    od:parseFloat(r.od),oal:parseFloat(r.oal),pressure:parseFloat(r.mawp),price:numeric(String(r.price).replace(/\/ea.*$/i,''))}));
  return {version:1,name,tables,templates,profiles,catalog,history,levelColumn,importedAt:todayISO()};
}
export function readNumericDictionary(text,name) {
  if(!['PRICES','HOURS'].includes(name))throw new Error('Unsupported reference dictionary.');
  const body=text.match(new RegExp(`^${name}\\s*=\\s*\\{([^}]+)\\}`,'m'))?.[1];
  if(!body)throw new Error(`Missing ${name} in level-column reference.`);
  const result={};
  for(const item of body.replace(/#[^\n]*/g,'').split(',').map(x=>x.trim()).filter(Boolean)) {
    const m=/^"([a-z0-9_]+)"\s*:\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/.exec(item);
    if(!m)throw new Error(`Unsupported literal in ${name}. Reference scripts are never executed.`);
    if(Object.hasOwn(result,m[1]))throw new Error('Duplicate reference constant.');
    result[m[1]]=number(Number(m[2])/(m[3]?Number(m[3]):1),'Reference constant');
  }
  return result;
}
export function parsePriceFeed(text,today=todayISO()) {
  if(text.length>5e6)throw new Error('Price feed exceeds 5 MB.');
  const data=JSON.parse(text);
  if(data.version!==1||data.currency!=='USD'||!Array.isArray(data.parts)||data.parts.length>10000)throw new Error('Expected version 1 USD feed with at most 10,000 parts.');
  const ids=new Set();
  const parts=data.parts.map(p=>{
    for(const k of ['id','description','source','asOf'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>1000)throw new Error(`Each feed part needs a valid ${k}.`);
    if(ids.has(p.id))throw new Error(`Duplicate feed ID: ${p.id}`);ids.add(p.id);
    if(!['net','list'].includes(p.basis))throw new Error(`Missing list/net basis for ${p.id}.`);
    const age=ageDays(p.asOf,today);
    if(age==null||age<0)throw new Error(`Invalid or future price date for ${p.id}.`);
    return {id:p.id,description:p.description,source:p.source,asOf:p.asOf,basis:p.basis,
      price:number(p.price,'Feed price'),vendor:String(p.vendor||'Price feed').slice(0,100),partNumber:String(p.partNumber||p.id).slice(0,200),
      tariff:number(p.tariff??0,'Tariff',0,2),requiredAccessories:String(p.requiredAccessories||'').slice(0,1000)};
  });
  return parts;
}
export function mergePriceFeed(book,parts) {
  const catalog=new Map(book.catalog.map(p=>[p.id,p]));let updated=0,skipped=0;
  for(const p of parts) {
    const old=catalog.get(p.id);
    if(old?.asOf && p.asOf<old.asOf){skipped++;continue;}
    catalog.set(p.id,p);updated++;
  }
  return {book:{...book,catalog:[...catalog.values()],lastRefresh:new Date().toISOString()},updated,skipped};
}
export async function fetchPriceFeed(url,{fetcher=globalThis.fetch,signal}={}) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('Use an HTTPS price-feed URL without embedded credentials.');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  const timeout=setTimeout(abort,15000);
  try {
    const response=await fetcher(parsed.href,{credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`Price feed returned HTTP ${response.status}.`);
    const reader=response.body?.getReader();let text='';
    if(reader){const decoder=new TextDecoder();let size=0;for(;;){const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>5e6){await reader.cancel();throw new Error('Price feed exceeds 5 MB.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
    else text=await response.text();
    return parsePriceFeed(text);
  }finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
export function catalogRow(part,terms={}) {
  let unitMaterial='',notice='';
  try{unitMaterial=catalogCost(part,terms.multiplier,terms.markup??1,terms.tariff??part.tariff??0);}catch(e){notice=e.message;}
  if(part.requiredAccessories)notice+=` Required accessories: ${part.requiredAccessories}. Review quantities and cost separately.`;
  return {description:part.description,unitMaterial,unitHours:0,source:part.source,asOf:part.asOf,confidence:'reference',notice:notice.trim(),
    catalogId:part.id,catalogTerms:terms,category:'Buyout',qty:1,scope:'base',adderCost:0,roundMaterial:true};
}
export function refreshCatalogRows(rows,book) {
  const parts=new Map(book.catalog.map(p=>[p.id,p]));
  return rows.map(row=>{
    if(!row.catalogId||row.manualPrice)return row;
    const part=parts.get(row.catalogId);
    if(!part)return {...row,unitMaterial:'',notice:'Linked catalog part is unavailable. Import its price source or enter a confirmed cost.'};
    return {...row,...catalogRow(part,row.catalogTerms),id:row.id,description:row.description,qty:row.qty,scope:row.scope,
      unitHours:row.unitHours,materialMargin:row.materialMargin,laborMargin:row.laborMargin,adderCost:row.adderCost};
  });
}
export function comparableQuotes(book,vessel) {
  if(!vessel)return [];
  return book.history.filter(r=>/water|buffer|hydronic|expansion/i.test(r.type)&&r.price>0&&r.od>0&&r.oal>0&&r.pressure>0)
    .map(r=>({...r,distance:Math.abs(Math.log(r.od/vessel.D_OD))+Math.abs(Math.log(r.oal/vessel.OAL))+Math.abs(Math.log(r.pressure/vessel.designPressure))}))
    .filter(r=>r.distance<.8).sort((a,b)=>a.distance-b.distance).slice(0,4);
}
