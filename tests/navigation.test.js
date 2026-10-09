import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { navigationOffset } from '../src/navigation.js';
const offset = (keys, orientation = new Quaternion()) => navigationOffset(new Set(keys), orientation, 2);
test('WASD and QE move along the requested camera-local directions', () => {
 for (const [key, expected] of Object.entries({w:[0,2,0],s:[0,-2,0],a:[-2,0,0],d:[2,0,0],q:[0,0,-2],e:[0,0,2]})) assert.deepEqual(offset([key]).toArray(),expected);
});
test('navigation follows a rotated camera and simultaneous keys maintain speed', () => {
 const orientation = new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
 assert.ok(offset(['q'],orientation).distanceTo(new Vector3(-2,0,0)) < 1e-9);
 assert.ok(Math.abs(offset(['w','d','q']).length()-2) < 1e-9);
 assert.equal(offset(['w','s','a','d','q','e']).length(),0);
});
