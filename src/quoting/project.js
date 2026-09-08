import {DEFAULT_QUOTE,calculateQuote} from './quote-engine.js';
import {EMPTY_BOOK} from './ratebook.js';
import {DEFAULT_RATES} from './seed-budget.js';
export const DEFAULT_META={customer:'',project:'',quoteNo:'',date:'',delivery:'',validity:'10 days',
  interior:'',exterior:'',rfq:'',notes:'',template:'bare'};
export function newSession(){return {settings:{...DEFAULT_QUOTE},rates:{...DEFAULT_RATES},meta:{...DEFAULT_META,date:new Date().toISOString().slice(0,10)},
  overrides:{},extras:[],book:{...EMPTY_BOOK},snapshots:[]};}
export function saveProject(session,design,rows) {
  // Templates and unrelated vendor/customer records are not needed to reload
  // a priced project. Linked prices and reference fabrication tables are kept.
  const ids=new Set(rows.map(r=>r.catalogId).filter(Boolean));
  const {book,...state}=session;
  const tables=Object.fromEntries(['vessel-labor','head-costs-observed','nozzle-hours-observed'].filter(k=>book.tables[k]).map(k=>[k,book.tables[k]]));
  return JSON.stringify({format:'jwt-quote',version:1,design,state:{...state,book:{...EMPTY_BOOK,name:book.name,tables,
    catalog:book.catalog.filter(p=>ids.has(p.id)),profiles:book.profiles}},pricedRows:rows},null,2);
}
export function loadProject(text) {
  if(text.length>12e6)throw new Error('Project exceeds 12 MB.');
  const p=JSON.parse(text,(key,value)=>{
    if(['__proto__','prototype','constructor'].includes(key))throw new Error('Invalid project key.');return value;
  });
  if(p.format!=='jwt-quote'||p.version!==1||!p.design||!p.state)throw new Error('Expected a version 1 JWT quote project.');
  const s=p.state;
  if(!s.settings||!s.rates||!s.meta||!s.overrides||!Array.isArray(s.extras)||s.extras.length>500||!s.book)throw new Error('Incomplete project.');
  const scalarMap=(obj,defaults)=>{
    const out={...defaults};for(const k of Object.keys(defaults))if(k in obj){if(!['string','number'].includes(typeof obj[k]))throw new Error(`Invalid ${k}.`);out[k]=obj[k];}return out;
  };
  s.settings=scalarMap(s.settings,DEFAULT_QUOTE);s.rates=scalarMap(s.rates,DEFAULT_RATES);s.meta=scalarMap(s.meta,DEFAULT_META);
  if(!['bare','package'].includes(s.meta.template))throw new Error('Unknown quote template.');
  if(typeof s.overrides!=='object'||Array.isArray(s.overrides)||Object.keys(s.overrides).length>500)throw new Error('Invalid line overrides.');
  for(const row of [...s.extras,...Object.values(s.overrides)]) {
    if(!row||typeof row!=='object'||typeof row.id!=='string'||typeof row.description!=='string'||typeof row.scope!=='string')throw new Error('Invalid quote row.');
    for(const [k,v] of Object.entries(row))if(v!=null&&typeof v==='object'&&k!=='catalogTerms')throw new Error('Invalid quote line value.');
  }
  const check=calculateQuote(s.extras,s.settings);if(check.error)throw new Error(check.error);
  if(!s.book.tables||!Array.isArray(s.book.catalog)||!Array.isArray(s.book.profiles)||s.book.catalog.length>10000)throw new Error('Invalid project price book.');
  for(const rows of Object.values(s.book.tables))if(!Array.isArray(rows)||rows.length>10000)throw new Error('Invalid project table.');
  s.book={...EMPTY_BOOK,...s.book,templates:{},history:[]};
  s.snapshots=Array.isArray(s.snapshots)?s.snapshots.slice(0,20).filter(x=>typeof x.name==='string'&&Number.isFinite(x.price)&&Number.isFinite(x.cost)):[];
  return {design:p.design,session:s};
}
