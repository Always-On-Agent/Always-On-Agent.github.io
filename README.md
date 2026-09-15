# Always-On Personal AI

Project website for **Always-On Personal AI: A Roadmap towards a Continuing and Self-Evolving Loop**.

Live site: https://always-on-agent.github.io/

## Structure

- `index.html` — research content, authors, and citation
- `styles.css` — responsive visual design
- `script.js` — accessible channel explorer, citation copy, and section navigation
- `assets/` — project icon, paper figures, and the current paper PDF
- `citation.bib` — downloadable citation for the working draft
- `reading-list.md` — curated snapshot of the survey’s reading list
- `halo/` — public evidence explorer, local analysis-task builder, and local report viewer
- `research.js`, `research-core.mjs`, `research.css` — searchable table index and application map/table
- `application-space.mjs`, `application-space-core.mjs`, `application-space.css` — draggable 3D application space, glass projection panels, and linked work inspector
- `data/research-index.json` — public export of all cited rows in the 11 module/application tables

This is a dependency-free static website. No package installation or build step is required.

## Preview locally

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/.

## Publish

GitHub Pages serves the `main` branch at `/ (root)`. Push changes to `main` to publish. `.nojekyll` ensures assets are served without Jekyll processing.

To update the paper, replace `assets/always-on-personal-ai.pdf`. Keep website copy, figure exports, author order, and the BibTeX in `index.html` and `citation.bib` synchronized with the approved draft.

## Content and provenance

The website summarizes the September 2026 working draft. The HALO count refers to a source-based review of 31 configurations from 30 works; it is not a field-prevalence estimate or a claim of new run-mode benchmark results. The linked PDF retains its current draft author block.

The visual identity and figures belong to this research project. The reading order was inspired by the [Long-Horizon Agents survey website](https://long-horizon-agents.github.io/); its text, figures, and source code were not copied.

## Research index and application map

The September 15 snapshot contains 195 distinct bibliography references across 208 source table rows (241 citation placements). Entries retain their module, category, subgroup, channel where explicit, original column text, and source table/page. The five channel implementation tables contain 49 works/placements: S→M 4, M→A 8, A→S 17, M→S 11, A→M 9. Additional evaluation entries can also carry a channel tag.

Sources are the citation-bearing tables in `sec/04_sensing.tex`, `sec/05_memory.tex`, `sec/06_action.tex`, and `sec/table_system_landscape.tex` in the survey checkout. Titles and years come from `custom.bib` and `position_refs.bib`; missing links were filled from the existing HALO inventory, reading list, or matching primary publication pages. PDF links use the compiled document's named destinations.

The application map preserves all 36 cases from the application table. Domains and participant scopes are arrays. Cross-domain cases appear in both matrix columns and count once. Outcome horizons describe the chosen evaluated consequence: `s` combines immediate/within-session results, and `--` remains Unmeasured. These are categorical coordinates, not numerical performance scores. Product/preview/demonstration/synthetic-history notes are retained only where the manuscript states them. The application cases and HALO configurations are separate selections.

The desktop application explorer opens in a draggable 3D view. Its categorical axes are interaction domain, participant scope, and measured outcome horizon. A location groups works sharing those categories; selecting a cluster opens its work list. Unmeasured cases stay on a separate shelf. “Unfold planes” shows Domain × People, Domain × Horizon, and People × Horizon with a shared work inspector. The same case highlights every matching cell. Switching views clears a location filter while retaining a selected case. The 2D map and full table remain available, with the 2D map as the initial mobile view.

The three glass planes preserve all 36 cases, including multiple domains or participant scopes, and deduplicate within each cell. Their totals are 39, 38, and 37 placements; the measured 3D space contains 32 placements for 29 works in 9 clusters, plus 7 Unmeasured works. Dragging and arrow keys rotate the view; +/− controls zoom and Home resets it. The page keeps its normal wheel scrolling. The unfolding transition respects reduced motion; glass cards provide an opaque fallback for reduced transparency.

When the manuscript tables change, regenerate the table records and application cases together, preserve multi-citation rows, refresh the PDF destinations, and check source links. `node --test tests/research.test.mjs tests/application-space.test.mjs` checks completeness, filters, projection counting, horizon semantics, camera bounds, and CSV output.

## HALO workspace

The public `/halo/` route is entirely static. It browses the published read-mode review, prepares a self-contained Markdown task for a local coding agent, and displays locally selected evidence/report files. It does not launch model sessions or contact a local agent. Inputs and imported files are not uploaded or saved by the site.

`halo/data/inventory.json` is an explicit public export of the current v2 source ledger, with local cache paths omitted. Its source SHA-256 is included for provenance. It preserves the 31 configurations and all 155 mechanism judgments. Run results are not inferred from this read-mode inventory.
