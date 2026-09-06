# Engineering calculation audit

This change corrects verified numerical and methodological defects in the original calculation paths. It does not certify a finished ASME vessel. The original application did not contain enough material, opening, weld, flange, loading or examination information to support that conclusion.

## Corrections

| Original issue | Corrected behavior |
| --- | --- |
| Water expansion table silently clamped temperature and used an undocumented container-expansion credit | IAPWS-IF97 Region 1 water density and enthalpy, Region 4 phase check, explicit temperature range, and no container or pressure-compression credit |
| Chilled-loop temperature reversal could yield zero expansion | Ordered minimum/maximum temperatures are required, including shutdown warm-up. Density maximum near 39 °F is included |
| Invalid pressures produced 999 or 9999 gallon fallback results | Invalid states block a vessel result and report |
| Factory precharge substituted for actual precharge | Actual empty-tank precharge enters the gas calculation and report |
| Diaphragm and partial bladder mechanical acceptance ignored | Supplier maximum acceptance and initial water charge limit usable acceptance |
| Buffer option only accepted direct gallons | Energy balance uses source output, coincident load, run time, control deadband, existing active volume and usable tank fraction |
| 20,000 psi applied to all materials at all temperatures | Separate designer-entered plate, seamless pipe, head and nozzle allowables at the design metal temperature, with edition and table-basis record |
| Seamless pipe and ERW material combined with E = 1 | Pipe shells explicitly specify seamless material. Separate circumferential and head efficiencies are entered |
| Pipe schedule omitted corrosion/mill tolerance, used outside radius in an inside-radius equation, and returned an inadequate heaviest schedule | Minimum delivered wall includes 12.5% mill tolerance. Corroded bore is used. Inadequate catalog selections raise an error |
| Shell radius/head diameter not increased for internal corrosion | New-condition dimensions are increased by the internal corrosion allowance |
| Only shell hoop stress considered | Both hoop and longitudinal pressure-wall requirements are evaluated |
| No liquid static head | Conservative full-water static head is iterated with geometry and applied to all components |
| Plate rounding could round down within 0.001 inch | No downward tolerance in stock-thickness selection |
| B16.9 cap pressure rating and geometry inferred from pipe schedule, with inconsistent cap volume | Both shell constructions now specify formed 2:1 ellipsoidal heads. Head geometry, pressure wall and forming allowance use one model. B16.9 caps need a separate supplier-based model |
| Unverified UG-37 weld credits, assumed coupling geometry and incorrect small-opening exemption | Removed unsupported area-replacement pass/exemption conclusions. Pipe-neck pressure screening is retained. UG-36/37/40/41, UG-45 and UW-16 remain explicit design requirements |
| Every flange assigned Class 150, including 300 psig designs | Class, material group, gasket, bolting and coincident pressure/temperature selection remain unassigned |
| Bladder access ring declared adequate without calculation, arbitrary dimensions and bolt torque | Matched supplier access assembly required. No invented dimensions or torque instructions |
| Tire-valve core described as fitting a 1/4 NPT port | Specify a complete rated valve with a compatible adapter |
| Shell-side drain presented as water-side drain for bladder tanks | Water drainage is through the system connection. No universal water drain is assigned across the membrane |
| Buffer nozzle chosen solely by tank volume and flow invented as half the tank gallons | Actual design GPM required. Pipe neck is selected against pressure wall and velocity target, up to supported NPS 12 |
| Average warm-up displacement called peak flow | Peak flow is an explicit input. Zero means unverified, without an invented minimum flow |
| Stainless roughness selected under an unused `SS` key | Both stainless material IDs select stainless roughness |
| Zero flow produced infinite friction and NaN pressure loss | Zero-flow result is finite and explicitly identified |
| Swamee-Jain described as an iterative Colebrook solver | Turbulent friction now solves Colebrook. Transitional results are identified as estimates |
| Universal entrance-plus-exit loss and fully developed heat-transfer coefficient for short nozzles | One specified vessel-port loss. No unsupported nozzle heat-transfer coefficient |
| Report always used skirt weight, product maximum temperature, factory precharge and input pressure as MAWP | Selected support, actual design/operating temperatures, actual sizing precharge and component-only pressure capacities are reported |
| Inaccurate head mass estimate | Two oblate half-spheroid surface areas at midwall, times thickness and metal density. Attachments remain estimates |
| No regression tests or locked dependencies | Node test suite, dependency lock and CI checks |

