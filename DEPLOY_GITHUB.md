# 发布到 GitHub Pages

本地仓库已准备在 `/home/vgd/hk-ozp-overlay-github`，默认分支为 `main`。它是独立的 GitHub 发布副本；原来的 `/home/vgd/hk-ozp-overlay` 继续保留 Sites 项目。以后维护 GitHub 网站，请在新目录中修改。

网页文件在 `dist/`；`.github/workflows/pages.yml` 会自动发布这个目录，不需要手动构建。浏览器语言、Google 地图子页面、数据文件及下载链接均使用相对路径，适合 GitHub 项目网站的子目录地址。

## 1. 创建空的远程仓库

1. 登录 GitHub，打开 https://github.com/new 。
2. Owner 选择你自己或有权限使用的组织。
3. Repository name 建议填 `hk-ozp-overlay`。
4. 使用 GitHub Free 的常见做法是选择 **Public**；这样代码、发布数据和网站可公开访问。仅把网址发给老板并不会限制其他人访问。
5. **不要勾选** Add a README，也不要添加 `.gitignore` 或 License；这些文件已经在本地，远程应保持为空。
6. 点击 **Create repository**。

仓库创建后，复制其 HTTPS 地址，例如：

```text
https://github.com/YOUR_USERNAME/hk-ozp-overlay.git
```

下文 `YOUR_USERNAME` 必须替换为你的实际用户名或组织名。

## 2. 配置本机 GitHub 登录

如果本机已经能向 GitHub 推送，可以跳过。HTTPS 推送不能用 GitHub 账户密码登录。可使用你已有的凭据管理器、GitHub CLI 浏览器登录，或个人访问令牌。

如果已安装 GitHub CLI：

```sh
gh auth login
gh auth setup-git
```

按提示选择 GitHub.com、HTTPS，并在浏览器授权。令牌不应写进项目文件或远程仓库 URL。

## 3. 关联远程并推送

在终端运行：

```sh
cd /home/vgd/hk-ozp-overlay-github
git remote add origin https://github.com/YOUR_USERNAME/hk-ozp-overlay.git
git remote -v
git push -u origin main
```

本地初始提交已由 Codex 创建，无需重复 `git init`、`git add` 或首次提交。

`git remote add origin` 只需执行一次。如果重复执行提示 origin 已存在，先检查 `git remote -v`；只有地址确实有误时才运行：

```sh
git remote set-url origin https://github.com/YOUR_USERNAME/hk-ozp-overlay.git
```

如果创建远程时误加了 README，首次推送可能被拒绝。先检查远程提交并合并处理，不要使用强制推送掩盖问题。

## 4. 开启 GitHub Pages

1. 在刚创建的 GitHub 仓库中打开 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 不需要另外创建工作流，本地已包含 `Deploy GitHub Pages`。
4. 打开仓库的 **Actions** 标签页。
5. 选择左侧 **Deploy GitHub Pages**。
6. 若首次推送的运行尚未成功，点击 **Run workflow**，选择 `main`，再点击运行。首次推送发生在开启 Pages 之前时，首轮运行可能失败；开启后重新运行即可。
7. 等待 `Publish static map` 运行成功，点击运行结果或 `github-pages` 环境中的网站链接。

你的网址通常为：

```text
https://YOUR_USERNAME.github.io/hk-ozp-overlay/
```

也可以在 **Settings → Pages** 中查看实际地址并点击 **Visit site**。把这个网页地址发给老板，而不是 GitHub 仓库地址。普通公开 Pages 网站无需老板登录 GitHub。

如果仓库禁止 Actions、限制官方 Actions，或配置了环境审批，需要由仓库/组织管理员调整对应设置或批准部署。

## 5. 后续修改和更新

后续修改应在 `/home/vgd/hk-ozp-overlay-github` 中进行。先设置你自己的提交身份，只作用于这个仓库：

```sh
git config user.name "你的名字"
git config user.email "你的 GitHub 邮箱或 GitHub 提供的 noreply 邮箱"
```

修改文件后：

```sh
git status
git add dist scripts README.md DEPLOY_GITHUB.md requirements.txt .gitignore .github
git diff --cached --stat
git commit -m "Update planning map"
git push
```

改动 `dist/` 或部署工作流时，推送到 `main` 会自动重新部署。只修改文档不会触发部署，也无需部署。若通过网页编辑或其他设备修改过远程仓库，先提交/妥善保存本地改动，再 `git pull --rebase`。

## 本地预览

```sh
cd /home/vgd/hk-ozp-overlay-github
python3 -m http.server 8765 --directory dist
```

浏览器打开 http://localhost:8765 。停止预览时按 Ctrl+C。

## 数据和 Google Maps

- 当前部署文件约 68 MB，适合静态托管。部署时不重新抓取政府数据。
- 默认的政府航拍和文字标注无需你提供 API key。
- 切换 Google Maps 仍需有效的 Maps JavaScript API key；如果之前限制在 Sites 域名，还应允许新的 GitHub Pages 来源。
- 规划资料是快照；网站在线不代表规划数据会自动更新。
- 发布副本不包含 Sites 身份配置、旧 Git 历史、抓取缓存、Python 环境或真实 API key。

## 官方参考

- https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
