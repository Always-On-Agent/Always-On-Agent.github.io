import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { placements, clusterPlacements, PLANES, projectPlane, INITIAL_CAMERA, dragCamera, worldPoint, projectPoint, fitProjection } from '../application-space-core.mjs';

const { applications: cases } = JSON.parse(await readFile(new URL('../data/research-index.json', import.meta.url), 'utf8'));

test('3D clusters preserve every measured case and exclude unmeasured outcomes', () => {
  const points = placements(cases), clusters = clusterPlacements(cases);
  assert.equal(points.length, 39);
  assert.equal(new Set(points.map(p => p.id)).size, 36);
  assert.equal(clusters.reduce((n, c) => n + c.ids.length, 0), 32);
  assert.equal(clusters.length, 9);
  assert.equal(new Set(clusters.flatMap(c => c.ids)).size, 29);
  const unmeasured = cases.filter(item => item.horizon === 'Unmeasured');
  assert.equal(unmeasured.length, 7);
  assert.ok(clusters.every(c => c.horizon !== 'Unmeasured' && c.ids.every(id => !unmeasured.some(item => item.id === id))));
});

test('the three projections retain all 36 works and deduplicate shared locations', () => {
  PLANES.forEach((plane, index) => {
    const cells = projectPlane(cases, plane);
    assert.equal(cells.reduce((n, cell) => n + cell.ids.length, 0), [39,38,37][index]);
    assert.equal(new Set(cells.flatMap(cell => cell.ids)).size, 36);
    assert.ok(cells.every(cell => cell.ids.length === new Set(cell.ids).size));
    if (plane.y === 'horizon') assert.equal(new Set(cells.filter(cell => cell.y === 'Unmeasured').flatMap(cell => cell.ids)).size, 7);
  });
  const cells = projectPlane(cases, PLANES[0]);
  assert.ok(cells.find(cell => cell.x === 'Wearable' && cell.y === 'Individual').ids.includes('lightmemego2026'));
  assert.ok(cells.find(cell => cell.x === 'Digital' && cell.y === 'Individual').ids.includes('lightmemego2026'));
  assert.ok(projectPlane([], PLANES[2]).every(cell => cell.ids.length === 0));
});

test('dragging rotates the camera, keeps zoom, and bounds vertical rotation', () => {
  const camera = dragCamera(INITIAL_CAMERA, 100, -60);
  assert.ok(camera.yaw > INITIAL_CAMERA.yaw);
  assert.ok(camera.tilt > INITIAL_CAMERA.tilt);
  assert.equal(camera.zoom, INITIAL_CAMERA.zoom);
  assert.equal(dragCamera(INITIAL_CAMERA, 0, -1e5).tilt, 1.16);
  assert.equal(dragCamera(INITIAL_CAMERA, 0, 1e5).tilt, .26);
  const point = worldPoint({domain:'Wearable',participant:'Group',horizon:'Cross-session'});
  assert.notDeepEqual(projectPoint(point, INITIAL_CAMERA), projectPoint(point, camera));
});

test('initial and rotated projections keep all data positions inside the stage', () => {
  const clusters = clusterPlacements(cases);
  for (const yaw of [-Math.PI, -1.5, INITIAL_CAMERA.yaw, 0, 1.5, Math.PI]) {
    for (const tilt of [.26, INITIAL_CAMERA.tilt, 1.16]) {
      const project = fitProjection({yaw,tilt,zoom:1});
      for (const cluster of clusters) {
        const point = project(worldPoint(cluster));
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        assert.ok(point.x > 35 && point.x < 745 && point.y > 35 && point.y < 495);
      }
    }
  }
});
