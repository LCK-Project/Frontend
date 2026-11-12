const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../assets/graph-utils.js"); const ask = require("../fixtures/ask_sample.json");
const graph = ask.graph; const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
const link = (i) => graph.links[i - 1];
test("REL_GROUPS_order_matches_spec", () => assert.deepEqual(G.REL_GROUPS.map(g => g.name), ["소속·역할","승패","출전","픽","전략·오브젝트","기타"]));
test("classifyRelation_by_type", () => { assert.equal(G.classifyRelation(link(1), byId, G.REL_GROUPS), "소속·역할"); assert.equal(G.classifyRelation(link(8), byId, G.REL_GROUPS), "승패"); assert.equal(G.classifyRelation(link(13), byId, G.REL_GROUPS), "출전"); assert.equal(G.classifyRelation(link(17), byId, G.REL_GROUPS), "픽"); assert.equal(G.classifyRelation(link(20), byId, G.REL_GROUPS), "전략·오브젝트"); });
test("classifyRelation_label_rule_for_unknown_type_touching_objective", () => assert.equal(G.classifyRelation(link(24), byId, G.REL_GROUPS), "전략·오브젝트"));
test("classifyRelation_unknown_type_is_etc", () => assert.equal(G.classifyRelation(link(22), byId, G.REL_GROUPS), "기타"));
test("classifyRelation_dangling_endpoint_is_etc", () => assert.equal(G.classifyRelation({source:"x",target:"y",type:"FOO"}, byId, G.REL_GROUPS), "기타"));
test("visibleSetForGroup_membership", () => { const v = G.visibleSetForGroup(graph, "소속·역할", G.REL_GROUPS); assert.equal(v.linkKeys.size, 7); assert.deepEqual([...v.nodeIds].sort(), ["mock:1","mock:16","mock:2","mock:3","mock:4","mock:5","mock:6","mock:7","mock:8"]); });
test("visibleSetForGroup_all", () => { const v = G.visibleSetForGroup(graph, "전체", G.REL_GROUPS); assert.equal(v.linkKeys.size, 24); assert.equal(v.nodeIds.size, 18); });
test("sortNodesForRail_degree_then_name", () => { const s = G.sortNodesForRail(graph.nodes); assert.equal(s[0].id, "mock:1"); assert.equal(s[1].id, "mock:9"); assert.equal(s[2].id, "mock:2"); const deg2 = s.slice(3, 11).map(n => n.name); assert.deepEqual(deg2, [...deg2].sort((a, b) => a.localeCompare(b, "ko"))); });
test("railSubtitle_variants", () => { assert.equal(G.railSubtitle(byId["mock:3"]), "선수 · 관계 2"); assert.equal(G.railSubtitle(byId["mock:9"]), "경기 · 09.06"); assert.equal(G.railSubtitle({label:"Match", match_date:null, degree:1}), "경기 · 날짜 없음"); });
test("labelKo", () => { assert.equal(G.labelKo("Objective"), "오브젝트"); assert.equal(G.labelKo("Weird"), "Weird"); });
test("labelKo_fan_labels", () => { assert.equal(G.labelKo("FanVideo"), "팬 영상"); assert.equal(G.labelKo("FanComment"), "팬 댓글"); assert.equal(G.labelKo("FanOpinion"), "팬 의견"); });
test("computeStats_fixture", () => assert.deepEqual(G.computeStats(ask), { seeds: ["한화생명 이스포츠"], matchCount: 4, linkCount: 24, period: "2025.01 ~ 2025.09", articleCount: 3 }));
test("computeStats_empty_graph", () => assert.deepEqual(G.computeStats({graph:{nodes:[],links:[]}, article_chunks:[]}), { seeds: [], matchCount: 0, linkCount: 0, period: "-", articleCount: 0 }));
test("localNodeDetail_groups_from_graph", () => { const d = G.localNodeDetail("mock:3", graph); assert.equal(d.name, "제카"); assert.equal(d.record, null); assert.equal(d.match, null); assert.deepEqual(d.groups.map(g => [g.relation, g.direction, g.neighbors.map(n => n.id)]), [["MEMBER_OF","out",["mock:1"]],["PICKED_CHAMPION","out",["mock:13"]]]); });
test("localNodeDetail_unknown_id_is_null", () => assert.equal(G.localNodeDetail("nope", graph), null));
test("factNodeIds_first_match_wins", () => { const nodes = [...graph.nodes, {id:"dup", name:"제카", label:"Player"}]; assert.deepEqual(G.factNodeIds({source:"제카", target:"아지르"}, nodes), {sourceId:"mock:3", targetId:"mock:13"}); assert.deepEqual(G.factNodeIds({source:"없는이름", target:"아지르"}, nodes), {sourceId:null, targetId:"mock:13"}); });

