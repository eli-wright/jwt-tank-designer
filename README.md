# JWT Expansion Tank Designer & Sizer v2.0

**Joe White Tank Company, Inc. — Fort Worth, Texas**  
Preliminary water expansion, buffer energy sizing, and ASME VIII-1 internal-pressure wall calculations. Full vessel MAWP and fabrication release are not established by this app.

See [the engineering audit](docs/ENGINEERING_AUDIT.md) for corrected methods, validation and remaining design requirements.

The designer must enter the project pressure/temperature basis, exact material allowable stresses from the applicable Section II-D rows, joint efficiencies, and supplier membrane acceptance. Glycol and two-phase operation are outside the water model. Unsupported or incomplete inputs block a vessel result.

## Live App

Once deployed: `https://YOUR-USERNAME.github.io/jwt-tank-designer/`

---

## Deploy to GitHub Pages (5 steps)

### Step 1 — Create a GitHub repository
1. Go to [github.com/new](https://github.com/new)
2. Name it exactly: `jwt-tank-designer`
3. Set to **Public** (required for free GitHub Pages)
4. Click **Create repository** (do NOT add README/gitignore — the repo must be empty)

### Step 2 — Update the base URL
Open `vite.config.js` and confirm the `base` matches your repo name:
```js
base: '/jwt-tank-designer/',
```
If you named your repo something different, change it here.

### Step 3 — Push the code
Open a terminal in this folder and run:
```bash
git init
git add .
git commit -m "Initial commit: JWT Tank Designer v2.0"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/jwt-tank-designer.git
git push -u origin main
```
Replace `YOUR-USERNAME` with your actual GitHub username.

### Step 4 — Enable GitHub Pages
1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Save

### Step 5 — Watch it deploy
1. Click the **Actions** tab in your repository
2. You'll see the "Deploy to GitHub Pages" workflow running
3. Once it shows a green checkmark, your app is live at:  
   `https://YOUR-USERNAME.github.io/jwt-tank-designer/`

---

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
- **Internal-pressure wall calculations**: Shell hoop and longitudinal checks (UG-27), ideal 2:1 head (UG-32), corroded dimensions, static head, pipe mill tolerance and forming allowance
- **IAPWS water properties** for expansion, buffer energy balance and liquid-phase validation
- **Membrane acceptance**: Actual precharge, pressure window and supplier acceptance limit
- **Buffer energy sizing**: Minimum output, coincident load, run time, control deadband and active existing volume
- **Live schematic vessel visualization** with conceptual internals, nozzles, and dimensions
- **Engineering review report** with calculated values and explicit unresolved design checks
- **Carbon Steel & Stainless Steel** material options
- **Corrosion allowance** toggle

---

*ASME U-Stamp Certified Fabricator | Fort Worth, Texas*
