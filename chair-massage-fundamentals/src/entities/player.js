// Player: third-person on-foot controller, orbit camera, procedural walk, elbow stub.
import * as THREE from '../../vendor/three.module.js';
import { makePerson } from '../world/props.js';
import { resolveStatic } from '../physics.js';

const WALK = 4;
const SPRINT = 7;
const ACCEL = 30;          // m/s^2 toward target velocity on the ground
const AIR_ACCEL = 8;
const JUMP_V = 5.5;
const GRAVITY = 18;
const CAM_DIST = 6;
const CAM_HEIGHT = 2.5;
const LOOK_HEIGHT = 1.5;
const PITCH_MIN = -0.35;
const PITCH_MAX = 1.1;
const MOUSE_SENS = 0.0025;
const ELBOW_TIME = 0.2;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

export function createPlayer(scene, pos) {
  const mesh = makePerson({ shirt: 0x2e9e4f, pants: 0x2a3140, skin: 0xc68e62 });
  mesh.position.copy(pos);
  scene.add(mesh);
  return {
    id: null,
    kind: 'player',
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    yaw: 0,              // body facing (radians, 0 = +Z)
    radius: 0.4,
    hp: 100,
    mesh,
    grounded: true,
    camYaw: Math.PI,     // camera behind the player (player faces +Z, camera looks +Z)
    camPitch: 0.25,
    walkPhase: 0,
    elbowT: 0,
    camInit: false,
    update: updatePlayer,
  };
}

export const create = createPlayer;
export const update = updatePlayer;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function updatePlayer(p, dt, ctx) {
  const input = ctx.input;

  // --- camera orbit from mouse (pointer lock deltas) ---
  if (input) {
    p.camYaw -= input.dx * MOUSE_SENS;
    p.camPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, p.camPitch + input.dy * MOUSE_SENS));
  }

  // --- movement relative to camera yaw ---
  // Camera looks along forward = (-sin yaw, 0, -cos yaw).
  _fwd.set(-Math.sin(p.camYaw), 0, -Math.cos(p.camYaw));
  _right.set(Math.cos(p.camYaw), 0, -Math.sin(p.camYaw));
  _wish.set(0, 0, 0);
  if (input) {
    if (input.forward) _wish.add(_fwd);
    if (input.back) _wish.sub(_fwd);
    if (input.right) _wish.add(_right);
    if (input.left) _wish.sub(_right);
  }
  const moving = _wish.lengthSq() > 0;
  if (moving) _wish.normalize();
  const speed = input && input.shift ? SPRINT : WALK;
  const tx = _wish.x * speed, tz = _wish.z * speed;
  const a = (p.grounded ? ACCEL : AIR_ACCEL) * dt;
  p.vel.x += THREE.MathUtils.clamp(tx - p.vel.x, -a, a);
  p.vel.z += THREE.MathUtils.clamp(tz - p.vel.z, -a, a);

  // --- jump + gravity (ground at y = 0) ---
  if (input && input.spacePressed && p.grounded) {
    p.vel.y = JUMP_V;
    p.grounded = false;
  }
  p.vel.y -= GRAVITY * dt;

  p.pos.addScaledVector(p.vel, dt);
  if (p.pos.y <= 0) {
    p.pos.y = 0;
    if (p.vel.y < 0) p.vel.y = 0;
    p.grounded = true;
  }

  if (ctx.world) resolveStatic(p, ctx.world.colliders);

  // --- facing: turn toward movement direction ---
  const hSpeed = Math.hypot(p.vel.x, p.vel.z);
  if (moving) {
    const targetYaw = Math.atan2(_wish.x, _wish.z);
    p.yaw += wrapAngle(targetYaw - p.yaw) * Math.min(1, 12 * dt);
    p.yaw = wrapAngle(p.yaw);
  }

  // --- elbow strike stub ---
  if (input && input.leftClicked && input.locked && p.elbowT <= 0) {
    p.elbowT = ELBOW_TIME;
    console.log('[CMF] elbow strike', { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(2) });
  }
  if (p.elbowT > 0) p.elbowT = Math.max(0, p.elbowT - dt);

  animate(p, dt, hSpeed);
  syncMesh(p);
  updateCamera(p, dt, ctx.camera);
}

function animate(p, dt, hSpeed) {
  const limbs = p.mesh.userData.limbs;
  const amt = p.grounded ? Math.min(hSpeed / SPRINT, 1) : 0.3;
  p.walkPhase += dt * (2 + hSpeed * 1.6);
  const swing = Math.sin(p.walkPhase) * 0.9 * amt;
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = -swing * 0.8;
  if (p.elbowT > 0) {
    // Snap the right arm out forward, bent across the body.
    limbs.armR.rotation.x = -Math.PI / 2;
    limbs.armR.rotation.z = 0.5;
  } else {
    limbs.armR.rotation.x = swing * 0.8;
    limbs.armR.rotation.z = 0;
  }
  // Small bob while moving.
  p.mesh.userData.body.position.y = 1.15 + Math.abs(Math.sin(p.walkPhase)) * 0.05 * amt;
}

function syncMesh(p) {
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.yaw;
}

function updateCamera(p, dt, camera) {
  if (!camera) return;
  _camTarget.set(p.pos.x, p.pos.y + LOOK_HEIGHT, p.pos.z);
  const horiz = Math.cos(p.camPitch) * CAM_DIST;
  _camDesired.set(
    p.pos.x + Math.sin(p.camYaw) * horiz,
    p.pos.y + CAM_HEIGHT + Math.sin(p.camPitch) * CAM_DIST - Math.sin(0.25) * CAM_DIST,
    p.pos.z + Math.cos(p.camYaw) * horiz,
  );
  _camDesired.y = Math.max(0.3, _camDesired.y);
  if (!p.camInit) {
    camera.position.copy(_camDesired);
    p.camInit = true;
  } else {
    camera.position.lerp(_camDesired, 1 - Math.exp(-10 * dt));
  }
  camera.lookAt(_camTarget);
}