// ===== 날짜 스트립 범위 선택 =====
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const TOURNAMENTS = ask.timeline.tournaments;
test("rangeStripLayout_months_and_points", () => {
  const L = G.rangeStripLayout(graph.nodes, TOURNAMENTS, 924, 12);
  assert.equal(L.months.length, 9); assert.equal(L.months[0].key, "2025-01"); assert.equal(L.months[8].key, "2025-09");
  near(L.cell, 100); near(L.months[3].x, 312);
  assert.deepEqual(L.points.map(p => p.date), ["2025-01-15", "2025-04-20", "2025-08-30", "2025-09-06"]);
  near(L.points[0].x, 12 + 100 * 14 / 31); near(L.points[3].x, 812 + 100 * 5 / 30);
});
test("rangeStripLayout_bands_snap_to_month_cells", () => {
  const L = G.rangeStripLayout(graph.nodes, TOURNAMENTS, 924, 12);
  assert.deepEqual(L.bands.map(b => [b.name, b.from, b.to]), [["2025 LCK Cup", "2025-01", "2025-02"], ["2025 LCK Rounds 1-2", "2025-04", "2025-06"], ["2025 LCK Rounds 3-5", "2025-07", "2025-09"]]);
  near(L.bands[0].x, 12); near(L.bands[0].w, 200);
});
test("rangeStripLayout_bands_outside_axis_dropped_and_overflow_clipped", () => {
  const L = G.rangeStripLayout(graph.nodes, [{ name: "옛 대회", start: "2024-06-01", end: "2024-08-01" }, { name: "걸친 대회", start: "2024-11-01", end: "2025-02-10" }, { name: "넘는 대회", start: "2025-09-01", end: "2025-11-30" }, { name: "깨진 대회", start: null, end: "2025-03-01" }], 924, 12);
  assert.deepEqual(L.bands.map(b => [b.name, b.from, b.to]), [["걸친 대회", "2025-01", "2025-02"], ["넘는 대회", "2025-09", "2025-09"]]);
});
test("rangeStripLayout_no_dated_match_is_empty", () => {
  const L = G.rangeStripLayout([{ id: "a", label: "Match", match_date: null }, { id: "t", label: "Team", match_date: null }], TOURNAMENTS, 924, 12);
  assert.deepEqual([L.months, L.points, L.bands], [[], [], []]); assert.equal(G.monthAtX(L, 100), null); assert.equal(G.normalizeRange("2025-01", "2025-02", L), null);
});
test("rangeStripLayout_missing_tournaments_ok", () => assert.deepEqual(G.rangeStripLayout(graph.nodes, undefined, 924, 12).bands, []));
test("monthAtX_clamps_to_axis", () => {
  const L = G.rangeStripLayout(graph.nodes, [], 924, 12);
  assert.equal(G.monthAtX(L, -50), "2025-01"); assert.equal(G.monthAtX(L, 12), "2025-01"); assert.equal(G.monthAtX(L, 111.9), "2025-01"); assert.equal(G.monthAtX(L, 112), "2025-02"); assert.equal(G.monthAtX(L, 5000), "2025-09");
});
test("normalizeRange_swaps_and_clamps", () => {
  const L = G.rangeStripLayout(graph.nodes, [], 924, 12);
  assert.deepEqual(G.normalizeRange("2025-06", "2025-04", L), { from: "2025-04", to: "2025-06" });
  assert.deepEqual(G.normalizeRange("2024-03", "2026-01", L), { from: "2025-01", to: "2025-09" });
  assert.deepEqual(G.normalizeRange("2025-05", "2025-05", L), { from: "2025-05", to: "2025-05" });
  assert.equal(G.normalizeRange("", "2025-05", L), null);
});
// 작은 그래프: 시드 팀 T, 선수 P1(팀과 경기 M1), 선수 P2(경기 M1 에만), 챔피언 C(경기 M2 에만), 날짜 없는 경기 M3, 고립 노드 X
const mini = {
  nodes: [
    { id: "T", label: "Team", is_seed: true, match_date: null }, { id: "P1", label: "Player", match_date: null },
    { id: "P2", label: "Player", match_date: null }, { id: "C", label: "Champion", match_date: null },
    { id: "M1", label: "Match", match_date: "2025-01-15" }, { id: "M2", label: "Match", match_date: "2025-08-30" },
    { id: "M3", label: "Match", match_date: null }, { id: "X", label: "Entity", match_date: null }, { id: "S", label: "Team", is_seed: true, match_date: null }
  ],
  links: [
    { source: "P1", target: "T", type: "MEMBER_OF" }, { source: "T", target: "M1", type: "WON_MATCH" },
    { source: "P1", target: "M1", type: "PLAYED_MATCH" }, { source: "P2", target: "M1", type: "PLAYED_MATCH" },
    { source: "T", target: "M2", type: "LOST_MATCH" }, { source: "C", target: "M2", type: "PICKED_IN" },
    { source: "T", target: "M3", type: "WON_MATCH" }, { source: "S", target: "M1", type: "LOST_MATCH" }
  ]
};
test("visibleSetForRange_null_shows_all", () => { const v = G.visibleSetForRange(mini, null); assert.equal(v.linkKeys.size, 8); assert.equal(v.nodeIds.size, 9); });
test("visibleSetForRange_hides_out_of_range_matches_and_orphans", () => {
  const v = G.visibleSetForRange(mini, { from: "2025-08", to: "2025-09" });
  assert.deepEqual([...v.linkKeys].sort(), ["C|M2|PICKED_IN", "P1|T|MEMBER_OF", "T|M2|LOST_MATCH", "T|M3|WON_MATCH"]);
  // M1(기간 밖)·P2(M1 에만 이어짐)는 빠진다. 날짜 없는 경기 M3, 시드 S, 원래 고립된 X 는 남는다.
  assert.deepEqual([...v.nodeIds].sort(), ["C", "M2", "M3", "P1", "S", "T", "X"]);
});
test("visibleSetForRange_month_bounds_inclusive", () => {
  const v = G.visibleSetForRange(mini, { from: "2025-01", to: "2025-01" });
  assert.ok(v.nodeIds.has("M1")); assert.ok(v.nodeIds.has("P2")); assert.ok(!v.nodeIds.has("M2")); assert.ok(!v.nodeIds.has("C"));
});
test("visibleSet_all_group_equals_range_only", () => {
  const range = { from: "2025-08", to: "2025-09" };
  const a = G.visibleSet(mini, "전체", range, G.REL_GROUPS); const b = G.visibleSetForRange(mini, range);
  assert.deepEqual([...a.linkKeys].sort(), [...b.linkKeys].sort()); assert.deepEqual([...a.nodeIds].sort(), [...b.nodeIds].sort());
});
test("visibleSet_group_and_range_intersect", () => {
  const v = G.visibleSet(mini, "승패", { from: "2025-08", to: "2025-09" }, G.REL_GROUPS);
  // 날짜 없는 경기 M3 의 승패 간선은 기간과 무관하게 남는다.
  assert.deepEqual([...v.linkKeys].sort(), ["T|M2|LOST_MATCH", "T|M3|WON_MATCH"]); assert.deepEqual([...v.nodeIds].sort(), ["M2", "M3", "T"]);
});
test("visibleSet_group_without_range_equals_group_only", () => {
  const a = G.visibleSet(graph, "소속·역할", null, G.REL_GROUPS); const b = G.visibleSetForGroup(graph, "소속·역할", G.REL_GROUPS);
  assert.deepEqual([...a.linkKeys].sort(), [...b.linkKeys].sort()); assert.deepEqual([...a.nodeIds].sort(), [...b.nodeIds].sort());
});

