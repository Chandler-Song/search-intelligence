# GitHub 项目部署完整指南

> 基于实际项目《搜商》图书阅读网站的部署全过程整理，涵盖流程记录、踩坑分析、方案对比与最佳实践。

---

## 一、部署流程记录

### 1.1 完整部署流程图

```
本地代码 → Git 初始化 → SSH 配置 → 创建远程仓库 → 推送代码 → 配置 Pages → workflow 自动部署 → 线上访问
```

### 1.2 详细步骤

#### 步骤一：Git 初始化与配置

```bash
# 初始化 git 仓库
git init

# 配置用户信息
git config user.name "你的用户名"
git config user.email "你的邮箱"

# 创建 .gitignore（排除非必要文件）
# 见下方最佳实践中的 .gitignore 模板
```

#### 步骤二：SSH 密钥配置

```bash
# 检查 SSH 是否已配置
ssh -T git@github.com
# 成功输出: Hi username! You've successfully authenticated.

# 如未配置，生成密钥
ssh-keygen -t ed25519 -C "你的邮箱"

# 将公钥添加到 GitHub
# Settings → SSH and GPG keys → New SSH key
# 粘贴 ~/.ssh/id_ed25519.pub 内容
```

#### 步骤三：创建远程仓库

```bash
# 方式一：网页创建（推荐）
# https://github.com/new → 填写仓库名 → Create repository
# 注意：不要勾选 README / .gitignore / license（保持空仓库）

# 方式二：gh CLI 创建（需安装 gh）
gh repo create 仓库名 --public --source=.
```

#### 步骤四：添加 Remote 并推送

```bash
# 添加 SSH remote
git remote add origin git@github.com:用户名/仓库名.git

# 首次提交
git add -A
git commit -m "feat: 初始提交"
git branch -M main
git push -u origin main
```

#### 步骤五：创建 GitHub Actions Workflow

在 `.github/workflows/deploy.yml` 中创建部署工作流（具体内容见推荐方案章节）。

#### 步骤六：配置 GitHub Pages Source

```
仓库 → Settings → Pages → Source → 选择 "GitHub Actions" → Save
```

**此步骤必须在 workflow 首次运行前完成**，否则部署会失败。

#### 步骤七：推送触发部署

```bash
git add -A
git commit -m "ci: 添加部署 workflow"
git push origin main
```

推送后 workflow 自动触发，在 Actions 页面查看进度。

#### 步骤八：验证部署

```
访问 https://用户名.github.io/仓库名/
```

---

## 二、常见问题与避坑指南

### 2.1 踩坑记录总览

| 坑号 | 问题 | 根因 | 解决方案 |
|------|------|------|----------|
| 坑1 | `Resource not accessible by integration` | GITHUB_TOKEN 无 admin 权限创建 Pages 站点 | 去掉 enablement，手动创建 Pages |
| 坑2 | `Not Found` + 一直 Queued | Pages 站点不存在，deploy 找不到目标 | 先在 Settings 中启用 Pages |
| 坑3 | workflow 成功但网站 404 | GITHUB_TOKEN 推送不触发 Pages 构建 | 改用官方 deploy-pages 方案 |
| 坑4 | Node.js 20 deprecated 警告 | GitHub 弃用 Node.js 20 运行时 | 警告不影响功能，可忽略 |

### 2.2 坑1：enablement 自动启用 Pages 失败

**现象**：
```
deployHttpError: Resource not accessible by integration
Create Pages site failed.
```

**根因**：
`actions/configure-pages` 的 `enablement: true` 参数会尝试通过 GitHub API 创建 Pages 站点。但 `GITHUB_TOKEN` 默认没有 admin 权限，无法调用 `POST /repos/{owner}/{repo}/pages` 接口。

**错误代码**：
```yaml
- uses: actions/configure-pages@v5
  with:
    enablement: true  # ← 需要 admin 权限
```

**解决方案**：
去掉 `enablement` 参数，改为用户手动在 Settings → Pages 中选择 Source。

### 2.3 坑2：Pages 站点未创建导致 Queued

**现象**：
workflow 一直处于 `Queued` 状态，不执行也不失败。

**根因**：
`actions/deploy-pages` 需要一个已存在的 Pages 站点来部署。如果仓库从未启用过 Pages，deploy 步骤找不到目标站点，任务无法执行。

