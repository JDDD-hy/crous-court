import assert from "node:assert/strict";
import test from "node:test";
import { canUseVoxelMotion } from "../lib/motion-preference.ts";
import { getVoxelDrop, preloadVoxelDrop } from "../lib/voxel-preload.ts";
import { createVoxelWorld, initializeVoxelPhysics, VOXEL_COUNT, VOXEL_DURATION_MS } from "../components/crous/voxel-drop.ts";

test("voxel motion excludes SSR, mobile and reduced motion without scheduling downloads", () => {
  assert.equal(canUseVoxelMotion(), false);
  assert.equal(getVoxelDrop(), undefined);
  let reduced = true, desktop = true;
  const testScreen = { width: 1920 };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    screen: testScreen,
    // A desktop side panel can be narrower than 1024px without being a phone.
    matchMedia: (query: string) => ({ matches: query.includes("reduced-motion") ? reduced : desktop && !query.includes("min-width") }),
  } });
  try {
    assert.equal(canUseVoxelMotion(), false);
    preloadVoxelDrop()(); // No document/timers exist here: excluded devices must return first.
    reduced = false; desktop = false;
    assert.equal(canUseVoxelMotion(), false);
    preloadVoxelDrop()();
    desktop = true;
    assert.equal(canUseVoxelMotion(), true);
    assert.equal(getVoxelDrop(), undefined); // Cold load must use the existing 2D effect.
    testScreen.width = 390;
    assert.equal(canUseVoxelMotion(), false);
  } finally { Reflect.deleteProperty(globalThis, "window"); }
});

test("voxel physics stays finite, collides with the floor, and meets the CPU budget", async (context) => {
  await initializeVoxelPhysics();
  const { world, bodies, size } = createVoxelWorld(440, 110);
  try {
    assert.equal(bodies.length, VOXEL_COUNT);
    assert.ok(VOXEL_COUNT <= 36 && VOXEL_DURATION_MS <= 1200);
    const startingHeight = bodies[0].translation().y;
    const samples: number[] = [];
    for (let frame = 0; frame < 72; frame++) {
      const start = performance.now();
      world.timestep = 1 / 60; world.step();
      samples.push(performance.now() - start);
      for (const body of bodies) {
        const { x, y, z } = body.translation();
        assert.ok([x, y, z].every(Number.isFinite));
        assert.ok(y > 0, "blocks must not fall through the floor");
      }
    }
    assert.ok(bodies[0].translation().y < startingHeight);
    assert.ok(bodies[0].translation().y >= 6 + size / 2 - 1);
    const p95 = samples.sort((a, b) => a - b)[Math.floor(samples.length * 0.95)];
    context.diagnostic(`36 bodies, 72 steps: p95 ${p95.toFixed(2)} ms (budget 8 ms; GPU excluded)`);
    assert.ok(p95 < 8, `physics p95 exceeded 8 ms: ${p95}`);
  } finally { world.free(); }
});
