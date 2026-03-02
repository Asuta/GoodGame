# 前端存储方案（v0.1）

## 结论

v0.1 采用 **IndexedDB** 作为主存储，原因如下：

- 容量远大于 localStorage，适合保存大量回合历史与案例文本。
- 支持结构化数据与索引，便于按会话检索回合记录。
- 异步 API，不会明显阻塞主线程。

localStorage 仅可作为少量临时缓存（例如当前 UI 偏好），不作为核心数据源。

## 数据库设计（草案）

- DB 名称：`goodgame_db`
- 版本：`1`

Object Stores：

1. `settings`
- key: `id`（固定使用 `singleton`）
- value: API 配置、模型参数、接口模式等

2. `worlds`
- key: `id`
- value: 世界观设定对象

3. `pcs`
- key: `id`
- value: 玩家角色对象

4. `npcs`
- key: `id`
- index: `sessionId`（可选）
- value: NPC 对象

5. `cases`
- key: `id`
- index: `enabled`
- value: 参考案例条目

6. `sessions`
- key: `id`
- index: `updatedAt`
- value: 一局游戏的配置与状态索引

7. `turns`
- key: `id`
- index: `sessionId`
- index: `createdAt`
- value: 回合记录（模型响应、选项、掷骰、提案、应用结果）

## 导入/导出格式

导出 JSON 顶层结构：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-03-02T00:00:00.000Z",
  "data": {
    "settings": [],
    "worlds": [],
    "pcs": [],
    "npcs": [],
    "cases": [],
    "sessions": [],
    "turns": []
  }
}
```

导入策略（v0.1）：

- 提供两种模式：`replace`（全量覆盖）与 `merge`（按 id 合并）。
- 导入前做 schemaVersion 检查；不兼容则阻断并提示。
- 导入后做引用完整性校验（缺失引用项给出报告）。

## 迁移策略

- 每次 schema 变更提升 DB version。
- 在 `upgrade` 回调中执行数据迁移。
- 保留最小回滚策略：迁移失败时保留旧库并提示导出备份。

## IndexedDB 实现建议

- 首选轻量封装库 `idb`，减少原生 API 模板代码。
- 数据访问层统一封装为 `src/features/storage/*`，避免组件直接读写 DB。
- 所有写操作记录 `updatedAt`，便于会话排序与冲突判断。
