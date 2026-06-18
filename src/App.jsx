import { useState } from "react";
import {
  Atom,
  BookOpenText,
  CaretDown,
  CaretRight,
  CheckCircle,
  Compass,
  Eye,
  EyeSlash,
  FlowArrow,
  GraduationCap,
  MagnifyingGlass,
  Minus,
  Plus,
  ShareNetwork,
  Sparkle,
  Target,
  TreeStructure,
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

const stageLabelMap = { junior: "初中", senior: "高一" };
const domainLabelMap = {
  number_algebra: "数与代数",
  functions: "函数",
  geometry: "图形与几何",
  geometry_algebra: "几何与代数",
  statistics_probability: "统计与概率",
  comprehensive_practice: "综合实践",
};
const levelPalette = [
  { background: "#eaf3ff", border: "#78b5ff", accent: "#1677ff", text: "#234c80" },
  { background: "#e9fbf7", border: "#6ed5bd", accent: "#159878", text: "#205e52" },
  { background: "#fff6e8", border: "#f2bd68", accent: "#d68812", text: "#74501d" },
  { background: "#f4efff", border: "#bba0ef", accent: "#815ec9", text: "#553d86" },
  { background: "#fff0ef", border: "#f2a09a", accent: "#dc625a", text: "#813d38" },
];

function getRelatedNodeId(relation, nodeId) {
  return relation.from === nodeId ? relation.to : relation.from;
}

function getNodeRelations(nodeId, enabledRelations, limit = 8) {
  return knowledgeRelations
    .filter(
      (relation) =>
        enabledRelations[relation.type] &&
        (relation.from === nodeId || relation.to === nodeId),
    )
    .slice(0, limit);
}

function getSearchText(node) {
  return [
    node.name,
    ...(node.aliases ?? []),
    node.summary,
    ...(node.keyFormulas ?? []),
    ...(node.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function buildRootPosition(rootIndex) {
  const rootPositions = [
    { x: 25, y: 32 },
    { x: 72, y: 32 },
    { x: 25, y: 72 },
    { x: 72, y: 72 },
    { x: 49, y: 50 },
    { x: 88, y: 52 },
  ];
  return rootPositions[rootIndex % rootPositions.length];
}

function findOpenPosition(center, rootPosition, index, total, existingPositions, depth) {
  const outwardAngle =
    Math.abs(center.x - rootPosition.x) + Math.abs(center.y - rootPosition.y) < 2
      ? -Math.PI / 2
      : Math.atan2(center.y - rootPosition.y, center.x - rootPosition.x);
  const fanAngle = total <= 1 ? 0 : ((index / (total - 1)) - 0.5) * Math.PI * 1.2;

  for (const radius of [depth === 1 ? 23 : 20, 26, 30, 34]) {
    for (const nudge of [0, 0.35, -0.35, 0.7, -0.7, Math.PI]) {
      const angle = outwardAngle + fanAngle + nudge;
      const candidate = {
        x: Math.max(8, Math.min(92, center.x + Math.cos(angle) * radius)),
        y: Math.max(11, Math.min(89, center.y + Math.sin(angle) * radius)),
      };
      const hasCollision = Object.values(existingPositions).some(
        (position) =>
          Math.abs(position.x - candidate.x) < 14 && Math.abs(position.y - candidate.y) < 12,
      );
      if (!hasCollision) return candidate;
    }
  }

  return {
    x: Math.max(8, Math.min(92, center.x + ((index % 3) - 1) * 15)),
    y: Math.max(11, Math.min(89, center.y + (Math.floor(index / 3) + 1) * 13)),
  };
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
            style={{ color: meta.color, borderTopStyle: meta.dash.length ? "dashed" : "solid" }}
          />
          <span>{meta.label}</span>
        </label>
      ))}
    </div>
  );
}

