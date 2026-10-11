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
    Entity: "엔티티"
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

  function dateStripLayout(nodes, width, pad) {
    const dated = nodes
      .filter(isDatedMatch)
      .map(node => ({ id: node.id, date: node.match_date.slice(0, 10), t: Date.parse(node.match_date.slice(0, 10)) }))
      .filter(point => !Number.isNaN(point.t))
      .sort((a, b) => a.t - b.t);
    if (dated.length === 0) return { points: [], minLabel: null, maxLabel: null };

    const tmin = dated[0].t;
    const tmax = dated[dated.length - 1].t;
    const points = dated.map(point => ({
      id: point.id,
      x: tmax === tmin ? width / 2 : pad + (point.t - tmin) / (tmax - tmin) * (width - 2 * pad),
      date: point.date
    }));
    return {
      points,
      minLabel: monthLabel(dated[0].date),
      maxLabel: monthLabel(dated[dated.length - 1].date)
    };
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

  const GraphUtils = {
    classifyRelation,
    visibleSetForGroup,
    sortNodesForRail,
    railSubtitle,
    labelKo,
    computeStats,
    dateStripLayout,
    localNodeDetail,
    factNodeIds,
    REL_GROUPS,
    LABEL_KO
  };

  if (typeof module !== "undefined") module.exports = GraphUtils; else window.GraphUtils = GraphUtils;
})();
