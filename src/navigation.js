import { Vector3 } from 'three';

// Camera-local axes: +X right, +Y up, -Z forward.
export function navigationOffset(keys, orientation, distance) {
  return new Vector3(
    Number(keys.has('d')) - Number(keys.has('a')),
    Number(keys.has('w')) - Number(keys.has('s')),
    Number(keys.has('e')) - Number(keys.has('q')),
  ).normalize().applyQuaternion(orientation).multiplyScalar(distance);
}
