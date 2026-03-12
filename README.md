# JWT Expansion Tank Designer & Sizer v2.0

**Joe White Tank Company, Inc. — Fort Worth, Texas**  
Professional ASME Section VIII, Division 1 engineering tool for sizing and designing expansion tanks and buffer vessels.

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
npm install
npm run dev
```
Then open `http://localhost:5173/jwt-tank-designer/`

## Build for Production

```bash
npm run build
```
Output goes to `./dist/`

---

## Features

- **6 product lines**: HydroGuard-D, HydroGuard-FB, HydroGuard-RB, AquaShield, ChillVault, HeatVault
- **ASME VIII-1 calculations**: Shell (UG-27), head (UG-32), pipe schedule selection
- **Smithsonian water volume tables** for accurate thermal expansion
- **Live SVG vessel visualization** with internals, nozzles, and dimensions
- **Engineering report generator** — full printable PDF-quality report
- **Carbon Steel & Stainless Steel** material options
- **Corrosion allowance** toggle

---

*ASME U-Stamp Certified Fabricator | Fort Worth, Texas*
