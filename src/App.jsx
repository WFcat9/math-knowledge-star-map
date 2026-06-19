import { useEffect, useRef, useState } from "react";
import {
  ArrowsClockwise,
  Atom,
  BookOpenText,
  CaretDown,
  CaretRight,
  CheckCircle,
  Compass,
  Eye,
  EyeSlash,
  FlowArrow,
  MagnifyingGlass,
  Minus,
  Plus,
  ShareNetwork,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  catalog,
  defaultEnabledRelations,
  knowledgeNodeMap,
  knowledgeRelations,
  knowledgeStats,
  relationMetaMap,
} from "./knowledgeRuntime.js";

const STAGE_WIDTH = 2400;
const STAGE_HEIGHT = 1600;
const DEFAULT_SELECTED_ID = null;
const DEFAULT_ZOOM = 42;
const MIN_ZOOM = 25;
const MAX_ZOOM = 120;
const MAX_HIGHLIGHT_DEPTH = 3;

const stageLabelMap = { junior: "初中", senior: "高一" };
const domainLabelMap = {
  number_algebra: "数与代数",
  functions: "函数",
  geometry: "图形与几何",
  geometry_algebra: "几何与代数",
  statistics_probability: "统计与概率",
  comprehensive_practice: "综合实践",
};

const groupCenterMap = {
  "junior:number_algebra": { x: 430, y: 360 },
  "junior:functions": { x: 980, y: 330 },
  "junior:geometry": { x: 520, y: 980 },
  "junior:statistics_probability": { x: 980, y: 1030 },
  "junior:comprehensive_practice": { x: 740, y: 1390 },
  "senior:functions": { x: 1500, y: 340 },
  "senior:geometry_algebra": { x: 1940, y: 640 },
  "senior:number_algebra": { x: 1460, y: 980 },
  "senior:statistics_probability": { x: 1900, y: 1250 },
};

