import { PRELIM_DEFAULTS, sizeWithPrelim } from './prelim-adapter.js';
import { sizeExpansion, sizeBuffer, sizeDrawdown, designVessel, selectDiameter,
  designLiquidDensity } from './engineering.js';
import { fluidBasis } from './fluid.js';

export const DEFAULT_INPUTS = {
  ...PRELIM_DEFAULTS,
  fluidId:'water', concentrationPercent:0,
  pumpFlowGPM:'', cutInPressure:'', cutOutPressure:'', pumpRuntimeMin:1,
  systemVol:'', fillTemp:'', operatingTemp:'', designTemp:'', minPressure:'', maxPressure:'',
  mawp:'', designFlowGPM:'', precharge:'', acceptancePercent:'', reliefPressure:'',
  reliefMargin:5, atmosphericPsia:14.7, gasExponent:1, expansionFlowGPM:0,
  shellStress:'', pipeStress:'', headStress:'', nozzleStress:'', shellE:0.85, circumferentialE:0.85, headE:0.85,
  headFormingPercent:10, plateTolerance:0.01, codeEdition:'2025', stressBasis:'',
  sourceOutput:'', minimumLoad:0, runtimeMin:10, bufferLowTemp:'', bufferHighTemp:'',
  existingVolume:0, utilizationPercent:100, velocityLimit:8,
};
export function numberInput(value, label) {
  if ((typeof value === 'string' && value.trim() === '') || value === null || value === undefined || typeof value === 'boolean') throw new RangeError(`Enter ${label}.`);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`${label} must be a finite number.`);
  return n;
}

