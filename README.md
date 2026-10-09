# Conduit · Interference finder

A browser-based PCSWMM conduit crossing checker with a signed-clearance report and interactive 3D viewer. Shapefiles are processed on the device; no backend or credentials are required. Fonts and libraries are bundled locally.

## Open without installing anything

Download the self-contained **[standalone/index.html](https://github.com/PLDesjardins/Interference_finder/blob/main/standalone/index.html)** file. On its GitHub file page, click **Download raw file** (the download icon at the upper right of the file). Save it with the `.html` extension, then double-click it to open in Edge, Chrome, or Firefox. It needs no Node.js, installation, server, or Internet connection after download. Import the same conduit files or choose the sample network. WebGL is required for 3D.

If your company blocks local HTML files, the same app can run as a hosted website. A GitHub Pages deployment workflow is included:

1. In this repository, open **Settings → Pages** and select **GitHub Actions** as the source.
2. Open **Actions → Publish web app → Run workflow** on `main` (or rerun the latest workflow).
3. After the deployment succeeds, open `https://pldesjardins.github.io/Interference_finder/`.

Pages must be enabled by a repository administrator. GitHub Pages availability depends on the repository visibility and GitHub plan. This URL is the deployment target; adding the workflow alone does not activate the site. For a private repository, review the Pages visibility setting before enabling it. Conduit files are still processed in the browser rather than uploaded.

## Develop locally (optional)

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).

```sh
npm ci
npm run dev
```

Open the address printed by Vite in your browser. For deployment, run `npm run build` and serve the `dist/` directory with any static web host. This is an HTML web application; serve its `dist/` build over HTTP. The separately generated `standalone/index.html` can be opened directly with `file://`.

## Use

1. Choose **Explore sample network** to try the app, or import one conduit layer as a ZIP containing matching `.shp` and `.dbf` files. You can also select the files together. Include `.prj` and `.cpg` when available. Input limit: 100 MB.
2. Map the conduit ID, upstream invert, downstream invert, and pipe height/diameter fields. The elevation mappings default to `INOFFSET` and `OUTOFFSET` when present; `US_Invert` and `DS_Invert` remain fallbacks. `Name`, `Geom1`, and `Geom2` are suggested for ID, height/diameter, and width. **Confirm the suggestions against your export**. Map the **Pipe geometry attribute** (typically `SHAPE`): each feature with `CIRCULAR` is circular and each feature with `RECT_CLOSED` is a box pipe. Height/diameter comes from the height mapping (typically `Geom1`); width comes from the width mapping (typically `Geom2`) only for boxes. A layer can contain both geometries. Circular pipes always use diameter for both dimensions and ignore the width mapping. Unsupported or blank geometry values are excluded with an explanation; they are never assumed circular.
3. Set minimum clearance and run **Analyze crossings**. Metres and invert elevations are the defaults. Advanced controls support feet, millimetre sizes, centerline elevations, wall thickness, reversed geometry, and endpoint crossings. Pipe geometry is read per conduit from the mapped attribute.
4. Filter or search the report, select a crossing to focus the 3D camera, and export the complete report to CSV. Drag to orbit, scroll to zoom, and right-drag to pan. Click the viewer to activate keyboard navigation, then hold **W** (up), **S** (down), **A** (left), **D** (right), **Q** (forward), or **E** (backward). Directions follow the current camera view. Movement stops on release or when focus leaves the viewer; typing in mapping/search fields does not move the camera. Top view, fit network, and vertical exaggeration controls are available. Crossing spheres use 30% opacity to keep the underlying pipes visible. Use the **Crossing markers** checkbox beside the vertical scale to hide or show all crossing spheres and the selection ring; the choice is retained during reanalysis and view changes. The crossing report remains available when markers are hidden. Changing engineering parameters invalidates the report until reanalysis.

## Calculation and assumptions

- Inputs must use **projected XY coordinates**, in the selected metres or feet. Geographic `.prj` files are rejected; without `.prj`, users must verify the coordinate system. Elevations must share the same vertical datum.
- The first vertex is assumed upstream. Enable reversed geometry if the exported lines run downstream → upstream.
- For each point where two different conduit centerlines cross in plan, interpolate the upstream/downstream invert linearly using cumulative XY polyline length, including bends.
- For invert elevations: inside bottom = interpolated invert; inside top = invert + pipe height. A uniform wall thickness lowers the outside bottom and raises the outside top. Centerline elevations use ± half the height instead.
- **Clearance = upper pipe outside bottom − lower pipe outside top**, in metres. Negative = clash; nonnegative but below the selected minimum = low clearance; at or above minimum = clear. A 1e-8 m numerical tolerance prevents floating-point noise from flagging exact boundaries.
- Geometry uses constant vertical heights and widths, including on sloping pipes. This is a vertical-envelope check at centerline crossings, not a full solid-intersection analysis. The 3D display uses the same envelope convention. Vertical exaggeration affects display only.
- Endpoints are excluded by default to avoid flagging intended node connections; this can be changed. Crossings at intermediate polyline vertices are deduplicated. Collinear overlaps are flagged separately and not represented as point crossings. Near misses, parallel body collisions, self-intersections, and curved or variable-section solid geometry are outside the analysis.
- Only continuous LineString conduits with finite elevations and positive dimensions are analyzed. Invalid features and multipart geometry are reported as excluded. Dimensions should describe internal size when adding wall thickness; use zero wall thickness when input sizes already describe the outside envelope.
- The export must contain **actual endpoint elevations**. SWMM node IDs and inlet/outlet offsets alone are insufficient; prepare actual invert fields before import. `INOFFSET` and `OUTOFFSET` are treated as actual endpoint elevations by this app, not automatically added to node inverts. If they contain SWMM offsets, add the corresponding node elevations before analyzing. No node-elevation lookup or terrain interpolation is performed.
- The sample network is synthetic. It has eight crossings: one clash, two low-clearance crossings, and five clear crossings at the default 0.30 m minimum.

## Validate

```sh
npm test
npm run build
npm run build:standalone
npm run test:browser
```

The twelve calculation tests exercise interpolation, signed clearance, thresholds, deduplication, endpoints, overlaps, invalid values, unit conversion, wall thickness, reversed geometry, CSV encoding, mixed circular/rectangular dimensions, and unsupported geometry values. Two additional navigation tests verify all six movement directions, camera-relative rotation, opposing keys, and consistent diagonal speed. Browser tests import generated standards-compliant SHP/DBF fixtures (zipped and loose), check expected clash results, reject geographic coordinates and missing attributes, exercise the demo/filter/focus/export/reanalysis flow, and check mobile layout.

Browser tests use `/usr/bin/chromium` when installed, otherwise Playwright's Chromium. Install the latter with `npx playwright install chromium` if needed. The 3D viewer requires WebGL; report calculations and CSV export remain usable when WebGL is unavailable.

## Maintain the downloadable version

After changing application code, run `npm run build:standalone` and commit the refreshed `standalone/index.html` along with the source. The generated file deliberately includes all JavaScript, CSS, libraries, and fonts so company users do not need a package manager or local server. GitHub Pages builds this file afresh for each deployment. Browser tests load the exact standalone HTML into an isolated document with network access disabled (the managed test browser blocks `file://` navigation). Direct local-file opening remains subject to company browser policy.
