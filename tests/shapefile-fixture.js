import { zipSync, strToU8 } from 'fflate';
// Minimal standards-compliant SHP + DBF fixture, built without a GIS runtime.
export function fixtureFiles(geographic = false, offsets = false) {
 const conduits = [
  {id:'P-A',points:[[0,5],[10,5]],up:10,down:10,size:1},
  {id:'P-B',points:[[5,0],[5,10]],up:10.5,down:10.5,size:1},
 ];
 const contents=conduits.map(p=>{
  const b=Buffer.alloc(48+p.points.length*16); b.writeInt32LE(3,0);
  [0,0,10,10].forEach((n,i)=>b.writeDoubleLE(n,4+i*8)); b.writeInt32LE(1,36);b.writeInt32LE(p.points.length,40);b.writeInt32LE(0,44);
  p.points.forEach((point,i)=>{b.writeDoubleLE(point[0],48+i*16);b.writeDoubleLE(point[1],56+i*16)});return b;
 });
 const shp=Buffer.alloc(100+contents.reduce((n,b)=>n+b.length+8,0));shp.writeInt32BE(9994,0);shp.writeInt32BE(shp.length/2,24);shp.writeInt32LE(1000,28);shp.writeInt32LE(3,32);[0,0,10,10].forEach((n,i)=>shp.writeDoubleLE(n,36+i*8));
 let offset=100;contents.forEach((b,i)=>{shp.writeInt32BE(i+1,offset);shp.writeInt32BE(b.length/2,offset+4);b.copy(shp,offset+8);offset+=b.length+8});
 const fields=[['Name','C',16,0],['US_Invert','N',12,4],['DS_Invert','N',12,4],['Geom1','N',12,4],...(offsets ? [['INOFFSET','N',12,4],['OUTOFFSET','N',12,4],['Geom2','N',12,4]] : [])],header=32+32*fields.length+1,record=1+fields.reduce((n,f)=>n+f[2],0);
 const dbf=Buffer.alloc(header+record*conduits.length+1,32);dbf[0]=3;dbf[1]=126;dbf[2]=10;dbf[3]=9;dbf.writeUInt32LE(conduits.length,4);dbf.writeUInt16LE(header,8);dbf.writeUInt16LE(record,10);dbf.fill(0,12,32);
 fields.forEach(([name,type,len,dec],i)=>{const start=32+i*32;dbf.fill(0,start,start+32);dbf.write(name,start);dbf[start+11]=type.charCodeAt(0);dbf[start+16]=len;dbf[start+17]=dec});dbf[header-1]=13;
 conduits.forEach((p,i)=>{let off=header+i*record+1;[p.id,p.up,p.down,p.size,...(offsets ? [p.up,p.down,2.5] : [])].forEach((v,j)=>{const value=j===0?String(v).padEnd(fields[j][2]):Number(v).toFixed(4).padStart(fields[j][2]);dbf.write(value,off);off+=fields[j][2]})});dbf[dbf.length-1]=26;
 const prj=geographic?'GEOGCS["WGS 84",DATUM["WGS_1984"],UNIT["degree",0.0174532925199433]]':'PROJCS["Local projected grid",UNIT["metre",1]]';
 return {'conduits.shp':shp,'conduits.dbf':dbf,'conduits.prj':strToU8(prj)};
}
export const fixtureZip = (geographic, offsets) => Buffer.from(zipSync(fixtureFiles(geographic, offsets)));
