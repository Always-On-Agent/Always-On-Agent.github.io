import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectWorks, selectCases, applicationCells, worksCSV } from "../research-core.mjs";

const data = JSON.parse(await readFile(new URL("../data/research-index.json", import.meta.url)));

test("table references retain all placements while the index deduplicates citations", () => {
  assert.equal(data.tables.length, 11);
  assert.equal(data.records.length, 241);
  assert.equal(new Set(data.records.map(row => row.row_id)).size, 208);
  const works = selectWorks(data.records);
  assert.equal(works.length, 195);
  assert.equal(works.reduce((sum, work) => sum + work.entries.length, 0), 241);
  assert.ok(works.every(work => new URL(work.url).protocol === "https:"));
});

test("implementation filters keep evaluation rows separate and search table content", () => {
  const channels = { "S→M": 4, "M→A": 8, "A→S": 17, "M→S": 11, "A→M": 9 };
  for (const [channel, count] of Object.entries(channels)) assert.equal(selectWorks(data.records, { category: "Channel", channel }).length, count);
  const results = selectWorks(data.records, { module: "Sensing", category: "Channel", channel: "M → S", query: "calendar/email" });
  assert.deepEqual(results.map(work => work.cite_key), ["visionclaw2026"]);
  assert.equal(selectWorks(data.records, { query: "no-such-reference-xyz" }).length, 0);
});

test("application coordinates preserve multi-domain, multi-participant, and unmeasured cases", () => {
  assert.equal(data.applications.length, 36);
  const cells = applicationCells(data.applications).flatMap(row => row.cells);
  assert.equal(cells.flatMap(cell => cell.cases).length, 38);
  assert.equal(new Set(cells.flatMap(cell => cell.cases.map(item => item.id))).size, 36);
  assert.equal(cells.filter(cell => cell.cases.some(item => item.id === "assistantx")).length, 2);
  assert.ok(selectCases(data.applications, { participants: "Group" }).some(item => item.id === "visionclaw2026"));
  assert.deepEqual(selectCases(data.applications, { participants: "Public" }).map(item => item.id), ["ouroboros2026"]);
  assert.equal(data.applications.find(item => item.id === "metamuse2026").horizon, "Unmeasured");
  assert.equal(data.applications.find(item => item.id === "mementoar2026").horizon, "Within-session");
});

test("filtered exports preserve the original table placements and spreadsheet-safe text", () => {
  const works = selectWorks(data.records, { query: "Vinci2" });
  const csv = worksCSV(works);
  assert.equal(csv.trim().split("\r\n").length, works.reduce((sum, work) => sum + work.entries.length, 0) + 1);
  assert.match(csv, /Streaming|Video memory/);
  const risky = [{ entries: [{ work: '=HYPERLINK("x")', title: "quoted, title", columns: {}, year: 2026 }] }];
  assert.ok(worksCSV(risky).includes('"\'=HYPERLINK(""x"")"'));
});
