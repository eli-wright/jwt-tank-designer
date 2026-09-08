# Dynamic vessel quoting

The **Build quote** workspace turns the current tank design into an adjustable internal budget and a customer draft. It implements the costing workflow supplied in `pressure-vessel-quoting-v3.14.zip`. The private package, customer records, vendor prices and signed templates are intentionally not committed to this public repository.

## Using the workspace

1. Complete the vessel design, then choose **Build quote**.
2. Open **Rates & catalog** and import the quoting ZIP. Import runs in the browser. The application does not upload its contents.
3. Apply a dated channel profile or enter current prices and burden. Profile ranges use the upper endpoint of the recommended rate/margin range and retain the original period date. Confirm the appropriate channel and current terms.
4. Review every base line. Enter its unit material cost and unit installation hours. Quantity multiplies both. A blank is a pricing gap. An explicit zero represents a deliberate allowance decision. Use the row's **Edit** controls for margins, extended adders, cost/sell overrides, sources, dates and confidence.
5. Add selected catalog parts, a level-column option, a pump-package scope, or custom components. Move lines between **Base**, **Option** and **Excluded**. Options are priced separately and excluded from the base total until selected.
6. Enter customer/project details, finish specifications and delivery. Export the **internal budget** and **JWT customer draft**. The template export requires the imported ZIP. The printable HTML draft remains available without templates.
7. Save the **internal quote project** to resume later. It includes design inputs, quote settings, line edits, relevant fabrication tables and linked catalog entries. It excludes unrelated customer history, unrelated catalog entries and template binaries. Re-import the ZIP to restore the templates. Reloading the browser clears unsaved session data.

## Calculation contract

For each line, before overrides:

```text
material cost = quantity × unit material × applicable steel adjustment
labor hours   = quantity × unit hours
labor cost    = labor hours × loaded burden × labor adjustment
cost          = material cost + labor cost + extended row adder
sell          = (material cost + extended row adder) / (1 - material margin)
              + labor cost / (1 - labor margin)
```

Margins are on sell. They are not markups. An extended cost override replaces the whole line cost and is sold at that line's material margin. An extended sell override replaces the whole line sell. Row-specific margins and burden take priority over global values.

Vessel/fabrication lines retain full precision until final price rounding. Catalog lines round the extended landed material cost once to cents, after quantity. The final base price adds cost contingency sold at the global material margin, applies the selected customer discount, then rounds to the chosen step/direction. Commercial nearest rounding uses half-up. An explicit unit price override takes precedence. Effective margin is calculated from the final price and estimated cost including contingency.

Order price equals final unit price multiplied by the whole-number vessel/package quantity. Optional additions use their own line sell rounded to the selected step. The base discount and contingency do not automatically apply to unselected options. Moving an option into the base recalculates the full base quote.

Commission is an internal what-if based on the **final customer unit price** divided by `1 - commission`. It never increases the actual customer price. This deliberately stays consistent with discounts, price overrides and final rounding. Some historical scripts calculate the what-if from the unrounded summary sell instead.

## Connection to prelim

- Shell stock comes from the current prelim purchase plan, including its purchased weight, courses and segments. The legacy quoting spreadsheet's pressure lookup key never selects thickness or MAWP.
- The selected shell/head material, nominal stock, head geometry, corrosion allowance, design pressure and actual design temperature remain authoritative.
- Head costs require a supplier allowance or an exact historical CS ellipsoidal-head match for a rolled shell. The small pipe-body history mixes cap purchases with formed heads and is not used to price a formed head. Inbound head freight is adjustable.
- Carbon-steel stock rates cannot silently carry into stainless estimates. Enter a rate for the currently selected material. A supplier head allowance is tied to head diameter, thickness, material and geometry.
- Imported fabrication labor rounds up to the next supported thickness and weld length. Nozzle labor uses the table floor and an available observed size/diameter-class median. Fitting selection remains explicit because a cost-table match does not establish end rating, material compatibility or reinforcement.
- A change to the design basis suspends prior design-line overrides. Review the affected lines against the new design. Custom equipment lines remain explicit estimator scope.
- Membrane assemblies, access/air-charge assemblies, supports, lifting, testing, inspection, NDE, PWHT, coatings and freight have visible scope lines. Missing prices cannot be hidden by a final selling-price override.

The pricing engine does not establish full vessel MAWP, nozzle adequacy, external-pressure adequacy, support adequacy or ASME fabrication release. Customer outputs identify the engineering basis as preliminary.

## Catalogs and assemblies

The importer supports the package's Danfoss, Hansen, Parker and Nikkiso catalog tables. Duplicate pump model records retain distinct IDs rather than overwriting different impeller configurations.

