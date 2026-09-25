// Per-type handling and geometry. Units: m, s, kg. halfW/halfL = footprint; circles = 3 along
// the length at +-circleOff with radius circleR (front, middle, rear). steerFall: speed (m/s) at
// which the steering angle has halved. grip / hbGrip: lateral velocity bleed rate (1/s), normal
// and with the handbrake. hpScale scales crash damage. chair: folded-chair mount (vehicle local).
// seat: the driver's seat (entities/seated.js), vehicle local, the floor point under the hips;
// left (+X) is the driver's side. The cart's seat is open; the others show through the glass.
// Serenity livery: the franchise van's black (world/cars.js paints the van with the same value), also
// the goon cars' sedans (run/goon-car.js): recolourBody swaps the asset's Paint for it.
export const SERENITY_BLACK = 0x111214;
export const VEHICLE_TYPES = {
  sedan: {
    label: 'sedan', asset: 'assets/sedan.json',
    halfW: 0.9, halfL: 2.3, circleR: 0.9, circleOff: 1.4, height: 1.45,
    mass: 1200, maxSpeed: 22, accel: 9, brake: 16, maxReverse: 7,
    steerMax: 0.6, steerRate: 3, steerFall: 9, wheelbase: 2.7, wheelR: 0.3,
    grip: 10, hbGrip: 1.3, lean: 1, hpScale: 1,
    seat: { x: 0.38, y: 0.03, z: -0.1 },
    chair: { pos: [0, 0.95, -1.55], rot: [-Math.PI / 2 + 0.35, 0, 0], scale: 0.85 }, // poking out of the trunk
  },
  van: {
    label: 'van', asset: 'assets/van.json',
    halfW: 1.0, halfL: 2.76, circleR: 1.0, circleOff: 1.76, height: 2.15,
    mass: 2200, maxSpeed: 16, accel: 6, brake: 11, maxReverse: 5,
    steerMax: 0.5, steerRate: 2.4, steerFall: 8, wheelbase: 3.5, wheelR: 0.34,
    grip: 9, hbGrip: 1.6, lean: 0.8, hpScale: 0.7,
    seat: { x: 0.45, y: 0.63, z: 1.0 },
    chair: { pos: [-0.45, 0.62, 1.05], rot: [0, Math.PI, 0], scale: 0.85 },           // passenger seat, behind the glass
  },
  cart: {
    label: 'cart', asset: 'assets/cart.json',
    halfW: 0.6, halfL: 1.22, circleR: 0.6, circleOff: 0.62, height: 1.9,
    mass: 450, maxSpeed: 13, accel: 11, brake: 14, maxReverse: 5,
    steerMax: 0.7, steerRate: 4, steerFall: 7, wheelbase: 1.64, wheelR: 0.22,
    grip: 5, hbGrip: 0.9, lean: 2.4, hpScale: 1.3,
    seat: { x: 0.26, y: 0.38, z: -0.1 },
    chair: { pos: [0, 0.86, -0.97], rot: [0, Math.PI, 0], scale: 0.85 },              // rear rack, upright
  },
  copcar: {
    label: 'cop car', asset: 'assets/copcar.json',
    halfW: 0.9, halfL: 2.35, circleR: 0.9, circleOff: 1.45, height: 1.57,
    mass: 1300, maxSpeed: 26, accel: 11, brake: 18, maxReverse: 8,
    steerMax: 0.6, steerRate: 3.2, steerFall: 10, wheelbase: 2.7, wheelR: 0.3,
    grip: 11, hbGrip: 1.3, lean: 0.9, hpScale: 0.9,
    seat: { x: 0.38, y: 0.03, z: -0.1 },
    chair: { pos: [0, 0.95, -1.55], rot: [-Math.PI / 2 + 0.35, 0, 0], scale: 0.85 },
  },
  swatvan: {
    label: 'SWAT van', asset: 'assets/swatvan.json',
    halfW: 1.01, halfL: 2.9, circleR: 1.01, circleOff: 1.9, height: 2.5,
    mass: 3000, maxSpeed: 18, accel: 6.5, brake: 11, maxReverse: 5,
    steerMax: 0.5, steerRate: 2.4, steerFall: 8, wheelbase: 3.5, wheelR: 0.36,
    grip: 9.5, hbGrip: 1.6, lean: 0.7, hpScale: 0.6,
    seat: { x: 0.45, y: 0.68, z: 1.0 },
    chair: { pos: [-0.45, 0.62, 1.05], rot: [0, Math.PI, 0], scale: 0.85 },
  },
};
