// 그래프 패널용 순수 함수 모음. DOM과 vis-network에 의존하지 않는다.
// 브라우저에서는 window.GraphUtils, Node에서는 module.exports 로 쓴다.
(function () {
  // 라벨 한글명. 맵에 없는 라벨은 원문 그대로 쓴다.
  const LABEL_KO = {
    Team: "팀",
    Player: "선수",
    Champion: "챔피언",
    Tournament: "대회",
    League: "리그",
    Match: "경기",
    Staff: "스태프",
    Coach: "코치",
    Objective: "오브젝트",
    Object: "오브젝트",
    Entity: "엔티티",
    FanVideo: "팬 영상",
    FanComment: "팬 댓글",
    FanOpinion: "팬 의견"
  };

  // 관계 유형 묶음. 배열 순서가 판정 순서다.
  const REL_GROUPS = [
    { name: "소속·역할", types: ["MEMBER_OF", "WORKED_FOR", "COACHES", "PLAYS_ROLE", "TRANSFERRED_TO", "RE_SIGNED_WITH"] },
    { name: "승패", types: ["WON_MATCH", "LOST_MATCH", "WON_GAME", "LOST_GAME", "DEFEATED", "DEFEATED_BY"] },
    { name: "출전", types: ["PLAYED_MATCH", "PLAYED_GAME", "PLAYED_IN", "PARTICIPATED_IN", "COMPETES_WITH"] },
    { name: "픽", types: ["PICKED_CHAMPION", "PICKED_IN", "USED", "PLAYED"] },
    { name: "전략·오브젝트", types: ["CAPTURED", "STARTED_OVER"], labelRule: ["Objective", "Object"] },
    { name: "기타", types: [] }
  ];

  const ETC_GROUP = "기타";
  const ALL_GROUP = "전체";
  const MAX_NEIGHBORS = 20;

  function labelKo(label) {
    return LABEL_KO[label] || label;
  }

  function linkKey(link) {
    return `${link.source}|${link.target}|${link.type}`;
  }

  function compareKo(a, b) {
    return String(a).localeCompare(String(b), "ko");
  }

  function isDatedMatch(node) {
    return node.label === "Match" && typeof node.match_date === "string";
  }

  // "2025-09-06" -> "2025.09"
  function monthLabel(date) {
    return `${date.slice(0, 4)}.${date.slice(5, 7)}`;
  }

  function classifyRelation(link, nodesById, relGroups) {
    for (const group of relGroups) {
      if (group.types.includes(link.type)) return group.name;
    }
    // 타입 조건에 안 걸린 간선에만 라벨 조건을 적용한다. 끝 노드가 없으면 건너뛴다.
    for (const group of relGroups) {
      if (!group.labelRule) continue;
      const ends = [nodesById[link.source], nodesById[link.target]];
      if (ends.some(node => node && group.labelRule.includes(node.label))) return group.name;
    }
    return ETC_GROUP;
  }

  function visibleSetForGroup(graph, groupName, relGroups) {
    const linkKeys = new Set();
    const nodeIds = new Set();
    if (groupName === ALL_GROUP) {
      for (const link of graph.links) linkKeys.add(linkKey(link));
      for (const node of graph.nodes) nodeIds.add(node.id);
      return { linkKeys, nodeIds };
    }
    const nodesById = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
    for (const link of graph.links) {
      if (classifyRelation(link, nodesById, relGroups) !== groupName) continue;
      linkKeys.add(linkKey(link));
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    }
    return { linkKeys, nodeIds };
  }

  function sortNodesForRail(nodes) {
    return [...nodes].sort((a, b) => (b.degree - a.degree) || compareKo(a.name, b.name));
  }

  function railSubtitle(node) {
    if (node.label === "Match") {
      if (typeof node.match_date !== "string") return "경기 · 날짜 없음";
      return `경기 · ${node.match_date.slice(5, 7)}.${node.match_date.slice(8, 10)}`;
    }
    return `${labelKo(node.label)} · 관계 ${node.degree}`;
  }

  function computeStats(data) {
    const graph = data.graph || {};
    const nodes = graph.nodes || [];
    const links = graph.links || [];
    const seeds = nodes
      .filter(node => node.is_seed === true)
      .sort((a, b) => b.degree - a.degree)
      .map(node => node.name);
    const dates = nodes.filter(isDatedMatch).map(node => node.match_date).sort();
    const period = dates.length
      ? `${monthLabel(dates[0])} ~ ${monthLabel(dates[dates.length - 1])}`
      : "-";
    return {
      seeds,
      matchCount: nodes.filter(node => node.label === "Match").length,
      linkCount: links.length,
      period,
      articleCount: (data.article_chunks || []).length
    };
  }

  // ===== 날짜 스트립 범위 선택 =====
  // 설계: docs/specs/2026-11-12-range-strip-design.md 5절. 달 키는 "YYYY-MM" 문자열이다.

  function monthIndex(key) {
    return Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
  }

  function monthKeyOf(index) {
    return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
  }

  function daysInMonth(key) {
    return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();
  }

  // 축은 날짜 있는 경기의 첫 달부터 끝 달까지이고 달마다 같은 폭의 칸을 준다.
  // 대회 띠는 걸친 달 칸의 양끝에 맞추고 축 밖은 잘라 낸다.
  function rangeStripLayout(nodes, tournaments, width, pad) {
    const dated = nodes
      .filter(isDatedMatch)
      .map(node => ({ id: node.id, date: node.match_date.slice(0, 10) }))
      .filter(point => !Number.isNaN(Date.parse(point.date)))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (dated.length === 0) return { months: [], points: [], bands: [], pad, cell: 0 };

    const first = monthIndex(dated[0].date);
    const last = monthIndex(dated[dated.length - 1].date);
    const cell = (width - 2 * pad) / (last - first + 1);
    const cellX = index => pad + (index - first) * cell;

    const months = [];
    for (let index = first; index <= last; index += 1) {
      months.push({ key: monthKeyOf(index), x: cellX(index), w: cell });
    }
    const points = dated.map(point => {
      const key = point.date.slice(0, 7);
      const day = Number(point.date.slice(8, 10));
      return { id: point.id, date: point.date, month: key, x: cellX(monthIndex(key)) + (day - 1) / daysInMonth(key) * cell };
    });
    const bands = [];
    for (const item of tournaments || []) {
      if (!item || typeof item.start !== "string" || typeof item.end !== "string") continue;
      const start = monthIndex(item.start);
      const end = monthIndex(item.end);
      if (Number.isNaN(start) || Number.isNaN(end) || end < first || start > last) continue;
      const from = Math.max(start, first);
      const to = Math.min(end, last);
      bands.push({ name: item.name, x: cellX(from), w: (to - from + 1) * cell, from: monthKeyOf(from), to: monthKeyOf(to) });
    }
    return { months, points, bands, pad, cell };
  }

  // x 좌표가 속한 달. 축 밖이면 가까운 끝 달이다.
  function monthAtX(layout, x) {
    if (layout.months.length === 0) return null;
    const index = Math.floor((x - layout.pad) / layout.cell);
    return layout.months[Math.min(layout.months.length - 1, Math.max(0, index))].key;
  }

  // 두 달을 순서대로 정렬하고 축 범위로 자른다. 축이 없거나 형식이 틀리면 null.
  function normalizeRange(a, b, layout) {
    const valid = key => typeof key === "string" && /^\d{4}-\d{2}$/.test(key);
    if (layout.months.length === 0 || !valid(a) || !valid(b)) return null;
    const first = layout.months[0].key;
    const last = layout.months[layout.months.length - 1].key;
    const clamp = key => (key < first ? first : key > last ? last : key);
    const from = clamp(a < b ? a : b);
    const to = clamp(a < b ? b : a);
    return { from, to };
  }

  // 간선이 고른 기간(달 단위, 양끝 포함)에 걸치는가.
  // link.when 은 [시작일, 종료일] 구간 목록이다. 종료일이 null 이면 지금까지 이어지는 구간이다.
  // when 이 null 이거나 비어 있으면 날짜를 알 수 없는 관계이므로 항상 보인다.
  // when 필드가 아예 없는 옛 응답은 양끝 경기 노드의 날짜로 대신 판정한다.
  const OPEN_FROM = "0000-01";
  const OPEN_TO = "9999-12";

  function linkInRange(link, range, nodesById) {
    let when = link.when;
    if (when === undefined) {
      when = [link.source, link.target]
        .map(id => nodesById[id])
        .filter(node => node && isDatedMatch(node))
        .map(node => [node.match_date, node.match_date]);
    }
    if (!Array.isArray(when) || when.length === 0) return true;
    return when.some(span => {
      const from = span[0] ? span[0].slice(0, 7) : OPEN_FROM;
      const to = span[1] ? span[1].slice(0, 7) : OPEN_TO;
      return from <= range.to && to >= range.from;
    });
  }

  // 기간 선택으로 보이는 간선·노드. range 가 null 이면 전부다.
  // 기간에 걸치지 않는 간선을 숨기고, 그 때문에 간선을 모두 잃은 노드도 숨긴다.
  // 시드 노드와 원래 간선이 없던 노드는 남긴다.
  function visibleSetForRange(graph, range) {
    const linkKeys = new Set();
    const nodeIds = new Set();
    if (!range) {
      for (const link of graph.links) linkKeys.add(linkKey(link));
      for (const node of graph.nodes) nodeIds.add(node.id);
      return { linkKeys, nodeIds };
    }
    const nodesById = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
    const hadLink = new Set();
    const hasLink = new Set();
    for (const link of graph.links) {
      hadLink.add(link.source);
      hadLink.add(link.target);
      if (!linkInRange(link, range, nodesById)) continue;
      linkKeys.add(linkKey(link));
      hasLink.add(link.source);
      hasLink.add(link.target);
    }
    for (const node of graph.nodes) {
      if (node.is_seed === true || !hadLink.has(node.id) || hasLink.has(node.id)) nodeIds.add(node.id);
    }
    return { linkKeys, nodeIds };
  }

  // 관계 필터와 기간 선택을 함께 적용한다. 필터가 "전체" 가 아니면 두 조건을 모두 만족하는
  // 간선과 그 양끝 노드만 보인다.
  function visibleSet(graph, groupName, range, relGroups) {
    const byRange = visibleSetForRange(graph, range);
    if (groupName === ALL_GROUP) return byRange;
    const byGroup = visibleSetForGroup(graph, groupName, relGroups);
    const linkKeys = new Set();
    const nodeIds = new Set();
    for (const link of graph.links) {
      const key = linkKey(link);
      if (!byRange.linkKeys.has(key) || !byGroup.linkKeys.has(key)) continue;
      linkKeys.add(key);
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    }
    return { linkKeys, nodeIds };
  }

  function localNodeDetail(nodeId, graph) {
    const nodesById = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
    const node = nodesById[nodeId];
    if (!node) return null;

    const groupMap = new Map();
    let degree = 0;
    for (const link of graph.links) {
      if (link.source !== nodeId && link.target !== nodeId) continue;
      degree += 1;
      const direction = link.source === nodeId ? "out" : "in";
      const neighbor = nodesById[direction === "out" ? link.target : link.source];
      if (!neighbor) continue;
      const key = `${link.type}|${direction}`;
      if (!groupMap.has(key)) groupMap.set(key, { relation: link.type, direction, neighbors: [] });
      const group = groupMap.get(key);
      if (group.neighbors.some(n => n.id === neighbor.id)) continue;
      // 그래프 응답에는 간선 속성이 없어 role 은 항상 null 이다.
      group.neighbors.push({ id: neighbor.id, name: neighbor.name, label: neighbor.label, role: null });
    }

    const groups = [...groupMap.values()]
      .sort((a, b) => (b.neighbors.length - a.neighbors.length) || (a.relation < b.relation ? -1 : a.relation > b.relation ? 1 : 0))
      .map(group => ({
        relation: group.relation,
        direction: group.direction,
        neighbors: group.neighbors.sort((a, b) => compareKo(a.name, b.name)).slice(0, MAX_NEIGHBORS)
      }));

    return { id: node.id, name: node.name, label: node.label, degree, record: null, match: null, groups };
  }

  function factNodeIds(fact, nodes) {
    const findId = name => {
      const found = nodes.find(node => node.name === name);
      return found ? found.id : null;
    };
    return { sourceId: findId(fact.source), targetId: findId(fact.target) };
  }

  // 관계 묶음별 간선 수. linkKeys 를 주면 그 안에 있는 간선만 센다(기간 선택으로 보이는 간선).
  function groupCounts(graph, relGroups, linkKeys) {
    const nodesById = Object.fromEntries(graph.nodes.map(node => [node.id, node]));
    const counts = { [ALL_GROUP]: 0 };
    for (const group of relGroups) counts[group.name] = 0;
    for (const link of graph.links) {
      if (linkKeys && !linkKeys.has(linkKey(link))) continue;
      counts[ALL_GROUP] += 1;
      counts[classifyRelation(link, nodesById, relGroups)] += 1;
    }
    return counts;
  }

  // 근거 카드(사실)에 대응하는 간선 키. 양끝 이름이 그래프에 없거나 그런 간선이 없으면 null.
  function factLinkKey(fact, graph) {
    const { sourceId, targetId } = factNodeIds(fact, graph.nodes);
    if (sourceId === null || targetId === null) return null;
    const key = `${sourceId}|${targetId}|${fact.relation}`;
    return graph.links.some(link => linkKey(link) === key) ? key : null;
  }

  const GraphUtils = {
    classifyRelation,
    visibleSetForGroup,
    sortNodesForRail,
    railSubtitle,
    labelKo,
    computeStats,
    rangeStripLayout,
    monthAtX,
    normalizeRange,
    linkInRange,
    visibleSetForRange,
    visibleSet,
    localNodeDetail,
    factNodeIds,
    groupCounts,
    factLinkKey,
    REL_GROUPS,
    LABEL_KO
  };

  if (typeof module !== "undefined") module.exports = GraphUtils; else window.GraphUtils = GraphUtils;
})();
