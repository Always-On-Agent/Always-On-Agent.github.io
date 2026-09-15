import { CHANNELS, STATUSES, GROUPS, esc, safeUrl, filterRecords, normaliseReport, reportMarkdown, makeTask } from "./core.mjs";

const $ = selector => document.querySelector(selector);
let records = [], selectedId = new URL(location.href).searchParams.get("system"), currentTask = "", protocolPromise;
const views = ["evidence", "prepare", "report"];
const viewTabs = [...document.querySelectorAll("[data-view]")];
function selectView(view, focus = false) {
  if (!views.includes(view)) view = "evidence";
  viewTabs.forEach(tab => {
    const selected = tab.dataset.view === view;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  views.forEach(id => { document.getElementById(id).hidden = id !== view; });
  document.querySelectorAll("[data-view-link]").forEach(link => {
    if (link.dataset.viewLink === view) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  const url = new URL(location.href); url.hash = view; history.replaceState(null, "", url);
}
viewTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectView(tab.dataset.view));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    if (event.key === "ArrowLeft") next = (index + views.length - 1) % views.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = views.length - 1;
    if (next !== undefined) { event.preventDefault(); selectView(views[next], true); }
  });
});
document.querySelectorAll("[data-view-link]").forEach(link => link.addEventListener("click", event => {
  event.preventDefault(); selectView(link.dataset.viewLink); $("#workspace").scrollIntoView({ block: "start" });
}));
window.addEventListener("hashchange", () => selectView(location.hash.slice(1)));
selectView(location.hash.slice(1));

