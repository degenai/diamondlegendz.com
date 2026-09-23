// Entity list helpers. Entities are plain objects:
// { id, kind, pos, vel, yaw, radius, hp, mesh, update?(e, dt, ctx), ... }

let nextId = 1;

export function addEntity(list, e) {
  if (e.id == null) e.id = nextId++;
  list.push(e);
  return e;
}

export function removeEntity(list, e, scene) {
  const i = list.indexOf(e);
  if (i >= 0) list.splice(i, 1);
  if (scene && e.mesh) scene.remove(e.mesh);
  return i >= 0;
}

export function updateAll(dt, ctx) {
  const list = ctx.entities;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (typeof e.update === 'function') e.update(e, dt, ctx);
  }
  // Late pass (cameras) once everything has moved this tick.
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (typeof e.lateUpdate === 'function') e.lateUpdate(e, dt, ctx);
  }
}
