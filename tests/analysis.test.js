import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePipes, analyze, envelope, csv } from '../src/analysis.js';
const feature = (id, points, up, down, height=1) => ({properties:{id,up,down,height},geometry:{type:'LineString',coordinates:points}});
const mapping = {id:'id',up:'up',down:'down',height:'height'};
const settings = {xyUnit:'m',zUnit:'m',sizeUnit:'m',wall:0,reference:'invert',shape:'circular'};
const prepare = features => makePipes(features,mapping,settings).pipes;
test('interpolates inverts by cumulative plan length and calculates signed clearance', () => {
 const pipes=prepare([feature('A',[[0,0],[10,0],[10,10]],10,8),feature('B',[[5,-5],[5,5]],12,12)]);
 const {crossings}=analyze(pipes,.3); assert.equal(crossings.length,1);
 assert.equal(crossings[0].ea.bottom,9.5); assert.equal(crossings[0].clearance,1.5); assert.equal(crossings[0].status,'clear');
});
test('detects clashes and clearance below standard', () => {
 const a=feature('A',[[-5,0],[5,0]],10,10);
 let c=analyze(prepare([a,feature('B',[[0,-5],[0,5]],10.5,10.5)]),.3).crossings[0];
 assert.equal(c.clearance,-.5); assert.equal(c.status,'clash');
 c=analyze(prepare([a,feature('B',[[0,-5],[0,5]],11.2,11.2)]),.3).crossings[0];
 assert.ok(Math.abs(c.clearance-.2)<1e-9); assert.equal(c.status,'review');
});
test('deduplicates crossings at internal polyline vertices', () => {
 const result=analyze(prepare([feature('A',[[-5,0],[0,0],[5,0]],0,0),feature('B',[[0,-5],[0,0],[0,5]],2,2)])); assert.equal(result.crossings.length,1);
});
test('excludes endpoints by default and includes them when requested', () => {
 const pipes=prepare([feature('A',[[0,0],[5,0]],0,0),feature('B',[[5,0],[5,5]],2,2)]);
 assert.equal(analyze(pipes).crossings.length,0); assert.equal(analyze(pipes,.3,true).crossings.length,1);
});
test('reports collinear overlap separately', () => {
 const result=analyze(prepare([feature('A',[[0,0],[10,0]],0,0),feature('B',[[5,0],[15,0]],2,2)])); assert.equal(result.overlaps.length,1); assert.equal(result.crossings.length,0);
});
test('rejects null and blank elevations and zero size', () => {
 const result=makePipes([feature('A',[[0,0],[5,0]],null,3),feature('B',[[0,0],[5,0]],'',3),feature('C',[[0,0],[5,0]],0,0,0)],mapping,settings); assert.equal(result.pipes.length,0); assert.equal(result.errors.length,3);
});
test('converts feet and millimetres, handles centerline and wall thickness', () => {
 const {pipes}=makePipes([feature('A',[[0,0],[10,0]],10,10,1000)],mapping,{...settings,xyUnit:'ft',zUnit:'ft',sizeUnit:'mm',reference:'center',wall:.1});
 assert.equal(pipes[0].length,3.048); const e=envelope(pipes[0],0); assert.ok(Math.abs(e.bottom-2.448)<1e-9); assert.ok(Math.abs(e.top-3.648)<1e-9);
});
test('reverse option associates upstream invert with final geometry coordinate', () => {
 const {pipes}=makePipes([feature('A',[[0,0],[10,0]],10,0)],mapping,{...settings,reverse:true}); assert.deepEqual(pipes[0].points[0],[10,0]); assert.equal(envelope(pipes[0],2).bottom,8);
});
test('CSV preserves quotes and reports coordinates in original XY units', () => {
 const result=analyze(prepare([feature('A"1',[[-5,0],[5,0]],0,0),feature('B',[[0,-5],[0,5]],2,2)])); assert.match(csv(result.crossings,'ft'),/A""1/); assert.match(csv(result.crossings,'ft'),/X \(ft\)/);
});
test('circular pipes ignore width attributes, rectangular pipes use separate width', () => {
 const f=feature('A',[[0,0],[10,0]],0,0,1);f.properties.width=2.5;
 const m={...mapping,width:'width'};
 assert.equal(makePipes([f],m,settings).pipes[0].width,1);
 const box=makePipes([f],m,{...settings,shape:'rectangular'}).pipes[0];
 assert.equal(box.height,1);assert.equal(box.width,2.5);assert.equal(box.shape,'rectangular');
 assert.equal(makePipes([f],mapping,{...settings,shape:'rectangular'}).errors.length,1);
 f.properties.width=0;assert.equal(makePipes([f],m,{...settings,shape:'rectangular'}).errors.length,1);
});
