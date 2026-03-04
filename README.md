# AI 跑团工作台（GoodGameRepo）

一个纯前端的 AI 跑团（TRPG）工作台，支持：

- 世界观快速生成
- DM 多轮 Agent 对话
- 规则内掷骰与上下文更新
- 流式输出（边生成边显示）
- 存档导入/导出（继续之前游戏）
- 上下文 Token 用量估算

项目基于 `React + TypeScript + Vite`，当前主页面为 `src/pages/Home.tsx`。

## 项目概况

该项目围绕“可持续推进剧情”的目标设计，核心思路是：

1. 用户输入行动。
2. DM Agent 按 JSON 协议返回 `actions + reply`。
3. 前端执行工具动作（更新上下文/掷骰），并把结果继续喂给模型。
4. 最终输出对玩家可读的回复。

这套机制允许 Agent 在前端完成“轻工具调用”，在不依赖后端的前提下保持一定可控性。

## 主要功能

### 1) 对话与 Agent 回合

- 支持多轮内部推理（最多 3 轮）
- 输出协议为 JSON：`analysis`、`actions`、`reply`
- 支持两类 action：
  - `update_context`：写入 `background/rules/characters/styleReference`
  - `roll_dice`：执行标准表达式（如 `1d20+2`）

### 2) 流式输出

- 三种接口模式均支持流式：
  - `completions`
  - `chat_completions`
  - `responses`
- 对话时可实时看到 DM 回复预览（从流式 JSON 中提取 `reply`）
- 流式过程中支持“贴底自动滚动”：
  - 当消息列表在底部时自动跟随
  - 手动上滑查看历史时不强制跳到底部

### 3) 输入体验

- `Enter` 发送消息
- `Shift + Enter` 换行

### 4) 富文本与换行适配

- 兼容模型返回中的转义换行（`\\n`）
- 基础行内格式支持：
  - `**加粗**`
  - `` `行内代码` ``

### 5) 上下文快照查看

- 主聊天区不再常驻显示快照
- 通过“查看上下文”按钮打开弹层查看
- 支持 ESC/点击遮罩关闭

### 6) 存档（导入/导出）

- 可导出当前完整状态为 JSON
- 可从 JSON 导入恢复游戏进度
- 导入导出包含内容：
  - API 配置
  - 背景/规则/人物/风格参考
  - 概念输入
  - 历史消息
  - 历史模式开关

### 7) Token 用量估算

- 在聊天头部展示上下文 Token 估算：
  - 设定 Token
  - 对话历史 Token
  - 总量
- 为前端估算值（非服务端精确 tokenizer）

### 8) Max Tokens 不限制

- 提供“Max Tokens 不限制”选项
- 启用后请求不传 `max_tokens/max_output_tokens`

## 技术栈

- 框架：`React 19`
- 语言：`TypeScript`
- 构建：`Vite 7`
- 路由：`react-router-dom`
- 样式：`TailwindCSS v4（通过 @tailwindcss/vite）+ 自定义 CSS`

## 目录结构

```text
src/
  app/
    App.tsx                # 路由入口
  lib/
    openai.ts              # OpenAI 接口适配（含流式）
    dice.ts                # 掷骰工具
  pages/
    Home.tsx               # 主界面与核心业务逻辑
    NotFound.tsx           # 404 页面
  index.css                # 全局与组件样式
  main.tsx                 # 应用入口
```

## 运行方式

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 预览构建产物

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## API 配置说明

在页面左侧「API 设置」中可配置：

- `API Key`
- `Base URL`
- `Model`
- `接口格式`（completions/chat_completions/responses）
- `Max Tokens` / `不限制`

## 重要实现说明

### OpenAI 适配层

`src/lib/openai.ts` 提供：

- `callOpenAIJson`：普通请求
- `callOpenAIJsonStream`：流式请求（SSE 解析）

并对三种接口结构做了统一兼容解析。

### 数据持久化

- 页面状态会持久化到 `localStorage`
- 存档导出会生成独立 JSON 文件
- 导入存档后会恢复当前会话状态

## 安全提示（务必阅读）

- 当前项目为纯前端，`API Key` 会存在浏览器端（含本地缓存/导出存档时的状态）。
- 不要将包含真实 Key 的存档文件分享给他人。
- 如需上线生产，建议把模型调用迁移到后端代理并做密钥隔离。

## 后续可扩展方向

- 接入精确 tokenizer（按目标模型计算 Token）
- 增加多存档槽位与命名管理
- 对动作日志和上下文变更做可视化时间线
- 引入更完整 Markdown 渲染（列表、引用、代码块）
