import React,{useEffect,useMemo,useRef,useState} from 'react';
import {calculateQuote,scenarioComparison,optional} from './quote-engine.js';
import {importPackage,catalogRow,refreshCatalogRows,fetchPriceFeed,mergePriceFeed,comparableQuotes,todayISO} from './ratebook.js';
import {seedBudget,applyOverrides,scopeIntelligence,fittingAllowance,headKey} from './seed-budget.js';
import {saveProject,loadProject} from './project.js';
import {COLUMN_DEFAULTS,levelColumn,pumpPackageScope} from './assemblies.js';
import {budgetWorkbook,quoteSpecification,customerWorkbook,customerHTML,download} from './exports.js';
import './quoting.css';

const usd=n=>Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}):'—';
const pct=n=>Number.isFinite(n)?`${(n*100).toFixed(1)}%`:'—';
function Input({label,value,onChange,percent=false,type='number',...props}) {
  const shown=percent&&!optional(value)?Math.round(Number(value)*1000000)/10000:value??'';
  return <label className="q-field"><span>{label}</span><input type={type} step="any" value={shown}
    onChange={e=>onChange(percent&&e.target.value!==''?Number(e.target.value)/100:e.target.value)} {...props}/></label>;
}
const uid=()=>`extra-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`}`;

export default function QuoteWorkbench({open,onClose,vessel,product,inputs,session,onChange,designContext,onRestoreDesign}) {
  const [tab,setTab]=useState('budget'),[message,setMessage]=useState(''),[expanded,setExpanded]=useState(null),[search,setSearch]=useState(''),
    [multiplier,setMultiplier]=useState(''),[markup,setMarkup]=useState(1),[tariff,setTariff]=useState(''),[feedURL,setFeedURL]=useState(''),
    [autoRefresh,setAutoRefresh]=useState(false),[busy,setBusy]=useState(false),[preview,setPreview]=useState(''),[columnConfig,setColumnConfig]=useState(COLUMN_DEFAULTS),[pumpCount,setPumpCount]=useState(2);
  const dialog=useRef(null),refreshLock=useRef(false),activeRequest=useRef(null),mounted=useRef(true);
  const {settings,rates,meta,book,overrides,extras,snapshots}=session;
  const change=patch=>onChange(prev=>({...prev,...patch}));
  const setSettings=patch=>onChange(prev=>({...prev,settings:{...prev.settings,...patch}}));
  const setRates=patch=>onChange(prev=>({...prev,rates:{...prev.rates,...patch,...('steelRate' in patch?{steelMaterial:vessel?.materialId||''}:{}),
    ...('headEach' in patch||'headHours' in patch?{headBasis:headKey(vessel)}:{})}}));
  const setMeta=patch=>onChange(prev=>({...prev,meta:{...prev.meta,...patch}}));
  const seeds=useMemo(()=>seedBudget(vessel,product,book,rates),[vessel,product,book,rates]);
  const rows=useMemo(()=>[...applyOverrides(seeds,overrides),...refreshCatalogRows(extras,book)],[seeds,overrides,extras,book]);
  const result=useMemo(()=>calculateQuote(rows,settings),[rows,settings]);
  const scenarios=useMemo(()=>scenarioComparison(rows,settings),[rows,settings]);
  const advice=useMemo(()=>scopeIntelligence(rows,vessel,product,meta),[rows,vessel,product,meta]);
  const comparables=useMemo(()=>comparableQuotes(book,vessel),[book,vessel]);
  const matches=useMemo(()=>{const terms=search.toLowerCase().trim().split(/\s+/).filter(Boolean);return terms.length?book.catalog.filter(p=>terms.every(t=>`${p.partNumber} ${p.vendor} ${p.description}`.toLowerCase().includes(t))).slice(0,40):[];},[book,search]);
  const priced=new Map([...result.lines,...result.options].map(l=>[l.id,l]));
  const gaps=new Map(result.gaps.map(g=>[g.id,g]));
  const exportName=(suffix)=>`JWT-${(meta.quoteNo||'draft').replace(/[^a-z0-9_-]/gi,'_')}-${suffix}`;
  const attempt=fn=>{try{fn();setMessage('Export prepared. Review the draft before issuing it.');}catch(e){setMessage(e.message);}};
  const spec=()=>quoteSpecification(vessel,product,inputs,rows,settings,meta);
  const editRow=(row,patch)=>onChange(prev=>{
    if(row.id.startsWith('extra-'))return {...prev,extras:prev.extras.map(r=>r.id===row.id?{...r,...patch,...('unitMaterial' in patch&&patch.manualPrice!==false?{manualPrice:true}:{})}:r)};
    const old=prev.overrides[row.id],validOld=old?.designKey===row.designKey?old:{};
    return {...prev,overrides:{...prev.overrides,[row.id]:{id:row.id,description:row.description,scope:row.scope,...validOld,...patch,designKey:row.designKey}}};
  });
  const addRow=row=>onChange(prev=>({...prev,extras:[...prev.extras,{id:uid(),description:'Additional component',category:'Buyout',qty:1,scope:'base',unitMaterial:'',unitHours:0,
    adderCost:0,source:'Estimator input',asOf:'',confidence:'estimate',customerVisible:true,...row}]}));
  const importZip=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{if(file.size>20e6)throw new Error('ZIP must be smaller than 20 MB.');const next=importPackage(new Uint8Array(await file.arrayBuffer()),file.name);
      change({book:next});setMessage(`Imported ${Object.keys(next.tables).length} tables and ${next.catalog.length.toLocaleString()} catalog entries. Select a historical profile or enter current rates.`);
    }catch(e){setMessage(e.message);}
  };
  const importQuote=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{if(file.size>12e6)throw new Error('Project exceeds 12 MB.');const p=loadProject(await file.text());onRestoreDesign(p.design);activeRequest.current?.abort();setAutoRefresh(false);setFeedURL('');onChange(p.session);setMessage('Project restored. Re-import the quoting ZIP to restore customer templates.');}
    catch(e){setMessage(e.message);}
  };
  const refresh=async()=>{
    if(refreshLock.current)return;refreshLock.current=true;setBusy(true);const controller=new AbortController();activeRequest.current=controller;
    try{const parts=await fetchPriceFeed(feedURL,{signal:controller.signal});if(!mounted.current)return;
      onChange(prev=>({...prev,book:mergePriceFeed(prev.book,parts).book}));setMessage(`Validated ${parts.length} feed records. Older records were skipped. Linked rows update unless their cost is manually overridden.`);
    }catch(e){if(mounted.current)setMessage(`Price refresh failed: ${e.message}. Existing prices were retained.`);}
    finally{refreshLock.current=false;if(mounted.current)setBusy(false);}
  };
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;activeRequest.current?.abort();};},[]);
  useEffect(()=>{if(!autoRefresh||!open||!feedURL)return;const timer=setInterval(refresh,15*60*1000);return()=>clearInterval(timer);},[autoRefresh,open,feedURL]);
  useEffect(()=>{
    if(!open)return;const previous=document.activeElement;dialog.current?.focus();
    const keydown=e=>{if(e.key==='Escape'){e.stopPropagation();if(preview)setPreview('');else onClose();}
      if(e.key==='Tab'){const items=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);
        const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    dialog.current?.addEventListener('keydown',keydown);const element=dialog.current;return()=>{element?.removeEventListener('keydown',keydown);previous?.focus?.();};
  },[open,preview]);
  if(!open)return null;
  const setProfile=id=>{const p=book.profiles.find(p=>p.id===id);if(!p)return;
    setSettings({laborRate:p.laborRate,materialMargin:p.margin,laborMargin:p.margin,rounding:p.rounding,roundMode:p.roundMode});
    setRates({steelRate:vessel?.materialId==='CS'?p.steelRate:'',aiCost:p.aiCost,asOf:p.asOf,source:`Historical profile ${p.label}`});setMessage(p.notes);
  };
  const fieldSettings=(key,label,percent=false)=> <Input key={key} label={label} value={settings[key]} percent={percent} onChange={v=>setSettings({[key]:v})}/>;
  const rateField=(key,label,percent=false)=> <Input key={key} label={label} value={rates[key]} percent={percent} onChange={v=>setRates({[key]:v})}/>;
  const metadataField=(key,label,type='text')=><Input key={key} label={label} type={type} value={meta[key]} onChange={v=>setMeta({[key]:v})}/>;
  return <div className="q-workbench" role="dialog" aria-modal="true" aria-labelledby="quote-title" tabIndex={-1} ref={dialog}>
    <header className="q-header"><div><span className="q-eyebrow">JWT · ESTIMATING</span><h1 id="quote-title">Build a quote</h1><p>{product.name} · {vessel?`${vessel.D_OD.toFixed(2)} in OD × ${vessel.OAL.toFixed(1)} in · ${vessel.designPressure} psig @ ${vessel.designTempF}°F`:'Design inputs need attention'}</p></div>
      <button onClick={onClose}>Back to design</button></header>
    <div className="q-topline"><span className={result.ready&&vessel?'q-tag':'q-tag q-amber'}>{result.ready&&vessel?'PRICED BUDGET · DRAFT':'INCOMPLETE BUDGET'}</span><span>USD · costs per vessel / package · {rows.length} lines</span></div>
    {message&&<div className="q-message" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss message">×</button></div>}
    {!vessel&&<p className="q-message">Return to the design and resolve its inputs before quoting. Existing line edits are retained for review.</p>}
    <div className="q-metrics" aria-live="polite"><div><small>Customer unit price{!result.ready?' · partial':''}</small><strong>{usd(result.quotePrice)}</strong></div>
      <div><small>Order total · {result.quantity||'—'} units</small><strong>{usd(result.orderPrice)}</strong></div><div><small>Estimated unit cost</small><strong>{usd(result.totalCost)}</strong></div>
      <div><small>Gross margin</small><strong>{pct(result.margin)}</strong></div><div><small>Labor per unit</small><strong>{result.hours?.toFixed(1)||'—'} hr</strong></div></div>
    <nav className="q-tabs" aria-label="Quote workspace">{[['budget','Budget & options'],['rates','Rates & catalog'],['quote','Customer & exports']].map(([id,name])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{name}</button>)}</nav>
    <div className="q-layout"><main>
    {tab==='budget'&&<>
      {!book.profiles.length&&<div className="q-message"><span>Start with your quoting package to load historical rates, parts and JWT templates.</span><button onClick={()=>setTab('rates')}>Load price package</button></div>}
      <section className="q-card"><h2>Commercial controls</h2><p>Margins are percentages of selling price. Material and labor are priced separately.</p><div className="q-fields">
        {fieldSettings('quantity','Vessels / packages')}{fieldSettings('laborRate','Loaded labor $/hr')}{fieldSettings('materialMargin','Material margin %',true)}{fieldSettings('laborMargin','Labor margin %',true)}
        {fieldSettings('contingency','Cost contingency %',true)}{fieldSettings('discount','Customer discount %',true)}{fieldSettings('rounding','Price rounding $')}
        <label className="q-field"><span>Rounding direction</span><select value={settings.roundMode} onChange={e=>setSettings({roundMode:e.target.value})}><option value="nearest">Nearest</option><option value="down">Down</option><option value="up">Up</option></select></label>
      </div><details><summary>Price override, commission and escalation</summary><div className="q-fields">
        {fieldSettings('priceOverride','Unit sell override $')}{fieldSettings('commission','Internal commission %',true)}{fieldSettings('steelChange','Steel cost adjustment %',true)}{fieldSettings('laborChange','Labor cost adjustment %',true)}
        </div><p>Commission-inclusive what-if: <b>{usd(result.commissionPrice)}</b>. This does not change the customer price. Row-specific margins override the global margins.</p></details></section>
      <section className="q-card"><div className="q-section-head"><div><h2>Cost build-up</h2><p>Quantity multiplies unit material and unit hours. Row adders and overrides are extended totals.</p></div><button onClick={()=>addRow({})}>+ Add component</button></div>
        <div className="q-table-scroll"><table className="q-budget"><thead><tr><th>Scope</th><th>Description</th><th>Qty</th><th>Material / unit $</th><th>Hours / unit</th><th>Extended cost</th><th>Extended sell</th><th>Details</th></tr></thead><tbody>
          {rows.map(row=><React.Fragment key={row.id}><tr className={`${row.scope==='excluded'?'q-excluded':''} ${gaps.has(row.id)?'q-gap':''}`}>
            <td><select aria-label={`Scope for ${row.description}`} value={row.scope} onChange={e=>editRow(row,{scope:e.target.value})}><option value="base">Base</option><option value="option">Option</option><option value="excluded">Excluded</option></select></td>
            <td><input aria-label={`Description for ${row.id}`} value={row.description} onChange={e=>editRow(row,{description:e.target.value})}/><small>{row.source||'Source needed'} · {row.asOf||'date unknown'}{row.needsReview?' · DESIGN CHANGED':''}</small></td>
            <td><input type="number" min="0" step="any" aria-label={`Quantity for ${row.description}`} value={row.qty} onChange={e=>editRow(row,{qty:e.target.value})}/></td>
            <td><input type="number" min="0" step="any" placeholder="Required" aria-label={`Unit material cost for ${row.description}`} value={row.unitMaterial} onChange={e=>editRow(row,{unitMaterial:e.target.value})}/></td>
            <td><input type="number" min="0" step="any" placeholder="Required" aria-label={`Unit hours for ${row.description}`} value={row.unitHours} onChange={e=>editRow(row,{unitHours:e.target.value})}/></td>
            <td>{usd(priced.get(row.id)?.cost)}</td><td>{usd(priced.get(row.id)?.sell)}</td><td><button aria-expanded={expanded===row.id} onClick={()=>setExpanded(expanded===row.id?null:row.id)}>Edit</button></td>
          </tr>{expanded===row.id&&<tr><td colSpan={8}><div className="q-line-detail"><p>{gaps.get(row.id)?.message||row.notice||'Review the price basis and scope.'}</p><div className="q-fields">
            <Input label="Price / allowance date" type="date" value={row.asOf} onChange={v=>editRow(row,{asOf:v})}/><Input label="Price source" type="text" value={row.source} onChange={v=>editRow(row,{source:v})}/>
            <Input label="Material margin % (blank = global)" percent value={row.materialMargin} onChange={v=>editRow(row,{materialMargin:v===''?null:v})}/>
            <Input label="Labor margin % (blank = global)" percent value={row.laborMargin} onChange={v=>editRow(row,{laborMargin:v===''?null:v})}/>
            <Input label="Labor $/hr (blank = global)" value={row.laborRate} onChange={v=>editRow(row,{laborRate:v===''?null:v})}/>
            <Input label="Extended row adder $" value={row.adderCost} onChange={v=>editRow(row,{adderCost:v})}/>
            <Input label="Extended cost override $" value={row.costOverride} onChange={v=>editRow(row,{costOverride:v})}/><Input label="Extended sell override $" value={row.sellOverride} onChange={v=>editRow(row,{sellOverride:v})}/>
            <label className="q-field"><span>Confidence</span><select value={row.confidence||'estimate'} onChange={e=>editRow(row,{confidence:e.target.value})}><option value="estimate">Estimator allowance</option><option value="reference">Historical / catalog reference</option><option value="confirmed">Supplier / estimator confirmed</option></select></label>
          </div><label className="q-checkbox"><input type="checkbox" checked={!!row.escalateSteel} onChange={e=>editRow(row,{escalateSteel:e.target.checked})}/>Apply steel escalation to this row</label>
          <label className="q-checkbox"><input type="checkbox" checked={!!row.customerVisible} onChange={e=>editRow(row,{customerVisible:e.target.checked})}/>List this component in the customer scope</label>
          {row.nozzleId&&vessel&&<label className="q-field"><span>Use a fitting allowance from the imported table</span><select value="" onChange={e=>{const fit=book.tables['vessel-labor']?.[Number(e.target.value)];if(fit)editRow(row,fittingAllowance(fit,vessel,book));}}><option value="">Select exact material, schedule and connection type</option>{(book.tables['vessel-labor']||[]).map((f,i)=>f.Type&&/Coupling|Stub|Flange/.test(f.Type)?<option key={i} value={i}>{f.Description}</option>:null)}</select></label>}
          <Input label="Review note" type="text" value={row.notice} onChange={v=>editRow(row,{notice:v})}/>
          {row.breakdownJSON&&<details><summary>Assembly calculation detail</summary><pre>{row.breakdownJSON}</pre><p>Rebuild the assembly in Rates & catalog to change its configuration. Line cost and hours can also be overridden above.</p></details>}
          {row.catalogId&&<><div className="q-fields"><Input label="This part's list multiplier" value={row.catalogTerms?.multiplier} onChange={v=>editRow(row,{catalogTerms:{...row.catalogTerms,multiplier:v},manualPrice:false})}/>
            <Input label="This part's vendor markup factor" value={row.catalogTerms?.markup??1} onChange={v=>editRow(row,{catalogTerms:{...row.catalogTerms,markup:v},manualPrice:false})}/>
            <Input label="This part's tariff %" percent value={row.catalogTerms?.tariff} onChange={v=>editRow(row,{catalogTerms:{...row.catalogTerms,tariff:v===''?undefined:v},manualPrice:false})}/></div>
            <button disabled={!book.catalog.some(p=>p.id===row.catalogId)} onClick={()=>editRow(row,{manualPrice:false})}>Restore linked catalog price</button></>}
          {row.id.startsWith('extra-')?<button onClick={()=>change({extras:extras.filter(r=>r.id!==row.id)})}>Remove component</button>:<button onClick={()=>{const next={...overrides};delete next[row.id];change({overrides:next});}}>Restore design allowance</button>}
          </div></td></tr>}</React.Fragment>)}</tbody></table></div>
      </section>
      <section className="q-card"><h2>Price sensitivity</h2><p>Recalculates the current scope with no unit sell override. Fixed row costs, sell overrides and row margins remain fixed.</p><div className="q-scenarios">{scenarios.map(s=><div key={s.name}><small>{s.name}</small><strong>{usd(s.result.quotePrice)}</strong><span>{pct(s.result.margin)} margin</span></div>)}</div>
        <button disabled={!result.ready} onClick={()=>change({snapshots:[...snapshots,{name:`${vessel?.D_OD.toFixed(1)} in · ${vessel?.actualVolGal.toFixed(0)} gal · ${new Date().toLocaleTimeString()}`,price:result.quotePrice,cost:result.totalCost}].slice(-20)})}>Save comparison snapshot</button>
        {snapshots.length>0&&<table className="q-simple"><thead><tr><th>Saved design / time</th><th>Unit price</th><th>Change to current</th></tr></thead><tbody>{snapshots.map((s,i)=><tr key={i}><td>{s.name}</td><td>{usd(s.price)}</td><td>{usd(result.quotePrice-s.price)}</td></tr>)}</tbody></table>}
      </section>
    </>}
    {tab==='rates'&&<>
      <section className="q-card"><h2>Private price package</h2><p>Import pressure-vessel-quoting-v3.14.zip to load its rates, reference catalogs, quote history and JWT templates. Contents remain in this browser session.</p>
        <label className="q-file">Import quoting ZIP<input type="file" accept=".zip" onChange={importZip}/></label><p>{book.name} · {book.catalog.length.toLocaleString()} catalog entries</p>
        <label className="q-field"><span>Apply a historical channel profile</span><select value="" onChange={e=>setProfile(e.target.value)}><option value="">Choose date and channel</option>{book.profiles.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <p>Profiles seed historical labor, material margins and carbon-steel rates. Confirm current supplier costs. Stainless requires its own steel price.</p>
      </section>
      <section className="q-card"><h2>Vessel allowances</h2><div className="q-fields">
        {rateField('steelRate',`${vessel?.materialId||'Material'} stock $/lb`)}{rateField('headEach','Head purchase $/each')}{rateField('headHours','Head fit / weld hours each')}{rateField('headFreight','Inbound head freight %',true)}
        {rateField('aiCost','Authorized inspection $')}{rateField('ndeCost','NDE / examination $')}{rateField('pwhtCost','PWHT $')}{rateField('interiorCost','Interior finish $')}{rateField('exteriorCost','Exterior finish $')}{rateField('freightCost','Outbound freight $')}
        <Input label="Allowance date" type="date" value={rates.asOf} onChange={v=>setRates({asOf:v})}/><Input label="Allowance source" type="text" value={rates.source} onChange={v=>setRates({source:v})}/>
      </div><p>Blank means missing. Enter zero only for a deliberate no-cost scope decision. Individual line overrides take priority over these defaults.</p></section>
      <section className="q-card"><h2>Vendor catalog</h2><p>Search selected parts for costing. Pump and valve duty selection requires the supplier sizing workflow.</p><Input label="Part number, vendor or description" type="search" value={search} onChange={setSearch}/>
        <div className="q-fields"><Input label="Confirmed list multiplier" value={multiplier} onChange={setMultiplier}/><Input label="Vendor markup factor" value={markup} onChange={setMarkup}/><Input label="Tariff % (blank = catalog)" value={tariff} percent onChange={setTariff}/></div>
        <p>Landed unit cost = list × multiplier × markup × (1 + tariff). Net catalogs skip the list multiplier. Installation and freight need their own allowance.</p>
        <table className="q-simple"><thead><tr><th>Vendor / part</th><th>Description</th><th>Source price</th><th>Add</th></tr></thead><tbody>{matches.map(p=><tr key={p.id}><td>{p.vendor}<small>{p.partNumber}</small></td><td>{p.description}<small>{p.asOf||'Date unknown'} · {p.source}</small></td><td>{p.price===''?'Ask vendor':usd(p.price)} {p.basis}</td><td><button onClick={()=>{addRow(catalogRow(p,{multiplier,markup,...(tariff!==''?{tariff}: {})}));setMessage(`Added ${p.partNumber}. Confirm required accessories and installation.`);}}>Add</button></td></tr>)}</tbody></table>
        {search&&!matches.length&&<p>No matching catalog parts. Import the price package or add a component with a supplier quote.</p>}<small>First 40 matches shown. Narrow the search to find a specific model.</small>
      </section>
      <section className="q-card"><h2>Live price feed</h2><p>Connect an HTTPS JSON feed from your pricing service. The feed must allow browser access and identify USD prices, list/net basis, source and date. No provider is preconfigured.</p>
        <Input label="Price-feed URL" type="url" value={feedURL} onChange={v=>{activeRequest.current?.abort();setAutoRefresh(false);setFeedURL(v);}}/>
        <button disabled={busy||!feedURL} onClick={refresh}>{busy?'Refreshing…':'Refresh prices now'}</button><label className="q-checkbox"><input type="checkbox" checked={autoRefresh} disabled={!feedURL} onChange={e=>setAutoRefresh(e.target.checked)}/>Refresh every 15 minutes while this workspace is open</label>
        <p>Last successful refresh: {book.lastRefresh||'None'}. Source dates are retained. Manual cost overrides are preserved.</p>{fieldSettings('staleDays','Flag prices older than (days)')}
        <details><summary>Feed format</summary><pre>{JSON.stringify({version:1,currency:'USD',parts:[{id:'Vendor:part-number',vendor:'Vendor',partNumber:'part-number',description:'Selected component',price:100,basis:'net',asOf:todayISO(),source:'Supplier quote reference',tariff:0}]},null,2)}</pre></details>
      </section>
      <section className="q-card"><h2>Package scope builders</h2><details><summary>Level column reference assembly</summary><p>NPS 4 carbon steel seamless S/40 with frost shields and NPS 1-1/2 vessel connections. Alternate materials and ratings require a separate supplier basis.</p>
        <div className="q-fields"><Input label="Column length, in" value={columnConfig.length} onChange={v=>setColumnConfig({...columnConfig,length:v})}/><Input label="Level-eye quantity" value={columnConfig.eyes} onChange={v=>setColumnConfig({...columnConfig,eyes:v})}/>
        <Input label="Column material / labor margin %" percent value={columnConfig.margin} onChange={v=>setColumnConfig({...columnConfig,margin:v})}/><label className="q-field"><span>Column finish</span><select value={columnConfig.finish} onChange={e=>setColumnConfig({...columnConfig,finish:e.target.value})}>{['Bare','Primer','Epoxy'].map(x=><option key={x}>{x}</option>)}</select></label></div>
        <div className="q-fields">{[['hlConnections','High-level connections'],['hlSwitch','High-level float switch'],['olConnections','Operating-level connections'],['olSwitch','Operating-level float switch'],['llConnections','Low-level connections'],['llSwitch','Low-level float switch'],['isolation','Isolation valves'],['drainValve','Drain valve'],['probe','Level probe'],['unions','Flanged unions']].map(([k,label])=><label className="q-checkbox" key={k}><input type="checkbox" checked={columnConfig[k]} onChange={e=>setColumnConfig({...columnConfig,[k]:e.target.checked})}/>{label}</label>)}</div>
        <button onClick={()=>{try{addRow(levelColumn(columnConfig,book.levelColumn));setMessage('Added a separately priced level-column option, including its labor and internal parts breakdown.');}catch(e){setMessage(e.message);}}}>Add level-column option</button></details>
        <details><summary>Pump package scope</summary><p>Creates adjustable cost lines for every pump, drive, accessory set and valve train, plus common panel, skid and assembly scope.</p><Input label="Total pumps, including standby" value={pumpCount} onChange={setPumpCount}/>
          <button onClick={()=>{try{const kit=pumpPackageScope(pumpCount);for(const row of kit)addRow(row);setMessage('Pump package scope added. Enter costs and installation hours and reconcile overlaps with existing vessel scope.');}catch(e){setMessage(e.message);}}}>Add pump package scope</button></details>
      </section>
    </>}
    {tab==='quote'&&<>
      <section className="q-card"><h2>Customer draft</h2><div className="q-fields">{metadataField('customer','Customer')}{metadataField('project','Project')}{metadataField('quoteNo','Quote number')}{metadataField('date','Quote date','date')}
        {metadataField('delivery','Delivery / lead time')}{metadataField('validity','Quote validity')}{metadataField('interior','Interior finish specification')}{metadataField('exterior','Exterior coating specification')}</div>
        <label className="q-field"><span>Customer-facing scope notes</span><textarea value={meta.notes} onChange={e=>setMeta({notes:e.target.value})}/></label>
        <label className="q-field"><span>RFQ / internal estimating notes</span><textarea value={meta.rfq} onChange={e=>setMeta({rfq:e.target.value})}/></label>
        <label className="q-field"><span>JWT template</span><select value={meta.template} onChange={e=>setMeta({template:e.target.value})}><option value="bare">Bare vessel</option><option value="package">Vessel package</option></select></label>
        <p>Customer exports contain selling prices and scope. Cost, margin, commission and internal RFQ notes stay in the internal budget. Quotes remain drafts for review.</p>
        <div className="q-buttons"><button disabled={!result.ready||!vessel} onClick={()=>attempt(()=>setPreview(customerHTML(spec())))}>Preview / print draft</button>
          <button disabled={!result.ready||!vessel} onClick={()=>attempt(()=>download(customerWorkbook(book.templates[meta.template],spec(),meta.template),exportName('customer-DRAFT.xlsx')))}>JWT customer draft .xlsx</button>
          <button disabled={!!result.error||!rows.length} onClick={()=>attempt(()=>download(budgetWorkbook(rows,settings,meta),exportName('INTERNAL-budget.xlsx')))}>Internal budget .xlsx</button></div>
      </section>
      <section className="q-card"><h2>Save and resume</h2><p>Save the design, rates, line edits and linked prices in a private project file. Import it to resume. Unsaved session data clears when the page reloads.</p><div className="q-buttons">
        <button onClick={()=>attempt(()=>download(saveProject(session,designContext,rows),exportName('INTERNAL-project.json'),'application/json'))}>Save quote project</button>
        <label className="q-file">Open quote project<input type="file" accept=".json" onChange={importQuote}/></label></div>
      </section>
    </>}
    </main><aside className="q-intelligence"><section className="q-card"><h2>Quote intelligence</h2><p>Live checks of scope, price age and cost drivers.</p>
      {result.error&&<p className="q-error" role="alert">{result.error}</p>}
      <h3>{result.gaps.length} pricing gaps</h3>{result.error?<p>Resolve the commercial input error to evaluate pricing gaps.</p>:result.gaps.length?<ul>{result.gaps.map(g=><li key={g.id}><button className="q-text-button" onClick={()=>{setTab('budget');setExpanded(g.id);}}>{g.description}</button><small>{g.message}</small></li>)}</ul>:<p>All included line costs and hours are entered.</p>}
      <details open><summary>Scope and engineering review</summary><ul>{advice.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <details><summary>Pricing review · {result.warnings.length}</summary><ul>{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <h3>Largest cost drivers</h3>{[...result.lines].sort((a,b)=>b.cost-a.cost).slice(0,5).map(l=><div className="q-driver" key={l.id}><span>{l.description}</span><b>{usd(l.cost)}</b><div style={{width:`${Math.max(1,100*l.cost/(result.cost||1))}%`}}/></div>)}
        {comparables.length>0&&<><h3>Historical comparables</h3><p>Similar water-service geometry only. Material and scope may differ. These are benchmarks, not current prices.</p>{comparables.map((c,i)=><p key={i}>#{c.quote} · {c.type}<br/>{c.od} × {c.oal} in · {c.pressure} psig<br/>{usd(c.price)} · {c.date}</p>)}</>}
    </section></aside></div>
    {preview&&<div className="q-preview"><div><button onClick={()=>setPreview('')}>Back to quote</button><button onClick={()=>document.getElementById('quote-preview-frame')?.contentWindow?.print()}>Print / save PDF</button><button onClick={()=>download(preview,exportName('customer-DRAFT.html'),'text/html')}>Download draft HTML</button></div>
      <iframe id="quote-preview-frame" title="Customer quote draft" srcDoc={preview} sandbox="allow-same-origin allow-modals"/></div>}
  </div>;
}
