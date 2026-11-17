# Mack Living and Laurito Capital

Market screening and analysis for Mack Living and Laurito Capital. This is dated research. It is not credit approval and it is not an investment recommendation.

The site is static HTML, CSS and JavaScript. It is published with GitHub Pages from the `main` branch.

Live site: https://pgraham974.github.io/ecosystem-partners/

Four views:

- **Mack Living.** The Monday morning list. Priority regions, recorded routes, shortcuts and notes live in `mack-monday.json`.
- **Market Screen.** Partner and market screening. The eight-test score uses `scoring-weights.json`. Current weights are live. Proposed weights are not agreed.
- **Analysis Dashboard.** Regional evidence, official 2026/27 Local Housing Allowance rates, commercial benchmark slots, contract opportunities and dataset dates. The separate property comparison site remains at https://pgraham974.github.io/ecosystem-deals/
- **Go / No-Go Checklist.** Partnership to-dos for the local authority lease and the portfolio. The starting list is `checklist.json`. Ticks, notes and owners stay in the browser. Export or import JSON to share them. Open it at https://pgraham974.github.io/ecosystem-partners/#checklist

BiP awards, notices and spend stay on Framework records. That evidence is the existing v4 file, built 3 November 2026. Competitors are the 64 records recovered from the Mack pipeline file, in `competitors.json`. Ask Partners searches the loaded files and cites the record. It does not invent names, financials or scores.

Checks: `node group-model.test.js`, `node market-score.test.js`, `node mack-model.test.js`, `node partners-mece.test.js`, `node partner-flow-model.test.js` and `node checklist-model.test.js`.
