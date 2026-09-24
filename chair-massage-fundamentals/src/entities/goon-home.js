// A goon with nobody to chase walks back to the van (or where it parks) and idles there, loose,
// until someone sees the player again (goon.js).
import { seek } from './npc-common.js';
import { SIZE } from '../world/layout.js';

const WALK = 2.2;            // return pace
const VAN_IDLE = 3;          // idle this close to the van's kerb-side point

const _home = { x: 0, y: 0, z: 0 };
export function vanHome(ctx) {
  const v = ctx.world.vehicles && ctx.world.vehicles.find((x) => x.franchise && x.driver !== ctx.player);
  const at = v ? v.pos : ctx.world.spawns.vanEntry.pos;
  // The kerb side of the van: 3 m from it toward the middle of its block.
  const cx = Math.round(at.x / SIZE) * SIZE, cz = Math.round(at.z / SIZE) * SIZE;
  const dx = at.x - cx, dz = at.z - cz, l = Math.hypot(dx, dz) || 1;
  _home.x = at.x - (dx / l) * 3; _home.z = at.z - (dz / l) * 3; _home.y = at.y || 0;
  return _home;
}

export function goHome(e, dt, ctx) {
  const h = vanHome(ctx);
  const d2 = (h.x - e.pos.x) ** 2 + (h.z - e.pos.z) ** 2;
  if (e.idle && d2 < (VAN_IDLE + 2) ** 2) { e.wishX = e.wishZ = 0; e.speed = 0; return; }
  e.idle = false;
  e.speed = WALK;
  if (seek(e, h.x, h.y, h.z, dt, ctx, VAN_IDLE) || d2 < VAN_IDLE * VAN_IDLE) {
    e.idle = true; e.speed = 0; e.wishX = e.wishZ = 0;
    const v = ctx.world.vehicles && ctx.world.vehicles.find((x) => x.franchise);
    if (v) { e.faceX = v.pos.x; e.faceZ = v.pos.z; }
  }
}