```text
landed catalog cost = source price × list multiplier × vendor markup × (1 + tariff)
```

Net prices skip the list multiplier. List prices require an entered multiplier. Unknown/consult-vendor prices remain missing. The importer does not invent Hansen/Parker buying multipliers. Required accessories are surfaced for review. Price lines stay linked to the catalog until their material cost is manually overridden.

The level-column builder ports the supplied component quantities and installation-hour calculations. It supports the reference **NPS 4 carbon steel seamless S/40** assembly, configurable length, eyes with frost shields, HL/OL/LL float connections/switches, isolation/drain valves, probe, unions and finish. It retains an internal parts breakdown and separate column margins. Switches require their matching connection pairs. Alternate materials, diameters, frost-shield selections and service ratings require a separate supplier basis.

The ZIP reader extracts only whitelisted numeric constants from the level-column reference. It never executes uploaded Python. The pump-package builder creates costing scope for each pump, drive, accessory set and valve train, plus shared panel, skid, assembly and freight. It does not perform pump duty or valve selection. The companion supplier-selection workflows named by the skill are not bundled in this repository.

## Live pricing and quote intelligence

Live intelligence consists of immediate recalculation, missing-scope checks, source/date checks, explicit exclusions, cost-driver ranking, steel/labor/margin sensitivity, saved comparison snapshots and similar historical water-service quotes. Historical comparables are filtered by vessel type, geometry and pressure. They are not current-price predictions and may have different materials and scope. RFQ text is retained as internal review context, not automatically treated as a complete bill of materials.

To receive external price changes, configure **Live price feed** with an HTTPS JSON endpoint that permits browser CORS access. No external provider or credential is configured by default. Refresh manually or enable a 15-minute interval while the workspace is open. Feed URLs are not included in saved quote projects.

```json
{
  "version": 1,
  "currency": "USD",
  "parts": [
    {
      "id": "Vendor:part-number",
      "vendor": "Vendor",
      "partNumber": "part-number",
      "description": "Selected component",
      "price": 100,
      "basis": "net",
      "asOf": "2026-09-08",
      "source": "Supplier quote reference",
      "tariff": 0
    }
  ]
}
```

IDs must match the linked catalog entry to update it. Tariff is a fraction. Every feed record requires a valid price, currency/basis, source and real calendar date. Future dates, duplicates, malformed records and oversized responses reject the update. Older records do not overwrite newer prices. Failed requests retain existing prices. Requests omit credentials, prohibit redirects, bypass browser caches and time out after 15 seconds. Imported catalog dates remain unknown when the package does not provide an unambiguous date.

## Exports and privacy

The internal XLSX contains editable inputs, auditable formulas, cached results, source/date columns, optional/excluded lines, pricing gaps and review notes. It clearly marks partial totals when costs are missing. Changing the exported spreadsheet does not update the browser project automatically.

The customer XLSX fills the actual supplied bare-vessel or package template and adds a **Scope and Review** sheet with order quantity, unit/order totals, options, exclusions and engineering status. It retains template images, terms, styles and print settings, with targeted wrapping/row-height changes for variable text. The selected quote validity replaces the template validity while retaining its shipment condition. Original customer-specific cell values, unused shared strings and old descriptive metadata are removed. Customer workbooks do not contain the internal budget or its costs, margins, commission and RFQ notes.

Template capacity limits are explicit: 11/13 nozzle rows for bare/package, three support rows, five/four options, and 14 package-component rows. Overflow blocks that workbook export with a useful message. The complete printable draft supports longer scope lists. It does not silently truncate a quote.

## Validation and judgment calls

- Automated tests cover on-sell margins, quantities, adders, overrides, optional scope, discount/contingency/rounding, commission, missing costs, price dates, ZIP/CSV input, feeds, catalog linking, mechanical changes, assemblies, project round-trips, export privacy and UI edits.
- Local parity checks against the supplied read-only Python reference passed nine level-column examples, seven package roll-ups and four vessel budgets. Private examples and prices are not committed as fixtures.
- Both real customer templates and the internal workbook were imported, inspected and rendered during implementation. Formula inspection found no Excel calculation errors. Tests cover literal dollar values, neighboring empty cells and template data removal.
- Browser interaction is exercised through React component tests and SSR. A local visual browser preview was unavailable in the implementation environment. Spreadsheet visual inspection and the production build passed.
- Judgment calls for review: dated reference profiles are estimates until confirmed, the level-column reference has a limited configuration envelope, and a current external price feed must be supplied by the operator.
- Discrepancies corrected from the reference workflow: fixed 200°F/15 psi template values, pricing-key-as-design-basis confusion, ambiguous cap/head history, material/geometry changes carrying old supplier allowances, float switches without connection pairs, and missing quantities in package scope.
