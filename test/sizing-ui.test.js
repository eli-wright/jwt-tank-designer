import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gallonsPerFoot, PIPE_CATALOGS } from '../src/system-volume.js';

test('fluid selection, the drawdown mode and the estimators are part of the design form', async () => {
  const compiled = await build({stdin:{contents:`
    import React from 'react';
    import TestRenderer,{act} from 'react-test-renderer';
    import App from './src/App.jsx';
    import {SystemVolumeEstimator,SourceStepHelper} from './src/sizing-helpers.jsx';
    const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(' ')
      :node&&node.children?text(node.children):'';
    export function exercise(){
      const oldDocument=globalThis.document;globalThis.document={activeElement:{focus(){}}};
      let renderer;
      try{
        act(()=>{renderer=TestRenderer.create(<App/>,{createNodeMock:()=>({focus(){},addEventListener(){},removeEventListener(){}})});});
        const root=()=>renderer.root;
        const screen=()=>text(renderer.toJSON());
        const button=label=>root().findAllByType('button').find(b=>b.props.children===label);
        const products=screen();
        // HydroGuard-D, a membrane product.
        act(()=>root().findAllByProps({className:'product-card'})[0].props.onClick());
        const designForm=screen();
        const fluid=()=>root().findByProps({'aria-label':'Heat-transfer fluid'});
        const fluidOptions=fluid().props.children.map(o=>o.props.value);
        act(()=>fluid().props.onChange({target:{value:'pg'}}));
        const glycol=screen();
        act(()=>button('Pump drawdown').props.onClick());
        const drawdown=screen();
        act(()=>button('Size for system').props.onClick());
        const system=screen();
        // A buffer product must not offer drawdown sizing at all.
        act(()=>button('Products / Reset').props.onClick());
        act(()=>root().findAllByProps({className:'product-card'})[4].props.onClick());
        act(()=>button('Energy balance').props.onClick());
        const buffer=screen();
        const bufferHasDrawdown=!!button('Pump drawdown');

        // The estimators write one number back into the design basis.
        let appliedVolume=null,appliedOutput=null,est;
        act(()=>{est=TestRenderer.create(<div>
          <SystemVolumeEstimator onApply={v=>{appliedVolume=v;}}/>
          <SourceStepHelper onApply={v=>{appliedOutput=v;}}/></div>);});
        const estRoot=est.root;
        const estButton=label=>estRoot.findAllByType('button').find(b=>b.props.children===label);
        const num=(label,value)=>{const input=estRoot.findAllByType('input').find(i=>i.parent.props.children?.[0]===label);
          act(()=>input.props.onChange({target:{value}}));};
        act(()=>estRoot.findByProps({'aria-label':'Pipe size 1'}).props.onChange({target:{value:'4'}}));
        num('Feet','200');
        act(()=>estButton('Add equipment').props.onClick());
        act(()=>estRoot.findAllByProps({'aria-label':'Equipment 1 description'})[0].props.onChange({target:{value:'AHU coils'}}));
        num('Gal each','48');
        const estimatorText=text(est.toJSON());
        act(()=>estButton('Use as system volume').props.onClick());
        act(()=>{const c=estRoot.findAllByType('input').find(i=>i.parent.props.children?.[0]==='Source rating');
          c.props.onChange({target:{value:'100'}});});
        act(()=>{const s=estRoot.findAllByType('input').find(i=>i.parent.props.children?.[0]==='Equal steps');
          s.props.onChange({target:{value:'4'}});});
        act(()=>estButton('Use as minimum stable output').props.onClick());
        act(()=>est.unmount());
        return {products,designForm,fluidOptions,glycol,drawdown,system,buffer,bufferHasDrawdown,
          estimatorText,appliedVolume,appliedOutput};
      } finally {if(renderer)act(()=>renderer.unmount());globalThis.document=oldDocument;}
    }`,loader:'jsx',resolveDir:fileURLToPath(new URL('../',import.meta.url))},
    bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},write:false,logLevel:'silent'});

  const dir = await mkdtemp(join(tmpdir(), 'jwt-sizing-ui-'));
  try {
    const path = join(dir, 'test.cjs');
    await writeFile(path, compiled.outputFiles[0].contents);
    const { exercise } = await import(pathToFileURL(path).href);
    const r = exercise();

    assert.ok(r.products.includes('aqueous ethylene glycol'), 'scope note names the supported fluids');
    // The fluid lives in the existing operating basis, not in a separate calculator.
    assert.ok(r.designForm.includes('Heat-transfer fluid'));
    assert.ok(r.designForm.includes('Operating and pressure basis'));
    assert.deepEqual(r.fluidOptions, ['water', 'eg', 'pg']);
    assert.ok(!r.designForm.includes('Glycol concentration'), 'water shows no concentration field');

    assert.ok(r.glycol.includes('Glycol concentration'));
    assert.ok(r.glycol.includes('freeze point'), 'glycol shows its freeze point');
    assert.ok(r.glycol.includes('0 to 212 °F'), 'glycol states its supported range');

    for (const label of ['Pump capacity at cut-out', 'Pressure-switch cut-in', 'Pressure-switch cut-out',
      'Minimum pump run time per start', 'Actual empty-tank precharge'])
      assert.ok(r.drawdown.includes(label), label);

    assert.ok(r.system.includes('System volume estimator'), 'the estimator sits with the volume it feeds');
    assert.ok(!r.system.includes('Pressure-switch cut-in'));

    assert.ok(r.buffer.includes('Minimum output from capacity and steps'), 'buffer gets the step helper');
    assert.equal(r.bufferHasDrawdown, false, 'a buffer vessel has no gas charge to draw down');

    // 200 ft of NPS 4 Schedule 40, plus 48 gal of coils, plus the 10% allowance.
    const pipeVolume = gallonsPerFoot(PIPE_CATALOGS.steel40.bores[4]) * 200;
    assert.ok(r.estimatorText.includes(pipeVolume.toFixed(1)), r.estimatorText);
    assert.equal(r.appliedVolume, String(Number(((pipeVolume + 48) * 1.1).toFixed(2))));
    assert.equal(r.appliedOutput, '300000');  // 100 tons in four equal steps

    for (const screen of [r.products, r.designForm, r.glycol, r.drawdown, r.system, r.buffer])
      assert.ok(!/undefined|NaN|Infinity/.test(screen));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