function dot(cell) {
  const star = cell.realization === "indirect_via_A";
  return `<i class="mechanism-dot ${esc(cell.status)}${star ? " starred" : ""}" aria-hidden="true"></i><span class="sr-only">${esc(cell.channel)}: ${esc(STATUSES[cell.status])}${star ? ", documented composition" : ""}; </span>`;
}
function download(text, name, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileStem = value => String(value || "halo-report").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "halo-report";
const text = value => typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
function sourceLink(url, label) {
  const href = safeUrl(url);
  return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : "";
}
function renderRecord(record, container, published = true) {
  const cells = CHANNELS.map(([code, , arrow, title]) => {
    const c = record.cells.find(cell => cell.channel === code);
    const sources = c.source_locator || safeUrl(c.source_url) ? `<div class="cell-source">${esc(text(c.source_locator) || "Source link")}${sourceLink(c.source_url, "Open source")}</div>` : "";
    const evidence = Array.isArray(c.raw_evidence) ? c.raw_evidence.map(value => {
      const e = value && typeof value === "object" ? value : { claim: text(value) };
      return `<div class="cell-source">${esc(text(e.claim || e))}${e.location ? `<br>${esc(text(e.location))}` : ""}${e.origin ? `<br>Origin: ${esc(text(e.origin))}` : ""}${e.kind ? `<br>Evidence form: ${esc(text(e.kind))}` : ""}${sourceLink(e.url, "Open evidence source")}</div>`;
    }).join("") : "";
    const caveats = [["Completed part",c.completed_part],["Unfinished requirement",c.unfinished_part],["Explicit absence",c.explicit_absence],["Unresolved",c.ambiguity],["Next test",c.next_test]].filter(([,v]) => v).map(([label,v]) => `<p class="cell-caveat"><strong>${esc(label)}:</strong> ${esc(text(v))}</p>`).join("");
    const tags = [["Realization",c.realization],["Update branch",c.update_branch]].filter(([,v]) => v).map(([label,v]) => `<span>${esc(label)}: ${esc(text(v).replaceAll("_", " "))}</span>`).join("");
    return `<details class="evidence-channel"><summary><span class="channel-code">${arrow}</span><span class="channel-title">${title}</span>${dot(c)}<span class="status-name">${STATUSES[c.status]}</span></summary><div class="cell-detail"><p>${esc(text(c.rationale))}</p>${sources}${evidence}${caveats}${tags ? `<div class="cell-tags">${tags}</div>` : ""}</div></details>`;
  }).join("");
  const sourceLinks = (record.sources || []).map(s => sourceLink(s.version_url || s.url, s.version || (s.source_kind === "product_documentation" ? "Product documentation" : "Primary source"))).join("");
  container.innerHTML = `<div class="detail-header"><span class="record-group">${esc(published ? GROUPS[record.group] || "SOURCE REVIEW" : "LOCAL FILE · SUPPLIED JUDGMENTS")}</span><h3>${esc(record.name)}</h3><p>${esc(text(record.configuration))}</p><div class="detail-meta"><span>${published ? "Read-mode review" : "Imported report"}</span>${record.source_review_date ? `<span>Reviewed ${esc(record.source_review_date)}</span>` : ""}${published ? "<span>Source-reported evidence</span>" : ""}</div></div><div class="detail-content"><p class="detail-summary">${esc(text(record.summary_en))}</p>${record.comparison_scope ? `<section class="record-section"><h4>What the comparisons establish</h4><p>${esc(text(record.comparison_scope))}</p></section>` : ""}<div class="evidence-channels">${cells}</div>${record.configuration_notes ? `<section class="record-section"><h4>Configuration and scope</h4><p>${esc(text(record.configuration_notes))}</p></section>` : ""}${sourceLinks ? `<section class="record-section"><h4>Primary sources</h4><div class="sources-list">${sourceLinks}</div></section>` : ""}${published ? '<div class="detail-downloads"><button type="button" data-export="json">Download evidence.json ↓</button><button type="button" data-export="report">Download review.md ↓</button></div>' : ""}</div>`;
  if (published) {
    container.querySelector('[data-export="json"]').addEventListener("click", () => download(JSON.stringify({ mode: "read", ...record }, null, 2) + "\n", `${fileStem(record.id)}-evidence.json`, "application/json"));
    container.querySelector('[data-export="report"]').addEventListener("click", () => download(reportMarkdown(record), `${fileStem(record.id)}-review.md`, "text/markdown"));
  }
}
function renderLibrary() {
  const filtered = filterRecords(records, { query: $("#search").value, group: $("#group-filter").value, channel: $("#channel-filter").value, status: $("#status-filter").value });
  $("#result-count").textContent = `${filtered.length} of ${records.length} configurations`;
  if (!filtered.some(record => record.id === selectedId)) selectedId = filtered[0]?.id;
  $("#record-list").innerHTML = filtered.length ? filtered.map(record => `<button type="button" class="record-button" data-record="${esc(record.id)}" aria-pressed="${record.id === selectedId}"><span><strong>${esc(record.name)}</strong><small title="${esc(record.configuration)}">${esc(record.configuration)}</small></span><span class="record-dots">${CHANNELS.map(([code]) => dot(record.cells.find(c => c.channel === code))).join("")}</span></button>`).join("") : '<p class="empty-results">No configurations match.<br>Try a different filter or reset the search.</p>';
  $("#record-list").querySelectorAll("[data-record]").forEach(button => button.addEventListener("click", () => {
    selectedId = button.dataset.record;
    const scrollTop = $("#record-list").scrollTop;
    renderLibrary(); $("#record-list").scrollTop = scrollTop;
    $("#record-list").querySelector(`[data-record="${CSS.escape(selectedId)}"]`)?.focus({ preventScroll: true });
    const url = new URL(location.href); url.searchParams.set("system", selectedId); history.replaceState(null, "", url);
  }));
  const selected = filtered.find(record => record.id === selectedId);
  if (selected) renderRecord(selected, $("#record-detail"));
  else $("#record-detail").innerHTML = '<div class="empty-results">Select another filter to explore the evidence.</div>';
}
for (const id of ["search", "group-filter", "channel-filter", "status-filter"]) $("#" + id).addEventListener(id === "search" ? "input" : "change", renderLibrary);
$("#reset-filters").addEventListener("click", () => { for (const id of ["search", "group-filter", "channel-filter", "status-filter"]) $("#" + id).value = ""; renderLibrary(); });
async function loadLibrary() {
  try {
    const response = await fetch("data/inventory.json"); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); records = data.records.map(normaliseReport);
    if (new Set(records.map(r => r.id)).size !== records.length) throw new Error("Duplicate configuration IDs");
    $("#config-count").textContent = String(records.length); renderLibrary();
  } catch {
    $("#data-error").textContent = "The inventory could not be loaded. Reload this page, or download the inventory directly using the link above.";
    $("#data-error").hidden = false; $("#result-count").textContent = "Inventory unavailable";
    $("#record-detail").innerHTML = '<div class="empty-results">Evidence will appear when the inventory is available.</div>';
  }
}
loadLibrary();

