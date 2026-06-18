import functionSample from "../data/seeds/function-sample.json";
import juniorAlgebra from "../data/seeds/junior-algebra.json";
import juniorGeometryStatistics from "../data/seeds/junior-geometry-statistics.json";
import seniorGrade1Functions from "../data/seeds/senior-grade1-functions.json";
import seniorGrade1GeometryVector from "../data/seeds/senior-grade1-geometry-vector.json";
import knowledgeCatalog from "../data/catalog.json";

const allSeedPayloads = [
  functionSample,
  juniorAlgebra,
  juniorGeometryStatistics,
  seniorGrade1Functions,
  seniorGrade1GeometryVector,
];

const relationVisualMeta = {
  prerequisite: {
    label: "先修关系",
    color: "#1677ff",
    dash: [],
  },
  develops_to: {
    label: "发展升级",
    color: "#1f8f6a",
    dash: [9, 6],
  },
  equivalent_to: {
    label: "等价转化",
    color: "#00aebd",
    dash: [],
  },
  similar_to: {
    label: "相似对比",
    color: "#8a63d2",
    dash: [3, 6],
  },
  confused_with: {
    label: "容易混淆",
    color: "#ef5c55",
    dash: [7, 7],
  },
  combines_with: {
    label: "组合解题",
    color: "#f08c2e",
    dash: [2, 5],
  },
  applies_to: {
    label: "应用扩展",
    color: "#d18a09",
    dash: [3, 7],
  },
  contains: {
    label: "包含关系",
    color: "#6b7c93",
    dash: [1, 4],
  },
};

const allNodeList = allSeedPayloads.flatMap((seedPayload) => seedPayload.nodes ?? []);
const allRelationList = allSeedPayloads.flatMap((seedPayload) => seedPayload.relations ?? []);

export const knowledgeNodeMap = Object.fromEntries(
  allNodeList.map((knowledgeNode) => [knowledgeNode.id, knowledgeNode]),
);

export const relationMetaMap = relationVisualMeta;
export const knowledgeRelations = allRelationList;
export const knowledgeNodeLayout = functionSample.layout;
export const knowledgeLearningPath = functionSample.learningPath;
export const connectionStepMap = functionSample.connectionSteps;
export const knowledgeStats = {
  seedCount: allSeedPayloads.length,
  nodeCount: allNodeList.length,
  relationCount: allRelationList.length,
};
export const catalog = knowledgeCatalog;
export const defaultEnabledRelations = Object.fromEntries(
  Object.keys(relationVisualMeta).map((relationType) => [relationType, true]),
);
