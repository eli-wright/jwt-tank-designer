import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('Quoting UI edits quantities/costs, toggles options, changes margins and retains the session',async()=>{
  const compiled=await build({stdin:{contents:`
    import React,{useState} from 'react';
    import TestRenderer,{act} from 'react-test-renderer';
    import {renderToStaticMarkup} from 'react-dom/server';
    import QuoteWorkbench from './src/quoting/QuoteWorkbench.jsx';
    import {newSession} from './src/quoting/project.js';
    import {seedBudget,applyOverrides} from './src/quoting/seed-budget.js';
    import {calculateQuote} from './src/quoting/quote-engine.js';
    import {DEFAULT_INPUTS,evaluateDesign} from './src/design-state.js';
    import {PRODUCTS} from './src/products.js';
    export function exercise(){
      const inputs={...DEFAULT_INPUTS,operatingTemp:180,designTemp:200,minPressure:12,maxPressure:25,reliefPressure:30,mawp:150,designFlowGPM:100};
      const product=PRODUCTS[4],vessel=evaluateDesign({product,inputs,sizingMode:'tank',tankVol:100,materialId:'CS',CA:.0625,supportType:'skirt'}).vessel;
      const initial=newSession();initial.settings.laborRate=100;
      const seeds=seedBudget(vessel,product,initial.book);
      initial.overrides=Object.fromEntries(seeds.map(r=>[r.id,{...r,unitMaterial:10,unitHours:1}]));
      let session,show;function Harness(){const [s,setS]=useState(initial),[open,setOpen]=useState(true);session=s;show=setOpen;
        return <QuoteWorkbench open={open} onClose={()=>setOpen(false)} vessel={vessel} product={product} inputs={inputs} session={s} onChange={setS} designContext={{}} onRestoreDesign={()=>{}}/>;}
      const oldDocument=globalThis.document;globalThis.document={activeElement:{focus(){}}};
      let renderer;
      const totals=()=>calculateQuote([...applyOverrides(seeds,session.overrides),...session.extras],session.settings);
      try {
        act(()=>{renderer=TestRenderer.create(<Harness/>,{createNodeMock:()=>({focus(){},addEventListener(){},removeEventListener(){}})});});
        const root=()=>renderer.root;
        const button=text=>root().findAllByType('button').find(b=>b.children.join('')===text);
        const before=totals().cost;
        act(()=>button('+ Add component').props.onClick());
        const field=label=>root().findByProps({'aria-label':label});
        act(()=>field('Unit material cost for Additional component').props.onChange({target:{value:'123'}}));
        act(()=>field('Quantity for Additional component').props.onChange({target:{value:'3'}}));
        const after=totals().cost;
        act(()=>field('Scope for Additional component').props.onChange({target:{value:'option'}}));
        const optional=totals();
        const labels=root().findAllByType('label');const material=labels.find(l=>l.findAllByType('span')[0]?.children.join('')==='Material margin %').findByType('input');
        act(()=>material.props.onChange({target:{value:'25'}}));
        const margin=session.settings.materialMargin;
        act(()=>show(false));act(()=>show(true));
        const retained=session.extras.length;
        act(()=>button('Customer & exports').props.onClick());
        const html=renderToStaticMarkup(<QuoteWorkbench open vessel={vessel} product={product} inputs={inputs} session={session} onChange={()=>{}} designContext={{}} onRestoreDesign={()=>{}} onClose={()=>{}}/>);
        return {before,after,optionalCost:optional.cost,optionSell:optional.options[0].sell,margin,retained,html,hasExports:!!button('Internal budget .xlsx')};
      } finally {if(renderer)act(()=>renderer.unmount());globalThis.document=oldDocument;}
    }`,loader:'jsx',resolveDir:fileURLToPath(new URL('../',import.meta.url))},bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},write:false,logLevel:'silent'});
  const dir=await mkdtemp(join(tmpdir(),'jwt-quote-ui-'));
  try{const path=join(dir,'test.cjs');await writeFile(path,compiled.outputFiles[0].contents);const mod=await import(pathToFileURL(path).href);const r=mod.exercise();
    assert.equal(r.after-r.before,369);assert.equal(r.optionalCost,r.before);assert.ok(r.optionSell>369);assert.equal(r.margin,.25);assert.equal(r.retained,1);assert.equal(r.hasExports,true);
    for(const text of ['Build a quote','Cost build-up','Quote intelligence','Material margin','Price sensitivity','Gross margin'])assert.ok(r.html.includes(text),text);
    assert.ok(!/NaN|undefined|Infinity/.test(r.html));
  }finally{await rm(dir,{recursive:true,force:true});}
});
