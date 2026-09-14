// Estimators that feed the existing sizing inputs. Each one writes a single
// number into the design basis and shows how that number was built, so the
// sizing calculation still has one set of inputs and one audit trail.
import { useState } from 'react';
import { PIPE_CATALOGS, estimateSystemVolume, minimumStepOutput, BTUH_PER_TON } from './system-volume.js';

const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'Not evaluated';
const EMPTY = 'Enter at least one pipe run or equipment volume.';

function Num({ label, value, onChange, width }) {
  return <label style={{flex:width ?? 1,minWidth:0,fontSize:10,color:'#A4A4B8'}}>{label}
    <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)}
      style={{width:'100%',background:'#16162A',border:'1px solid #383849',borderRadius:4,color:'#F0E6D3',padding:'5px 6px',fontSize:12}} /></label>;
}

// Builds system volume from pipe bore geometry plus entered equipment volumes.
export function SystemVolumeEstimator({ onApply }) {
  const [pipeRows, setPipeRows] = useState([{ catalog:'steel40', size:'2', feet:'' }]);
  const [equipmentRows, setEquipmentRows] = useState([]);
  const [allowancePercent, setAllowancePercent] = useState(10);

  let result = null, error = null;
  try {
    result = estimateSystemVolume({
      pipeRows: pipeRows.filter(r => String(r.feet).trim() !== '')
        .map(r => ({ catalog:r.catalog, size:Number(r.size), feet:Number(r.feet) })),
      equipmentRows: equipmentRows.filter(r => String(r.gallonsEach).trim() !== '' && String(r.quantity).trim() !== '')
        .map(r => ({ label:r.label, quantity:Number(r.quantity), gallonsEach:Number(r.gallonsEach) })),
      allowancePercent: Number(allowancePercent),
    });
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    error = e.message;
  }
  const setPipe = (i, patch) => setPipeRows(rows => rows.map((r, k) => k === i ? {...r, ...patch} : r));
  const setEquip = (i, patch) => setEquipmentRows(rows => rows.map((r, k) => k === i ? {...r, ...patch} : r));
  const select = { background:'#16162A',border:'1px solid #383849',borderRadius:4,color:'#F0E6D3',padding:'5px 6px',fontSize:12,width:'100%' };
  const rowStyle = { display:'flex',gap:6,alignItems:'flex-end',marginBottom:6 };
  const drop = { background:'#1A1A2A',border:'1px solid #383849',color:'#A4A4B8',borderRadius:4,padding:'5px 8px',fontSize:11 };

  return <details style={{marginBottom:14}}>
    <summary>System volume estimator</summary>
    <p style={{fontSize:11,lineHeight:1.6,color:'#8E8EA3'}}>Pipe volume is calculated from the bore. Equipment volume must come from submittal data:
      no gallons-per-ton rule of thumb is applied, because equipment water content varies too widely to assume.</p>

    {pipeRows.map((row, i) => <div key={i} style={rowStyle}>
      <label style={{flex:2.2,minWidth:0,fontSize:10,color:'#A4A4B8'}}>Pipe
        <select aria-label={`Pipe catalog ${i + 1}`} value={row.catalog} style={select}
          onChange={e => setPipe(i, { catalog:e.target.value, size:String(Object.keys(PIPE_CATALOGS[e.target.value].bores)[0]) })}>
          {Object.values(PIPE_CATALOGS).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
      <label style={{flex:1,minWidth:0,fontSize:10,color:'#A4A4B8'}}>NPS
        <select aria-label={`Pipe size ${i + 1}`} value={row.size} style={select} onChange={e => setPipe(i, { size:e.target.value })}>
          {Object.keys(PIPE_CATALOGS[row.catalog].bores).map(s => <option key={s} value={s}>{s}</option>)}
        </select></label>
      <Num label="Feet" value={row.feet} onChange={feet => setPipe(i, { feet })} />
      <button style={drop} onClick={() => setPipeRows(rows => rows.filter((_, k) => k !== i))} aria-label={`Remove pipe run ${i + 1}`}>×</button>
    </div>)}
    <button style={drop} onClick={() => setPipeRows(rows => [...rows, { catalog:'steel40', size:'2', feet:'' }])}>Add pipe run</button>

    {equipmentRows.map((row, i) => <div key={i} style={{...rowStyle, marginTop:i === 0 ? 10 : 0}}>
      <label style={{flex:2.2,minWidth:0,fontSize:10,color:'#A4A4B8'}}>Equipment
        <input value={row.label} onChange={e => setEquip(i, { label:e.target.value })} style={select} aria-label={`Equipment ${i + 1} description`} /></label>
      <Num label="Qty" value={row.quantity} onChange={quantity => setEquip(i, { quantity })} width={0.8} />
      <Num label="Gal each" value={row.gallonsEach} onChange={gallonsEach => setEquip(i, { gallonsEach })} />
      <button style={drop} onClick={() => setEquipmentRows(rows => rows.filter((_, k) => k !== i))} aria-label={`Remove equipment ${i + 1}`}>×</button>
    </div>)}
    <button style={{...drop, marginLeft:6}} onClick={() => setEquipmentRows(rows => [...rows, { label:'', quantity:'1', gallonsEach:'' }])}>Add equipment</button>

    <div style={{marginTop:10}}><Num label="Takeoff allowance (%)" value={allowancePercent} onChange={setAllowancePercent} /></div>

    <div className="notice" style={{marginTop:10}}>
      {result ? <>
        <div className="spec-row"><span>Pipe</span><b>{fmt(result.pipeVolume)} gal</b></div>
        <div className="spec-row"><span>Equipment</span><b>{fmt(result.equipmentVolume)} gal</b></div>
        <div className="spec-row"><span>Allowance</span><b>{fmt(result.allowance)} gal</b></div>
        <div className="spec-row"><span>Estimated system volume</span><b>{fmt(result.total)} gal</b></div>
        <button className="secondary" style={{marginTop:8}} onClick={() => onApply(String(Number(result.total.toFixed(2))))}>Use as system volume</button>
      </> : <span className="status">{error === EMPTY ? 'Add a pipe run or an equipment volume to estimate.' : error}</span>}
    </div>
  </details>;
}

// Converts a source rating and its unloading steps into the minimum stable
// output the buffer has to absorb.
export function SourceStepHelper({ onApply }) {
  const [capacity, setCapacity] = useState('');
  const [unit, setUnit] = useState('tons');
  const [steps, setSteps] = useState('1');

  let result = null, error = null;
  try {
    if (String(capacity).trim() === '') throw new RangeError('Enter the source rating.');
    result = minimumStepOutput({ capacity:Number(capacity), unit, steps:Number(steps) });
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    error = e.message;
  }
  return <details style={{marginBottom:14}}>
    <summary>Minimum output from capacity and steps</summary>
    <p style={{fontSize:11,lineHeight:1.6,color:'#8E8EA3'}}>A source that unloads in equal steps holds its smallest step until the load drops below it.
      That step is what the buffer must absorb. Enter the controlling stage directly instead if the steps are unequal.</p>
    <div style={{display:'flex',gap:6,alignItems:'flex-end',marginBottom:6}}>
      <Num label="Source rating" value={capacity} onChange={setCapacity} />
      <label style={{flex:1,minWidth:0,fontSize:10,color:'#A4A4B8'}}>Unit
        <select aria-label="Source capacity unit" value={unit} onChange={e => setUnit(e.target.value)}
          style={{width:'100%',background:'#16162A',border:'1px solid #383849',borderRadius:4,color:'#F0E6D3',padding:'5px 6px',fontSize:12}}>
          <option value="tons">tons</option><option value="btuh">Btu/hr</option>
        </select></label>
      <Num label="Equal steps" value={steps} onChange={setSteps} width={0.9} />
    </div>
    <div className="notice">
      {result ? <>
        <div className="spec-row"><span>Total output</span><b>{fmt(result.totalBtuh, 0)} Btu/hr</b></div>
        <div className="spec-row"><span>Minimum step</span><b>{fmt(result.stepBtuh, 0)} Btu/hr</b></div>
        <button className="secondary" style={{marginTop:8}} onClick={() => onApply(String(Number(result.stepBtuh.toFixed(2))))}>Use as minimum stable output</button>
      </> : <span className="status">{error}</span>}
    </div>
    <small style={{color:'#8E8EA3',fontSize:10}}>1 ton = {BTUH_PER_TON.toLocaleString()} Btu/hr.</small>
  </details>;
}
