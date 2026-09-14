# Heat-transfer fluids, pump drawdown and the sizing estimators

This change brings the sizing cases a commercial tank-sizing calculator covers —
HVAC expansion, domestic hot-water expansion, well-water and pressure-booster
tanks, and buffer tanks, each with a fluid selection and a system-volume
estimator — into the existing design flow rather than alongside it.

Nothing here is a second calculator. The fluid selection sits in the operating
and pressure basis and drives every downstream calculation. The system-volume
estimator writes into the same system-volume input the expansion sizing already
used. Pump drawdown is a third option on the existing thermal sizing toggle and
produces the same required-volume result that feeds the same vessel design,
schematic, report and quote.

## Fluids

| | Water | Ethylene glycol | Propylene glycol |
| --- | --- | --- | --- |
| Model | IAPWS-IF97 Region 1, unchanged | CoolProp `INCOMP::MEG` | CoolProp `INCOMP::MPG` |
| Temperature range | 32 to 450 °F | 0 to 212 °F, above the freeze point | 0 to 212 °F, above the freeze point |
| Concentration | none | above 0 to 60 mass % | above 0 to 60 mass % |

Glycol density, specific heat and dynamic viscosity are the CoolProp 7.2.0
incompressible aqueous-solution correlations (Melinder polynomials), re-expressed
in `src/fluid.js` as the same degree-5 bivariate polynomial in normalized
temperature and mass fraction. This is a change of basis rather than a fit of a
fit: the coefficients were solved against engine values and then checked against
engine values that were not in that sample. The maximum relative deviation over
the validity domain is 3.0e-13 in density, 3.0e-13 in specific heat, 2.2e-12 in
viscosity, 1.6e-11 in the expansion-factor ratio, and 2.4e-12 K on the freeze
curve. Those are double-precision rounding, so the two polynomials are the same
polynomial.

Engine identification, kept with the fixture in `test/fixtures/glycol-coolprop.json`:

- CoolProp 7.2.0, git `98b3523d5daa98454618d381d2ae53f7471d216b`
- wasm sha256 `cb77d0381fbe639bffb65a3e8fa44ff8e2a110f21c18125c89a9b336135bd194`

The incompressible model carries no pressure dependence; density and specific
heat were verified identical at 101325 Pa and 3.0 MPa. Glycol enthalpy is the
analytic integral of the same specific-heat polynomial from 273.15 K, which
reproduces the engine's own enthalpy difference to 1.4e-4 relative. Only
enthalpy differences are used. `test/fluid.test.js` re-checks every reference
point on each run, and separately verifies that a numerical integration of the
reported specific heat returns the reported enthalpy difference.

A selection of 0% glycol is rejected: uninhibited water must be selected as
water, so the IAPWS model is used rather than the solution correlation's water
endpoint. A fluid temperature below the solution freeze point is rejected and
names the freeze point.

### What the fluid selection now changes

| Calculation | Effect |
| --- | --- |
| Expansion volume | Glycol expands materially more than water over the same range, so required tank volume rises |
| Buffer energy | Glycol stores less energy per gallon, so required buffer volume rises |
| Static head on every pressure part | Uses the heaviest credible fill instead of a fixed 62.5 lb/ft³ |
| Empty and operating weights | Same fill density |
| Prelim solve | The fill density is passed through as `fluid_sg` instead of a hard-coded water value |
| Nozzle hydraulic screen | Uses the solution viscosity. 50% propylene glycol at 70 °F is about six times as viscous as water, which moves the Reynolds number and friction factor |

The water floor of 62.5 lb/ft³ on fill density is retained, so every existing
water design is numerically unchanged. This was confirmed by the regression
suite passing without amendment.

Glycol service adds an explicit outstanding requirement covering the inhibitor
package, membrane and gasket compatibility, concentration control and the actual
field concentration. Inhibitor depletion, corrosion behavior and installed
heat-transfer performance are not established here.

## Pump drawdown, for well-water and pressure-booster tanks

`sizeDrawdown` in `src/engineering.js` sizes the tank from the pump and the
pressure switch:

```
required drawdown = pump capacity x minimum run time
f(cut-in)  = 1 - (Pprecharge,abs / Pcut-in,abs)^(1/n)
f(cut-out) = min[1 - (Pprecharge,abs / Pcut-out,abs)^(1/n), supplier acceptance fraction]
Vtank      >= required drawdown / (f(cut-out) - f(cut-in))
starts/hr  = 60 x pump capacity / (4 x required drawdown)
```

The drawdown fraction is the same Boyle's-law gas compression the expansion path
already used for membrane acceptance, evaluated at the switch settings instead
of the system operating range, so the application has one gas model rather than
two. With a 40/60 psi switch and a 38 psig precharge it returns a usable fraction
of 0.258, matching the published drawdown multiplier for that setting. The
starts-per-hour figure is the worst case, which occurs when demand is half the
pump capacity; a one-minute minimum run returns the familiar 15 starts per hour.

Rejected inputs: cut-out at or below cut-in, a precharge above cut-in (the tank
would be empty before the pump restarts), a supplier acceptance limit that
leaves no drawdown, and a vessel pressure basis that does not bracket the switch
settings. Drawdown sizing is offered only for membrane products; a buffer vessel
has no gas charge and is refused with that reason.

Not evaluated: pump motor starting limits, well yield and recovery,
pressure-switch differential, and potable certification of the wetted assembly.

## System volume estimator

Expansion volume is proportional to system volume, so an assumed system volume is
the largest single error source in a tank selection. The estimator builds it from:

- **Pipe**, calculated from bore geometry as `gal/ft = pi/4 x bore^2 x 12 / 231`.
  Steel bores are derived from the B36.10 outside diameters and Schedule 40 walls
  already in `engineering-data.js`, so the application keeps one pipe dimension
  source. Copper is ASTM B88 Type L. Calculated values agree with published
  tables (NPS 1/2 steel 1.58 gal per 100 ft, NPS 2 17.4, NPS 4 66.1; 1 in Type L
  copper 0.0429 gal/ft).
- **Equipment**, entered from submittal data as quantity and gallons each.
- **A takeoff allowance**, an explicit and visible uncertainty margin.

No gallons-per-ton or gallons-per-MBH rule of thumb is applied. Equipment water
content varies by several hundred percent between equipment types, and no such
figure is established here, so the estimator asks for the submittal number
instead of inventing one.

The estimator writes a single number into the system-volume input. The sizing
calculation still has one set of inputs and one audit trail.

## Minimum output from capacity and steps

A source that unloads in equal steps holds its smallest step until the load falls
below it, and that step is what the buffer must absorb. The helper converts a
source rating and a step count into that minimum stable output and writes it into
the existing input (1 ton = 12,000 Btu/hr exactly). Unequal steps must be entered
directly as the controlling stage.

## Scope

This adds sizing cases and a fluid model. It does not change what the application
establishes about the vessel: MAWP, opening reinforcement, flange selection,
supports, relief protection and fabrication release remain outside its scope, and
the existing outstanding-check list still applies.
