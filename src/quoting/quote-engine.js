// Pricing is independent of pressure design. Rates and customer records are
// supplied at runtime, never embedded in the public application.
export const DEFAULT_QUOTE = {
  quantity:1,laborRate:'',materialMargin:0.18,laborMargin:0.18,commission:0,
  rounding:5,roundMode:'nearest',contingency:0,discount:0,priceOverride:'',
  steelChange:0,laborChange:0,staleDays:60,
};
export const number = (value,label,min=0,max=1e12) => {
  if(value==null || typeof value==='boolean' || (typeof value==='string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value)<min || Number(value)>max)
    throw new RangeError(`${label} must be a number from ${min} to ${max}.`);
  return Number(value);
};
export const optional = v => v==null || (typeof v==='string'&&!v.trim());
export function roundPrice(value,step=5,mode='nearest') {
  number(value,'Price');number(step,'Rounding step',0.01,100000);
  if(!['nearest','down','up'].includes(mode)) throw new RangeError('Unknown rounding mode.');
  // Python/Excel history ties are uncommon. Use explicit commercial half-up.
  return Math.round((mode==='down'?Math.floor(value/step):mode==='up'?Math.ceil(value/step):Math.floor(value/step+0.5))*step*100)/100;
}
export function catalogCost(part,multiplier,markup=1,tariff=part?.tariff ?? 0) {
  if(!part) throw new RangeError('Catalog part was not found.');
  const price=number(part.price,'Catalog price');
  const basis=part.basis;
  if(!['net','list'].includes(basis)) throw new RangeError('Catalog price must identify list or net basis.');
  const mult=basis==='net'?1:number(multiplier,'Confirmed list multiplier',0,5);
  return price*mult*number(markup,'Vendor markup',0,5)*(1+number(tariff,'Tariff',0,2));
}
export function ageDays(asOf,today=new Date().toISOString().slice(0,10)) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf??'')) return null;
  const d=Date.parse(asOf),now=Date.parse(today);
  return Number.isFinite(d)&&Number.isFinite(now)&&new Date(d).toISOString().slice(0,10)===asOf?Math.floor((now-d)/86400000):null;
}
export function priceLine(row,settings) {
  const s={...DEFAULT_QUOTE,...settings};
  const qty=number(row.qty,'Line quantity',0,1e6);
  const mm=number(row.materialMargin??s.materialMargin,'Material margin',0,.95);
  const lm=number(row.laborMargin??s.laborMargin,'Labor margin',0,.95);
  const material=number(row.unitMaterial,'Unit material cost')*qty;
  const hours=number(row.unitHours,'Unit labor hours',0,1e6)*qty;
  const rate=hours===0?0:number(row.laborRate??s.laborRate,'Loaded labor rate',0,10000);
  const extendedMaterial=material*(1+(row.escalateSteel?number(s.steelChange,'Steel adjustment',-.9,10):0));
  const materialCost=row.roundMaterial?Math.round((extendedMaterial+Number.EPSILON)*100)/100:extendedMaterial;
  const laborCost=hours*rate*(1+number(s.laborChange,'Labor adjustment',-.9,10));
  const adderCost=number(row.adderCost??0,'Extended row adder');
  const cost=optional(row.costOverride)?materialCost+laborCost+adderCost:number(row.costOverride,'Extended cost override');
  const computedSell=optional(row.costOverride)?(materialCost+adderCost)/(1-mm)+laborCost/(1-lm):cost/(1-mm);
  const sell=optional(row.sellOverride)?computedSell:number(row.sellOverride,'Extended sell override');
  return {...row,qty,materialCost,laborCost,hours,adderCost,cost,sell,margin:sell?1-cost/sell:0,mm,lm,rate};
}
export function calculateQuote(rows,settings={},today) {
  const s={...DEFAULT_QUOTE,...settings};
  try {
    const quantity=number(s.quantity,'Vessel quantity',1,10000);
    if(!Number.isInteger(quantity)) throw new RangeError('Vessel quantity must be a whole number.');
    number(s.materialMargin,'Material margin',0,.95);number(s.laborMargin,'Labor margin',0,.95);
    number(s.steelChange,'Steel adjustment',-.9,10);number(s.laborChange,'Labor adjustment',-.9,10);
    const commission=number(s.commission,'Commission',0,.95),contingency=number(s.contingency,'Contingency',0,2);
    const discount=number(s.discount,'Discount',0,.95),staleDays=number(s.staleDays,'Stale-price threshold',1,3650);
    const lines=[],gaps=[],warnings=[],options=[];
    const ids=new Set();
    for(const row of rows) {
      if(!row.id || ids.has(row.id)) throw new RangeError('Quote line IDs must be unique.');ids.add(row.id);
      if(!['base','option','excluded'].includes(row.scope)) throw new RangeError('Invalid quote scope.');
      if(row.scope==='excluded') continue;
      let line;
      try {line=priceLine(row,s);} catch(e) {
        if(!(e instanceof RangeError)) throw e;
        gaps.push({id:row.id,description:row.description,scope:row.scope,message:e.message});continue;
      }
      (row.scope==='option'?options:lines).push(line);
      const age=ageDays(row.asOf,today);
      if(line.cost>0 && (age==null || age>staleDays || age<0)) warnings.push(`${row.description}: ${age==null?'price date unknown':age<0?'price is future-dated':`price is ${age} days old`}.`);
      if(line.cost>0 && row.confidence!=='confirmed') warnings.push(`${row.description}: ${row.confidence||'unverified'} allowance.`);
      if(line.sell<line.cost) warnings.push(`${row.description}: selling below cost.`);
      if(row.notice) warnings.push(`${row.description}: ${row.notice}`);
    }
    const sum=k=>lines.reduce((a,l)=>a+l[k],0);
    const cost=sum('cost'),rawSell=sum('sell'),allowance=cost*contingency;
    const contingencySell=allowance/(1-number(s.materialMargin,'Material margin',0,.95));
    const unrounded=(rawSell+contingencySell)*(1-discount);
    const quotePrice=optional(s.priceOverride)?roundPrice(unrounded,s.rounding,s.roundMode):number(s.priceOverride,'Unit quote price override');
    const totalCost=cost+allowance,profit=quotePrice-totalCost;
    if(quotePrice<totalCost) warnings.push('The customer unit price is below estimated cost.');
    if(!optional(s.priceOverride)) warnings.push('Customer unit price is manually overridden. Effective margin reflects this price.');
    const ready=lines.length>0 && quotePrice>0 && !gaps.some(g=>g.scope==='base');
    const otherCost=lines.filter(l=>l.category==='Other').reduce((a,l)=>a+l.materialCost,0);
    return {settings:s,lines,options,gaps,warnings:[...new Set(warnings)],quantity,materialCost:sum('materialCost')-otherCost,laborCost:sum('laborCost'),
      otherCost,adderCost:sum('adderCost'),hours:sum('hours'),
      cost,totalCost,allowance,rawSell,unrounded,quotePrice,orderPrice:quotePrice*quantity,profit,margin:quotePrice?profit/quotePrice:0,
      commissionPrice:quotePrice/(1-commission),commissionDollars:quotePrice/(1-commission)-quotePrice,
      ready,error:null};
  } catch(e) {if(!(e instanceof RangeError)) throw e;return {error:e.message,ready:false,lines:[],options:[],gaps:[],warnings:[]};}
}
export function scenarioComparison(rows,settings) {
  settings={...DEFAULT_QUOTE,...settings};
  return [['Calculated baseline',{}],['Steel +10%',{steelChange:Number(settings.steelChange||0)+.1}],['Labor +10%',{laborChange:Number(settings.laborChange||0)+.1}],
    ['Global margins +2 points',{materialMargin:Math.min(.95,Number(settings.materialMargin)+.02),laborMargin:Math.min(.95,Number(settings.laborMargin)+.02)}]]
    .map(([name,changes])=>({name,result:calculateQuote(rows,{...settings,...changes,priceOverride:''})}));
}
