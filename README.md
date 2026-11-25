# Mack Living and Laurito Capital

Market screening and analysis for Mack Living and Laurito Capital. This is dated research. It is not credit approval and it is not an investment recommendation.

The site is static HTML, CSS and JavaScript. It is published with GitHub Pages from the `main` branch.

Live site: https://pgraham974.github.io/ecosystem-partners/

The front screen is a regional executive snapshot, one area at a time. Greater Manchester is the default priority region in `priority-region.json`. Manchester, Edinburgh, Birmingham, Liverpool and Cheshire are on the same selector. Market Screen, the Analysis Dashboard, Mack Living and Records stay behind that snapshot.

The rent matrix is one table for the selected area. Rows are bedroom size. Columns are LHA, open market rent, the gap in pounds, and the gap in percent. Target acquisitions sit in a separate panel for off-market, auction and on-market. Auction lots come from Ecosystem Deals. On-market counts come from the blocks file in that repo. Off-market has no feed yet.

Open market rents load from the Ecosystem Deals ONS file when it is available. Deals executed and properties held stay blank until they are entered on Records, Position. The empty source file is `portfolio-position.json`. Do not write a zero there unless the holding really is zero.

Ecosystem Deals is at https://pgrahamlc.github.io/ecosystem-deals/

BiP awards, notices and spend stay on Framework records. That evidence is the existing v4 file, built 3 November 2026. Competitors are the 64 records recovered from the Mack pipeline file, in `competitors.json`. Ask Partners searches the loaded files and cites the record. It does not invent names, financials or scores.

Checks: `node group-model.test.js`, `node market-score.test.js`, `node mack-model.test.js`, `node partners-mece.test.js`, `node partner-flow-model.test.js`, `node boardroom-model.test.js`, `node acquisition-channels.test.js` and `node boardroom-ui.test.js`.
