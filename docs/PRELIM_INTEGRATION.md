# Prelim ASME sizing integration

JWT now uses the sizing and code-assessment modules from Eli's `prelim` repository as its default mechanical method. Expansion and buffer thermal sizing feed their selected volume directly into the mechanical engine. The original entered-stress pressure-wall method remains selectable.

## Source

- Repository: https://github.com/eli-wright/prelim
- Pinned commit: `60df2ff88bbe40e8f33d0dd4bfbd732ea501ec08`
- `src/prelim/engine.js` is byte-identical to upstream `assets/engine.js`, Git blob `db5241006cd9ec23bf430bd37e4155495058f40e`.
- `src/prelim/assessment.js` is byte-identical to upstream `assets/assessment.js`, Git blob `584795d4441aba365e772a9655317147bdd17cb4`.
- Both the default/main tree and `hero-redesign` tree were inspected. Neither contains a `SKILL.md` or agent instructions. The implemented source is the repository's calculation engine and assessment workflow, rather than a separate installable skill.

These files were incorporated at the repository owner's request. Future synchronization should review upstream changes, update the pinned hashes and regenerate Python reference fixtures before changing the revision.

## Implemented behavior

| Source capability | JWT integration |
| --- | --- |
| UG-27 pressure-shell sizing | Default mechanical solver, including corrosion and pipe mill tolerance |
| Material stress and modulus curves | Temperature-dependent CS, 304L and 316L product-form mapping, with source basis in reports |
| Pipe and rolled-plate construction | Automatic selection or explicit preference, with visible fallback and final material specification |
| Seamless and welded pipe | Separate product weld factor and vessel joint quality factor |
| Heads | Ellipsoidal, hemispherical, ASME F&D and supplier-verified B16.9 cap option |
| ID and OD basis | Optional diameter override and automatic length sizing to meet thermal volume |
| Static head | Separate shell and head elevations, vertical full-water loading at 62.5 lb/ft³ |
| Internal pressure capacity | Component-only top capacities, with an independent longitudinal shell check |
| External pressure | Optional 0–15 psi differential screen and unsupported-length result, retaining provisional status |
| Radiography | Manual selection with thickness-rule enforcement, or automatic stock/NDE tradeoff |
| Category B joints | Pipe joint Type 1/2 and none, quality spot, spot or full examination |
| MDMT | Required-temperature input, approximate UCS/UHA screening and applied treatment assumptions |
| Heat treatment | As-rolled/normalized supply, preheat/PWHT options and source escalation rules |
| Reduced-pressure rating | Source 35%-pressure cold-service case, explicitly conditional on its treatment assumptions |
| Procurement | Plate courses/segments, pipe joints, stock, blanks, drop, purchased weight and estimating costs |
| Output | Shared on-screen/report sections and JSON export containing inputs, thermal results, mechanical results and source revision |

JWT products remain vertical water vessels. Horizontal arrangements, other fluid specific gravities and partially filled mechanical load cases are supported internally by the imported engine but are not selected by this product workflow. The original prelim three.js presentation is not copied into JWT. JWT's existing product schematic uses the resulting dimensions and identifies the selected head type.

## Integration corrections and bounds

1. Volume is checked after each complete sizing pass. Increasing shell length recalculates wall, bore, static head and RT selection. The loop rounds length upward and refuses nonconvergence or a length above 960 in. It cannot substitute a stale manually entered tank volume when thermal inputs are invalid.
2. Automatic formed-head selections respect prelim's 12 in minimum forming diameter. A small automatic vessel can therefore exceed the requested volume. Explicit unbuildable geometry produces an error.
3. Prelim's raw head capacity uses nominal available wall. JWT instead reports capacity at the required guaranteed minimum after forming, or at the tolerance-reduced product wall for caps. It also back-checks ID-basis heads against the actual selected shell OD. Nominal source capacity is retained separately with its conditional basis.
4. Shell top capacity is the lower of the source hoop result and an independent longitudinal-stress inverse check, less shell static head. Plate Category B efficiency follows the source Type 2 examination designation. Pipe Category B efficiency follows the actual selected joint type and examination.
5. Source plate results assume the nominal wall is available. Reports explicitly require that delivered minimum. They do not claim that the old manual-mode plate deduction was applied by prelim.
6. Nozzle necks retain JWT's flow and pressure screening. Their material/stress mapping now uses the matching prelim seamless pipe family. Nozzle reinforcement, flange ratings or attachment weld adequacy are not inferred from shell sizing.
7. All enum and numeric inputs are validated before the source engine is called. Hidden entered-stress fields cannot block prelim mode. Invalid results clear the vessel and disable the report.
8. Built-in source price rates and July 2026 alloy surcharge constants are estimates. They are labeled with that basis and are not represented as current vendor quotations. The source reduced-pressure MDMT case is not a released dual rating.

## Verification

- 214 Node tests pass, including the original 70 thermal/pressure tests.
- 36 product/material/volume integration cases cover all six JWT product lines, three material families and pipe/plate size ranges.
- 96 additional combinations exercise three materials, four head types, pipe/plate preference, ID/OD basis and 0/15 psi external pressure.
- Twelve numerical and assessment fixtures generated from the pinned Python source match JavaScript within the recorded tolerances. The fixtures contain complete inputs and checked outputs in `test/fixtures/prelim-python.json`.
- The source repository's Python test suite passes 142/142 on the pinned revision.
- Imported file hashes are tested against the upstream Git blob hashes.
- React server rendering checks the controls, selected head, assessment sections and product page. Report tests check escaping, actual values, assumptions and removal of inapplicable old equations.
- Production Vite build and whitespace checks pass.
- Interactive browser QA could not be completed. The connected browser blocks the local preview URL with `net::ERR_BLOCKED_BY_CLIENT`. Server rendering and build checks do not replace browser interaction or visual QA.

## Engineering status

The upstream engine explicitly describes its material data, UCS-66 screening and external-pressure treatment as preliminary or approximate. Importing those modules does not upgrade their verification status. In particular, source MDMT screening uses nominal source thicknesses and simplified exemptions. JWT presents potential exemption results with their assumptions, not an unconditional impact-test waiver.

Exact project-edition material rows and notes, manufactured dimensions, cap ratings, guaranteed formed thickness, MDMT/exemption conditions and vacuum chart results still require engineering verification. UG-36/37/40/41 openings, UG-45 necks, UW-16 attachments, end fittings, cyclic and structural loads, supports, relief and hydrotest are not fully analyzed by either application. Fabrication release remains false.

ASME's [BPVC resource page](https://www.asme.org/codes-standards/bpvc-standards) identifies separate code editions, stress tables, errata and interpretations. Its [certification program scope](https://www.asme.org/certification-accreditation/boiler-and-pressure-vessel-certification) includes design, fabrication, assembly and inspection. A preliminary sizing result is only part of that scope.