// ===== 간선의 when 으로 기간 판정 =====
const R = (from, to) => ({ from, to });
test("linkInRange_interval_overlap_month_inclusive", () => {
  const link = { source: "a", target: "b", type: "MEMBER_OF", when: [["2025-04-01", "2025-07-23"]] };
  assert.equal(G.linkInRange(link, R("2025-07", "2025-09"), {}), true);
  assert.equal(G.linkInRange(link, R("2025-01", "2025-04"), {}), true);
  assert.equal(G.linkInRange(link, R("2025-08", "2025-09"), {}), false);
  assert.equal(G.linkInRange(link, R("2025-01", "2025-03"), {}), false);
});
test("linkInRange_open_ended_and_open_start", () => {
  assert.equal(G.linkInRange({ when: [["2025-05-01", null]] }, R("2026-01", "2026-03"), {}), true);
  assert.equal(G.linkInRange({ when: [["2025-05-01", null]] }, R("2025-01", "2025-04"), {}), false);
  assert.equal(G.linkInRange({ when: [[null, "2025-02-01"]] }, R("2024-01", "2024-03"), {}), true);
});
test("linkInRange_any_of_several_dates", () => {
  const link = { when: [["2025-04-20", "2025-04-20"], ["2025-08-30", "2025-08-30"]] };
  assert.equal(G.linkInRange(link, R("2025-08", "2025-08"), {}), true);
  assert.equal(G.linkInRange(link, R("2025-05", "2025-07"), {}), false);
});
test("linkInRange_undated_always_visible", () => {
  assert.equal(G.linkInRange({ when: null }, R("2025-08", "2025-08"), {}), true);
  assert.equal(G.linkInRange({ when: [] }, R("2025-08", "2025-08"), {}), true);
});
test("linkInRange_missing_when_falls_back_to_match_date", () => {
  const byId = { m: { id: "m", label: "Match", match_date: "2025-01-15" }, t: { id: "t", label: "Team", match_date: null } };
  assert.equal(G.linkInRange({ source: "t", target: "m" }, R("2025-01", "2025-01"), byId), true);
  assert.equal(G.linkInRange({ source: "t", target: "m" }, R("2025-02", "2025-03"), byId), false);
  assert.equal(G.linkInRange({ source: "t", target: "t" }, R("2025-02", "2025-03"), byId), true);
});
test("visibleSetForRange_fixture_roster_and_picks_follow_range", () => {
  const name = id => byId[id].name;
  const spring = new Set([...G.visibleSetForRange(graph, R("2025-01", "2025-04")).nodeIds].map(name));
  const summer = new Set([...G.visibleSetForRange(graph, R("2025-08", "2025-09")).nodeIds].map(name));
  // 피넛은 4월까지, 제우스는 5월부터 소속이다. 바루스 픽은 4월, 오리아나 픽은 9월 기사에만 있다.
  assert.ok(spring.has("피넛") && !spring.has("제우스")); assert.ok(summer.has("제우스") && !summer.has("피넛"));
  assert.ok(spring.has("바루스") && !spring.has("오리아나")); assert.ok(summer.has("오리아나") && !summer.has("바루스"));
  // 아지르 픽은 4월과 8월 두 번이라 양쪽에 다 보인다. 날짜 없는 대회 참가 관계는 항상 보인다.
  assert.ok(spring.has("아지르") && summer.has("아지르")); assert.ok(spring.has("LCK 2025 Summer") && summer.has("LCK 2025 Summer"));
});
test("fixture_every_link_has_when_field", () => { for (const l of graph.links) assert.ok(l.when === null || Array.isArray(l.when)); assert.equal(graph.links.filter(l => l.when === null).length, 1); });

