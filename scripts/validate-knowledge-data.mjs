import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, "data");
const seedRoot = path.join(dataRoot, "seeds");

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkSeedFiles(directoryPath) {
  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => path.join(directoryPath, fileName));
}

function normalizeName(value) {
  return value.trim().toLowerCase();
}

function buildAliasIndex(nodeList) {
  const aliasMap = new Map();

  for (const knowledgeNode of nodeList) {
    const candidateNames = [knowledgeNode.name, ...(knowledgeNode.aliases ?? [])];
    for (const candidateName of candidateNames) {
      const normalizedName = normalizeName(candidateName);
      const ownerList = aliasMap.get(normalizedName) ?? [];
      ownerList.push(knowledgeNode.id);
      aliasMap.set(normalizedName, ownerList);
    }
  }

  return aliasMap;
}

function countCoreRelations(nodeList, relationList) {
  const relationCountMap = new Map();

  for (const knowledgeNode of nodeList) {
    relationCountMap.set(knowledgeNode.id, 0);
  }

  for (const knowledgeRelation of relationList) {
    relationCountMap.set(
      knowledgeRelation.from,
      (relationCountMap.get(knowledgeRelation.from) ?? 0) + 1,
    );
    relationCountMap.set(
      knowledgeRelation.to,
      (relationCountMap.get(knowledgeRelation.to) ?? 0) + 1,
    );
  }

  return relationCountMap;
}

function formatIssueList(issueList) {
  return issueList.map((issueText) => `- ${issueText}`).join("\n");
}

const schema = readJsonFile(path.join(dataRoot, "schema.json"));
const catalog = readJsonFile(path.join(dataRoot, "catalog.json"));
const seedFileList = walkSeedFiles(seedRoot);
const seedPayloadList = seedFileList.map(readJsonFile);
const allNodeList = seedPayloadList.flatMap((seedPayload) => seedPayload.nodes ?? []);
const allRelationList = seedPayloadList.flatMap((seedPayload) => seedPayload.relations ?? []);

const issueList = [];
const nodeIdSet = new Set();
const relationIdSet = new Set();
const nodeMap = new Map(allNodeList.map((knowledgeNode) => [knowledgeNode.id, knowledgeNode]));

for (const knowledgeNode of allNodeList) {
  if (nodeIdSet.has(knowledgeNode.id)) {
    issueList.push(`发现重复节点 ID：${knowledgeNode.id}`);
  }
  nodeIdSet.add(knowledgeNode.id);

  for (const requiredField of schema.node.required) {
    if (
      knowledgeNode[requiredField] === undefined ||
      knowledgeNode[requiredField] === null ||
      knowledgeNode[requiredField] === ""
    ) {
      issueList.push(`节点 ${knowledgeNode.id} 缺少必填字段：${requiredField}`);
    }
  }
}

for (const knowledgeRelation of allRelationList) {
  if (relationIdSet.has(knowledgeRelation.id)) {
    issueList.push(`发现重复关系 ID：${knowledgeRelation.id}`);
  }
  relationIdSet.add(knowledgeRelation.id);

  for (const requiredField of schema.relation.required) {
    if (
      knowledgeRelation[requiredField] === undefined ||
      knowledgeRelation[requiredField] === null ||
      knowledgeRelation[requiredField] === ""
    ) {
      issueList.push(`关系 ${knowledgeRelation.id} 缺少必填字段：${requiredField}`);
    }
  }

  if (!nodeMap.has(knowledgeRelation.from)) {
    issueList.push(`关系 ${knowledgeRelation.id} 的起点不存在：${knowledgeRelation.from}`);
  }

  if (!nodeMap.has(knowledgeRelation.to)) {
    issueList.push(`关系 ${knowledgeRelation.id} 的终点不存在：${knowledgeRelation.to}`);
  }
}

const aliasIndex = buildAliasIndex(allNodeList);
for (const [normalizedName, ownerList] of aliasIndex.entries()) {
  const uniqueOwnerList = [...new Set(ownerList)];
  if (uniqueOwnerList.length > 1) {
    issueList.push(`名称或别名重复：${normalizedName} -> ${uniqueOwnerList.join(", ")}`);
  }
}

const coreRelationCountMap = countCoreRelations(allNodeList, allRelationList);
for (const knowledgeNode of allNodeList) {
  if (knowledgeNode.nodeType === "core_concept") {
    const relationCount = coreRelationCountMap.get(knowledgeNode.id) ?? 0;
    if (relationCount < 3) {
      issueList.push(`核心概念关系过少：${knowledgeNode.id} 当前仅 ${relationCount} 条`);
    }
  }
}

const juniorSectionCount = catalog.juniorHigh.domains.reduce(
  (sectionCount, domainItem) => sectionCount + domainItem.sections.length,
  0,
);
const seniorSectionCount = catalog.seniorHigh.domains.reduce(
  (sectionCount, domainItem) => sectionCount + domainItem.sections.length,
  0,
);

if (issueList.length > 0) {
  console.error("知识数据校验失败：");
  console.error(formatIssueList(issueList));
  process.exit(1);
}

console.log("知识数据校验通过。");
console.log(`- 种子文件数：${seedFileList.length}`);
console.log(`- 节点数：${allNodeList.length}`);
console.log(`- 关系数：${allRelationList.length}`);
console.log(`- 初中目录章节数：${juniorSectionCount}`);
console.log(`- 高中目录章节数：${seniorSectionCount}`);
