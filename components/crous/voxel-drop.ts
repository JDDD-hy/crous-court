import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { canUseVoxelMotion } from "../../lib/motion-preference.ts";

export const VOXEL_COUNT = 36;
export const VOXEL_DURATION_MS = 1200;
let initialization: Promise<void> | undefined;
export function initializeVoxelPhysics() { return initialization ??= RAPIER.init(); }

export function createVoxelWorld(width: number, height: number) {
  const world = new RAPIER.World({ x: 0, y: -850, z: 0 });
  const size = Math.min(12, width / 40, height / 10);
  try {
    world.createCollider(RAPIER.ColliderDesc.cuboid(width, 3, 100).setTranslation(0, 3, 0));
    const bodies = Array.from({ length: VOXEL_COUNT }, (_, index) => {
      const column = index % 12;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation((column - 5.5) * size * 1.15, height * 0.5 + Math.floor(index / 12) * size * 1.15, 0)
        .setLinvel((column - 5.5) * 9, 45 + (index % 3) * 15, (index % 5 - 2) * 6)
        .setAngvel({ x: (index % 3 - 1) * 5, y: (index % 5 - 2) * 3, z: (column - 5.5) * 0.8 }));
      world.createCollider(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2).setRestitution(0.38).setFriction(0.7), body);
      return body;
    });
    return { world, bodies, size };
  } catch (error) { world.free(); throw error; }
}

export async function playVoxelDrop(host: HTMLDivElement, tier: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted || !canUseVoxelMotion() || document.hidden || host.clientWidth < 1 || host.clientHeight < 1) return false;
  let renderer: THREE.WebGLRenderer | undefined;
  let simulation: ReturnType<typeof createVoxelWorld> | undefined;
  let geometry: THREE.BoxGeometry | undefined;
  let material: THREE.MeshLambertMaterial | undefined;
  let cubes: THREE.InstancedMesh | undefined;
  try {
    const width = host.clientWidth, height = host.clientHeight;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height);
    renderer.setClearColor(0, 0);
    renderer.domElement.className = "pointer-events-none absolute inset-0 z-20 h-full w-full";
    renderer.domElement.dataset.voteEffect = "voxel";
    simulation = createVoxelWorld(width, height);
    const { world, bodies, size } = simulation;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height, 0, 0.1, 2000);
    camera.position.z = 600;
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-100, 200, 300); scene.add(light);
    geometry = new THREE.BoxGeometry(size, size, size);
    material = new THREE.MeshLambertMaterial({ transparent: true });
    cubes = new THREE.InstancedMesh(geometry, material, VOXEL_COUNT);
    cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const palette = ["#d88c86", "#d5b26f", "#d4ca78", "#c4bdb3", "#b6aaa4"];
    const color = new THREE.Color();
    bodies.forEach((_, index) => cubes!.setColorAt(index, color.set(index % 4 === 0 ? "#a94d49" : palette[tier - 1] ?? palette[4])));
    scene.add(cubes);
    host.appendChild(renderer.domElement);
    const object = new THREE.Object3D();
    const started = performance.now();
    let previous = started, accumulator = 0, slowFrames = 0, failed = false;
    await new Promise<void>((resolve) => {
      let frame = 0;
      const finish = () => {
        cancelAnimationFrame(frame);
        signal.removeEventListener("abort", finish);
        document.removeEventListener("visibilitychange", onVisibility);
        resolve();
      };
      const onVisibility = () => { if (document.hidden) finish(); };
      const draw = (now: number) => {
        try {
          if (signal.aborted || !canUseVoxelMotion() || now - started >= VOXEL_DURATION_MS) return finish();
          const delta = now - previous; previous = now;
          slowFrames = delta > 50 ? slowFrames + 1 : 0;
          if (slowFrames >= 3) return finish();
          // ponytail: max two fixed physics steps/frame; drop catch-up time on slow devices.
          accumulator = Math.min(accumulator + delta / 1000, 2 / 60);
          while (accumulator >= 1 / 60) { world.timestep = 1 / 60; world.step(); accumulator -= 1 / 60; }
          bodies.forEach((body, index) => {
            object.position.copy(body.translation()); object.quaternion.copy(body.rotation());
            object.updateMatrix(); cubes!.setMatrixAt(index, object.matrix);
          });
          cubes!.instanceMatrix.needsUpdate = true;
          material!.opacity = Math.min(1, (VOXEL_DURATION_MS - (now - started)) / 220);
          renderer!.render(scene, camera);
          frame = requestAnimationFrame(draw);
        } catch { failed = true; finish(); }
      };
      signal.addEventListener("abort", finish, { once: true });
      document.addEventListener("visibilitychange", onVisibility);
      frame = requestAnimationFrame(draw);
    });
    return !failed;
  } catch { return false; }
  finally {
    cubes?.dispose(); geometry?.dispose(); material?.dispose(); simulation?.world.free();
    renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
  }
}
