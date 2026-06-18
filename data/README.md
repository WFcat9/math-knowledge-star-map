# 数据目录说明

本目录是“数学知识星图”的统一知识库入口。当前策略不是盲目扩库，而是优先保证：

1. 数据关系清楚
2. 前端能稳定读取
3. 范围控制在“初中主干 + 高一高价值主线”

## 文件说明

- [schema.json](/D:/CODEX3/math-knowledge-star-map/data/schema.json)：统一字段规范。
- [catalog.json](/D:/CODEX3/math-knowledge-star-map/data/catalog.json)：全局目录参考。
- [seeds/function-sample.json](/D:/CODEX3/math-knowledge-star-map/data/seeds/function-sample.json)：原始函数样板数据。
- [seeds/junior-algebra.json](/D:/CODEX3/math-knowledge-star-map/data/seeds/junior-algebra.json)：阶段 2 初中数与代数。
- [seeds/junior-geometry-statistics.json](/D:/CODEX3/math-knowledge-star-map/data/seeds/junior-geometry-statistics.json)：阶段 3 初中几何、统计概率、综合实践。
- [seeds/senior-grade1-functions.json](/D:/CODEX3/math-knowledge-star-map/data/seeds/senior-grade1-functions.json)：阶段 4 高一集合与函数主线。
- [seeds/senior-grade1-geometry-vector.json](/D:/CODEX3/math-knowledge-star-map/data/seeds/senior-grade1-geometry-vector.json)：阶段 5 高一三角、向量、解析几何与立体几何精简主线。

## 当前扩充原则

- 初中内容保持较完整主干。
- 高中内容只做高一高价值知识点。
- 新增内容必须优先考虑“是否真的能和已有节点连起来”。
- 如果某类内容暂时接入前端价值不高，就先不做。

## 校验命令

```bash
npm.cmd run validate:data
npm.cmd run build
```

校验脚本会检查：

- 重复 ID
- 重复名称或别名
- 失效关系
- 缺少关系原因
- 核心概念关系过少

## 当前统计

- seed 文件：5 个
- 节点：88 个
- 关系：243 条
- 当前前端已可读取全量知识库运行时数据
- 最终浏览器验收已确认全部 5 个 seed 可通过搜索、详情和一层发散进入页面