const levelPalette = {
  root: {
    fill: "#2499f8",
    border: "#ade5fe",
    text: "#ffffff",
    badge: "#ffffff",
    badgeText: "#103d7e",
  },
  level1: {
    fill: "#edfaff",
    border: "#74d9fb",
    text: "#114f75",
    badge: "#2cbaf6",
    badgeText: "#ffffff",
  },
  level2: {
    fill: "#f3f9ff",
    border: "#8bc8ff",
    text: "#184c76",
    badge: "#3a9ef8",
    badgeText: "#ffffff",
  },
  level3: {
    fill: "#f8fcff",
    border: "#bfdcfe",
    text: "#355775",
    badge: "#6bb4ff",
    badgeText: "#ffffff",
  },
  neutral: {
    fill: "rgba(255,255,255,0.92)",
    border: "#d7e4f1",
    text: "#34516f",
    badge: "#6f8aa8",
    badgeText: "#ffffff",
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRelatedNodeId(relation, nodeId) {
  return relation.from === nodeId ? relation.to : relation.from;
}

function getSearchText(node) {
  return [
    node.name,
    ...(node.aliases ?? []),
    node.summary,
    node.definition,
    ...(node.keyFormulas ?? []),
    ...(node.applicationScenarios ?? []),
    ...(node.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getNodeRelations(nodeId, enabledRelations) {
  return knowledgeRelations.filter(
    (relation) =>
      enabledRelations[relation.type] &&
      (relation.from === nodeId || relation.to === nodeId),
  );
}

function getHighlightLevels(selectedId, enabledRelations) {
  if (!selectedId) return {};
  const levelMap = { [selectedId]: 0 };
  let frontier = [selectedId];

  for (let depth = 1; depth <= MAX_HIGHLIGHT_DEPTH; depth += 1) {
    const nextFrontier = [];
    for (const nodeId of frontier) {
      for (const relation of getNodeRelations(nodeId, enabledRelations)) {
        const relatedNodeId = getRelatedNodeId(relation, nodeId);
        if (levelMap[relatedNodeId] !== undefined) continue;
        levelMap[relatedNodeId] = depth;
        nextFrontier.push(relatedNodeId);
      }
    }
    frontier = nextFrontier;
    if (!frontier.length) break;
  }

  return levelMap;
}

function getVisibleNodeIds(selectedId, expandedNodeIds, enabledRelations) {
  const visibleIds = new Set(selectedId ? [selectedId] : []);

  for (const nodeId of expandedNodeIds) {
    visibleIds.add(nodeId);
    for (const relation of getNodeRelations(nodeId, enabledRelations)) {
      visibleIds.add(getRelatedNodeId(relation, nodeId));
    }
  }

  return visibleIds;
}

function pickVisiblePositions(nodePositions, visibleNodeIds) {
  return Object.fromEntries(
    [...visibleNodeIds]
      .filter((nodeId) => nodePositions[nodeId])
      .map((nodeId) => [nodeId, nodePositions[nodeId]]),
  );
}

function getNodePalette(nodeId, highlightLevels) {
  const level = highlightLevels[nodeId];
  if (level === 0) return levelPalette.root;
  if (level === 1) return levelPalette.level1;
  if (level === 2) return levelPalette.level2;
  if (level === 3) return levelPalette.level3;
  return levelPalette.neutral;
}

function getRelationLineLabel(relation) {
  return relationMetaMap[relation.type]?.label ?? relation.type;
}

function getRelationPath(fromPosition, toPosition, relationId) {
  const deltaX = toPosition.x - fromPosition.x;
  const deltaY = toPosition.y - fromPosition.y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const midX = (fromPosition.x + toPosition.x) / 2;
  const midY = (fromPosition.y + toPosition.y) / 2;
  const normalX = -deltaY / distance;
  const normalY = deltaX / distance;
  const seed = relationId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const direction = seed % 2 === 0 ? 1 : -1;
  const bend = clamp(distance * 0.055, 18, 62) * direction;

  return {
    path: `M ${fromPosition.x} ${fromPosition.y} Q ${midX + normalX * bend} ${
      midY + normalY * bend
    } ${toPosition.x} ${toPosition.y}`,
    labelX: midX + normalX * bend * 0.72,
    labelY: midY + normalY * bend * 0.72,
  };
}

function getReadableLabelAngle(fromPosition, toPosition) {
  const angle =
    (Math.atan2(toPosition.y - fromPosition.y, toPosition.x - fromPosition.x) * 180) / Math.PI;
  return angle > 90 || angle < -90 ? angle + 180 : angle;
}

function resolvePositionCollisions(initialPositions) {
  const nextPositions = structuredClone(initialPositions);
  const nodeIds = Object.keys(nextPositions);
  const minGapX = 150;
  const minGapY = 104;

  for (let iteration = 0; iteration < 90; iteration += 1) {
    let moved = false;

    for (let firstIndex = 0; firstIndex < nodeIds.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < nodeIds.length; secondIndex += 1) {
        const firstId = nodeIds[firstIndex];
        const secondId = nodeIds[secondIndex];
        const firstPosition = nextPositions[firstId];
        const secondPosition = nextPositions[secondId];
        const deltaX = secondPosition.x - firstPosition.x;
        const deltaY = secondPosition.y - firstPosition.y;
        const overlapX = minGapX - Math.abs(deltaX);
        const overlapY = minGapY - Math.abs(deltaY);

        if (overlapX <= 0 || overlapY <= 0) continue;

        const seed = firstIndex + secondIndex + iteration;
        const directionX = deltaX === 0 ? (seed % 2 === 0 ? 1 : -1) : Math.sign(deltaX);
        const directionY = deltaY === 0 ? (seed % 3 === 0 ? 1 : -1) : Math.sign(deltaY);
        const pushX = Math.min(34, overlapX / 2 + 2) * directionX;
        const pushY = Math.min(26, overlapY / 2 + 2) * directionY;

        nextPositions[firstId] = {
          x: clamp(firstPosition.x - pushX, 90, STAGE_WIDTH - 90),
          y: clamp(firstPosition.y - pushY, 90, STAGE_HEIGHT - 90),
        };
        nextPositions[secondId] = {
          x: clamp(secondPosition.x + pushX, 90, STAGE_WIDTH - 90),
          y: clamp(secondPosition.y + pushY, 90, STAGE_HEIGHT - 90),
        };
        moved = true;
      }
    }

    if (!moved) break;
  }

  return nextPositions;
}

function getStrongRelationExplanation(selectedNode, relatedNode, relation) {
  const relationLabel = getRelationLineLabel(relation);
  const directionText =
    relation.from === selectedNode.id
      ? `从「${selectedNode.name}」延伸到「${relatedNode.name}」`
      : `理解「${selectedNode.name}」时会回到「${relatedNode.name}」`;

  return `${relationLabel}：${directionText}，因为${relation.reason}`;
}

function buildConceptBlocks(node, allRelations) {
  const directConnections = allRelations.slice(0, 4).map((relation) => {
    const relatedNode = knowledgeNodeMap[getRelatedNodeId(relation, node.id)];
    return `${getRelationLineLabel(relation)}：${relatedNode.name}`;
  });

  const understandingParagraphs = [
    node.definition ?? node.summary,
    `${node.name}属于${stageLabelMap[node.stage]}${domainLabelMap[node.domain] ?? "知识板块"}中的关键节点。它不仅独立成题，还会与${directConnections.join("、")}形成连续的解题链条。`,
    node.applicationScenarios?.length
      ? `常见使用场景包括：${node.applicationScenarios.join("、")}。`
      : `常见使用场景包括概念判断、图像分析、条件转化和综合建模。`,
  ];

  const mistakeDetails = (node.commonMistakes ?? []).slice(0, 3).map((mistake) => ({
    title: mistake,
    detail: `${mistake}。处理时优先回到定义、适用条件和相关联知识点，再决定使用公式或图像判断。`,
  }));

  if (!mistakeDetails.length) {
    mistakeDetails.push({
      title: "忽略适用条件",
      detail: "做题时先确认定义域、已知条件和对象范围，再进行代数或几何推导。",
    });
  }

  return { understandingParagraphs, mistakeDetails };
}

function createInitialPositions() {
  const nextPositions = {};
  const groupedNodes = {};

  for (const node of Object.values(knowledgeNodeMap)) {
    const groupKey = `${node.stage}:${node.domain}`;
    const groupList = groupedNodes[groupKey] ?? [];
    groupList.push(node);
    groupedNodes[groupKey] = groupList;
  }

  for (const [groupKey, groupNodes] of Object.entries(groupedNodes)) {
    const center = groupCenterMap[groupKey] ?? { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
    const groupCount = groupNodes.length;

    const sortedNodes = groupNodes.sort((firstNode, secondNode) =>
      firstNode.name.localeCompare(secondNode.name, "zh-CN"),
    );
    const defaultIndex = sortedNodes.findIndex((node) => node.id === DEFAULT_SELECTED_ID);
    if (defaultIndex > 0) {
      const [defaultNode] = sortedNodes.splice(defaultIndex, 1);
      sortedNodes.unshift(defaultNode);
    }

    const columns = clamp(Math.ceil(Math.sqrt(groupCount * 1.45)), 2, 6);
    const rows = Math.ceil(groupCount / columns);
    const gapX = groupCount > 12 ? 142 : 154;
    const gapY = groupCount > 12 ? 104 : 116;
    const startX = center.x - ((columns - 1) * gapX) / 2;
    const startY = center.y - ((rows - 1) * gapY) / 2;

    sortedNodes.forEach((node, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const stagger = row % 2 === 0 ? 0 : gapX * 0.2;

      nextPositions[node.id] = {
        x: clamp(startX + column * gapX + stagger, 90, STAGE_WIDTH - 90),
        y: clamp(startY + row * gapY, 90, STAGE_HEIGHT - 90),
      };
    });
  }

  return resolvePositionCollisions(nextPositions);
}

function RelationLegend({ enabledRelations, onToggle }) {
  return (
    <div className="relation-legend">
      <p className="eyebrow">关系筛选</p>
      {Object.entries(relationMetaMap).map(([type, meta]) => (
        <label key={type}>
          <input
            type="checkbox"
            checked={enabledRelations[type]}
            onChange={() => onToggle(type)}
          />
          <span
            className="legend-line"
            style={{
              color: meta.color,
              borderTopStyle: meta.dash.length ? "dashed" : "solid",
            }}
          />
          <span>{meta.label}</span>
        </label>
      ))}
    </div>
  );
}

function KnowledgeDirectory({
  grade,
  onGradeChange,
  selectedId,
  onFocusNode,
  visible,
  onClose,
}) {
  const [openDomains, setOpenDomains] = useState({});
  const stageKey = grade === "初中" ? "juniorHigh" : "seniorHigh";
  const stageValue = grade === "初中" ? "junior" : "senior";
  const stageCatalog = catalog[stageKey];
  const stageNodes = Object.values(knowledgeNodeMap).filter((node) => node.stage === stageValue);

  return (
    <aside className={`left-rail ${visible ? "mobile-visible" : ""}`}>
      <div className="mobile-panel-head">
        <strong>知识目录</strong>
        <button onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="stage-tabs">
        {["初中", "高中"].map((stage) => (
          <button
            key={stage}
            className={grade === stage ? "active" : ""}
            onClick={() => onGradeChange(stage)}
          >
            {stage}数学
          </button>
        ))}
      </div>

      <p className="directory-tip">点击知识点，直接在总图中聚焦并高亮相关知识链。</p>
      <div className="tree">
        {stageCatalog.domains.map((domain) => {
          const isOpen = openDomains[domain.id] ?? true;
          const domainNodes = stageNodes.filter((node) =>
            domain.sections.some((section) => node.sectionPath?.includes(section.id)),
          );
          const representativeNode = [...domainNodes].sort(
            (firstNode, secondNode) =>
              getNodeRelations(secondNode.id, defaultEnabledRelations).length -
              getNodeRelations(firstNode.id, defaultEnabledRelations).length,
          )[0];

          return (
            <div className="directory-domain" key={domain.id}>
              <button
                className="branch"
                onClick={() => {
                  setOpenDomains((current) => ({ ...current, [domain.id]: !isOpen }));
                  if (representativeNode) onFocusNode(representativeNode.id);
                }}
              >
                {isOpen ? <CaretDown /> : <CaretRight />}
                {domain.name}
                <small>{domainNodes.length}</small>
              </button>

              {isOpen
                ? domainNodes.map((node) => (
                    <button
                      key={node.id}
                      className={`leaf ${selectedId === node.id ? "active" : ""}`}
                      onClick={() => onFocusNode(node.id)}
                    >
                      {node.name}
                      {selectedId === node.id ? <CheckCircle weight="fill" /> : null}
                    </button>
                  ))
                : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function KnowledgeGraph({
  selectedId,
  nodePositions,
  highlightLevels,
  expandedNodeIds,
  totalExpandedCount,
  enabledRelations,
  labelsVisible,
  reasonsVisible,
  canvasRef,
  isPanning,
  zoom,
  onSelectNode,
  onZoom,
  onReset,
  onCanvasPointerDown,
  onNodePointerDown,
}) {
  const visibleRelations = knowledgeRelations.filter(
    (relation) =>
      enabledRelations[relation.type] &&
      nodePositions[relation.from] &&
      nodePositions[relation.to] &&
      (expandedNodeIds.has(relation.from) || expandedNodeIds.has(relation.to)),
  );

  return (
    <div
      className={`web-canvas ${isPanning ? "is-panning" : ""}`}
      ref={canvasRef}
      onPointerDown={onCanvasPointerDown}
    >
      <div className="web-hint">
        <Sparkle weight="fill" />
        {selectedId
          ? `当前从「${knowledgeNodeMap[selectedId].name}」发散出 ${Object.keys(nodePositions).length} 个知识点，已展开 ${totalExpandedCount} 个发散点`
          : "先从左侧目录或顶部搜索选择一个知识点，再逐层发散成知识网络"}
      </div>

      {!selectedId ? (
        <div className="empty-network">
          <Sparkle weight="fill" />
          <strong>请选择一个知识点开始发散</strong>
          <p>点击左侧章节或知识点，画布会从一个核心节点开始，一层一层长成网络。</p>
        </div>
      ) : null}

      <div className="web-stage-wrap">
        <div className="web-stage" style={{ transform: `scale(${zoom / 100})` }}>
          <svg
            className="web-lines"
            viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {visibleRelations.map((relation) => {
              const fromPosition = nodePositions[relation.from];
              const toPosition = nodePositions[relation.to];
              const relationMeta = relationMetaMap[relation.type];
              const isActive =
                selectedId === relation.from ||
                selectedId === relation.to ||
                (highlightLevels[relation.from] !== undefined &&
                  highlightLevels[relation.to] !== undefined);
              const relationPath = getRelationPath(fromPosition, toPosition, relation.id);
              const lineLabel = getRelationLineLabel(relation);
              const labelWidth = Math.max(52, lineLabel.length * 13 + 18);
              const labelAngle = getReadableLabelAngle(fromPosition, toPosition);

              return (
                <g key={relation.id} className={isActive ? "active" : ""}>
                  <path
                    className={isActive ? "active" : ""}
                    d={relationPath.path}
                    stroke={relationMeta.color}
                    strokeDasharray={relationMeta.dash.join(" ")}
                  />
                  {reasonsVisible ? (
                    <g
                      className={`edge-label-group ${isActive ? "active" : ""}`}
                      transform={`translate(${relationPath.labelX}, ${relationPath.labelY}) rotate(${labelAngle})`}
                    >
                      <rect x={-labelWidth / 2} y="-9" width={labelWidth} height="18" rx="9" />
                      <text textAnchor="middle" dominantBaseline="middle">
                        {lineLabel}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {Object.entries(nodePositions).map(([nodeId, position]) => {
            const node = knowledgeNodeMap[nodeId];
            const palette = getNodePalette(nodeId, highlightLevels);
            const relationCount = getNodeRelations(nodeId, enabledRelations).length;
            const isSelected = selectedId === nodeId;
            const isExpanded = expandedNodeIds.has(nodeId);
            const level = highlightLevels[nodeId];
            const nodeBadge = level === 0 ? "焦" : isExpanded ? "展" : level ?? "待";

            return (
              <button
                key={nodeId}
                className={`web-node ${isSelected ? "selected" : ""} ${
                  level === 0 ? "root-node" : ""
                } ${isExpanded ? "expanded-node" : ""}`}
                style={{
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  "--node-bg": palette.fill,
                  "--node-border": palette.border,
                  "--node-accent": palette.badge,
                  "--node-text": palette.text,
                  "--badge-text": palette.badgeText,
                }}
                title={`${node.name} · ${relationCount} 条关系 · 点击继续发散`}
                onClick={() => onSelectNode(nodeId)}
                onPointerDown={(event) => onNodePointerDown(event, nodeId)}
              >
                <span>{nodeBadge}</span>
                <strong>{node.name}</strong>
                {labelsVisible ? <small>{relationCount} 条关系</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="canvas-tools">
        <button title="放大" onClick={() => onZoom(Math.min(MAX_ZOOM, zoom + 8))}>
          <Plus />
        </button>
        <span>{zoom}%</span>
        <button title="缩小" onClick={() => onZoom(Math.max(MIN_ZOOM, zoom - 8))}>
          <Minus />
        </button>
        <button title="重排" onClick={onReset}>
          <ArrowsClockwise />
        </button>
      </div>
    </div>
  );
}

function DetailPanel({ selectedId, enabledRelations, visible, onClose, onFocusNode }) {
  if (!selectedId) {
    return (
      <aside className={`detail-panel ${visible ? "mobile-visible" : ""}`}>
        <div className="detail-head">
          <div>
            <span className="node-tag">等待选择</span>
            <h2>还没有开始发散</h2>
            <p>从左侧目录或顶部搜索选择一个知识点。</p>
          </div>
          <button onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="detail-scroll">
          <section>
            <h3>
              <BookOpenText /> 使用方式
            </h3>
            <p>先点击一个章节或知识点，画布会出现第一层关联。之后点击任意节点，它会继续向外扩展下一层，逐渐形成知识网络。</p>
            <p>拖动画布空白处可以移动视图，使用右下角按钮可以放大或缩小。</p>
          </section>
        </div>
      </aside>
    );
  }

  const selectedNode = knowledgeNodeMap[selectedId];
  const allRelations = getNodeRelations(selectedId, enabledRelations);
  const conceptBlocks = buildConceptBlocks(selectedNode, allRelations);
  const strongRelations = allRelations.slice(0, 6).map((relation) => {
    const relatedNode = knowledgeNodeMap[getRelatedNodeId(relation, selectedId)];
    return {
      relation,
      relatedNode,
      explanation: getStrongRelationExplanation(selectedNode, relatedNode, relation),
    };
  });

  return (
    <aside className={`detail-panel ${visible ? "mobile-visible" : ""}`}>
      <div className="detail-head">
        <div>
          <span className="node-tag">
            {stageLabelMap[selectedNode.stage]} · {selectedNode.nodeType}
          </span>
          <h2>{selectedNode.name}</h2>
          <p>{selectedNode.keyFormulas?.[0] ?? selectedNode.summary}</p>
        </div>
        <button onClick={onClose}>
          <X size={22} />
        </button>
      </div>

      <div className="detail-scroll">
        <section>
          <h3>
            <BookOpenText /> 概念理解
          </h3>
          {conceptBlocks.understandingParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {(selectedNode.keyFormulas ?? []).length ? (
            <div className="formula-pills">
              {selectedNode.keyFormulas.map((formulaText) => (
                <span key={formulaText}>{formulaText}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h3>
            <ShareNetwork /> 直接联系
          </h3>
          <div className="connection-list">
            {strongRelations.map(({ relation, relatedNode, explanation }) => (
              <button key={relation.id} onClick={() => onFocusNode(relatedNode.id)}>
                <i style={{ background: relationMetaMap[relation.type].color }} />
                <span>
                  <strong>{relatedNode.name}</strong>
                  <small>{explanation}</small>
                </span>
                <CaretRight />
              </button>
            ))}
          </div>
        </section>

        <section className="mistake-section">
          <h3>
            <WarningCircle weight="fill" /> 易错点解析
          </h3>
          {conceptBlocks.mistakeDetails.map((mistakeItem) => (
            <div className="mistake-item" key={mistakeItem.title}>
              <strong>{mistakeItem.title}</strong>
              <p>{mistakeItem.detail}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="detail-actions single-action">
        <button className="primary-action" onClick={() => onFocusNode(selectedId)}>
          <Compass /> 将此知识点设为当前焦点
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState(DEFAULT_SELECTED_ID);
  const [grade, setGrade] = useState("高中");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [toast, setToast] = useState("");
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [reasonsVisible, setReasonsVisible] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [enabledRelations, setEnabledRelations] = useState(defaultEnabledRelations);
  const [nodePositions, setNodePositions] = useState(() => createInitialPositions());
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => new Set());
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const canvasRef = useRef(null);
  const dragStateRef = useRef(null);
  const panStateRef = useRef(null);
  const selectedNode = selectedId ? knowledgeNodeMap[selectedId] : null;
  const highlightLevels = getHighlightLevels(selectedId, enabledRelations);
  const visibleNodeIds = getVisibleNodeIds(selectedId, expandedNodeIds, enabledRelations);
  const visibleNodePositions = pickVisiblePositions(nodePositions, visibleNodeIds);

  useEffect(() => {
    if (!draggingNodeId) return undefined;

    const handlePointerMove = (event) => {
      if (!dragStateRef.current) return;
      const dragState = dragStateRef.current;
      const nextX = clamp(
        dragState.startNodeX + (event.clientX - dragState.startClientX) / dragState.zoomScale,
        90,
        STAGE_WIDTH - 90,
      );
      const nextY = clamp(
        dragState.startNodeY + (event.clientY - dragState.startClientY) / dragState.zoomScale,
        90,
        STAGE_HEIGHT - 90,
      );

      setNodePositions((current) => ({
        ...current,
        [dragState.nodeId]: {
          x: nextX,
          y: nextY,
        },
      }));
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingNodeId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingNodeId]);

  useEffect(() => {
    if (!isPanning) return undefined;

    const handlePointerMove = (event) => {
      const panState = panStateRef.current;
      const canvas = canvasRef.current;
      if (!panState || !canvas) return;

      canvas.scrollLeft = panState.startScrollLeft - (event.clientX - panState.startClientX);
      canvas.scrollTop = panState.startScrollTop - (event.clientY - panState.startClientY);
    };

    const handlePointerUp = () => {
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (!selectedId || draggingNodeId || isPanning) return undefined;

    let frameId = 0;
    const timeoutIds = [];

    const centerSelectedNode = () => {
      const canvas = canvasRef.current;
      const position = nodePositions[selectedId];
      if (!canvas || !position) return;

      const scale = zoom / 100;
      const maxLeft = Math.max(0, canvas.scrollWidth - canvas.clientWidth);
      const maxTop = Math.max(0, canvas.scrollHeight - canvas.clientHeight);
      const nextLeft = clamp(position.x * scale - canvas.clientWidth / 2, 0, maxLeft);
      const nextTop = clamp(position.y * scale - canvas.clientHeight / 2, 0, maxTop);

      canvas.scrollTo({
        left: nextLeft,
        top: nextTop,
        behavior: "smooth",
      });
    };

    // 等节点完成本轮渲染后再居中，避免新发散节点贴在画布边缘。
    frameId = window.requestAnimationFrame(() => {
      centerSelectedNode();
      timeoutIds.push(window.setTimeout(centerSelectedNode, 120));
      timeoutIds.push(window.setTimeout(centerSelectedNode, 360));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [selectedId, zoom, layoutVersion, draggingNodeId, isPanning, nodePositions]);

  const showToastMessage = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const startNetworkFromNode = (nodeId) => {
    setSelectedId(nodeId);
    setExpandedNodeIds(new Set([nodeId]));
    setLayoutVersion((current) => current + 1);
    setShowDetail(true);
    setShowSearch(false);
    showToastMessage(`已从「${knowledgeNodeMap[nodeId].name}」重新发散`);
  };

  const expandNetworkFromNode = (nodeId) => {
    setSelectedId(nodeId);
    setExpandedNodeIds((current) => {
      const nextExpandedNodeIds = new Set(current);
      nextExpandedNodeIds.add(nodeId);
      return nextExpandedNodeIds;
    });
    setLayoutVersion((current) => current + 1);
    setShowDetail(true);
    setShowSearch(false);
    showToastMessage(`已继续发散「${knowledgeNodeMap[nodeId].name}」`);
  };

  const resetLayout = () => {
    setNodePositions(createInitialPositions());
    setSelectedId(DEFAULT_SELECTED_ID);
    setExpandedNodeIds(new Set());
    setZoom(DEFAULT_ZOOM);
    setLayoutVersion((current) => current + 1);
    setShowDetail(false);
    showToastMessage("已清空画布，请重新选择知识点");
  };

  const handleCanvasPointerDown = (event) => {
    if (!canvasRef.current) return;
    if (event.target.closest(".web-node") || event.target.closest(".canvas-tools")) return;

    event.preventDefault();
    panStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: canvasRef.current.scrollLeft,
      startScrollTop: canvasRef.current.scrollTop,
    };
    setIsPanning(true);
  };

  const handleNodePointerDown = (event, nodeId) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingNodeId(nodeId);
    dragStateRef.current = {
      nodeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startNodeX: nodePositions[nodeId].x,
      startNodeY: nodePositions[nodeId].y,
      zoomScale: zoom / 100,
    };
  };

  const searchResults = Object.values(knowledgeNodeMap).filter((node) => {
    const matchesStage =
      (grade === "初中" && node.stage === "junior") ||
      (grade === "高中" && node.stage === "senior");
    return matchesStage && getSearchText(node).includes(search.trim().toLowerCase());
  });

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={resetLayout}>
          <span>
            <Atom size={29} weight="duotone" />
          </span>
          <div>
            <strong>数学知识星图</strong>
            <small>全量总图 · 拖拽排布 · 关系高亮</small>
          </div>
        </button>

        <div className={`search-wrap ${showSearch ? "mobile-search-open" : ""}`}>
          <MagnifyingGlass size={20} />
          <input
            value={search}
            onFocus={() => setShowSearch(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowSearch(true);
            }}
            placeholder="搜索知识点，直接聚焦到总图中的位置…"
          />
          {showSearch && search ? (
            <div className="search-results">
              {searchResults.length ? (
                searchResults.slice(0, 12).map((node) => (
                  <button key={node.id} onClick={() => startNetworkFromNode(node.id)}>
                    <ShareNetwork size={18} />
                    <span>
                      <strong>{node.name}</strong>
                      <small>定位并高亮它的强相关知识</small>
                    </span>
                  </button>
                ))
              ) : (
                <p>当前知识库暂无这个知识点</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="stage-switch">
          {["初中", "高中"].map((stage) => (
            <button
              key={stage}
              className={grade === stage ? "active" : ""}
              onClick={() => setGrade(stage)}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="graph-summary">
          <strong>{knowledgeStats.nodeCount}</strong> 节点
          <span>·</span>
          <strong>{knowledgeStats.relationCount}</strong> 条关系
        </div>

        <div className="mobile-actions">
          <button onClick={() => setShowSearch(!showSearch)} aria-label="打开搜索">
            <MagnifyingGlass size={22} />
          </button>
          <button onClick={() => setShowLeft(true)} aria-label="打开知识目录">
            <BookOpenText size={22} />
          </button>
          <button onClick={() => setShowDetail(true)} aria-label="打开知识详情">
            <ShareNetwork size={22} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <div className={`control-column ${showLeft ? "mobile-visible" : ""}`}>
          <div className="directory-scroll">
            <KnowledgeDirectory
              grade={grade}
              onGradeChange={setGrade}
              selectedId={selectedId}
              onFocusNode={startNetworkFromNode}
              visible={showLeft}
              onClose={() => setShowLeft(false)}
            />
          </div>

          <div className="left-fixed-controls">
            <div className="view-controls">
              <p className="eyebrow">视图控制</p>
              <label>
                <span>
                  {labelsVisible ? <Eye /> : <EyeSlash />} 节点标签
                </span>
                <input
                  type="checkbox"
                  checked={labelsVisible}
                  onChange={() => setLabelsVisible(!labelsVisible)}
                />
              </label>
              <label>
                <span>
                  <FlowArrow /> 连线说明
                </span>
                <input
                  type="checkbox"
                  checked={reasonsVisible}
                  onChange={() => setReasonsVisible(!reasonsVisible)}
                />
              </label>
            </div>

            <RelationLegend
              enabledRelations={enabledRelations}
              onToggle={(type) =>
                setEnabledRelations((current) => ({
                  ...current,
                  [type]: !current[type],
                }))
              }
            />

            <button className="reset-button" onClick={resetLayout}>
              <ArrowsClockwise /> 重排全图
            </button>
          </div>
        </div>

        <section className="main-stage">
          <div className="stage-heading">
            <div>
              {selectedNode ? (
                <>
                  <span>当前焦点</span>
                  <strong>{stageLabelMap[selectedNode.stage]}</strong>
                  <CaretRight />
                  <strong>{domainLabelMap[selectedNode.domain] ?? selectedNode.domain}</strong>
                  <CaretRight />
                  <b>{selectedNode.name}</b>
                </>
              ) : (
                <>
                  <span>等待选择</span>
                  <strong>从左侧目录或搜索开始</strong>
                </>
              )}
            </div>
            <span className="data-badge">
              当前网络 {visibleNodeIds.size}/{knowledgeStats.nodeCount} 节点 · 空白拖拽平移
            </span>
          </div>

          <KnowledgeGraph
            selectedId={selectedId}
            nodePositions={visibleNodePositions}
            highlightLevels={highlightLevels}
            expandedNodeIds={expandedNodeIds}
            totalExpandedCount={expandedNodeIds.size}
            enabledRelations={enabledRelations}
            labelsVisible={labelsVisible}
            reasonsVisible={reasonsVisible}
            canvasRef={canvasRef}
            isPanning={isPanning}
            zoom={zoom}
            onSelectNode={expandNetworkFromNode}
            onZoom={setZoom}
            onReset={resetLayout}
            onCanvasPointerDown={handleCanvasPointerDown}
            onNodePointerDown={handleNodePointerDown}
          />
        </section>

        <DetailPanel
          selectedId={selectedId}
          enabledRelations={enabledRelations}
          visible={showDetail}
          onClose={() => setShowDetail(false)}
          onFocusNode={expandNetworkFromNode}
        />
      </div>

      {showLeft || showDetail ? (
        <button
          className="mobile-scrim"
          aria-label="关闭侧边面板"
          onClick={() => {
            setShowLeft(false);
            setShowDetail(false);
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast">
          <CheckCircle weight="fill" /> {toast}
        </div>
      ) : null}
    </main>
  );
}
