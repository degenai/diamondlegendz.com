// Between runs (MASSAGE entry): every vehicle with a home (the parked sedans, the maintenance
// cart, the franchise van, the parked cop car) goes back to it repaired, not stolen, engine off,
// chair unloaded, smoke gone. Vehicles without a home (a carjacked civilian car) are removed.
// Police and traffic vehicles are cleared by their own modules first (spawner.clear).
import { removeEntity } from '../entities/index.js';
import { clearDriverRig } from '../entities/seated.js';

function dropSmoke(v) {
  if (!v.smoke) return;
  const g = v.smoke.group;
  if (g.parent) g.parent.remove(g);
  for (const m of v.smoke.puffs) m.material.dispose();
  v.smoke = null;
}

export function resetVehicles(ctx) {
  const world = ctx.world, list = world.vehicles;
  if (!list) return;
  for (const v of list.slice()) {
    if (v.driver && v.driver !== ctx.player) v.driver = null;
    clearDriverRig(v);
    v.ai = null; v.aiBackT = 0; v.aiStuckT = 0; v.route = null;
    dropSmoke(v);
    if (!v.home) {
      const i = list.indexOf(v);
      if (i >= 0) list.splice(i, 1);
      removeEntity(ctx.entities, v);
      if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
      v.removed = true;
      continue;
    }
    v.pos.copy(v.home.pos); v.yaw = v.home.yaw;
    v.vel.set(0, 0, 0); v.vy = 0; v.speed = 0; v.steer = 0; v.yawRate = 0; v.slip = 0; v.throttle = 0;
    v.hp = 100; v.parked = true; v.asleep = true; v.wreckSeen = false; v.chairLoaded = false;
    v.stolen = false; v.handbrake = false; v.lastImpact = 0; v.wobbleT = 0;
    v._hpSeen = undefined; v._propT = undefined;
    v.lean.roll = 0; v.lean.pitch = 0;
    v.body.rotation.set(0, 0, 0);
    v.mesh.position.copy(v.pos); v.mesh.rotation.set(0, v.yaw, 0);
  }
}
