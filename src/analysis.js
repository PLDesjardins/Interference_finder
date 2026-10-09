/** Engineering calculations use projected XY coordinates and metres internally. */
const EPS = 1e-9;
export const units = { m: 1, ft: 0.3048, mm: 0.001 };
export function makePipes(features, mapping, settings) {
  const pipes = [], errors = [];
  const number = value => value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value);
  features.forEach((feature, index) => {
    const p = feature.properties || {}, label = String(p[mapping.id] ?? `Pipe ${index + 1}`);
    if (feature.geometry?.type !== 'LineString') { errors.push(`${label}: only continuous LineString conduits are supported.`); return; }
    let points = feature.geometry.coordinates.map(c => [number(c[0]) * units[settings.xyUnit], number(c[1]) * units[settings.xyUnit]]);
    if (settings.reverse) points.reverse();
    const up = number(p[mapping.up]) * units[settings.zUnit], down = number(p[mapping.down]) * units[settings.zUnit];
    const height = number(p[mapping.height]) * units[settings.sizeUnit];
    const width = mapping.width ? number(p[mapping.width]) * units[settings.sizeUnit] : height;
    if (!Number.isFinite(up) || !Number.isFinite(down) || !Number.isFinite(height) || height <= 0 || !Number.isFinite(width) || width <= 0 || points.some(c => !c.every(Number.isFinite))) {
      errors.push(`${label}: missing or invalid elevation, size, or coordinates.`); return;
    }
    const distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const length = distances.at(-1);
    if (!length || points.length < 2) { errors.push(`${label}: zero-length geometry.`); return; }
    pipes.push({ key: index, id: label, points, distances, length, up, down, height, width, wall: settings.wall, shape: settings.shape, reference: settings.reference });
  });
  return { pipes, errors };
}
export function envelope(pipe, distance) {
  const elevation = pipe.up + (pipe.down - pipe.up) * Math.max(0, Math.min(1, distance / pipe.length));
  const bottom = pipe.reference === 'center' ? elevation - pipe.height / 2 : elevation;
  return { bottom: bottom - pipe.wall, top: bottom + pipe.height + pipe.wall, center: bottom + pipe.height / 2, elevation };
}
function cross(a, b) { return a[0] * b[1] - a[1] * b[0]; }
function minus(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
export function intersect(a, b, c, d) {
  const r = minus(b, a), s = minus(d, c), q = minus(c, a), denom = cross(r, s);
  if (Math.abs(denom) < EPS) {
    if (Math.hypot(...r) < EPS || Math.hypot(...s) < EPS || Math.abs(cross(q, r)) > EPS) return null;
    const rr = r[0] ** 2 + r[1] ** 2, t0 = (q[0] * r[0] + q[1] * r[1]) / rr, t1 = t0 + (s[0] * r[0] + s[1] * r[1]) / rr;
    return Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > EPS ? { overlap: true } : null;
  }
  const t = cross(q, s) / denom, u = cross(q, r) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)), point: [a[0] + t * r[0], a[1] + t * r[1]] };
}
export function analyze(pipes, minimum = 0.3, includeEndpoints = false) {
  const crossings = [], overlaps = [], seen = new Set();
  // Sweep segment bounding boxes along X; avoid testing spatially separate segments.
  const segments = pipes.flatMap(pipe => pipe.points.slice(1).map((b, i) => {
    const a = pipe.points[i]; return { pipe, i, a, b, minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) };
  })).sort((a, b) => a.minX - b.minX);
  let active = [];
  for (const s of segments) {
    active = active.filter(o => o.maxX >= s.minX - EPS);
    for (const o of active) {
      if (s.pipe.key === o.pipe.key || o.maxY < s.minY - EPS || s.maxY < o.minY - EPS) continue;
      const hit = intersect(o.a, o.b, s.a, s.b);
      if (!hit) continue;
      const pair = [o.pipe.key, s.pipe.key].sort((a, b) => a - b).join(':');
      if (hit.overlap) { if (!overlaps.some(v => v.pair === pair)) overlaps.push({ pair, a: o.pipe.id, b: s.pipe.id }); continue; }
      const da = o.pipe.distances[o.i] + hit.t * Math.hypot(...minus(o.b, o.a));
      const db = s.pipe.distances[s.i] + hit.u * Math.hypot(...minus(s.b, s.a));
      const atEnd = (d, pipe) => d <= 1e-7 || pipe.length - d <= 1e-7;
      if (!includeEndpoints && (atEnd(da, o.pipe) || atEnd(db, s.pipe))) continue;
      const token = `${pair}:${hit.point.map(n => n.toFixed(6)).join(':')}`;
      if (seen.has(token)) continue;
      seen.add(token);
      const ea = envelope(o.pipe, da), eb = envelope(s.pipe, db);
      const upper = ea.center >= eb.center ? ea : eb, lower = upper === ea ? eb : ea;
      const clearance = upper.bottom - lower.top;
      crossings.push({ id: crossings.length + 1, a: o.pipe, b: s.pipe, point: hit.point, da, db, ea, eb, clearance, status: clearance < -1e-8 ? 'clash' : clearance < minimum - 1e-8 ? 'review' : 'clear' });
    }
    active.push(s);
  }
  return { crossings, overlaps };
}
export function csv(crossings, xyUnit = 'm') {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  const header = ['Crossing', 'Pipe A', 'Pipe B', `X (${xyUnit})`, `Y (${xyUnit})`, 'A outside bottom (m)', 'A top (m)', 'B outside bottom (m)', 'B top (m)', 'Clearance (m)', 'Status'];
  return [header, ...crossings.map(c => [c.id, c.a.id, c.b.id, c.point[0] / units[xyUnit], c.point[1] / units[xyUnit], c.ea.bottom, c.ea.top, c.eb.bottom, c.eb.top, c.clearance, c.status])].map(row => row.map(quote).join(',')).join('\r\n');
}
