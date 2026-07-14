# 外刊词库 PWA · 手机上传版

这是为手机端 GitHub 上传准备的扁平目录版本，所有文件都放在同一层。

## GitHub Pages 发布
1. 将本文件夹中的全部文件上传到仓库根目录。
2. 仓库进入 Settings → Pages。
3. Source 选择 Deploy from a branch。
4. Branch 选择 main，Folder 选择 /(root)，点击 Save。
5. 等待几分钟后打开 GitHub Pages 提供的网址。

## 注意
- 不要只上传 ZIP 文件；必须先解压并上传里面的全部文件。
- `index.html` 必须位于仓库根目录。
- 词库文件是 `vocab.json`、`vocab.js` 和 `vocab.csv`。
- 当前版本已替换为可爱蘑菇 App 图标。

# 外刊词库 PWA 手机 App

这是一个可安装到 iPhone、iPad、Android 和电脑桌面的渐进式网页应用（PWA）。项目已预置 Week25 和 Week27 共 375 条外刊词汇。

## 已完成的 App 功能

- 新词学习：按文章顺序学习，支持“忘记 / 困难 / 认识 / 熟练”四档反馈。
- 间隔复习：根据反馈自动安排下一次复习时间。
- 词汇测试：英文选中文、中文选英文、中文拼写英文。
- 词库管理：搜索、周次筛选、学习状态筛选、JSON/CSV/TSV 导入和备份导出。
- 手机安装：具备 App 图标、独立全屏窗口、启动主题和桌面快捷入口。
- 离线使用：首次联网打开后，可在没有网络时继续背词和复习。
- 自动更新：发现新版程序时，页面会提示“立即更新”。
- 自动词库同步：启动时自动读取 `data/vocab.json`；部署后只要更新该文件，已安装的 App 下次联网打开便会合并新增词汇，原有学习记录不会被覆盖。
- 可选远程词库：设置中可以填写 GitHub Raw、Supabase 等公开 JSON 地址。

## 在电脑上预览

不要直接双击 `index.html` 测试安装和离线功能。请在本文件夹运行：

```bash
python -m http.server 8000
```

然后打开：

```text
http://localhost:8000
```

## 发布到 GitHub Pages

1. 在 GitHub 新建一个公开或私有仓库。
2. 将本文件夹中的全部内容上传到仓库根目录。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **Deploy from a branch**。
5. 选择 `main` 分支和根目录 `/ (root)`，保存。
6. 等待 GitHub 生成 HTTPS 网页地址，然后在手机浏览器中打开。

PWA 必须通过 HTTPS（或电脑上的 localhost）访问，才能安装并启用离线缓存。

## 安装到 iPhone / iPad

1. 使用 Safari 打开部署后的地址。
2. 点击底部“分享”按钮。
3. 选择“添加到主屏幕”。
4. 点击右上角“添加”。

## 安装到 Android

使用 Chrome 打开部署后的地址，点击网页内的“安装”按钮；也可以打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。

## 以后如何更新词库

标准数据文件是 `data/vocab.json`，格式如下：

```json
{
  "version": 2,
  "updatedAt": "2026-07-15",
  "words": [
    {
      "word": "replenish",
      "meaning": "补充；重新装满",
      "week": "Week28",
      "article": "文章标题",
      "pages": "2-3",
      "source": "Week28 外刊阅读"
    }
  ]
}
```

更新时保留旧词并加入新词，然后把新的 `vocab.json` 上传到原位置。App 会按“英文 + 中文释义 + 周次”去重，并保留已经产生的学习进度。

## 重要说明

学习记录目前保存在每台设备的浏览器本地存储中，不会自动跨设备同步。请定期在“词库管理”中导出 JSON 备份。若以后接入 Supabase/Firebase，可继续增加账号登录和多设备进度同步。
