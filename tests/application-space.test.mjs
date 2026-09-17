import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLANES, projectPlane } from '../application-space-core.mjs';
import { selectCases } from '../research-core.mjs';

const { applications: cases } = JSON.parse(await readFile(new URL('../data/research-index.json', import.meta.url), 'utf8'));

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


test('every glass panel preserves the filtered works, including unmeasured public cases', () => {
  for (const filters of [{ participants:'Group' }, { participants:'Public' }, { query:'Vinci' }, { query:'no-such-reference-xyz' }]) {
    const filtered = selectCases(cases, filters);
    for (const plane of PLANES) {
      const ids = new Set(projectPlane(filtered, plane).flatMap(cell => cell.ids));
      assert.deepEqual([...ids].sort(), filtered.map(item => item.id).sort());
    }
  }
});
