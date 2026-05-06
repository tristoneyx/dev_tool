# DevTool

> A minimalist, offline-first developer toolbox built with Tauri 2 + React.
> 极简、纯本地的开发者工具箱，基于 Tauri 2 + React 构建。

[English](#english) · [中文](#中文)

---

## English

DevTool bundles a handful of everyday developer utilities into a single native
desktop app. Everything runs locally — no network calls, no telemetry, no
account.

### Features

- **JSON Viewer** — virtualized tree, lint diagnostics, path search, format /
  unescape / escape, jump-to-path.
- **JSON Diff** — structural diff between two documents with side-by-side
  navigation and search.
- **Base64** — encode / decode, with URL-safe variant.
- **URL Parser** — break a URL into scheme / host / path / query, edit query
  params in a table, rebuild the URL.
- **History** — every tool can save its current input/output to a local SQLite
  store and restore it later.
- **i18n** — English and 简体中文, switchable from the title bar.
- **Theming** — light / dark / system.

### Tech stack

| Layer    | Stack                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Shell    | [Tauri 2](https://tauri.app), Rust 2021, `rusqlite` (bundled SQLite)          |
| UI       | React 18, TypeScript, Vite, Tailwind CSS                                      |
| Editor   | CodeMirror 6 (`@codemirror/lang-json`, lint)                                  |
| State    | Zustand                                                                       |
| i18n     | i18next + react-i18next                                                       |
| Testing  | Vitest + Testing Library, Rust integration tests                              |

### Requirements

- Node.js **≥ 18**
- Rust toolchain (`rustup` — stable)
- Platform prerequisites for Tauri 2 — see
  [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Getting started

```bash
# install JS deps
npm install

# run the desktop app in dev mode (Vite + Tauri)
npm run tauri dev

# run the web frontend only
npm run dev

# unit / component tests
npm test
```

### Build

```bash
npm run tauri build
```

Bundles are emitted to `src-tauri/target/release/bundle/`. Default targets are
`dmg` and `app` (macOS) — adjust `bundle.targets` in
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) for other platforms.

### Project layout

```
src/                  React frontend
  shell/              Title bar, tabs, theme & locale toggles
  tools/              Each tool in its own folder
    json-viewer/
    json-diff/
    base64/
    url-parser/
  history/            Save / load drawer + SQLite-backed store
  i18n/               i18next setup + locale JSON
src-tauri/            Rust backend
  src/commands/       Tauri command handlers (json, diff, codec, history)
  src/persistence/    SQLite layer
  icons/              App icons (built from icon.svg)
```

### License

Not yet declared. Treat as **all rights reserved** until a license is added.

---

## 中文

DevTool 把日常开发常用的小工具打包进一个原生桌面应用。所有处理都在本地完成 ——
不联网、无埋点、无需账号。

### 功能

- **JSON Viewer** — 虚拟化树、Lint 诊断、按路径搜索、格式化 / 反转义 / 转义、
  跳转到指定路径。
- **JSON Diff** — 两份 JSON 的结构化对比，左右联动滚动 + 搜索。
- **Base64** — 编码 / 解码，支持 URL-safe 变体。
- **URL Parser** — 拆解 URL 的 scheme / host / path / query，表格式编辑查询参数
  并重建 URL。
- **历史记录** — 每个工具都可以把当前输入/输出存进本地 SQLite，稍后恢复。
- **国际化** — 中文 / English，标题栏可切换。
- **主题** — 浅色 / 深色 / 跟随系统。

### 技术栈

| 层级     | 选型                                                                  |
| -------- | --------------------------------------------------------------------- |
| 外壳     | [Tauri 2](https://tauri.app)、Rust 2021、`rusqlite`（内嵌 SQLite）    |
| UI       | React 18、TypeScript、Vite、Tailwind CSS                              |
| 编辑器   | CodeMirror 6（`@codemirror/lang-json`、lint）                         |
| 状态管理 | Zustand                                                               |
| 国际化   | i18next + react-i18next                                               |
| 测试     | Vitest + Testing Library，Rust 集成测试                               |

### 环境要求

- Node.js **≥ 18**
- Rust 工具链（`rustup`，stable）
- Tauri 2 的平台依赖：参见
  [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### 快速开始

```bash
# 安装前端依赖
npm install

# 以桌面应用模式启动（Vite + Tauri）
npm run tauri dev

# 仅启动前端
npm run dev

# 运行前端单元测试 / 组件测试
npm test
```

### 打包

```bash
npm run tauri build
```

产物输出在 `src-tauri/target/release/bundle/`。默认 target 是 macOS 的 `dmg` 与
`app`，其它平台请修改
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) 里的 `bundle.targets`。

### 目录结构

```
src/                  前端代码
  shell/              标题栏、Tab、主题/语言切换
  tools/              每个工具一个目录
    json-viewer/
    json-diff/
    base64/
    url-parser/
  history/            历史记录抽屉 + SQLite 存储
  i18n/               i18next 配置与文案
src-tauri/            Rust 后端
  src/commands/       Tauri 命令处理（json / diff / codec / history）
  src/persistence/    SQLite 持久化层
  icons/              应用图标（由 icon.svg 生成）
```

### 许可证

尚未声明。在添加 LICENSE 之前请视为 **保留所有权利（All rights reserved）**。