**解决方案**：
在 workflow 运行前，先去 Settings → Pages → Source 选择 "GitHub Actions"，手动创建 Pages 站点。

### 2.4 坑3：GITHUB_TOKEN 推送不触发 Pages 构建（404）

**现象**：
- workflow 运行成功
- `gh-pages` 分支已创建且包含全部文件
- 访问网站返回 404

**根因**：
GitHub 官方文档明确指出：
> Commits pushed by a GitHub Actions workflow that uses the `GITHUB_TOKEN` do not trigger a GitHub Pages build.

使用 `peaceiris/actions-gh-pages` 等第三方 action 通过 `GITHUB_TOKEN` 推送代码到 `gh-pages` 分支，虽然分支创建成功，但 GitHub Pages **不会自动构建**。

**错误代码**：
```yaml
- uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}  # ← 不触发构建
    publish_dir: .
    publish_branch: gh-pages
```

**解决方案**：
改用官方 `actions/deploy-pages` 方案，它通过内部 API 直接部署 artifact，不依赖 git push 触发构建。

### 2.5 坑4：Node.js 20 弃用警告

**现象**：
```
Node.js 20 is deprecated. The following actions target Node.js 20
but are being forced to run on Node.js 24.
```

**根因**：
GitHub 于 2025-09-19 弃用 Node.js 20 运行时。`actions/checkout@v4` 等 action 仍使用 Node.js 20，GitHub 自动升级到 Node.js 24 运行。

**影响**：
仅警告，不影响功能。等 action 发布新版本后警告自动消失。

**处理**：
可暂时忽略，无需降级或特殊处理。

---

## 三、推荐部署方案

### 3.1 方案对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **A. 官方 deploy-pages** | 上传 artifact → 内部 API 部署 | 官方维护，无权限问题，部署快 | 需手动启用 Pages | **推荐**：纯静态站点 |
| **B. peaceiris + gh-pages** | git push 到 gh-pages 分支 | 可自定义构建过程 | GITHUB_TOKEN 不触发构建 | 需构建步骤的站点 |
| **C. Deploy from branch** | 直接从分支发布 | 最简单，无需 workflow | 无构建过程 | 纯 HTML 无依赖 |
| **D. 第三方平台** | Vercel/Netlify 自动部署 | 功能丰富，预览部署 | 需外部平台账号 | 需高级功能的站点 |

### 3.2 方案 A：官方 deploy-pages（推荐）

**适用场景**：纯静态网站（HTML/CSS/JS），无需构建步骤。

**Workflow 代码**：
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**前置条件**：
- 仓库 Settings → Pages → Source 选择 "GitHub Actions"
- 添加 `.nojekyll` 文件（禁用 Jekyll 处理）

### 3.3 方案 B：peaceiris + deploy_key（需构建时推荐）

**适用场景**：需要构建步骤（如 Vue/React 打包），或方案 A 遇到权限问题。

**Workflow 代码**：
```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 构建步骤（如有）
      # - name: Build
      #   run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          deploy_key: ${{ secrets.DEPLOY_KEY }}  # 用 SSH key 而非 GITHUB_TOKEN
          publish_dir: ./dist
          publish_branch: gh-pages
```

**关键区别**：使用 `deploy_key`（SSH 密钥）而非 `github_token`，SSH 推送会触发 Pages 构建。

**前置条件**：
- 生成 SSH 密钥对，私钥添加到仓库 Secrets（名 `DEPLOY_KEY`），公钥添加为 Deploy Key
- 仓库 Settings → Pages → Source 选择 "Deploy from a branch" → `gh-pages`

### 3.4 方案 C：Deploy from branch（最简单）

**适用场景**：纯 HTML 站点，无需 CI/CD。

**操作**：
1. 将静态文件放在 `main` 分支根目录或 `/docs` 目录
2. Settings → Pages → Source 选择 "Deploy from a branch" → `main` / `/docs`

**优点**：零配置，推送即部署。
**缺点**：无构建过程，无法自动化。

### 3.5 最终推荐

| 项目类型 | 推荐方案 | 原因 |
|----------|----------|------|
| 纯静态站点（HTML/CSS/JS） | **方案 A** | 官方维护，最可靠 |
| 需构建的站点（Vue/React） | **方案 B** | 支持构建步骤 |
| 简单 HTML 页面 | **方案 C** | 零配置 |
| 需预览/自定义域名等高级功能 | **方案 D**（Vercel） | 功能最丰富 |

