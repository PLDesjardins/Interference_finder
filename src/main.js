import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import './style.css';
import { makePipes, analyze, csv, units, pipeShape } from './analysis.js';
import { readConduits } from './import.js';
import { demo } from './demo.js';
import { createViewer } from './viewer.js';
const icons = {
 pipes: '<path d="M5 3v7a4 4 0 0 0 4 4h6v7M10 3v5a1 1 0 0 0 1 1h4a5 5 0 0 1 5 5v7M3 3h9M13 21h9"/>',
 upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
 arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
 download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-10 12 10 6 10-6M2 12l10 6 10-6"/>',
 check: '<path d="m5 12 4 4L19 6"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.layers}</svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let features = [], pipes = [], crossings = [], overlaps = [], selected = null, layerName = '', projection = '', analyzedSettings;
document.querySelector('#app').innerHTML = `
<aside class="sidebar">
  <a class="brand" href="./">${icon('pipes', 29)}<span>conduit<span class="brand-dot">.</span></span></a>
  <div class="workspace-label">ENGINEERING WORKSPACE</div>
  <div class="nav-item active">${icon('layers')}<span>Interference finder</span><span class="nav-dot"></span></div>
  <div class="side-note">A clearer view of<br>what’s below the surface.</div>
  <div class="sidebar-bottom"><span class="avatar">IF</span><div>Conduit workspace<small>Local · private by design</small></div></div>
</aside>
<div class="shell">
<header><div class="breadcrumbs">Workspace ${icon('chevron', 13)} <span>Interference finder</span></div><div class="local-badge"><i></i> Runs in your browser</div></header>
<main>
  <div class="page-heading"><div><div class="eyebrow">CONDUIT COORDINATION</div><h1>See the crossing. Know the clearance.</h1><p>Find conflicts in your pipe network before they become problems on site.</p></div><button id="demo" class="button secondary">Explore sample network ${icon('arrow', 16)}</button></div>
  <div class="workflow"><span class="step active"><b>1</b> Import conduits</span><span class="step-line"></span><span class="step" id="step2"><b>2</b> Map attributes</span><span class="step-line"></span><span class="step" id="step3"><b>3</b> Review crossings</span><span class="workflow-note">PCSWMM compatible</span></div>
  <div class="workspace-grid">
    <section class="card setup-panel">
      <div class="card-heading"><div><h2>Network setup</h2><p>Your data, your design parameters.</p></div><span class="section-number">01</span></div>
      <label class="dropzone" id="dropzone" for="file-input" tabindex="0"><span class="upload-icon">${icon('upload', 23)}</span><strong id="file-title">Drop your conduit shapefile</strong><span id="file-subtitle">or <u>browse files</u> to get started</span><small>ZIP or SHP + DBF · up to 100 MB</small></label>
      <input type="file" id="file-input" accept=".zip,.shp,.dbf,.prj,.shx,.cpg" multiple hidden>
      <div id="upload-status" role="status" class="upload-status"></div>
      <div class="panel-divider"></div>
      <div class="subheading"><h3>Attribute mapping</h3><span id="field-count">No layer loaded</span></div>
      <div class="form-grid">
        <label class="full">Conduit ID<select id="map-id" disabled><option>Choose a field</option></select></label>
        <label>Upstream invert<select id="map-up" disabled><option>Choose a field</option></select></label>
        <label>Downstream invert<select id="map-down" disabled><option>Choose a field</option></select></label>
        <label class="full">Pipe geometry attribute<select id="map-shape" disabled><option value="">Choose a field</option></select></label>
        <p id="geometry-info" class="help full" style="margin:0">CIRCULAR → circular · RECT_CLOSED → box pipe</p>
        <label id="height-label" class="full"><span id="height-caption">Pipe diameter</span><select id="map-height" disabled><option>Choose a field</option></select></label>
        <label id="width-label" hidden>Pipe width <span class="optional">box pipes only</span><select id="map-width" disabled><option value="">Choose a field</option></select></label>
      </div>
      <details class="advanced"><summary>Geometry & units <span>Metres · inverts</span></summary><div class="form-grid">
        <label>XY units<select id="xy-unit"><option value="m">Metres</option><option value="ft">Feet</option></select></label>
        <label>Elevation units<select id="z-unit"><option value="m">Metres</option><option value="ft">Feet</option></select></label>
        <label>Pipe size units<select id="size-unit"><option value="m">Metres</option><option value="mm">Millimetres</option><option value="ft">Feet</option></select></label>
        <label>Elevation reference<select id="reference"><option value="invert">Invert (inside bottom)</option><option value="center">Centerline</option></select></label>
        <label>Wall thickness (m)<input id="wall" type="number" min="0" step="0.001" value="0"></label>
        <label class="checkbox full"><input id="reverse" type="checkbox"> Geometry runs downstream → upstream</label>
        <label class="checkbox full"><input id="endpoints" type="checkbox"> Include conduit endpoint crossings</label>
      </div><p class="help">Use projected XY coordinates. Geometry is assumed to run upstream → downstream. Wall thickness expands the inside dimensions to the outside envelope.</p></details>
      <div class="threshold"><label for="minimum">Minimum clearance <small>Flag crossings below your design standard</small></label><div class="unit-input"><input id="minimum" type="number" min="0" step="0.05" value="0.30"><span>m</span></div></div>
      <button id="analyze" class="button primary" disabled>${icon('layers', 17)} Analyze crossings ${icon('arrow', 17)}</button>
      <p class="privacy-note">${icon('check', 13)} Files stay on your device. No upload required.</p>
      <div id="issues" class="issues" role="status"></div>
    </section>
    <div class="review-panel">
      <section class="card viewer-card"><div class="viewer-header"><div><span class="live-dot"></span><h2>3D network viewer</h2><span id="viewer-count">No conduits loaded</span></div><div class="viewer-actions"><button id="top" title="Top view" aria-label="Top view">${icon('layers', 16)}</button><button id="fit" title="Fit network" aria-label="Fit network">${icon('fit', 16)}</button></div></div>
      <div class="viewer-body"><div id="viewer"></div><div class="viewer-empty" id="viewer-empty"><span>${icon('pipes', 44)}</span><h3>Your network, in perspective.</h3><p>Import a conduit layer or explore the sample<br>to see your pipes and crossings in 3D.</p><button id="demo-viewer">Load sample network ${icon('arrow', 15)}</button></div>
      <div class="viewer-legend"><span><i class="legend-dot blue"></i> Conduits</span><span><i class="legend-dot clash"></i> Clash</span><span><i class="legend-dot review"></i> Low clearance</span><span><i class="legend-dot clear"></i> Clear</span></div><div class="viewer-scale"><label for="exaggeration">Vertical scale</label><select id="exaggeration"><option value="1">1× actual</option><option value="3">3×</option><option value="5">5×</option><option value="10">10×</option></select><label class="marker-toggle"><input id="show-markers" type="checkbox" checked> Crossing markers</label></div><div class="viewer-hint">Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag to pan</div><div class="axis"><span class="axis-z">Z ↑</span><span class="axis-y">Y ↗</span><span class="axis-x">X →</span></div></div></section>
      <div class="stats"><div class="stat"><span>Total crossings</span><strong id="total">—</strong><small>Unique intersection points</small></div><div class="stat"><span><i class="legend-dot clash"></i> Clashes</span><strong id="clash-total">—</strong><small>Pipe envelopes overlap</small></div><div class="stat"><span><i class="legend-dot review"></i> Low clearance</span><strong id="review-total">—</strong><small>Below minimum clearance</small></div><div class="stat"><span><i class="legend-dot clear"></i> Clear</span><strong id="clear-total">—</strong><small>Meets your design standard</small></div></div>
    </div>
  </div>
  <section class="card results-card"><div class="results-heading"><div><h2>Crossing report <span id="report-count" class="count-badge">0</span></h2><p>Every intersection. Every elevation. One clear picture.</p></div><button id="export" class="button secondary" disabled>${icon('download', 16)} Export CSV</button></div><div class="table-toolbar"><div class="tabs" role="group" aria-label="Filter crossing status"><button class="tab active" data-filter="all">All crossings</button><button class="tab" data-filter="clash">Clashes</button><button class="tab" data-filter="review">Low clearance</button><button class="tab" data-filter="clear">Clear</button></div><label class="search">${icon('search', 15)}<input id="search" placeholder="Search conduit ID…" aria-label="Search conduit ID"></label></div>
  <div class="table-wrap"><table><thead><tr><th>Crossing</th><th>Conduit pair</th><th>Location <span id="location-unit">(m)</span></th><th>Pipe A · bottom / top <small>(m)</small></th><th>Pipe B · bottom / top <small>(m)</small></th><th>Clearance <small>(m)</small></th><th>Status</th><th></th></tr></thead><tbody id="results"></tbody></table><div id="table-empty" class="table-empty">${icon('layers', 27)}<strong>Your crossing report will appear here</strong><span>Load your network and run an analysis to get started.</span></div></div>
  <div id="crossing-detail" hidden></div><div class="report-footer">${icon('info', 14)}<span>Clearance = upper pipe bottom − lower pipe top. Negative values indicate overlap. Select a crossing to inspect it in 3D.</span></div></section>
  <footer><span>Built for the details that matter.</span><span>CONDUIT <b>/</b> INTERFERENCE FINDER</span></footer>
</main></div><div id="toast" role="status"></div>`;
const $ = id => document.getElementById(id);
const viewer = createViewer($('viewer'), selectCrossing);
let filter = 'all';
function settings() {
  return { xyUnit: $('xy-unit').value, zUnit: $('z-unit').value, sizeUnit: $('size-unit').value, reference: $('reference').value, wall: Number($('wall').value), reverse: $('reverse').checked, endpoints: $('endpoints').checked, minimum: Number($('minimum').value) };
}
function mapping() { return Object.fromEntries(['id','up','down','shape','height','width'].map(k => [k, $('map-' + k).value])); }
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 4000); }
function populateFields() {
  const fields = [...new Set(features.flatMap(f => Object.keys(f.properties || {})))];
  const patterns = { id: [/^name$/i,/^conduit$/i,/^id$/i,/link.*id/i], up: [/^inoffset$/i,/^us[_ ]?invert$/i,/up.*invert/i,/^inletelev$/i,/^z1$/i,/^us.*elev/i], down: [/^outoffset$/i,/^ds[_ ]?invert$/i,/down.*invert/i,/^outletelev$/i,/^z2$/i,/^ds.*elev/i], height: [/^geom1$/i,/diam/i,/height/i,/maxdepth/i], width: [/^geom2$/i,/width/i], shape: [/^shape$/i,/^xsect.*$/i,/^geometry$/i,/^geomtype$/i,/^shapetype$/i] };
  for (const key of ['id','up','down','shape','height','width']) {
    const select = $('map-' + key); select.disabled = false;
    select.innerHTML = `<option value="">Choose a field</option>` + fields.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    const match = patterns[key]?.map(re => fields.find(f => re.test(f))).find(Boolean) || (key === 'shape' ? fields.find(f => features.some(feature => pipeShape(feature.properties?.[f]))) : null); if (match) select.value = match;
  }
  $('field-count').textContent = `${fields.length} fields available`; $('analyze').disabled = false;
  $('file-title').textContent = layerName; $('file-subtitle').innerHTML = `${features.length.toLocaleString()} conduits · <u>replace layer</u>`; $('dropzone').classList.add('loaded');
  $('step2').classList.add('active'); updateGeometryFields();
}
function updateGeometryFields() {
  const shapeField = $('map-shape').value;
  const shapes = features.map(f => pipeShape(f.properties?.[shapeField]));
  const circular = shapes.filter(s => s === 'circular').length;
  const rectangular = shapes.filter(s => s === 'rectangular').length;
  $('height-caption').textContent = rectangular ? (circular ? 'Pipe height / diameter' : 'Pipe height') : 'Pipe diameter';
  $('height-label').classList.toggle('full', !rectangular);
  $('width-label').hidden = !rectangular;
  $('map-width').disabled = !rectangular || !features.length;
  $('geometry-info').textContent = shapeField
    ? `${circular} circular · ${rectangular} box pipes${shapes.length - circular - rectangular ? ` · ${shapes.length - circular - rectangular} unsupported / blank` : ''}. Height applies to boxes; diameter to circular pipes. Width applies only to boxes.`
    : 'CIRCULAR → circular · RECT_CLOSED → box pipe';
}
function clearReport() {
  crossings = []; pipes = []; overlaps = []; selected = null; analyzedSettings = null;
  viewer.update([], []); $('viewer-empty').hidden = false; $('viewer-count').textContent = 'Awaiting analysis';
  $('export').disabled = true; $('crossing-detail').hidden = true; $('issues').textContent = ''; $('step3').classList.remove('active');
  for (const k of ['total','clash-total','review-total','clear-total']) $(k).textContent = '—';
  renderTable();
}
async function upload(files) {
  if (!files.length) return;
  if ([...files].reduce((sum, f) => sum + f.size, 0) > 100_000_000) { $('upload-status').textContent = 'Please select a layer smaller than 100 MB.'; return; }
  $('upload-status').textContent = 'Reading geometry and attributes…';
  try {
    const data = await readConduits(files); features = data.features; layerName = data.name; projection = data.projection;
    clearReport(); populateFields(); $('upload-status').textContent = projection ? 'Layer loaded. Confirm field mapping and projected units.' : 'No .prj found. Confirm this layer uses projected XY coordinates, not longitude/latitude.';
  } catch (error) { $('upload-status').textContent = error.message; }
  $('file-input').value = '';
}
function runAnalysis() {
  const m = mapping(), s = settings();
  if (['id','up','down','shape','height'].some(k => !m[k])) { toast('Map the conduit ID, both elevations, geometry attribute, and pipe height / diameter before analyzing.'); return; }
  if (features.some(f => pipeShape(f.properties?.[m.shape]) === 'rectangular') && !m.width) { toast('Map the pipe width for rectangular conduits before analyzing.'); return; }
  if ($('minimum').value === '' || $('wall').value === '' || !Number.isFinite(s.minimum) || s.minimum < 0 || !Number.isFinite(s.wall) || s.wall < 0) { toast('Enter a non-negative minimum clearance and wall thickness.'); return; }
  const prepared = makePipes(features, m, s);
  pipes = prepared.pipes;
  const result = analyze(pipes, s.minimum, s.endpoints); crossings = result.crossings; overlaps = result.overlaps; analyzedSettings = s;
  selected = null; $('crossing-detail').hidden = true;
  viewer.update(pipes, crossings); viewer.exaggerate(Number($('exaggeration').value)); $('viewer-empty').hidden = !!pipes.length;
  $('viewer-count').textContent = `${pipes.length.toLocaleString()} conduits · ${layerName}`;
  $('total').textContent = crossings.length.toLocaleString();
  for (const status of ['clash','review','clear']) $(status + '-total').textContent = crossings.filter(c => c.status === status).length.toLocaleString();
  $('export').disabled = !crossings.length; $('step3').classList.add('active'); $('upload-status').textContent = `${layerName === 'Sample network' ? 'Sample data' : 'Layer'} analyzed · ${pipes.length} valid conduits`;
  const notes = [];
  if (prepared.errors.length) notes.push(`<strong>${prepared.errors.length} conduit(s) excluded</strong><ul>${prepared.errors.slice(0, 15).map(e => `<li>${esc(e)}</li>`).join('')}</ul>${prepared.errors.length > 15 ? 'Additional invalid conduits omitted from this list.' : ''}`);
  if (overlaps.length) notes.push(`<strong>${overlaps.length} collinear pair(s) need separate review</strong><p>${overlaps.slice(0, 10).map(o => `${esc(o.a)} / ${esc(o.b)}`).join(', ')}. Continuous overlaps are not included in the point-crossing report.</p>`);
  if (/^(INOFFSET|OUTOFFSET)$/i.test(m.up) || /^(INOFFSET|OUTOFFSET)$/i.test(m.down)) notes.push('<p>Selected offset fields are treated as actual endpoint elevations. If they are offsets above node inverts, add the node elevations first; offsets alone do not give absolute pipe elevations.</p>');
  notes.push(`<p>Uses linear invert interpolation along plan length and a constant vertical pipe height. ${s.endpoints ? 'Endpoint crossings included.' : 'Crossings at conduit endpoints excluded.'} Near misses, self-intersections, and lateral pipe-body collisions are not checked.</p>`);
  $('issues').innerHTML = notes.join(''); renderTable(); toast(`${crossings.length} crossings analyzed${prepared.errors.length ? ` · ${prepared.errors.length} invalid conduits excluded` : ''}.`);
}
const statusName = { clear: 'Clear', review: 'Low clearance', clash: 'Clash' };
function renderTable() {
  const query = $('search').value.toLowerCase();
  const rows = crossings.filter(c => (filter === 'all' || c.status === filter) && `${c.a.id} ${c.b.id}`.toLowerCase().includes(query));
  $('report-count').textContent = crossings.length; $('location-unit').textContent = `(${analyzedSettings?.xyUnit || 'm'})`;
  const factor = units[analyzedSettings?.xyUnit || 'm'];
  $('results').innerHTML = rows.map(c => `<tr class="${selected === c.id ? 'selected' : ''}" data-id="${c.id}"><td><span class="crossing-id">CR-${String(c.id).padStart(3, '0')}</span></td><td><strong>${esc(c.a.id)}</strong><span class="pair-divider"> × </span><strong>${esc(c.b.id)}</strong></td><td class="coordinates">${(c.point[0] / factor).toFixed(2)}, ${(c.point[1] / factor).toFixed(2)}</td><td class="numeric">${c.ea.bottom.toFixed(3)} / ${c.ea.top.toFixed(3)}</td><td class="numeric">${c.eb.bottom.toFixed(3)} / ${c.eb.top.toFixed(3)}</td><td class="clearance ${c.status}">${c.clearance > 0 ? '+' : ''}${c.clearance.toFixed(3)}</td><td><span class="status-pill ${c.status}"><i></i>${statusName[c.status]}</span></td><td><button class="inspect" aria-label="Inspect crossing ${c.id}" data-select="${c.id}">${icon('arrow', 15)}</button></td></tr>`).join('');
  $('table-empty').hidden = !!rows.length;
  if (!rows.length) $('table-empty').innerHTML = `${icon('layers', 27)}<strong>${!analyzedSettings ? 'Your crossing report will appear here' : crossings.length ? 'No crossings match this filter' : 'No point crossings found'}</strong><span>${!analyzedSettings ? 'Load your network and run an analysis to get started.' : !pipes.length ? 'Check the attribute mapping and excluded conduit messages.' : 'Adjust your filters or review the geometry and analysis notes.'}</span>`;
}
function selectCrossing(id) {
  const c = crossings.find(c => c.id === id); if (!c) return;
  selected = id; viewer.focus(id); renderTable();
  $('crossing-detail').hidden = false;
  $('crossing-detail').innerHTML = `<div><strong>CR-${String(id).padStart(3,'0')} · ${esc(c.a.id)} × ${esc(c.b.id)}</strong><span>${Math.abs(c.clearance).toFixed(3)} m ${c.clearance < 0 ? 'vertical overlap' : 'vertical clearance'}</span></div><p>Along ${esc(c.a.id)}: ${c.da.toFixed(2)} m from upstream · Along ${esc(c.b.id)}: ${c.db.toFixed(2)} m from upstream. ${c.clearance >= 0 ? `Minimum required: ${analyzedSettings.minimum.toFixed(3)} m.` : 'Pipe envelopes overlap at this plan crossing.'}</p>`;
}
function loadDemo() {
  features = demo; layerName = 'Sample network'; projection = 'Projected local metres';
  $('xy-unit').value = $('z-unit').value = $('size-unit').value = 'm'; $('reference').value = 'invert'; $('wall').value = '0'; $('minimum').value = '0.30'; $('reverse').checked = $('endpoints').checked = false;
  clearReport(); populateFields(); runAnalysis();
}
$('demo').onclick = $('demo-viewer').onclick = loadDemo;
$('file-input').onchange = e => upload(e.target.files);
$('dropzone').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file-input').click(); } };
for (const type of ['dragover','dragleave','drop']) $('dropzone').addEventListener(type, e => { e.preventDefault(); $('dropzone').classList.toggle('dragging', type === 'dragover'); if (type === 'drop') upload(e.dataTransfer.files); });
$('map-shape').addEventListener('change', updateGeometryFields);
$('analyze').onclick = runAnalysis;
$('show-markers').onchange = e => viewer.showMarkers(e.target.checked);
$('fit').onclick = () => viewer.fit(); $('top').onclick = () => viewer.top(); $('exaggeration').onchange = e => viewer.exaggerate(Number(e.target.value));
$('search').oninput = renderTable;
document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => { filter = tab.dataset.filter; document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab)); renderTable(); });
$('results').onclick = e => { const row = e.target.closest('tr[data-id]'); if (row) selectCrossing(Number(row.dataset.id)); };
$('export').onclick = () => {
  const blob = new Blob(['\ufeff', csv(crossings, analyzedSettings.xyUnit)], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'conduit-crossing-report.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Invalidate displayed results when engineering settings change; never export stale results.
for (const input of document.querySelectorAll('.setup-panel select, .setup-panel input:not([type=file])')) input.addEventListener('change', () => {
  if (analyzedSettings) { clearReport(); $('upload-status').textContent = 'Parameters changed. Analyze again to update the report.'; }
});
renderTable();
