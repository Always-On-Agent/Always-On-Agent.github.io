# Always-On Personal AI

Project website for **Always-On Personal AI: A Roadmap towards a Continuing and Self-Evolving Loop**.

Live site: https://always-on-agent.github.io/

## Structure

- `index.html` — research content, authors, and citation
- `styles.css` — responsive visual design
- `script.js` — accessible channel explorer, citation copy, and section navigation
- `assets/` — project icon, paper figures, and the current paper PDF
- `demo/` — Minecraft iframe, scene switching and page-level game mode
- `game-src/` — complete editable Minecraft client, bilingual HUD, NPCs, continuous demo and developer guide
- `game/` — deployed client and versioned NTU map assets
- `citation.bib` — downloadable citation for the working draft
- `reading-list.md` — curated snapshot of the survey’s reading list
- `halo/` — public evidence explorer, local analysis-task builder, and local report viewer
- `research.js`, `research-core.mjs`, `research.css` — searchable research index and application filters
- `application-space.mjs`, `application-space-core.mjs`, `application-space.css` — three glass projection panels with work lists and inline details
- `data/research-index.json` — public export of all cited rows in the 11 module/application tables

This is a static website, including a Minecraft client with an in-browser single-player server. No build step is needed to preview the checked-in website. To develop the game, follow [game-src/README.MD](game-src/README.MD).

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

## Research index and application glass panels

The September 15 snapshot contains 195 distinct bibliography references across 208 source table rows (241 citation placements). Entries retain their module, category, subgroup, channel where explicit, original column text, and source table/page. The five channel implementation tables contain 49 works/placements: S→M 4, M→A 8, A→S 17, M→S 11, A→M 9. Additional evaluation entries can also carry a channel tag.

Sources are the citation-bearing tables in `sec/04_sensing.tex`, `sec/05_memory.tex`, `sec/06_action.tex`, and `sec/table_system_landscape.tex` in the survey checkout. Titles and years come from `custom.bib` and `position_refs.bib`; missing links were filled from the existing HALO inventory, reading list, or matching primary publication pages. PDF links use the compiled document's named destinations.

The application explorer preserves all 36 cases from the application table. Domains and participant scopes are arrays. Cross-domain cases appear in each matching cell and count once in a work list. Outcome horizons describe the chosen evaluated consequence: `s` combines immediate/within-session results, and `--` remains Unmeasured. These are categorical coordinates, not numerical performance scores. Product/preview/demonstration/synthetic-history notes are retained only where the manuscript states them. The application cases and HALO configurations are separate selections.

The explorer uses glass panels on desktop and mobile. Domain × People, Domain × Horizon, and People × Horizon stack along visual depth. Their totals are 39, 38, and 37 placements, each retaining all 36 distinct works and deduplicating within every cell. Unmeasured cases remain in the horizon panels and are included in the Domain × People panel. Open `#applications` directly; legacy `view` query parameters have no effect.

Click a panel title, exposed rear edge, or card background to open that projection at its initial matrix, clearing the location and selected work. Clicking the front card resets it to its matrix as well. Drag the title or empty card area sideways to switch layers; a short drag settles back. Vertical gestures retain native page scrolling. On a panel title, arrow keys switch projections and Home/End select the first/last projection.

Select a matrix cell to browse its matching works inside the same card, or use **Browse all works** to list every filtered case. Family, participant, and text filters apply to all panels and work lists. Selecting a work opens its mechanism, bottleneck, and source links inside the panel. **Back to matrix** or Escape returns to the matrix; Back/Close inside a detail returns to the work list. Only the front panel and its visible pane accept input. Returning from a detail restores the work list scroll position, and returning to the matrix restores the source cell focus.

Stable panel elements preserve depth transitions and keyboard focus. Matrix, work list, and details share a fixed footprint; long content scrolls inside the card. Panel changes and the blur-to-clear reveal take about 1.1 seconds, with reduced motion respected. The front glass is less transparent for readability. Reduced transparency or missing backdrop-filter support receives an opaque fallback.

When the manuscript tables change, regenerate the table records and application cases together, preserve multi-citation rows, refresh the PDF destinations, and check source links. Run `node --test tests/research.test.mjs tests/application-space.test.mjs` to check reference completeness, filters, projection counting, multi-domain/participant placement, Unmeasured cases, and spreadsheet-safe CSV output. Browser checks cover panel clicks and dragging, matrix/list/detail navigation, search, all-work access, and legacy query fallback.

## HALO workspace

The public `/halo/` route is entirely static. It browses the published read-mode review, prepares a self-contained Markdown task for a local coding agent, and displays locally selected evidence/report files. It does not launch model sessions or contact a local agent. Inputs and imported files are not uploaded or saved by the site.

`halo/data/inventory.json` is an explicit public export of the current v2 source ledger, with local cache paths omitted. Its source SHA-256 is included for provenance. It preserves the 31 configurations and all 155 mechanism judgments. Run results are not inferred from this read-mode inventory.
