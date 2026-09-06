import { sizeExpansion, sizeBuffer, designVessel } from './engineering.js';

export const DEFAULT_INPUTS = {
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
    if (!['system','tank'].includes(sizingMode)) throw new RangeError('Unknown sizing mode.');
    if (sizingMode === 'system') {
      if (product.internals === 'none') {
        sizing = sizeBuffer({sourceOutput:n('sourceOutput','minimum stable source output'),minimumLoad:n('minimumLoad'),
          runtimeMin:n('runtimeMin'),lowTemp:n('bufferLowTemp'),highTemp:n('bufferHighTemp'),
          minPressure:n('minPressure','minimum operating pressure'),existingVolume:n('existingVolume'),
          utilization:n('utilizationPercent')/100,atmosphericPsia:n('atmosphericPsia')});
      } else {
        sizing = sizeExpansion({systemVol:n('systemVol','system volume'),fillTemp:n('fillTemp','minimum fluid temperature'),
          designTemp:n('operatingTemp','maximum fluid temperature'),minPressure:n('minPressure','minimum operating pressure'),
          maxPressure:n('maxPressure','maximum operating pressure'),precharge:n('precharge','actual empty-tank precharge'),
          acceptanceLimit:n('acceptancePercent','supplier acceptance limit')/100,
          atmosphericPsia:n('atmosphericPsia'),polytropicExponent:n('gasExponent')});
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
    const vessel = designVessel(effectiveTankVol,designPressure,product,materialId,CA,{
      designTempF:n('designTemp','design metal temperature'),operatingTempF:n('operatingTemp','maximum fluid temperature'),minPressure,
      shellStress:n('shellStress','plate-shell allowable stress'),pipeStress:n('pipeStress','pipe-shell allowable stress'),headStress:n('headStress','head allowable stress'),nozzleStress:n('nozzleStress','nozzle allowable stress'),
      shellE:n('shellE'),circumferentialE:n('circumferentialE'),headE:n('headE'),headFormingLoss:n('headFormingPercent')/100,
      plateTolerance:n('plateTolerance'),codeEdition:inputs.codeEdition,stressBasis:inputs.stressBasis,
      designFlowGPM:inputs.designFlowGPM === '' ? 0 : n('designFlowGPM'),expansionFlowGPM:n('expansionFlowGPM'),
      velocityLimit:n('velocityLimit'),atmosphericPsia:n('atmosphericPsia'),supportType,
    });
    return {sizing:sizing || {kind:'direct',minTankVol:effectiveTankVol},vessel,error:null,effectiveTankVol};
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return {sizing,vessel:null,error:error.message,effectiveTankVol};
  }
}
