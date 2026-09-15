import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHANNELS, filterRecords, normaliseReport, makeTask, reportMarkdown, safeUrl, esc } from "../halo/core.mjs";

const inventory = JSON.parse(readFileSync(new URL("../halo/data/inventory.json", import.meta.url)));
const protocol = readFileSync(new URL("../halo/protocol.md", import.meta.url), "utf8");
const records = inventory.records;

test("the published export preserves all 31 configurations and the manuscript's channel counts", () => {
  assert.equal(records.length, 31);
  assert.equal(new Set(records.map(r => r.id)).size, 31);
  const expected = { SM: 28, MA: 28, AS: 19, MS: 19, AM: 11 };
  for (const record of records) assert.doesNotThrow(() => normaliseReport(record));
  for (const [channel, count] of Object.entries(expected)) {
    assert.equal(records.filter(r => r.cells.some(c => c.channel === channel && c.status === "reported")).length, count);
  }
});

test("search and combined filters preserve the difference between absent and unreported", () => {
  assert.equal(filterRecords(records, { query: " VisualClaw " }).length, 2);
  assert.equal(filterRecords(records, { group: "D" }).length, 2);
  assert.equal(filterRecords(records, { channel: "AM", status: "absent" }).length, 2);
  assert.equal(filterRecords(records, { channel: "AM", status: "unreported" }).length, 18);
  assert.equal(filterRecords(records, { status: "partial" }).length, 0);
  assert.equal(filterRecords(records, { query: "no-such-configuration" }).length, 0);
});

test("local reports accept the existing five-key schema and reject incomplete or invalid judgments", () => {
  const ledger = { system: "Local test", channels: Object.fromEntries(CHANNELS.map(([, key]) => [key, { status: "unreported", evidence: [{ origin: "code_inspection", claim: "No endpoint specified" }] }])) };
  assert.equal(normaliseReport(ledger).cells.length, 5);
  assert.equal(normaliseReport(ledger).cells[0].raw_evidence[0].origin, "code_inspection");
  delete ledger.channels.outcome_feedback;
  assert.throws(() => normaliseReport(ledger), /Missing AM/);
  const bad = structuredClone(records[0]); bad.cells[0].status = "excellent";
  assert.throws(() => normaliseReport(bad), /Unsupported status/);
  bad.cells[0].status = "reported"; bad.sources = [null];
  assert.throws(() => normaliseReport(bad), /source-record/);
  assert.throws(() => normaliseReport(inventory), /No five-channel/);
});

test("links and labels from imported reports cannot introduce executable HTML or URLs", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,test"), null);
  assert.equal(safeUrl("https://user:secret@example.com/"), null);
  assert.equal(safeUrl("https://arxiv.org/abs/2503.03803"), "https://arxiv.org/abs/2503.03803");
  assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test("task generation includes the complete protocol, output contract, and distinct mode boundaries", () => {
  const values = { target: '/path/with spaces/$(example)/"paper"', mode: "read", scope: "Cross-session state" };
  const task = makeTask(values, protocol);
  assert.ok(task.includes(JSON.stringify(values.target)));
  assert.ok(task.includes("without executing the target system"));
  assert.ok(task.includes(protocol.trim()));
  for (const [, key] of CHANNELS) assert.ok(task.includes(`"${key}"`));
  const runTask = makeTask({ target: "https://example.com/repo", mode: "run" }, protocol);
  assert.ok(runTask.includes("isolated execution"));
  assert.ok(runTask.includes("do not fabricate execution or metrics"));
  assert.throws(() => makeTask({ target: " " }, protocol), /Enter a paper/);
});

test("downloaded review text retains five statuses, sources, and the source-review provenance", () => {
  const report = reportMarkdown(records[0]);
  assert.ok(report.includes("not a newly executed analysis"));
  for (const [, , arrow] of CHANNELS) assert.ok(report.includes(`## ${arrow}`));
  assert.ok(report.includes(records[0].cells[0].source_locator));
  assert.ok(report.includes(records[0].cells[0].source_url));
});
