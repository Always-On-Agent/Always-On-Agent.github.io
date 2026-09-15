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

## HALO workspace

The public `/halo/` route is entirely static. It browses the published read-mode review, prepares a self-contained Markdown task for a local coding agent, and displays locally selected evidence/report files. It does not launch model sessions or contact a local agent. Inputs and imported files are not uploaded or saved by the site.

`halo/data/inventory.json` is an explicit public export of the current v2 source ledger, with local cache paths omitted. Its source SHA-256 is included for provenance. It preserves the 31 configurations and all 155 mechanism judgments. Run results are not inferred from this read-mode inventory.