// ===== 목록·칩·근거 카드가 기간을 따라가기 =====
test("groupCounts_all_links_matches_fixture", () => {
  const c = G.groupCounts(graph, G.REL_GROUPS);
  assert.equal(c["전체"], 24); assert.equal(c["소속·역할"], 7);
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), 48);
});
test("groupCounts_only_counts_given_link_keys", () => {
  const v = G.visibleSetForRange(mini, { from: "2025-08", to: "2025-09" });
  const c = G.groupCounts(mini, G.REL_GROUPS, v.linkKeys);
  assert.deepEqual([c["전체"], c["소속·역할"], c["승패"], c["출전"], c["픽"]], [4, 1, 2, 0, 1]);
});
test("factLinkKey_maps_fact_to_link_or_null", () => {
  assert.equal(G.factLinkKey({ source: "제카", relation: "MEMBER_OF", target: "한화생명 이스포츠" }, graph), "mock:3|mock:1|MEMBER_OF");
  assert.equal(G.factLinkKey({ source: "제카", relation: "NO_SUCH", target: "한화생명 이스포츠" }, graph), null);
  assert.equal(G.factLinkKey({ source: "없는이름", relation: "MEMBER_OF", target: "한화생명 이스포츠" }, graph), null);
});
test("fixture_every_fact_maps_to_a_link", () => { for (const f of ask.graph_facts) assert.notEqual(G.factLinkKey(f, graph), null, `${f.source} ${f.relation} ${f.target}`); });
