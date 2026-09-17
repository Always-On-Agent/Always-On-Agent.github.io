export const MODULES = ["Sensing", "Memory", "Action", "Applications"];
export const DOMAINS = ["Wearable", "Digital", "Physical"];
export const HORIZONS = ["Within-session", "Cross-session", "Longitudinal", "Unmeasured"];
export const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
export const channelCode = value => String(value ?? "").replace(/\s/g, "");
export const unique = values => [...new Set(values)];

export function selectWorks(records, filters = {}) {
  const query = normalize(filters.query);
  const matches = records.filter(record =>
    (!filters.module || record.module === filters.module) &&
    (!filters.category || record.category === filters.category) &&
    (!filters.channel || channelCode(record.channel) === channelCode(filters.channel)) &&
    (!query || normalize([record.work, record.title, record.year, record.subcategory, record.group, record.channel, ...Object.values(record.columns)].join(" ")).includes(query))
  );
  const grouped = new Map();
  for (const record of matches) {
    if (!grouped.has(record.cite_key)) grouped.set(record.cite_key, { ...record, entries: [] });
    grouped.get(record.cite_key).entries.push(record);
  }
  return [...grouped.values()].sort((a, b) =>
    (filters.sort === "name" ? 0 : (Number(b.year) || 0) - (Number(a.year) || 0)) || a.work.localeCompare(b.work) || a.title.localeCompare(b.title)
  );
}

export function selectCases(cases, filters = {}) {
  const query = normalize(filters.query);
  return cases.filter(item =>
    (!filters.family || item.family === filters.family) &&
    (!filters.participants || item.participants.includes(filters.participants)) &&
    (!query || normalize([item.name, item.family, item.mechanism, item.bottleneck, ...item.domains].join(" ")).includes(query))
  );
}

export function csvValue(value) {
  const text = String(value ?? "");
  // Preserve spreadsheet text instead of interpreting research labels as formulas.
  return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
}

export function worksCSV(works) {
  const rows = [["Reference", "Title", "Year", "URL", "Module", "Category", "Channel", "Table", "Table details"]];
  for (const work of works) for (const entry of work.entries) rows.push([
    entry.work, entry.title, entry.year, entry.url, entry.module, entry.category, entry.channel || "", entry.table_label,
    Object.entries(entry.columns).map(([key,value]) => `${key}: ${value}`).join(" | ")
  ]);
  return rows.map(row => row.map(csvValue).join(",")).join("\r\n") + "\r\n";
}
