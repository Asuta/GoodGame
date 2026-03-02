# LLM JSON 协议（v0.1）

本协议用于约束模型输出，确保前端可稳定解析并驱动游戏流程。

## 协议原则

- 模型必须只返回 JSON，不得附加解释性文本。
- 字段不完整或类型错误视为无效响应。
- 无效响应不会推进回合，前端提示重试。

## 顶层结构

```json
{
  "narration": "string",
  "options": [
    {
      "id": "string",
      "text": "string",
      "check": {
        "expr": "1d20+3",
        "dc": 12,
        "skill": "Perception"
      }
    }
  ],
  "proposedPatches": [
    {
      "target": "pc|npc|world",
      "targetId": "string",
      "op": "set|add|remove|inc",
      "path": "stats.hp",
      "value": 3,
      "reason": "string"
    }
  ],
  "meta": {
    "tone": "optional string",
    "safety": "optional string"
  }
}
```

## 字段说明

- `narration`：DM 叙事正文。
- `options`：玩家可点击选项（至少 1 条，建议 3-5 条）。
- `options[].check`：可选判定配置。
  - `expr`：骰表达式（v0.1 支持 `NdM(+/-K)`）。
  - `dc`：难度阈值（可选）。
  - `skill`：关联技能名（可选，仅展示）。
- `proposedPatches`：状态变更提案数组。
  - 只提案，不自动应用。
  - 由玩家在 UI 中逐条确认或拒绝。
- `meta`：可选元信息。

## Patch 约束（v0.1）

- `target` 仅允许 `pc` / `npc` / `world`。
- `op` 仅允许 `set` / `add` / `remove` / `inc`。
- `path` 为点路径（如 `status.poisoned`、`inventory.items`）。
- `inc` 的 `value` 必须是数字。

## 无效输出处理

- 非 JSON：直接失败。
- 缺少 `narration` 或 `options`：失败。
- `options` 为空：失败。
- `proposedPatches` 不合规：可降级为 `[]` 并记录警告（不阻断叙事）。

## 提示词约束建议

系统提示词中应固定包含：

1. 仅返回 JSON。
2. 严格遵守字段与类型。
3. `proposedPatches` 只作为建议，不可假设自动生效。
4. 选项文案应简洁并可执行。