## Calculation scope

The water model is pure liquid water only, 32 to 450 °F at pressures inside IF97 Region 1. It does not model glycol, refrigerants or two-phase operation. The entire maximum-temperature state must be liquid at the specified minimum operating pressure. This is a conservative envelope requirement, not a coupled pressure/temperature transient model.

Expansion volume uses a constant minimum-pressure density envelope. Gas acceptance assumes a selected polytropic exponent from 1 to 1.4 and a supplier water-acceptance fraction referenced to nominal tank volume. The cold-volume precharge basis must match the installation. The 5% volume allowance is a sizing assumption, not an ASME requirement.

Buffer sizing computes surplus energy in Btu from Btu/hr and minutes, divides by water enthalpy change and hot-state water mass per gallon, subtracts participating existing volume, and divides by usable tank fraction. Heating and cooling inputs use positive capacity magnitudes. Zero additional volume is a valid cycling result. This calculation does not verify ride-through, storage stratification, control failure or redundancy.

Mechanical sizing addresses ideal cylindrical shells and ideal 2:1 ellipsoidal heads under internal pressure. Component capacities are referenced to the top after deducting the conservative static head. They are not vessel MAWP. Pipe and nozzle nominal walls use B36.10 dimensions, including stainless orders to those dimensions. Do not substitute an 80S wall where different.

Plate and forming deductions are explicit planning assumptions. Minimum delivered and minimum formed thicknesses must be guaranteed. Volumes exclude internal displacement and head straight flanges. Body length excludes supports/nozzles and the final installation envelope. Head corrosion geometry is the ideal 2:1 screening approximation and must be reconciled with the actual formed profile.

The retained water viscosity interpolation and nozzle transition-flow results are approximate hydraulic screening data. No hydraulic-network, gravity-drain time or short-nozzle heat-transfer performance is certified. Nozzle attachment, flange, coupling, relief and structural data are not inferred.

## Validation

Run `npm ci`, `npm test` and `npm run build` with Node 20 or later.

The suite checks all six IAPWS published verification states used by the model, an independently stated expansion benchmark, Caleffi's nominal 46-gallon buffer example with the expected variable-property correction, shell/head hand-calculation and inverse-pressure checks, corrosion/tolerance selection boundaries, flow conservation, the implicit Colebrook residual, zero-flow behavior, invalid input states, all six products with pipe/rolled geometries and three material selections, and report consistency and escaping.

Test material stresses are synthetic explicit inputs. Passing software tests does not validate Section II-D material rows or establish a Code stamp. Production bundling is checked separately. Browser visual verification was not completed because the browser connection failed during this session.

## References

- [IAPWS-IF97 release](https://iapws.org/technical-guidance/release/IF97-Rev.download), Region 1 equation (7), Tables 2 through 5, Region 4 equation (30) and Table 35. Coefficients and property relations attributed to IAPWS, whose release permits publication with attribution.
- [Watts expansion tank sizing](https://www.watts.com/resources/planning/etp), independent total-volume and acceptance-volume requirements.
- [Caleffi buffer sizing example](https://www.caleffi.com/en-us/blog/design-details-air-water-heat-pump), minimum run-time energy balance.
- [ASME VIII-1](https://www.asme.org/codes-standards/find-codes-standards/bpvc-viii-1-bpvc-section-viii-rules-construction-pressure-vessels-division-1), applicable Code scope and available edition. The adopted project edition is an input, not inferred from the current year.
- [Codeware nozzle design](https://www.codeware.com/products/compress/nozzles/), separate opening, reinforcement, neck, attachment and loading checks.
- [Codeware pipe mill tolerance](https://support.codeware.com/s/article/1761), treatment of minimum wall when pipe is entered nominally.

Licensed ASME text/tables and actual fabrication details were not supplied in the repository. Full nozzle reinforcement, flange ratings, UG-45, external pressure, MDMT/impact, fatigue, support/anchor and wind/seismic loading, relief and hydrotest verification remain outside this implemented calculation scope.