function KnowledgeDirectory({ grade, onGradeChange, selectedId, onStartNetwork, visible, onClose }) {
  const [openDomains, setOpenDomains] = useState({});
  const stageKey = grade === "初中" ? "juniorHigh" : "seniorHigh";
  const stageValue = grade === "初中" ? "junior" : "senior";
  const stageCatalog = catalog[stageKey];
  const stageNodes = Object.values(knowledgeNodeMap).filter((node) => node.stage === stageValue);

  return (
    <aside className={`left-rail ${visible ? "mobile-visible" : ""}`}>
      <div className="mobile-panel-head">
        <strong>知识目录</strong>
        <button onClick={onClose}><X size={20} /></button>
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

      <p className="directory-tip">点击知识点，在画布上生成一张新知识网</p>
      <div className="tree">
        {stageCatalog.domains.map((domain) => {
          const isOpen = openDomains[domain.id] ?? true;
          const domainNodes = stageNodes.filter((node) =>
            domain.sections.some((section) => node.sectionPath?.includes(section.id)),
          );
          return (
            <div className="directory-domain" key={domain.id}>
              <button
                className="branch"
                onClick={() =>
                  setOpenDomains((current) => ({ ...current, [domain.id]: !isOpen }))
                }
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
                      onClick={() => onStartNetwork(node.id)}
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

function KnowledgeWeb({
  selectedId,
  visibleNodeIds,
  nodePositions,
  rootNodeIds,
  nodeLevels,
  enabledRelations,
  labelsVisible,
  reasonsVisible,
  zoom,
  onSelectAndExpand,
  onZoom,
  onReset,
}) {
  const visibleSet = new Set(visibleNodeIds);
  const visibleRelations = knowledgeRelations.filter(
    (relation) =>
      enabledRelations[relation.type] &&
      visibleSet.has(relation.from) &&
      visibleSet.has(relation.to),
  );

  return (
    <div className="web-canvas">
      <div className="web-hint">
        <Sparkle weight="fill" /> 点击任意节点继续发散，搜索新知识点生成另一张网
      </div>

      <div className="web-stage-wrap">
      <div className="web-stage" style={{ transform: `scale(${zoom / 100})` }}>
        <svg className="web-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {visibleRelations.map((relation) => {
            const from = nodePositions[relation.from];
            const to = nodePositions[relation.to];
            if (!from || !to) return null;
            const meta = relationMetaMap[relation.type];
            const active = selectedId === relation.from || selectedId === relation.to;
            return (
              <line
                key={relation.id}
                className={active ? "active" : ""}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={meta.color}
                strokeDasharray={meta.dash.join(" ")}
              >
                {reasonsVisible ? <title>{`${meta.label}：${relation.reason}`}</title> : null}
              </line>
            );
          })}
        </svg>

        {visibleNodeIds.map((nodeId, index) => {
          const node = knowledgeNodeMap[nodeId];
          const position = nodePositions[nodeId];
          if (!node || !position) return null;
          const level = nodeLevels[nodeId] ?? 0;
          const palette = levelPalette[level % levelPalette.length];
          return (
            <button
              key={nodeId}
              className={`web-node ${selectedId === nodeId ? "selected" : ""} ${
                rootNodeIds.includes(nodeId) ? "root-node" : ""
              }`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                "--node-delay": `${Math.min(index * 45, 500)}ms`,
                "--node-bg": palette.background,
                "--node-border": palette.border,
                "--node-accent": palette.accent,
                "--node-text": palette.text,
              }}
              onClick={() => onSelectAndExpand(nodeId)}
              title={`点击继续发散：${node.name}`}
            >
              <span>{rootNodeIds.includes(nodeId) ? "根" : level}</span>
              <strong>{node.name}</strong>
              {labelsVisible ? (
                <small>{getNodeRelations(nodeId, enabledRelations, 99).length} 条关联</small>
              ) : null}
            </button>
          );
        })}
      </div>
      </div>

      <div className="canvas-tools">
        <button title="放大" onClick={() => onZoom(Math.min(135, zoom + 10))}><Plus /></button>
        <span>{zoom}%</span>
        <button title="缩小" onClick={() => onZoom(Math.max(70, zoom - 10))}><Minus /></button>
        <button title="重置" onClick={onReset}><Target /></button>
      </div>
    </div>
  );
}

function DetailPanel({ selectedId, visible, onClose, onExpand }) {
  const node = knowledgeNodeMap[selectedId];
  const relations = getNodeRelations(selectedId, defaultEnabledRelations, 6);
  return (
    <aside className={`detail-panel ${visible ? "mobile-visible" : ""}`}>
      <div className="detail-head">
        <div>
          <span className="node-tag">{stageLabelMap[node.stage]} · {node.nodeType}</span>
          <h2>{node.name}</h2>
          <p>{node.keyFormulas?.[0] ?? node.summary}</p>
        </div>
        <button onClick={onClose}><X size={22} /></button>
      </div>
      <div className="detail-scroll">
        <section>
          <h3><BookOpenText /> 概念理解</h3>
          <p>{node.definition ?? node.summary}</p>
        </section>
        <section>
          <h3><ShareNetwork /> 直接连接</h3>
          <div className="connection-list">
            {relations.map((relation) => {
              const related = knowledgeNodeMap[getRelatedNodeId(relation, selectedId)];
              const meta = relationMetaMap[relation.type];
              return (
                <button key={relation.id} onClick={() => onExpand(related.id)}>
                  <i style={{ background: meta.color }} />
                  <span><strong>{related.name}</strong><small>{meta.label}：{relation.reason}</small></span>
                  <CaretRight />
                </button>
              );
            })}
          </div>
        </section>
        <section className="mistake-section">
          <h3><WarningCircle weight="fill" /> 常见易错点</h3>
          <p>{node.commonMistakes?.[0] ?? "注意定义条件和适用范围。"}</p>
        </section>
      </div>
      <div className="detail-actions single-action">
        <button className="primary-action" onClick={() => onExpand(selectedId)}>
          <ShareNetwork /> 从这里继续发散
        </button>
      </div>
    </aside>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState("quadratic");
  const [grade, setGrade] = useState("高中");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [toast, setToast] = useState("");
  const [labelsVisible, setLabelsVisible] = useState(true);
  const [reasonsVisible, setReasonsVisible] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [enabledRelations, setEnabledRelations] = useState(defaultEnabledRelations);
  const [visibleNodeIds, setVisibleNodeIds] = useState(["quadratic"]);
  const [rootNodeIds, setRootNodeIds] = useState(["quadratic"]);
  const [nodePositions, setNodePositions] = useState({ quadratic: { x: 50, y: 50 } });
  const [nodeLevels, setNodeLevels] = useState({ quadratic: 0 });
  const [nodeRoots, setNodeRoots] = useState({ quadratic: "quadratic" });
  const selectedNode = knowledgeNodeMap[selectedId];

  const showToastMessage = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const expandNode = (nodeId, makeRoot = false) => {
    const relations = getNodeRelations(nodeId, enabledRelations, 7);
    const relatedIds = relations.map((relation) => getRelatedNodeId(relation, nodeId));
    setSelectedId(nodeId);
    setShowDetail(true);
    setShowSearch(false);

    setRootNodeIds((current) =>
      makeRoot && !current.includes(nodeId) ? [...current, nodeId] : current,
    );
    setVisibleNodeIds((current) => [...new Set([...current, nodeId, ...relatedIds])]);
    const parentLevel = makeRoot ? 0 : nodeLevels[nodeId] ?? 0;
    const rootId = makeRoot ? nodeId : nodeRoots[nodeId] ?? nodeId;
    setNodeLevels((current) => {
      const next = { ...current, [nodeId]: makeRoot ? 0 : current[nodeId] ?? parentLevel };
      relatedIds.forEach((relatedId) => {
        if (next[relatedId] === undefined) next[relatedId] = parentLevel + 1;
      });
      return next;
    });
    setNodeRoots((current) => {
      const next = { ...current, [nodeId]: rootId };
      relatedIds.forEach((relatedId) => {
        if (!next[relatedId]) next[relatedId] = rootId;
      });
      return next;
    });
    setNodePositions((current) => {
      const next = { ...current };
      const alreadyRoot = rootNodeIds.includes(nodeId);
      const rootCount = alreadyRoot ? rootNodeIds.length : rootNodeIds.length + 1;
      const center =
        makeRoot && !alreadyRoot
          ? buildRootPosition(rootCount - 1)
          : next[nodeId] ?? buildRootPosition(rootNodeIds.length);
      next[nodeId] = center;
      const rootPosition = makeRoot ? center : next[rootId] ?? center;
      relatedIds.forEach((relatedId, index) => {
        if (!next[relatedId]) {
          next[relatedId] = findOpenPosition(
            center,
            rootPosition,
            index,
            relatedIds.length,
            next,
            parentLevel + 1,
          );
        }
      });
      return next;
    });
    showToastMessage(makeRoot ? `已生成「${knowledgeNodeMap[nodeId].name}」知识网` : `已继续发散「${knowledgeNodeMap[nodeId].name}」`);
  };

  const resetView = () => {
    setSelectedId("quadratic");
    setVisibleNodeIds(["quadratic"]);
    setRootNodeIds(["quadratic"]);
    setNodePositions({ quadratic: { x: 50, y: 50 } });
    setNodeLevels({ quadratic: 0 });
    setNodeRoots({ quadratic: "quadratic" });
    setZoom(100);
    setEnabledRelations(defaultEnabledRelations);
    setShowDetail(false);
    showToastMessage("已清空画布并回到二次函数");
  };

  const searchResults = Object.values(knowledgeNodeMap).filter((node) => {
    const stageMatches =
      (grade === "初中" && node.stage === "junior") ||
      (grade === "高中" && node.stage === "senior");
    return stageMatches && getSearchText(node).includes(search.trim().toLowerCase());
  });

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={resetView}>
          <span><Atom size={29} weight="duotone" /></span>
          <div><strong>数学知识星图</strong><small>动态发散 · 多网连接</small></div>
        </button>

        <div className={`search-wrap ${showSearch ? "mobile-search-open" : ""}`}>
          <MagnifyingGlass size={20} />
          <input
            value={search}
            onFocus={() => setShowSearch(true)}
            onChange={(event) => { setSearch(event.target.value); setShowSearch(true); }}
            placeholder="输入知识点，生成一张新的知识网…"
          />
          {showSearch && search ? (
            <div className="search-results">
              {searchResults.length ? searchResults.slice(0, 12).map((node) => (
                <button key={node.id} onClick={() => expandNode(node.id, true)}>
                  <ShareNetwork size={18} />
                  <span><strong>{node.name}</strong><small>生成新网并连接已有知识</small></span>
                </button>
              )) : <p>当前知识库暂无这个知识点</p>}
            </div>
          ) : null}
        </div>

        <div className="stage-switch">
          {["初中", "高中"].map((stage) => (
            <button key={stage} className={grade === stage ? "active" : ""} onClick={() => setGrade(stage)}>
              {stage}
            </button>
          ))}
        </div>

        <div className="graph-summary">
          <strong>{visibleNodeIds.length}</strong> 节点
          <span>·</span>
          <strong>{rootNodeIds.length}</strong> 张知识网
        </div>

        <div className="mobile-actions">
          <button onClick={() => setShowSearch(!showSearch)} aria-label="打开搜索"><MagnifyingGlass size={22} /></button>
          <button onClick={() => setShowLeft(true)} aria-label="打开知识目录"><TreeStructure size={22} /></button>
          <button onClick={() => setShowDetail(true)} aria-label="打开知识详情"><BookOpenText size={22} /></button>
        </div>
      </header>

      <div className="workspace">
        <div className={`control-column ${showLeft ? "mobile-visible" : ""}`}>
          <div className="directory-scroll">
            <KnowledgeDirectory
              grade={grade}
              onGradeChange={setGrade}
              selectedId={selectedId}
              onStartNetwork={(nodeId) => expandNode(nodeId, true)}
              visible={showLeft}
              onClose={() => setShowLeft(false)}
            />
          </div>
          <div className="left-fixed-controls">
            <div className="view-controls">
              <p className="eyebrow">视图控制</p>
              <label><span>{labelsVisible ? <Eye /> : <EyeSlash />} 节点标签</span><input type="checkbox" checked={labelsVisible} onChange={() => setLabelsVisible(!labelsVisible)} /></label>
              <label><span><FlowArrow /> 关系说明</span><input type="checkbox" checked={reasonsVisible} onChange={() => setReasonsVisible(!reasonsVisible)} /></label>
            </div>
            <RelationLegend
              enabledRelations={enabledRelations}
              onToggle={(type) => setEnabledRelations((current) => ({ ...current, [type]: !current[type] }))}
            />
            <button className="reset-button" onClick={resetView}><Compass /> 清空并重置</button>
          </div>
        </div>

        <section className="main-stage">
          <div className="stage-heading">
            <div>
              <span>当前焦点</span><strong>{stageLabelMap[selectedNode.stage]}</strong><CaretRight />
              <strong>{domainLabelMap[selectedNode.domain] ?? selectedNode.domain}</strong><CaretRight />
              <b>{selectedNode.name}</b>
            </div>
            <span className="data-badge">知识库 {knowledgeStats.nodeCount} 节点 · {knowledgeStats.relationCount} 关系</span>
          </div>
          <KnowledgeWeb
            selectedId={selectedId}
            visibleNodeIds={visibleNodeIds}
            nodePositions={nodePositions}
            rootNodeIds={rootNodeIds}
            nodeLevels={nodeLevels}
            enabledRelations={enabledRelations}
            labelsVisible={labelsVisible}
            reasonsVisible={reasonsVisible}
            zoom={zoom}
            onSelectAndExpand={(nodeId) => expandNode(nodeId, false)}
            onZoom={setZoom}
            onReset={resetView}
          />
        </section>

        <DetailPanel
          selectedId={selectedId}
          visible={showDetail}
          onClose={() => setShowDetail(false)}
          onExpand={(nodeId) => expandNode(nodeId, false)}
        />
      </div>

      {(showLeft || showDetail) ? (
        <button className="mobile-scrim" aria-label="关闭侧边面板" onClick={() => { setShowLeft(false); setShowDetail(false); }} />
      ) : null}
      {toast ? <div className="toast"><CheckCircle weight="fill" /> {toast}</div> : null}
    </main>
  );
}
