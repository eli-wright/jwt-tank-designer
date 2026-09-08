import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('React renders the prelim controls, selected values, result sections and product page',async()=>{
  const out=await build({stdin:{contents:`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {PrelimControls,PrelimResults} from './src/PrelimControls.jsx';
    import App from './src/App.jsx';
    import {PRELIM_DEFAULTS,sizeWithPrelim} from './src/prelim-adapter.js';
    export function render() {
      const inputs={...PRELIM_DEFAULTS,headType:'torispherical',externalPressure:15};
      const p=sizeWithPrelim(100,150,200,'CS',.0625,inputs,{nps:24});
      const field=(key,label)=>React.createElement('label',{key},label,React.createElement('input',{value:inputs[key],readOnly:true}));
      return renderToStaticMarkup(React.createElement(React.Fragment,null,
        React.createElement(PrelimControls,{inputs,field,update:()=>{}}),
        React.createElement(PrelimResults,{prelim:p}),React.createElement(App)));
    }`,resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'jsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false});
  const dir=await mkdtemp(join(tmpdir(),'jwt-prelim-ui-'));
  try {
    const path=join(dir,'render.cjs');await writeFile(path,out.outputFiles[0].contents);
    const {render}=await import(pathToFileURL(path).href);const html=render();
    for(const label of ['Head geometry','Pipe product form','Radiography selection','Required MDMT','Welding heat treatment','Prelim sizing basis','External pressure screen','Shell procurement estimate','Select a product line']) assert.ok(html.includes(label),label);
    assert.match(html,/<option value="torispherical" selected="">/);
    assert.ok(html.includes('Provisional elastic model'));assert.ok(html.includes('supplier guarantee'));
    assert.ok(!/undefined|NaN|Infinity/.test(html));
  } finally {await rm(dir,{recursive:true,force:true});}
});