let formRevision = 0;
$("#task-form").addEventListener("input", () => {
  formRevision++; currentTask = ""; $("#generated-task").hidden = true; $("#task-status").textContent = "";
  $("#mode-guidance").textContent = new FormData($("#task-form")).get("mode") === "run"
    ? "Run mode adds isolated tests only where the local agent has a suitable interface and access; missing prerequisites remain explicit limitations."
    : "Read mode produces source-linked judgments and identifies what existing comparisons establish.";
});
async function getProtocol() {
  if (!protocolPromise) protocolPromise = fetch("protocol.md").then(response => { if (!response.ok) throw new Error("Protocol unavailable"); return response.text(); }).catch(error => { protocolPromise = undefined; throw error; });
  return protocolPromise;
}
$("#task-form").addEventListener("submit", async event => {
  event.preventDefault(); const revision = formRevision, values = Object.fromEntries(new FormData(event.target));
  $("#generate-task").disabled = true; $("#task-status").textContent = "Preparing the task and protocol…";
  try {
    const protocol = await getProtocol();
    if (revision !== formRevision) { $("#task-status").textContent = "Inputs changed. Generate the task again when ready."; return; }
    currentTask = makeTask(values, protocol); $("#task-preview").textContent = currentTask; $("#generated-task").hidden = false;
    $("#task-status").textContent = "Task prepared locally. No analysis has been started.";
    $("#generated-task").scrollIntoView({ block: "nearest" });
  } catch (error) { $("#task-status").textContent = error.message === "Protocol unavailable" ? "Could not load the review protocol. Please reload and try again." : error.message; }
  finally { $("#generate-task").disabled = false; }
});
$("#download-task").addEventListener("click", () => { if (currentTask) download(currentTask, "halo-task.md", "text/markdown"); });
let copyTimer;
$("#copy-task").addEventListener("click", async () => {
  if (!currentTask) return; clearTimeout(copyTimer);
  try { await navigator.clipboard.writeText(currentTask); $("#copy-task").textContent = "Copied!"; }
  catch { $("#copy-task").textContent = "Use Download task.md →"; }
  copyTimer = setTimeout(() => { $("#copy-task").textContent = "Copy task"; }, 4000);
});

const MAX_FILE_SIZE = 2_000_000;
let ledgerVersion = 0, reportVersion = 0;
function importMessage(message, error = false) { $("#import-message").textContent = message; $("#import-message").classList.toggle("error", error); }
function updateEmpty() { $("#viewer-empty").hidden = !$("#imported-detail").hidden || !$("#imported-report").hidden; }
$("#evidence-file").addEventListener("change", async event => {
  const version = ++ledgerVersion, file = event.target.files[0];
  $("#imported-detail").hidden = true; updateEmpty();
  if (!file) return;
  try {
    if (file.size > MAX_FILE_SIZE) throw new Error("Choose an evidence file smaller than 2 MB.");
    const raw = await file.text(); if (version !== ledgerVersion) return;
    let input; try { input = JSON.parse(raw); } catch { throw new Error("This file is not valid JSON. Choose the analysis’s evidence.json."); }
    const record = normaliseReport(input); renderRecord(record, $("#imported-detail"), false); $("#imported-detail").hidden = false; updateEmpty();
    importMessage(`Opened ${file.name}. Five channel entries loaded locally; judgments have not been independently verified.`);
  } catch (error) { if (version === ledgerVersion) importMessage(error.message, true); }
});
$("#report-file").addEventListener("change", async event => {
  const version = ++reportVersion, file = event.target.files[0];
  $("#imported-report").hidden = true; updateEmpty();
  if (!file) return;
  try {
    if (file.size > MAX_FILE_SIZE) throw new Error("Choose a report smaller than 2 MB.");
    const raw = await file.text(); if (version !== reportVersion) return;
    $("#report-text").textContent = raw; $("#report-file-name").textContent = file.name; $("#imported-report").hidden = false; updateEmpty();
    importMessage(`Opened ${file.name} locally. The report is displayed as original text.`);
  } catch (error) { if (version === reportVersion) importMessage(error.message, true); }
});
$("#open-sample").addEventListener("click", () => { selectView("evidence"); $("#workspace").scrollIntoView({ block: "start" }); });
