import { MODULES, DOMAINS, HORIZONS, unique, channelCode, selectWorks, selectCases, applicationCells, worksCSV } from "./research-core.mjs";
import { createApplicationSpace } from "./application-space.mjs?v=glass-inside-20260916";

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const safeURL = value => {
  try { const url = new URL(value, location.href); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};
const sourceLink = (url, label = "Source ↗") => url && safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : "";
const haloLinks = record => (record.halo_ids || []).map(id => `<a href="halo/?system=${encodeURIComponent(id)}#evidence">HALO evidence →</a>`).join("");
const tag = (value, type = "") => `<span class="research-tag ${esc(type)}">${esc(value)}</span>`;
const prettyChannel = value => channelCode(value).replace("→", " → ");
const motion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

let data, tables, applicationSpace, filteredWorks = [], page = 1, applicationFamily = "", applicationView = window.matchMedia("(max-width: 760px)").matches ? "map" : "3d", selectedCase = "";
const requestedApplicationView = new URLSearchParams(location.search).get('view');
if (["3d", "planes", "map", "table"].includes(requestedApplicationView)) applicationView = requestedApplicationView;
const expandedReferences = new Set();
const pageSize = 12;

function researchFilters() {
  return { query: $("#research-search").value, module: $("#research-module").value, category: $("#research-category").value, channel: $("#research-channel").value, sort: $("#research-sort").value };
}

function tableSource(record) {
  const table = tables.get(record.table_label);
  return `<a href="${esc(table?.pdf_url || "assets/always-on-personal-ai.pdf")}">${esc(table?.number ? `Table ${table.number}` : "Survey table")} ↗</a>`;
}

function renderReferenceDetails(work) {
  return `<tr class="research-expanded" id="reference-details-${esc(work.cite_key)}"><td colspan="3"><div class="reference-entries">${work.entries.map(entry => `<article><div class="reference-entry-heading"><strong>${esc(entry.module)} · ${esc(entry.category)}</strong>${tableSource(entry)}</div>${entry.subcategory ? `<p class="reference-group">${esc(entry.subcategory)}</p>` : ""}<dl>${Object.entries(entry.columns).map(([key, value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`).join("")}</div></td></tr>`;
}

function renderResearch() {
  filteredWorks = selectWorks(data.records, researchFilters());
  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  page = Math.min(page, totalPages);
  const entries = filteredWorks.flatMap(work => work.entries);
  $("#research-count").textContent = `${filteredWorks.length} of ${data.reference_count} references · ${unique(entries.map(entry => entry.row_id)).length} table rows`;
  $("#research-coverage").innerHTML = MODULES.map(module => {
    const count = filteredWorks.filter(work => work.entries.some(entry => entry.module === module)).length;
    return `<span class="coverage-count"><i class="module-dot dot-${module.toLowerCase()}" aria-hidden="true"></i><strong>${count}</strong> ${module}</span>`;
  }).join("");
  $("#research-rows").innerHTML = filteredWorks.slice((page - 1) * pageSize, page * pageSize).map(work => {
    const expanded = expandedReferences.has(work.cite_key);
    const modules = unique(work.entries.map(entry => entry.module));
    const categories = unique(work.entries.map(entry => entry.category));
    const topics = unique(work.entries.map(entry => entry.channel ? prettyChannel(entry.channel) : entry.subcategory).filter(Boolean));
    return `<tr><th scope="row"><span class="reference-year">${esc(work.year)}</span><strong>${esc(work.work)}</strong><p class="reference-title">${esc(work.title)}</p></th><td><div class="reference-tags">${modules.map(module => tag(module, `tag-${module.toLowerCase()}`)).join("")}</div><p class="reference-categories">${esc(categories.join(" · "))}</p><p class="reference-topics">${esc(topics.slice(0, 3).join(" · "))}${topics.length > 3 ? ` · +${topics.length - 3} more` : ""}</p></td><td><div class="reference-actions">${sourceLink(work.url)}${haloLinks(work)}<button type="button" id="reference-toggle-${esc(work.cite_key)}" data-reference="${esc(work.cite_key)}" aria-expanded="${expanded}"${expanded ? ` aria-controls="reference-details-${esc(work.cite_key)}"` : ""}>${expanded ? "Hide" : "Read"} ${work.entries.length} ${work.entries.length === 1 ? "entry" : "entries"} ${expanded ? "−" : "+"}</button></div></td></tr>${expanded ? renderReferenceDetails(work) : ""}`;
  }).join("") || '<tr><td colspan="3" class="research-empty">No references match these filters. Try a broader search or reset the filters.</td></tr>';
  $("#research-page").textContent = filteredWorks.length ? `Page ${page} of ${totalPages}` : "0 results";
  $("#research-prev").disabled = page <= 1;
  $("#research-next").disabled = page >= totalPages;
  $("#research-export").disabled = !filteredWorks.length;
}

function setResearchPreset({ module = "", channel = "" } = {}) {
  $("#research-search").value = "";
  $("#research-module").value = module;
  $("#research-channel").value = channelCode(channel);
  $("#research-category").value = channel ? "Channel" : "";
  page = 1; expandedReferences.clear(); renderResearch();
}

function renderChannelWorks() {
  for (const code of ["S→M", "M→A", "A→S", "M→S", "A→M"]) {
    const id = code.replace("→", "").toLowerCase();
    const records = data.records.filter(record => record.category === "Channel" && channelCode(record.channel) === code);
    const related = $(`#framework-panel-${id} .channel-related`);
    const renderRows = rows => rows.map(record => {
      const columns = Object.entries(record.columns).slice(1);
      const implementation = columns.slice(0, 2).map(([, value]) => esc(value)).join(' <span class="channel-work-arrow">→</span> ');
      const evaluation = columns[2];
      const indirect = code === "M→S" && Object.values(record.columns)[0].includes("*");
      return `<tr><th scope="row"><strong>${esc(record.work)}</strong>${indirect ? '<span class="channel-route-label">via Action</span>' : ""}<div class="channel-work-links">${sourceLink(record.url, "Paper ↗")}${haloLinks(record)}</div></th><td><p>${implementation}</p>${evaluation ? `<small><strong>${esc(evaluation[0])}:</strong> ${esc(evaluation[1])}</small>` : ""}</td></tr>`;
    }).join("");
    related.innerHTML = `<div class="channel-works-heading"><h5>Works in the survey</h5><span>${records.length} works</span></div><p class="related-intro">All entries in the ${prettyChannel(code)} implementation table. ${tableSource(records[0])}</p><div class="channel-work-table-wrap"><table class="channel-work-table"><thead><tr><th scope="col">Work</th><th scope="col">Guidance, use, and evaluation</th></tr></thead><tbody>${renderRows(records.slice(0, 6))}</tbody><tbody id="channel-more-${id}" hidden>${renderRows(records.slice(6))}</tbody></table></div>${records.length > 6 ? `<button class="channel-show-more" type="button" data-channel-more="${id}" aria-expanded="false" aria-controls="channel-more-${id}">Show all ${records.length} works +</button>` : ""}${code === "M→S" ? '<p class="channel-table-note">Guidance may be realized through Action; the table records the reported route and evaluation.</p>' : ""}<a class="channel-index-link" href="#research" data-index-channel="${code}">Explore these works in the full index →</a>`;
  }
  for (const module of MODULES.slice(0, 3)) {
    const count = selectWorks(data.records, { module }).length;
    $(`#framework-panel-${module.toLowerCase()}`).insertAdjacentHTML("beforeend", `<a class="module-index-link" href="#research" data-index-module="${module}">Browse all ${count} ${module} references →</a>`);
  }
}

function applicationFilters() {
  return { family: applicationFamily, query: $("#application-search").value, participants: $("#application-participants").value };
}

function caseDetail(item) {
  return `<div class="application-detail-heading"><div><span class="section-number">${esc(item.family)}</span><h4>${esc(item.name)}</h4></div><button type="button" data-close-case aria-label="Close system details">×</button></div><div class="reference-tags">${[...item.domains, ...item.participants, item.horizon].map(value => tag(value)).join("")}${item.context ? tag(item.context, "tag-context") : ""}</div><div class="application-detail-body"><section><h5>Key mechanism</h5><p>${esc(item.mechanism)}</p></section><section><h5>Bottleneck</h5><p>${esc(item.bottleneck)}</p></section></div><div class="application-detail-links">${item.sources.map((source,index) => sourceLink(source.url, item.sources.length > 1 ? `Source ${index + 1} ↗` : "Source ↗")).join("")}${haloLinks(item)}<a href="${esc(data.application_table_url)}">Application table in the survey ↗</a></div>`;
}

function renderApplications() {
  const cases = selectCases(data.applications, applicationFilters());
  const families = unique(data.applications.map(item => item.family));
  const familyLabels = ["Daily assistance", "Conversation & meetings", "Digital workspaces", "Physical collaboration"];
  $("#application-families").innerHTML = `<button type="button" data-application-family="" aria-pressed="${!applicationFamily}">All families <span>${data.applications.length}</span></button>` + families.map((family,index) => `<button type="button" data-application-family="${esc(family)}" aria-pressed="${family === applicationFamily}">${familyLabels[index]} <span>${data.applications.filter(item => item.family === family).length}</span></button>`).join("");
  $("#application-count").textContent = `${cases.length} of ${data.applications.length} cases`;
  $("#application-map").innerHTML = `<table class="application-matrix"><caption>Interaction domain → <span>Outcome horizon ↓</span></caption><thead><tr><td></td>${DOMAINS.map(domain => `<th scope="col">${domain}</th>`).join("")}</tr></thead><tbody>${applicationCells(cases).map(row => `<tr><th scope="row">${row.horizon}<small>${({"Within-session":"Including immediate", "Cross-session":"Across interactions", "Longitudinal":"Later outcomes", "Unmeasured":"No measured endpoint"})[row.horizon]}</small></th>${row.cells.map(cell => `<td><div class="map-cell-works">${cell.cases.map(item => `<button type="button" data-application-case="${esc(item.id)}" aria-pressed="${selectedCase === item.id}">${esc(item.name)}${item.domains.length > 1 ? '<span title="Appears in multiple domains" aria-label="Cross-domain">↔</span>' : ""}</button>`).join("") || '<span class="map-cell-empty" aria-label="No coded case in this selection">—</span>'}</div></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  $("#application-rows").innerHTML = cases.map(item => `<tr><th scope="row"><button type="button" data-application-case="${esc(item.id)}" aria-pressed="${selectedCase === item.id}">${esc(item.name)}</button><small>${esc(item.family)}</small></th><td>${esc(item.domains.join(" + "))}<small>${esc(item.participants.join(" + "))}</small></td><td>${esc(item.horizon)}${item.context ? `<small>${esc(item.context)}</small>` : ""}</td><td><p>${esc(item.mechanism)}</p><small><strong>Bottleneck:</strong> ${esc(item.bottleneck)}</small></td></tr>`).join("") || '<tr><td colspan="4" class="research-empty">No application cases match these filters.</td></tr>';
  $("#application-map").hidden = applicationView !== "map";
  $("#application-table-view").hidden = applicationView !== "table";
  document.querySelectorAll("[data-application-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.applicationView === applicationView)));
  const current = cases.find(item => item.id === selectedCase);
  if (!current) selectedCase = "";
  const spatial = ["3d", "planes"].includes(applicationView);
  $("#application-space").hidden = !spatial;
  $("#application-detail").hidden = !current || spatial;
  $("#application-detail").innerHTML = current && !spatial ? caseDetail(current) : "";
  applicationSpace.update({ cases, selectedCase, view: applicationView });
}

function selectApplication(id) {
  selectedCase = id;
  renderApplications();
  if (!id) return;
  const detail = ["3d", "planes"].includes(applicationView) ? applicationSpace.detailElement : $("#application-detail");
  detail?.focus({ preventScroll: true });
  detail?.scrollIntoView({ behavior: motion(), block: "nearest" });
}

function wireEvents() {
  document.querySelectorAll(".research-filters input,.research-filters select,#research-sort").forEach(input => input.addEventListener(input.tagName === "INPUT" ? "input" : "change", () => { page = 1; expandedReferences.clear(); renderResearch(); }));
  $("#research-reset").addEventListener("click", () => setResearchPreset());
  for (const [id, direction] of [["#research-prev", -1], ["#research-next", 1]]) $(id).addEventListener("click", () => { page += direction; renderResearch(); $("#research-explorer").scrollIntoView({ behavior: motion(), block: "start" }); });
  $("#research-export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + worksCSV(filteredWorks)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "always-on-survey-filtered.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#research-rows").addEventListener("click", event => {
    const button = event.target.closest("[data-reference]"); if (!button) return;
    const key = button.dataset.reference; expandedReferences.has(key) ? expandedReferences.delete(key) : expandedReferences.add(key);
    renderResearch(); document.getElementById(`reference-toggle-${key}`).focus({ preventScroll: true });
  });
  document.addEventListener("click", event => {
    const channel = event.target.closest("[data-index-channel]");
    const module = event.target.closest("[data-index-module]");
    if (channel) setResearchPreset({ channel: channel.dataset.indexChannel });
    if (module) setResearchPreset({ module: module.dataset.indexModule });
    const more = event.target.closest("[data-channel-more]");
    if (more) {
      const target = document.getElementById(`channel-more-${more.dataset.channelMore}`);
      target.hidden = !target.hidden; more.setAttribute("aria-expanded", String(!target.hidden));
      const total = more.closest(".channel-related").querySelectorAll("tbody tr").length;
      more.textContent = target.hidden ? `Show all ${total} works +` : "Show fewer −";
    }
  });
  for (const id of ["#application-search", "#application-participants"]) $(id).addEventListener(id.includes("search") ? "input" : "change", renderApplications);
  $("#application-reset").addEventListener("click", () => { applicationFamily = ""; selectedCase = ""; applicationSpace.clearLocation(); $("#application-search").value = ""; $("#application-participants").value = ""; renderApplications(); });
  $("#application-explorer").addEventListener("click", event => {
    const view = event.target.closest("[data-application-view]");
    if (view) { applicationView = view.dataset.applicationView; renderApplications(); }
    const family = event.target.closest("[data-application-family]");
    if (family) { applicationFamily = family.dataset.applicationFamily; renderApplications(); [...document.querySelectorAll("[data-application-family]")].find(button => button.dataset.applicationFamily === applicationFamily)?.focus({ preventScroll: true }); }
    const work = event.target.closest("[data-application-case]");
    if (work) selectApplication(work.dataset.applicationCase);
    if (event.target.closest("[data-close-case]")) {
      const previous = selectedCase; selectedCase = ""; renderApplications();
      [...document.querySelectorAll("[data-application-case]")].find(button => button.dataset.applicationCase === previous && !button.closest("[hidden]"))?.focus({ preventScroll: true });
    }
  });
}

try {
  const response = await fetch("data/research-index.json");
  if (!response.ok) throw new Error(`Index unavailable (${response.status})`);
  data = await response.json(); tables = new Map(data.tables.map(table => [table.label, table]));
  applicationSpace = createApplicationSpace($("#application-space"), { onSelect: selectApplication, renderDetail: caseDetail });
  renderChannelWorks(); renderResearch(); renderApplications(); wireEvents();
} catch (error) {
  $("#research-count").textContent = "The research index could not load. Refresh the page or read the survey PDF below.";
  $("#application-count").textContent = "The application index could not load. The paper’s landscape is available below.";
  $("#research-explorer").querySelectorAll("input,select,button").forEach(control => control.disabled = true);
  $("#application-explorer").querySelectorAll("input,select,button").forEach(control => control.disabled = true);
  console.error(error);
}
