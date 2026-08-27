# GitHub Pages 404 问题分析报告

## 问题现象
- workflow #5 运行成功（11秒完成）
- `gh-pages` 分支已创建且包含全部文件
- 访问 `https://chandler-song.github.io/search-intelligence/` 返回 404

## 根因分析

### 核心原因：GITHUB_TOKEN 推送不触发 Pages 构建

GitHub 官方文档明确指出：

> **Commits pushed by a GitHub Actions workflow that uses the `GITHUB_TOKEN` do not trigger a GitHub Pages build.**

`peaceiris/actions-gh-pages` 使用 `GITHUB_TOKEN` 将代码推送到 `gh-pages` 分支。虽然分支创建成功，但由于是 `GITHUB_TOKEN` 推送的，GitHub Pages **不会自动构建**。

### 历史问题回顾

| 版本 | 方案 | 问题 |
|------|------|------|
| v1 | `actions/deploy-pages` + `enablement: true` | GITHUB_TOKEN 无 admin 权限创建 Pages 站点 → Resource not accessible |
| v2 | `actions/deploy-pages` 无 enablement | Pages 站点未创建 → Not Found → Queued |
| v3 | `peaceiris/actions-gh-pages` 推送 gh-pages | GITHUB_TOKEN 推送不触发 Pages 构建 → 404 |

## 解决方案

改回官方 `actions/deploy-pages` 方式，**用户手动在 Settings → Pages 选择 Source: GitHub Actions**（一次性操作）。

这样：
- 不需要 `enablement` 自动创建站点（用户手动创建了）
- 不需要 admin 权限
- 使用官方部署管道，不依赖 GITHUB_TOKEN 推送触发构建