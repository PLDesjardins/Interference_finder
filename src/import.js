import { unzipSync } from 'fflate';
import * as shapefile from 'shapefile';
export async function readConduits(files) {
  let entries = {};
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      // Limit expanded data as well as the compressed input to reject oversized archives.
      let expandedSize = 0;
      const unpacked = unzipSync(bytes, { filter: entry => {
        if (!/\.(shp|dbf|prj|cpg)$/i.test(entry.name) || entry.name.startsWith('__MACOSX/')) return false;
        expandedSize += entry.originalSize;
        if (expandedSize > 200_000_000) throw new Error('The expanded shapefile exceeds the 200 MB limit. Select a smaller conduit layer.');
        return true;
      } });
      Object.assign(entries, unpacked);
    } else entries[file.name] = bytes;
  }
  const names = Object.keys(entries).filter(n => !n.startsWith('__MACOSX/') && /\.shp$/i.test(n));
  if (names.length !== 1) throw new Error('Select one conduit layer: a ZIP containing one .shp and its .dbf, or the matching files together.');
  const shp = names[0], stem = shp.slice(0, -4).toLowerCase();
  const find = ext => Object.keys(entries).find(n => n.toLowerCase() === stem + ext);
  const dbf = find('.dbf');
  if (!dbf) throw new Error('The matching .dbf attribute file is missing. Include it with the .shp file.');
  const prj = find('.prj'), projection = prj ? new TextDecoder().decode(entries[prj]) : '';
  if (projection && /^\s*(GEOGCS|GEOGCRS|GEOGRAPHICCRS)\s*\[/i.test(projection)) throw new Error('This layer uses longitude/latitude. Re-export it from PCSWMM in a projected coordinate system (metres or feet) before checking clearances.');
  const cpg = find('.cpg');
  let encoding = cpg ? new TextDecoder().decode(entries[cpg]).trim() : 'windows-1252';
  if (/^(65001|utf-?8)$/i.test(encoding)) encoding = 'utf-8';
  if (encoding === '1252') encoding = 'windows-1252';
  const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const geojson = await shapefile.read(buffer(entries[shp]), buffer(entries[dbf]), { encoding });
  if (!geojson.features.length) throw new Error('This conduit layer contains no features.');
  return { features: geojson.features, name: shp.split('/').at(-1), projection };
}
