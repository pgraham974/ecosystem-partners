# ecosystem-partners
Mack Living | Contract pipeline. Tabs: Pipeline, Partners, Competitors, Supply, Method and sources.
build/build_site.py writes site-data.json and Mack_Living_Pipeline.xlsx (one sheet per tab) from the same JSON. build/coverage_check.py enforces exactly one home per record. A full BiP pull goes in bip-data.json ({cols,rows}) and appears as a section in Method and sources.
