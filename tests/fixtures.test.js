const test = require("node:test"); const assert = require("node:assert/strict");
const ask = require("../fixtures/ask_sample.json"); const nodeFx = require("../fixtures/node_sample.json");
test("fixture_counts", () => { assert.equal(ask.graph.nodes.length, 18); assert.equal(ask.graph.links.length, 24); assert.equal(ask.graph_facts.length, 24); assert.equal(ask.article_chunks.length, 3); });
test("fixture_degree_matches_links", () => { const d = {}; for (const l of ask.graph.links) { d[l.source] = (d[l.source]||0)+1; d[l.target] = (d[l.target]||0)+1; } for (const n of ask.graph.nodes) assert.equal(n.degree, d[n.id] || 0, n.id); });
test("fixture_single_seed_is_team", () => { const seeds = ask.graph.nodes.filter(n => n.is_seed); assert.equal(seeds.length, 1); assert.equal(seeds[0].label, "Team"); });
test("fixture_match_dates", () => { const dates = ask.graph.nodes.filter(n => n.label === "Match").map(n => n.match_date).sort(); assert.deepEqual(dates, ["2025-01-15","2025-04-20","2025-08-30","2025-09-06"]); });
test("fixture_claim_links_have_evidence", () => { const ev = ask.graph.links.filter(l => l.evidence); assert.equal(ev.length, 8); for (const l of ev) { assert.equal(typeof l.evidence.article_key, "string"); assert.equal(l.evidence.confidence, 1.0); } });
test("fixture_node_sample_has_team_and_match", () => { assert.equal(nodeFx["mock:1"].record.wins, 88); assert.equal(nodeFx["mock:9"].match.score_b, 3); assert.equal(nodeFx["mock:1"].groups[0].relation, "MEMBER_OF"); });
