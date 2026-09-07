import React from 'react';
import { prelimSections } from './prelim-summary.js';

export function PrelimControls({inputs,update,field}) {
  const select=(key,label,options)=><label className="field" key={key}>{label}<select aria-label={label} value={inputs[key]} onChange={e=>update(key,e.target.value)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
  return <>
    <p className="status">Prelim automatically selects material stress curves and stock thicknesses. The built-in tables and code assessments are preliminary and require project-code verification.</p>
    {field('mechanicalDiameter','Mechanical diameter override','in','Leave blank to select from the required thermal volume.')}
    {select('diameterBasis','Diameter basis',[['OD','Outside diameter'],['ID','Inside diameter']])}
    {select('construction','Shell construction',[['auto','Automatic pipe / plate'],['pipe','Pipe preferred'],['plate','Rolled plate']])}
    {select('headType','Head geometry',[['ellipsoidal','2:1 ellipsoidal'],['torispherical','ASME F&D torispherical'],['hemispherical','Hemispherical'],['pipecap','B16.9 cap, supplier verification required']])}
    {select('pipeProductForm','Pipe product form',[['seamless','Seamless'],['welded','Welded / ERW']])}
    {select('headConstruction','Formed head construction',[['seamless','Seamless formed head'],['welded','Welded formed head']])}
    {select('rtMode','Radiography selection',[['auto','Automatic stock and NDE cost selection'],['manual','Specified examination with thickness rules']])}
    {select('rtEfficiency','Category A examination',[['0.7','None, E 0.70'],['0.85','Spot, E 0.85'],['1','Full, E 1.00']])}
    {select('capWeldExam','Pipe Category B examination',[['none','None'],['a5b','UW-11(a)(5)(-b) quality spot'],['spot','Spot plus qualifying quality examination'],['full','Full RT']])}
    {select('capWeldType','Pipe Category B joint type',[['type1','Type 1'],['type2','Type 2']])}
    {field('externalPressure','External design pressure','psi differential','0 disables vacuum sizing. Positive values invoke the provisional elastic screen.')}
    {field('requiredMDMT','Required MDMT','°F')}
    {select('materialCondition','Plate supply condition',[['as_rolled','As rolled'],['normalized','Normalized']])}
    {select('heatTreatment','Welding heat treatment',[['none','None elected'],['preheat','At least 200 °F weld preheat'],['pwht','PWHT elected']])}
    {field('steelPrice','Base shell-stock price','$/lb','Estimating input for stock and automatic radiography tradeoff. Confirm current vendor price.')}
    <small>JWT vessels use vertical full-water mechanical loading, including expansion tanks. Prelim may escalate examination or treatment and may substitute plate when pipe stock is unavailable. The results show the actual selection.</small>
  </>;
}
export function PrelimResults({prelim}) {
  return <>{prelimSections(prelim).map(([title,rows])=><section key={title}><h3>{title}</h3>{rows.map(([label,value])=><div className="spec-row" key={label}><span>{label}</span><b style={{whiteSpace:'pre-line'}}>{value}</b></div>)}</section>)}</>;
}
