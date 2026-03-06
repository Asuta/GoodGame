# GoodGame Editor

一个基于 React + TypeScript + Vite 的文字冒险 / 养成编辑器 Demo。

这个项目把“编辑配置”和“立即试玩”放在同一个前端应用里：

- `/` 是游戏试玩页
- `/editor` 是剧情与数值编辑器
- 配置保存在浏览器 `localStorage`
- 编辑器改动可以立刻回到试玩页验证

目前它更适合作为剧情策划原型、养成玩法验证工具，或视觉小说类项目的前端脚手架。

## 功能概览

- 序章播放与日常循环
- 属性驱动的日常行动
- 条件触发的剧情事件
- 对话逐字显示与自动播放
- 场景、立绘、头像 URL 配置
- 属性、行动、事件可视化编辑
- JSON 导入 / 导出配置
- `localStorage` 本地持久化
- 多窗口下基于 `storage` 事件的配置同步

## 技术栈

- React 19
- TypeScript
- Vite 7
- React Router DOM 7
- Tailwind CSS 4
- ESLint 9

## 项目结构

```text
src/
  app/
    App.tsx                  # 路由入口
  components/editor/
    BaseTab.tsx              # 基础配置编辑
    MediaTab.tsx             # 场景与图片配置
    StatsTab.tsx             # 属性编辑
    DataTab.tsx              # JSON 导入导出
    shared.tsx               # 编辑器共享工具
  hooks/
    useGameConfig.ts         # 配置读取、保存、跨窗口同步
    useGameRuntime.ts        # 游戏运行时状态与交互逻辑
    useTypewriterText.ts     # 打字机文本效果
  lib/gameCore/
    types.ts                 # 核心数据结构
    defaultConfig.ts         # 默认模板配置
    engine.ts                # 数值、条件、事件等核心规则
    storage.ts               # localStorage 持久化
  pages/
    Home.tsx                 # 游戏试玩页
    Editor.tsx               # 编辑器页
    NotFound.tsx             # 404 页面
  main.tsx                   # 应用启动入口
```

## 核心概念

项目围绕两部分展开：

### 1. 配置 `GameConfig`

游戏内容主要由配置驱动，包含：

- `title` / `subtitle`
- `prologue`：序章文本
- `scenes`：场景资源
- `stats`：属性定义
- `dailyActions`：日常行动
- `events`：条件触发事件
- `maxEnergy` / `defaultSceneId`

### 2. 运行状态 `GameState`

试玩过程中的状态包括：

- 当前天数
- 当前行动力
- 各项属性值
- 已触发事件
- 当前场景
- 当前文本
- 日志记录

整体流程大致为：

1. 播放序章
2. 进入日常行动阶段
3. 根据行动结果修改属性
4. 检查并触发满足条件的事件
5. 播放叙事文本或分支对话
6. 结束当天并进入下一天

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认会启动 Vite 开发服务器，通常可在本地浏览器打开终端输出中的地址。

其他常用命令：

```bash
npm run build
npm run lint
npm run preview
```

## 使用说明

### 试玩页 `/`

- 浏览当前剧情与场景
- 推进序章和对话
- 执行日常行动
- 结束当天，触发下一轮事件检查
- 调整打字速度、自动播放、重开试玩

### 编辑器页 `/editor`

可编辑以下内容：

- 基础信息：标题、副标题、序章、默认场景、每日行动力
- 图片场景：背景图、角色立绘、头像 URL
- 属性：名称、范围、默认值、说明
- 日常选项：描述、消耗、数值效果、叙事与分支
- 事件：触发条件、效果、叙事内容、是否可重复
- 数据：导出当前配置 JSON，或粘贴 JSON 导入

## 数据存储

项目当前没有后端，所有配置都保存在浏览器本地：

- 存储位置：`localStorage`
- 存储键：`daily-raising-editor-config-v2`

这意味着：

- 刷新页面后配置仍会保留
- 换浏览器、换设备不会自动同步
- 清空浏览器存储后数据会丢失

如果需要长期保存，建议定期从编辑器的数据页导出 JSON 备份。

## 当前定位与限制

这个仓库当前是一个前端原型项目，适合：

- 快速验证养成 / 剧情循环
- 搭建视觉小说编辑器雏形
- 演示配置驱动的叙事玩法

暂未包含：

- 后端服务
- 用户系统
- 云端存档
- 素材上传管理
- 配置版本管理
- 更严格的数据 schema 校验

## 后续可扩展方向

- 拆分 `Editor.tsx`，降低单文件复杂度
- 为配置增加更严格的校验与迁移逻辑
- 增加文件导入导出，而不只是文本 JSON
- 接入素材上传或本地文件选择
- 接入后端，实现多人协作与云端存储
- 增加更多玩法系统，例如好感线、结局、任务、时间段等

