# Conduit · Interference finder

A browser-based PCSWMM conduit crossing checker with a signed-clearance report and interactive 3D viewer. Shapefiles are processed on the device; no backend or credentials are required. Fonts and libraries are bundled locally.

## Run

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).

```sh
npm ci
npm run dev
```

Open the address printed by Vite in your browser. For deployment, run `npm run build` and serve the `dist/` directory with any static web host. This is an HTML web application; serve it over HTTP instead of opening `index.html` directly with `file://`.

## Use

1. Choose **Explore sample network** to try the app, or import one conduit layer as a ZIP containing matching `.shp` and `.dbf` files. You can also select the files together. Include `.prj` and `.cpg` when available. Input limit: 100 MB.
2. Map the conduit ID, upstream invert, downstream invert, and pipe height/diameter fields. Common `Name`, `US_Invert`, `DS_Invert`, and `Geom1` fields are automatically suggested. **Confirm the suggestions against your export**. A width field is optional for elliptical or rectangular sections.
3. Set minimum clearance and run **Analyze crossings**. Metres and invert elevations are the defaults. Advanced controls support feet, millimetre sizes, centerline elevations, wall thickness, rectangular sections, reversed geometry, and endpoint crossings.
4. Filter or search the report, select a crossing to focus the 3D camera, and export the complete report to CSV. Drag to orbit, scroll to zoom, and right-drag to pan. Top view, fit network, and vertical exaggeration controls are available. Changing engineering parameters invalidates the report until reanalysis.

## Calculation and assumptions

- Inputs must use **projected XY coordinates**, in the selected metres or feet. Geographic `.prj` files are rejected; without `.prj`, users must verify the coordinate system. Elevations must share the same vertical datum.
- The first vertex is assumed upstream. Enable reversed geometry if the exported lines run downstream → upstream.
- For each point where two different conduit centerlines cross in plan, interpolate the upstream/downstream invert linearly using cumulative XY polyline length, including bends.
- For invert elevations: inside bottom = interpolated invert; inside top = invert + pipe height. A uniform wall thickness lowers the outside bottom and raises the outside top. Centerline elevations use ± half the height instead.
- **Clearance = upper pipe outside bottom − lower pipe outside top**, in metres. Negative = clash; nonnegative but below the selected minimum = low clearance; at or above minimum = clear. A 1e-8 m numerical tolerance prevents floating-point noise from flagging exact boundaries.
- Geometry uses constant vertical heights and widths, including on sloping pipes. This is a vertical-envelope check at centerline crossings, not a full solid-intersection analysis. The 3D display uses the same envelope convention. Vertical exaggeration affects display only.
- Endpoints are excluded by default to avoid flagging intended node connections; this can be changed. Crossings at intermediate polyline vertices are deduplicated. Collinear overlaps are flagged separately and not represented as point crossings. Near misses, parallel body collisions, self-intersections, and curved or variable-section solid geometry are outside the analysis.
- Only continuous LineString conduits with finite elevations and positive dimensions are analyzed. Invalid features and multipart geometry are reported as excluded. Dimensions should describe internal size when adding wall thickness; use zero wall thickness when input sizes already describe the outside envelope.
- The export must contain **actual endpoint elevations**. SWMM node IDs and inlet/outlet offsets alone are insufficient; prepare actual invert fields before import. No node-elevation lookup or terrain interpolation is performed.
- The sample network is synthetic. It has eight crossings: one clash, two low-clearance crossings, and five clear crossings at the default 0.30 m minimum.

## Validate

```sh
npm test
npm run build
npm run test:browser
```

The nine calculation tests exercise interpolation, signed clearance, thresholds, deduplication, endpoints, overlaps, invalid values, unit conversion, wall thickness, reversed geometry, and CSV encoding. Browser tests import generated standards-compliant SHP/DBF fixtures (zipped and loose), check expected clash results, reject geographic coordinates and missing attributes, exercise the demo/filter/focus/export/reanalysis flow, and check mobile layout.

Browser tests use `/usr/bin/chromium` when installed, otherwise Playwright's Chromium. Install the latter with `npx playwright install chromium` if needed. The 3D viewer requires WebGL; report calculations and CSV export remain usable when WebGL is unavailable.
