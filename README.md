# JWT Expansion Tank Designer & Sizer v2.0

**Joe White Tank Company, Inc. — Fort Worth, Texas**  
Water expansion, buffer energy sizing, and preliminary ASME VIII-1 mechanical sizing using the prelim engine. Full vessel MAWP and fabrication release are not established by this app.

See [the prelim integration](docs/PRELIM_INTEGRATION.md) for the source revision, implemented calculations, validation and limitations. The [earlier engineering audit](docs/ENGINEERING_AUDIT.md) records the original thermal and pressure-wall corrections.

The designer enters the project pressure/temperature basis and supplier membrane acceptance. Prelim supplies temperature-dependent preliminary material curves, stock selection, radiography, MDMT, PWHT and optional vacuum screening. An alternative entered-stress mode accepts project Section II-D values. Glycol and two-phase operation are outside the water model. Unsupported or incomplete inputs block a vessel result.

## Deployment

Changes are reviewed through pull requests. Merging to `main` runs the test/build gate and the existing GitHub Pages deployment workflow. A draft pull request does not change the deployed application.

The Vite base path is `/jwt-tank-designer/`.

## Local Development

```bash
npm ci
npm run dev
```
Then open `http://localhost:5173/jwt-tank-designer/`

## Build for Production

```bash
npm run build
```
Output goes to `./dist/`

---

## Verification

```bash
npm test
```

Regression checks and production build run on pull requests. The deployment build also requires passing tests.

## Features

- **6 product lines**: HydroGuard-D, HydroGuard-FB, HydroGuard-RB, AquaShield, ChillVault, HeatVault
- **Prelim mechanical sizing**: Pipe and plate, four head types, ID/OD basis, material/product-form mapping, RT selection, approximate MDMT/PWHT and optional external-pressure screens
- **Procurement estimates**: Stock, courses, segments, pipe joints, drop, weight and estimating costs
- **Calculation JSON export** with source revision and complete results
- **Alternative entered-stress wall calculations**: Shell hoop and longitudinal checks (UG-27), ideal 2:1 head (UG-32), corroded dimensions, static head, pipe mill tolerance and forming allowance
- **IAPWS water properties** for expansion, buffer energy balance and liquid-phase validation
- **Membrane acceptance**: Actual precharge, pressure window and supplier acceptance limit
- **Buffer energy sizing**: Minimum output, coincident load, run time, control deadband and active existing volume
- **Live schematic vessel visualization** with conceptual internals, nozzles, and dimensions
- **Engineering review report** with calculated values and explicit unresolved design checks
- **Carbon Steel & Stainless Steel** material options
- **Corrosion allowance** toggle

---

*ASME U-Stamp Certified Fabricator | Fort Worth, Texas*
