# Mack Living and Laurito Capital

Market screening and analysis for Mack Living and Laurito Capital. This is dated research. It is not credit approval and it is not an investment recommendation.

The site is static HTML, CSS and JavaScript. It is published with GitHub Pages from the `main` branch.

Live site: https://pgraham974.github.io/ecosystem-partners/

The front screen is the boardroom, one area at a time. Greater Manchester is the default. Market Screen, the Analysis Dashboard, Mack Living and Records open from it.

Open market rents, deals executed, properties held and acquisition targets stay blank until they are entered on Records, Position. The empty source file is `portfolio-position.json`.

Ecosystem Deals is at https://pgrahamlc.github.io/ecosystem-deals/

BiP awards, notices and spend stay on Framework records. That evidence is the existing v4 file, built 3 November 2026. Competitors are the 64 records recovered from the Mack pipeline file, in `competitors.json`. Ask Partners searches the loaded files and cites the record. It does not invent names, financials or scores.

Checks: `node group-model.test.js`, `node market-score.test.js`, `node mack-model.test.js`, `node partners-mece.test.js`, `node partner-flow-model.test.js` and `node boardroom-model.test.js`.