---

## 四、最佳实践总结

### 4.1 部署前检查清单

- [ ] SSH 密钥已配置（`ssh -T git@github.com` 成功）
- [ ] `.gitignore` 已创建（排除非必要文件）
- [ ] `.nojekyll` 文件已添加（禁用 Jekyll）
- [ ] 仓库已创建且为空（无 README/gitignore）
- [ ] 代码已提交并推送到 main 分支

### 4.2 部署配置顺序（关键）

```
1. 推送代码到 main 分支（含 workflow）
2. ⚠️ 手动设置 Settings → Pages → Source: GitHub Actions
3. workflow 自动触发部署
4. 等待绿色 ✅
5. 访问网站验证
```

> **核心原则**：先配置 Pages Source，再触发 workflow。顺序反了会导致 Queued 或 404。

### 4.3 .gitignore 模板

```gitignore
# 依赖
node_modules/
__pycache__/
*.pyc

# 构建产物
dist/
build/

# 临时文件
*.log
*.tmp
server_log.txt

# 系统文件
Thumbs.db
.DS_Store
desktop.ini

# IDE
.vscode/
.idea/
*.swp

# 环境变量
.env
.env.local
```

### 4.4 Workflow 最佳实践

1. **使用官方 actions**：优先使用 `actions/*` 系列，避免第三方 action 的权限问题
2. **不使用 enablement**：手动配置 Pages Source，不依赖自动创建
3. **设置 concurrency**：避免重复部署浪费资源
4. **配置 workflow_dispatch**：支持手动触发，便于调试
5. **最小权限原则**：只授予必要权限

```yaml
permissions:
  contents: read      # 只读代码
  pages: write        # 写入 Pages
  id-token: write     # OIDC 认证
```

### 4.5 调试技巧

1. **查看 workflow 日志**：Actions → 点击失败的 run → 展开步骤查看日志
2. **手动触发**：Actions → 选 workflow → Run workflow
3. **重新运行**：Actions → 点击 run → Re-run all jobs
4. **检查 Pages 状态**：Settings → Pages 查看部署状态和 URL
5. **检查分支**：确认 gh-pages 分支内容是否正确

### 4.6 常见错误速查表

| 错误信息 | 原因 | 解决 |
|----------|------|------|
| `Resource not accessible by integration` | GITHUB_TOKEN 权限不足 | 去掉 enablement，手动配置 |
| `Not Found` / `Queued` | Pages 站点未创建 | Settings → Pages → Source: GitHub Actions |
| 404（workflow 成功） | GITHUB_TOKEN 推送不触发构建 | 改用官方 deploy-pages |
| `Repository not found` | SSH 无权限或仓库不存在 | 检查 SSH 配置和仓库名 |
| Node.js 20 deprecated | 运行时弃用警告 | 可忽略，不影响功能 |

### 4.7 后续更新流程

```bash
# 修改代码后
git add -A
git commit -m "更新说明"
git push origin main

# workflow 自动触发，无需手动操作
# 等 Actions 绿色 ✅ 后访问网站验证
```

---

## 五、附录

### 5.1 官方文档参考

- [Configuring Pages source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [actions/deploy-pages](https://github.com/actions/deploy-pages)
- [actions/configure-pages](https://github.com/actions/configure-pages)

### 5.2 本项目部署记录

| 步骤 | 状态 | 耗时 |
|------|------|------|
| Git 初始化 + 提交 | ✅ | - |
| SSH 推送到远程 | ✅ | < 10s |
| Workflow v1（enablement） | ❌ 权限不足 | 20s |
| Workflow v2（无 enablement） | ❌ Queued | - |
| Workflow v3（peaceiris） | ✅ 但 404 | 11s |
| Workflow v4（官方方案） | ✅ 成功 | ~30s |

### 5.3 关键教训

1. **GitHub Pages 部署必须先手动启用**：不要依赖 workflow 自动创建
2. **GITHUB_TOKEN 推送不触发 Pages 构建**：用官方 deploy-pages 而非 git push
3. **官方 action 优于第三方**：减少权限和兼容性问题
4. **先配置再部署**：Pages Source 配置必须在 workflow 运行前完成