// A single state evaluator drives the on-screen numbers and the report. An
// invalid sizing input cannot fall back to a stale manually entered volume.
export function evaluateDesign({ product, inputs, sizingMode, tankVol, materialId, CA, supportType }) {
  if (!product) return { sizing:null, vessel:null, error:null, effectiveTankVol:0 };
  let sizing = null, effectiveTankVol = 0;
  const n = (key, label = key) => numberInput(inputs[key],label);
  try {
    if (!['prelim','entered'].includes(inputs.mechanicalMethod ?? 'entered')) throw new RangeError('Select a valid mechanical sizing method.');
    if (!['system','tank','drawdown'].includes(sizingMode)) throw new RangeError('Unknown sizing mode.');
    // One fluid selection drives expansion, buffer energy, static head, support
    // loads and the nozzle hydraulic screen.
    const fluid = { fluidId: inputs.fluidId ?? 'water',
      concentrationPercent: (inputs.fluidId ?? 'water') === 'water' ? 0 : n('concentrationPercent','the glycol concentration') };
    fluidBasis(fluid.fluidId, fluid.concentrationPercent);
    if (sizingMode === 'drawdown') {
      if (product.internals === 'none') throw new RangeError('Pump drawdown sizing needs a precharged membrane tank. A buffer vessel has no gas charge to draw water back out.');
      sizing = sizeDrawdown({pumpFlow:n('pumpFlowGPM','pump capacity at cut-out'),cutIn:n('cutInPressure','pressure-switch cut-in'),
        cutOut:n('cutOutPressure','pressure-switch cut-out'),runtimeMin:n('pumpRuntimeMin','minimum pump run time'),
        precharge:n('precharge','actual empty-tank precharge'),acceptanceLimit:n('acceptancePercent','supplier acceptance limit')/100,
        atmosphericPsia:n('atmosphericPsia'),polytropicExponent:n('gasExponent')});
      // The vessel pressure basis has to cover the switch settings it is sized around.
      if (n('minPressure','minimum operating pressure') > sizing.cutIn || n('maxPressure','maximum operating pressure') < sizing.cutOut)
        throw new RangeError('The pressure basis must bracket the switch settings: minimum operating pressure at or below cut-in, maximum operating pressure at or above cut-out.');
      effectiveTankVol = Math.ceil(sizing.minTankVol * 1.05);
    } else if (sizingMode === 'system') {
      if (product.internals === 'none') {
        sizing = sizeBuffer({sourceOutput:n('sourceOutput','minimum stable source output'),minimumLoad:n('minimumLoad'),
          runtimeMin:n('runtimeMin'),lowTemp:n('bufferLowTemp'),highTemp:n('bufferHighTemp'),
          minPressure:n('minPressure','minimum operating pressure'),existingVolume:n('existingVolume'),
          utilization:n('utilizationPercent')/100,atmosphericPsia:n('atmosphericPsia'),...fluid});
      } else {
        sizing = sizeExpansion({systemVol:n('systemVol','system volume'),fillTemp:n('fillTemp','minimum fluid temperature'),
          designTemp:n('operatingTemp','maximum fluid temperature'),minPressure:n('minPressure','minimum operating pressure'),
          maxPressure:n('maxPressure','maximum operating pressure'),precharge:n('precharge','actual empty-tank precharge'),
          acceptanceLimit:n('acceptancePercent','supplier acceptance limit')/100,
          atmosphericPsia:n('atmosphericPsia'),polytropicExponent:n('gasExponent'),...fluid});
      }
      effectiveTankVol = sizing.minTankVol > 0 ? Math.ceil(sizing.minTankVol * 1.05) : 0;
      if (effectiveTankVol === 0) return {sizing,vessel:null,error:null,effectiveTankVol:0};
    } else {
      effectiveTankVol = numberInput(tankVol,'required tank volume');
    }
    const designPressure = n('mawp','top design pressure'), minPressure = n('minPressure','minimum operating pressure');
    const maxPressure = n('maxPressure','maximum operating pressure'), reliefPressure = n('reliefPressure','relief set pressure');
    const margin = n('reliefMargin','margin below relief');
    if (margin <= 0) throw new RangeError('Provide a positive operating margin below relief.');
    if (minPressure > maxPressure || maxPressure + margin > reliefPressure || reliefPressure > designPressure) {
      throw new RangeError('Require minimum pressure ≤ maximum operating pressure, maximum + margin ≤ relief setting, and relief setting ≤ top design pressure. Use the tank pressure datum for all pressures.');
    }
    if (sizing?.kind === 'buffer' && n('bufferHighTemp') > n('operatingTemp')) throw new RangeError('Maximum fluid temperature must cover the upper buffer control temperature.');
    // Static head, support loads and the prelim solve all use the heaviest
    // credible fill, taken at the coldest temperature this basis actually states.
    const coldTempF = sizing?.kind === 'expansion' ? sizing.fillTemp : sizing?.kind === 'buffer' ? sizing.lowTemp : undefined;
    const liquidDensity = designLiquidDensity({...fluid,coldTempF,hotTempF:n('operatingTemp','maximum fluid temperature'),
      minPressure,atmosphericPsia:n('atmosphericPsia')});
    const prelim = inputs.mechanicalMethod === 'prelim' ? sizeWithPrelim(effectiveTankVol,designPressure,n('designTemp','design metal temperature'),materialId,CA,inputs,selectDiameter(effectiveTankVol),liquidDensity) : null;
    const vessel = designVessel(effectiveTankVol,designPressure,product,materialId,CA,{
      ...fluid,coldTempF,
      designTempF:n('designTemp','design metal temperature'),operatingTempF:n('operatingTemp','maximum fluid temperature'),minPressure,
      prelim, shellStress:prelim?.result.S ?? n('shellStress','plate-shell allowable stress'),pipeStress:prelim?.result.S ?? n('pipeStress','pipe-shell allowable stress'),headStress:prelim?.headStress ?? n('headStress','head allowable stress'),nozzleStress:prelim?.nozzleStress ?? n('nozzleStress','nozzle allowable stress'),
      shellE:prelim?.result.e_circ ?? n('shellE'),circumferentialE:prelim?.longE ?? n('circumferentialE'),headE:prelim?.headE ?? n('headE'),headFormingLoss:prelim?.headFormingLoss ?? n('headFormingPercent')/100,
      plateTolerance:prelim ? 0 : n('plateTolerance'),codeEdition:inputs.codeEdition,stressBasis:prelim?.sourceBasis ?? inputs.stressBasis,
      designFlowGPM:inputs.designFlowGPM === '' ? 0 : n('designFlowGPM'),expansionFlowGPM:n('expansionFlowGPM'),
      velocityLimit:n('velocityLimit'),atmosphericPsia:n('atmosphericPsia'),supportType,
    });
    return {sizing:sizing || {kind:'direct',minTankVol:effectiveTankVol},vessel,error:null,effectiveTankVol};
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return {sizing,vessel:null,error:error.message,effectiveTankVol};
  }
}
