---
name: 秒应
description: 创建在线表单收集信息、制作调查问卷、发起投票活动、预约报名、数据查询表格或截图收集任务。支持打卡签到、接龙报名、在线考试、选课抢课、时段预约、信息查询等场景。当用户需要制作问卷、收集报名信息、进行投票选举、预约时间段、创建查询表格或收集图片截图时使用此技能。

install:
  command: npm install --ignore-scripts
  alternative_command: npm ci --ignore-scripts
  description: 安装 Node.js 依赖（axios, form-data, xlsx）
  requires_internet: true
  writes_to:
    - node_modules/
    - package-lock.json
  safe_dependencies:
    - name: axios
      version: ">=1.0.0"
      purpose: HTTP 客户端，用于调用秒应 API
      npm_url: https://www.npmjs.com/package/axios
    - name: form-data
      version: ">=4.0.0"
      purpose: 处理 multipart/form-data 文件上传
      npm_url: https://www.npmjs.com/package/form-data
    - name: xlsx
      version: ">=0.18.0"
      purpose: Excel 文件解析，用于数据导出
      npm_url: https://www.npmjs.com/package/xlsx
  security_notes:
    - "所有依赖均为知名 npm 包，无恶意代码风险"
    - "package.json 中无 postinstall/preinstall 生命周期脚本"
    - "使用 --ignore-scripts 禁止执行任何包脚本"
    - "建议使用 npm ci（而非 npm install）以确保依赖版本锁定"
  verify_integrity: npm audit --audit-level=moderate

credentials:
  - name: MIAOYING_API_KEY
    description: 秒应 OpenAPI 密钥，用于创建活动、生成二维码等操作
    required: true
    obtain_url: https://miaoying.hui51.cn/apikey
    permissions:
      - creator:create
      - creator:read
      - creator:export

env:
  MIAOYING_API_KEY:
    description: 秒应 API 密钥（必需 - 未配置将无法使用本技能）
    required: true
    security_note: 推荐使用环境变量存储，避免在聊天会话中直接粘贴

binaries:
  - name: node
    description: Node.js 运行时
    version: ">=16.0.0"
  - name: npm
    description: Node.js 包管理器（用于安装依赖）

file_access:
  read:
    - path: ~/.miaoying/config.json
      description: 读取本地存储的 API 密钥配置
    - path: ./qrcodes/*.png
      description: 读取生成的二维码图片
    - path: ./qrcodes/*.jpeg
      description: 读取生成的二维码图片
    - path: ./src/**/*.js
      description: CLI 源代码（本地直接使用）
    - path: ./bin/miaoying.js
      description: CLI 入口文件
    - path: ./package.json
      description: 依赖配置文件
  write:
    - path: ~/.miaoying/config.json
      description: 存储 API 密钥配置（可选）
    - path: ./qrcodes/*.png
      description: 保存生成的二维码图片
    - path: ./qrcodes/*.jpeg
      description: 保存生成的二维码图片
    - path: ./node_modules/**
      description: npm 依赖安装目录

network:
  - host: miaoying.hui51.cn
    description: 秒应用户管理后台（获取 API Key、管理账户）
    endpoints:
      - /apikey
  - host: www.aiphoto8.cn
    description: 秒应 OpenAPI 服务器（实际 API 调用）
    endpoints:
      - /api/openapi/graphql
      - /api/openapi/creator/qrcode
---

# 秒应 OpenAPI 技能 (Miaoying Skill)

## 概述 (Overview)

引导用户完成秒应 (miaoying) 活动的完整创建流程：从 API 密钥创建到二维码生成。支持打卡、接龙、投票、信息收集、预约、考试、查查等多种场景。

## 🔐 凭证与安全说明

**⚠️ 重要：本技能需要 API Key 才能使用**

**本技能需要以下凭证和权限：**

| 类型 | 名称 | 用途 | 获取方式 |
|------|------|------|----------|
| API Key | `MIAOYING_API_KEY` | 调用秒应 OpenAPI | [API Key 管理页面](https://miaoying.hui51.cn/apikey) |
| 本地 CLI | `./bin/miaoying.js` | CLI 工具 | 技能自带，无需安装 |

**文件访问：**
- 读取/写入：`~/.miaoying/config.json`（本地配置存储）
- 写入：`./qrcodes/*.png`、`./qrcodes/*.jpeg`（二维码图片）

**网络访问：**
- `miaoying.hui51.cn` - 用户管理后台（获取 API Key）
- `www.aiphoto8.cn` - API 服务器（实际调用）

### 🛡️ 安全最佳实践

1. ✅ **使用环境变量存储 API Key**
   ```bash
   export MIAOYING_API_KEY="your_key_here"
   # 添加到 ~/.zshrc 或 ~/.bashrc 实现持久化
   ```

2. ✅ **使用最小权限原则创建 API Key**
   - 仅勾选必要的权限（创建活动、读取数据、导出数据）
   - 避免创建具有不必要权限的长期密钥

3. ❌ **避免在聊天会话中直接粘贴长期密钥**
   - 如果不小心泄露，请立即在管理后台删除并重新创建

4. ❌ **避免将 API Key 提交到代码仓库**
   - 确保 `.gitignore` 包含 `~/.miaoying/config.json`

### 📦 CLI 安装（本地源码）

本技能自带 CLI 源码，无需安装 npm 包。首次使用前需安装依赖：

```bash
# 进入技能目录
cd /path/to/miaoying-skill

# 安装依赖
npm install
```

**使用方式：**

```bash
# 直接运行本地 CLI
node ./bin/miaoying.js help

# 或者使用 npx
npx ./bin/miaoying.js help
```

### ⚠️ 使用前检查清单

在首次使用本技能前，请确认：

- [ ] 已从官方渠道 [miaoying.hui51.cn/apikey](https://miaoying.hui51.cn/apikey) 获取 API Key
- [ ] 已在技能目录运行 `npm install` 安装依赖
- [ ] 已使用环境变量存储 API Key（而非直接粘贴）
- [ ] 了解本技能会访问 `~/.miaoying/config.json` 和 `./qrcodes/` 目录
- [ ] 了解 API 调用会发送到 `www.aiphoto8.cn`

## ⚠️ 重要前置提醒 (AI 必读)

**在创建活动之前，必须先阅读以下参考文档：**

1. **`prompts/ai-form-prompt.md`** - 表单配置完整参考，包含所有可用字段、类型说明和场景示例
2. **`prompts/booking-guide.md`** - 预约/考试/选课创建指南，帮助判断用户需求类型和必填字段

**原因：** 这两个文档提供了完整的字段说明、配置示例和验证规则，确保生成的活动配置准确无误。

## 📱 创建成功后必做

**活动创建成功后，必须完成以下步骤：**

1. **展示二维码图片给用户** - 使用 Read 工具读取生成的二维码图片文件并展示
2. **提醒用户微信扫码分享到群里** - 明确告知用户："请打开微信扫描二维码，在小程序中点击分享按钮，将活动分享到微信群"

**标准提醒话术：**

> ✅ 活动创建成功！
>
> 📱 二维码已生成（见上图）
>
> 📲 **操作指引**：
>
> 1. 打开微信，扫描上方二维码
> 2. 在秒应小程序中打开活动
> 3. 点击右上角「分享」按钮
> 4. 选择要分享的微信群或好友

**⚠️ 重要：二维码展示方法**

CLI 输出中的二维码路径格式为：`qrcodes/tongji_XXX.jpeg` 或 `qrcodes/XXX.png`

**展示二维码的方法：**

**方法 1：使用 Markdown 图片引用（推荐）**
```markdown
![二维码](/完整/路径/qrcodes/tongji_XXX.jpeg)
```

**方法 2：使用 Read 工具读取（如果 Markdown 引用不显示）**
```
使用 Read 工具读取二维码文件：
Read(file_path="/完整/路径/qrcodes/tongji_XXX.jpeg")
```

**如果用户反馈看不到图片，提供备用方案：**
```
📱 如果看不到上方的二维码图片，您可以通过以下方式查看：

1. 直接打开文件：
   - macOS: open /完整/路径/qrcodes/tongji_XXX.jpeg
   - Windows: start /完整/路径/qrcodes/tongji_XXX.jpeg

2. 在文件管理器中找到并打开该文件
```

**不要只说"二维码已生成（见上图/附件）"但不实际展示图片！**

## 📞 客服联系与反馈

如果遇到问题或有建议，可以通过以下方式联系我们：

- **微信搜索「秒应服务」** - 关注服务号后联系我们
- **GitHub Issues** - 在 [miaoying-cli-skill/issues](https://github.com/creatorkuang/miaoying-cli-skill/issues) 中提交问题或建议

## 适用场景 (When to Use)

使用此技能的场景：

**📊 统计/打卡/接龙类：**

- 创建打卡活动（每日健康打卡、会议签到、作业提交等）
- 创建接龙活动（班级报名、活动接龙、物资收集等）
- 创建信息收集活动（数据采集、意见征集、表单填写等）

**🗳️ 预约类：**

- 需要分时段预约功能（如：上午场/下午场/晚场时段）
- 需要控制每个时间段的人数（如：每时段限 10 人）
- 场馆预约、设备借用、咨询服务等
- 用户提到"预约"、"订号"、"限号"、"时间段"等关键词

**📝 考试/测验类：**

- 创建在线考试、测验、问卷考试
- 需要设置考试时长、自动阅卷、成绩排名
- 学生考试、在线测评、知识竞赛等
- 用户提到"考试"、"测验"、"在线考试"等关键词

**🎓 选课类：**

- 学校选课、培训机构课程报名、兴趣班课程选择
- 需要展示课程列表、配额限制、时间安排等
- 使用 type=24 的课程选择字段
- 用户提到"选课"、"课程选择"、"课程报名"等关键词

**🗳️ 投票类：**

- 创建投票活动（班级评选、选项投票、问卷调查等）

**📋 查查类：**

- 创建数据查询表格
- 多维度数据展示和筛选
- 员工信息查询、库存查询等

**通用场景：**

- 用户提到 "秒应" (miaoying)、"统计" (tongji)、"开放接口" (OpenAPI)
- 需要通过 API 创建活动并生成二维码分享

**不适用场景：**

- 手动创建表单（不使用 API）
- 不需要二维码分享的活动

## Workflow Flowchart

```dot
digraph miaoying_workflow {
    rankdir=LR;
    node [shape=box, style=rounded];

    start [label="Start: User requests miaoying activity", shape=oval];
    read_docs [label="⚠️ READ: ai-form-prompt.md + booking-guide.md"];
    has_key [label="Has API Key?", shape=diamond];
    create_key [label="Guide to https://miaoying.hui51.cn/apikey"];
    store_key [label="Store API key securely"];
    collect_info [label="Collect activity requirements"];
    gen_form [label="Generate form config via AI (formPromptV2)"];
    call_graphql [label="Call /api/openapi/graphql"];
    get_id [label="Extract tongji ID from response"];
    call_qrcode [label="Call /api/openapi/creator/qrcode"];
    save_qrcode [label="Save QR code as local image"];
    display [label="📱 Display QR code to user", shape=oval, style=filled, fillcolor=lightgreen];
    remind_share [label="📲 Remind user to scan & share to WeChat group", shape=oval, style=filled, fillcolor=lightyellow];

    start -> read_docs;
    read_docs -> has_key;
    has_key -> create_key [label="No"];
    create_key -> store_key;
    store_key -> collect_info;
    has_key -> collect_info [label="Yes"];
    collect_info -> gen_form;
    gen_form -> call_graphql;
    call_graphql -> get_id;
    get_id -> call_qrcode;
    call_qrcode -> save_qrcode;
    save_qrcode -> display;
    display -> remind_share;
}
```

## Step-by-Step Guide

### 🚀 快速开始 (Quick Start)

**⚠️ 前置必读（AI 助手）：**

在创建活动前，请先阅读：

- `prompts/ai-form-prompt.md` - 完整表单配置参考
- `prompts/booking-guide.md` - 预约/考试/选课判断指南

**对于 AI 助手：**

1. **使用本地 CLI 工具** - 本技能自带 CLI 源码，直接运行 `node ./bin/miaoying.js`
2. **首次使用前安装依赖** - 在技能目录运行 `npm install`
3. **参考代码示例** - 源码在 `./src/` 目录
4. **📱 创建成功后** - 展示二维码图片，提醒用户微信扫码分享到微信群

**对于终端用户：**

```bash
# 步骤 1: 进入技能目录
cd /path/to/miaoying-skill

# 步骤 2: 安装依赖（首次使用）
npm install

# 步骤 3: 设置 API Key（使用环境变量）
export MIAOYING_API_KEY="your_api_key_here"

# 步骤 4: 创建统计并生成二维码
node ./bin/miaoying.js create --title "每日打卡" --desc "请完成每日打卡" --qrcode

# 查看帮助
node ./bin/miaoying.js help
```


### Step 1: API Key Setup

**If user doesn't have an API key:**

1. 引导用户访问 **官方** API Key 管理页面：https://miaoying.hui51.cn/apikey
2. 引导用户创建新的 API Key，权限范围按需勾选：
   - 创建活动 (creator:create) — 用于创建统计活动
   - 读取活动数据 (creator:read) — 用于读取数据、生成二维码
   - 导出数据 (creator:export) — 用于导出数据

**After obtaining the key:** Guide user to store the key **securely** (recommended methods):

- **Environment variable (推荐)**: `export MIAOYING_API_KEY="your_key_here"` (add to `~/.zshrc` or `~/.bashrc` for persistence)
- **Configuration file**: `~/.miaoying/config.json` (注意：此文件可能包含敏感信息，确保不被提交到版本控制)

**⚠️ 安全提醒：**
- **切勿在聊天会话中直接粘贴长期有效的 API Key**
- 建议使用环境变量方式存储，避免密钥泄露
- 如需临时测试，请使用权限受限的短期密钥
- 如果密钥意外泄露，立即在管理后台删除并重新创建

**Load the stored key:**

```javascript
// Read from environment or config
const apiKey = process.env.MIAOYING_API_KEY || loadFromConfig();
```

**🔒 域名说明：**

秒应服务使用多个域名，请注意区分：
- `miaoying.hui51.cn` - 用户管理后台、API Key 管理
- `www.aiphoto8.cn` - API 调用服务器

这是正常的多域名架构，`hui51.cn` 用于用户界面，`aiphoto8.cn` 用于 API 服务。

### Step 2: Determine Activity Type & Form Configuration

**⚠️ 第一步：必读参考文档**

在生成表单配置之前，**必须先阅读**：

- `prompts/ai-form-prompt.md` - 包含所有表单字段类型、配置项和场景示例
- `prompts/booking-guide.md` - 帮助判断用户需求类型（预约/考试/统计/选课）

**第二步：判断活动类型**

参考 `prompts/booking-guide.md` 判断用户需要的是哪种类型：

| 活动类型 | 判断标准                   | 标识字段             |
| -------- | -------------------------- | -------------------- |
| **预约** | 分时段预约、控制每时段人数 | `needBookMode: true` |
| **考试** | 在线考试、测验、自动阅卷   | `needExamMode: true` |
| **统计** | 打卡、接龙、信息收集       | 默认模式             |
| **投票** | 单选/多选投票              | 使用 Toupiao 模型    |
| **查查** | 数据查询表格               | 使用 Chacha 模型     |

**不同类型的必填字段要求：**

- **预约**：必须包含 `needBookMode: true` + 时段配置（`dayRepeatCount` + `allowSubmitTimeRules`）
- **考试**：必须包含 `needExamMode: true` + 题目（`examForms`）
- **统计**：基础配置 + 表单字段（`infoForms`）

查看 `prompts/booking-guide.md` 获取完整的字段说明。

**第二步：使用 CLI 创建活动**

使用本地 CLI 命令直接创建活动。

**完整工作流示例（使用本地源码）：**

```javascript
// 直接引入本地源码
import { createTongji, generateQrCode } from "./src/index.js";

// 创建统计
const tongjiId = await createTongji({
  title: "每日打卡",
  content: "请完成每日打卡",
  infoForms: '[{"type":"0","title":"姓名","required":true}]',
  apiKey: process.env.MIAOYING_API_KEY,
});

// 生成二维码
const qrcodePath = await generateQrCode(tongjiId, { qrcode: true });

console.log("✅ 统计创建成功:", tongjiId);
console.log("📱 二维码已保存:", qrcodePath);
```

**如果需要单独保存二维码：**

```javascript
import { generateQrCode } from "./src/index.js";

// 生成并保存二维码
const qrcodePath = await generateQrCode(tongjiId, {
  app: "qingtongji",
  output: "./qrcodes/myqrcode.png",
});
```

## CLI 命令行工具

### 配置文件支持

可以使用 `--config` 选项从 JSON 配置文件加载选项，CLI 参数会覆盖配置文件中的同名选项。

```bash
# 使用配置文件
node ./bin/miaoying.js create --config ./my-config.json

# CLI 参数覆盖配置文件
node ./bin/miaoying.js create --config ./my-config.json --title "覆盖标题"
```

**配置文件示例 (config.json)：**

```json
{
  "title": "活动标题",
  "content": "活动描述",
  "infoForms": [
    { "type": "0", "title": "姓名", "required": true },
    { "type": "11", "title": "手机号", "required": true }
  ],
  "count": 100,
  "endTime": "2026-04-01T23:59:59",
  "isAnonymous": true,
  "qrcode": true
}
```

**配置选项列表：**

| 选项          | 类型          | 说明                         |
| ------------- | ------------- | ---------------------------- |
| `title`       | string        | 活动标题（大多数命令必需）   |
| `content`     | string        | 活动描述                     |
| `infoForms`   | JSON          | 表单字段配置                 |
| `count`       | number        | 人数限制                     |
| `endTime`     | string/number | 结束时间（ISO 格式或时间戳） |
| `startTime`   | string/number | 开始时间（ISO 格式或时间戳） |
| `isAnonymous` | boolean       | 匿名模式                     |
| `qrcode`      | boolean       | 创建后生成二维码             |
| `app`         | string        | 应用名（qingtongji/huiyuan） |

### 命令说明

**重要提示**：当需要配置高级选项时（如时间限制、位置限制、名单模式、WiFi 限制等），请使用 `--config` 加载配置文件。CLI 参数只支持基础选项，高级配置请参考 `prompts/ai-form-prompt.md`。

**快速创建（仅基础选项）：**

```bash
node ./bin/miaoying.js create --title "活动标题" --desc "描述" --qrcode
```

**高级创建（使用配置文件）：**

```bash
node ./bin/miaoying.js create --config ./config.json --qrcode
```

**配置文件模板生成：**
参考 `prompts/ai-form-prompt.md` 中的完整配置项说明，创建 config.json：

```bash
# 创建配置文件示例
cat > my-activity.json << 'EOF'
{
  "title": "每日健康打卡",
  "content": "请每日完成健康打卡",
  "infoForms": [
    {"type": "4", "title": "上传照片", "required": true},
    {"type": "0", "title": "今日感悟", "required": false}
  ],
  "isRepeat": true,
  "count": 100,
  "endTime": "2026-04-01T23:59:59",
  "needSubmitLocation": true
}
EOF

# 使用配置文件创建
node ./bin/miaoying.js create --config my-activity.json --qrcode
```

**1. 创建统计/打卡/接龙**

```bash
node ./bin/miaoying.js create [options]
```

选项:

- `--title <标题>` - 统计标题（必需）
- `--desc <描述>` - 统计描述
- `--info-forms <JSON>` - 表单字段（JSON 数组格式）
- `--count <数量>` - 人数限制
- `--end-time <日期>` - 结束时间（ISO 格式）
- `--anonymous` - 匿名填写
- `--qrcode` - 创建后自动生成二维码
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）
- `--config <配置文件>` - 从 JSON 配置文件加载选项（支持更多字段如 pictures, cover 等）

**2. 更新统计**

```bash
node ./bin/miaoying.js update [options]
```

选项:
- `--id <ID>` - 统计 ID（必需）
- `--title <标题>` - 统计标题
- `--desc <描述>` - 统计描述
- `--info-forms <JSON>` - 表单字段（JSON 数组格式）
- `--count <数量>` - 人数限制
- `--end-time <日期>` - 结束时间（ISO 格式）
- `--anonymous` - 匿名填写
- `--close <true/false>` - 关闭/开启统计
- `--repeat <true/false>` - 允许重复打卡
- `--config <配置文件>` - 从 JSON 配置文件加载选项（推荐用于复杂更新，如添加图片、封面等）

**配置文件示例 (update-config.json)：**
```json
{
  "id": "69c382a2e92fdf45795e90c1",
  "title": "健康体检计划登记",
  "pictures": ["xxx.png"],
  "cover": "xxx.png",
  "infoForms": [
    {"type": "0", "title": "姓名", "required": true}
  ]
}
```

使用配置文件更新：
```bash
node ./bin/miaoying.js update --config ./update-config.json
```

**3. 创建预约**

```bash
node ./bin/miaoying.js book [options]
node ./bin/miaoying.js booking [options]
```

选项:

- `--title <标题>` - 预约标题（必需）
- `--slots <数量>` - 每天时段数（1=全天，2=上下午，3=三时段，默认 1）
- `--count <数量>` - 每时段人数限制（默认 20）
- `--fixed-no` - 使用固定名单模式
- `--no-name <标签>` - 固定名单标签名（序号/学号/工号，默认"序号"）
- `--qrcode` - 创建后自动生成二维码

**3. 创建考试**

```bash
node ./bin/miaoying.js exam [options]
node ./bin/miaoying.js create-exam [options]
```

选项:

- `--title <标题>` - 考试标题（必需）
- `--duration <分钟>` - 考试时长（默认 60 分钟）
- `--questions <JSON>` - 考试题目（JSON 数组格式）
- `--info-forms <JSON>` - 信息收集字段（JSON 数组格式）
- `--no-fixed-no` - 关闭固定名单模式（默认开启）
- `--no-ranking` - 不显示排名（默认显示）
- `--ban-view-result` - 禁止提交后查看试卷详情
- `--qrcode` - 创建后自动生成二维码

**4. 创建投票**

```bash
node ./bin/miaoying.js vote [options]
node ./bin/miaoying.js create-vote [options]
```

选项:

- `--title <标题>` - 投票标题（必需）
- `--options <JSON>` - 投票项配置（JSON 格式）
- `--single` - 单选投票
- `--multi` - 多选项投票
- `--count <数量>` - 投票人数限制
- `--publish-result` - 公开结果
- `--qrcode` - 创建后自动生成二维码

**5. 获取列表**

```bash
node ./bin/miaoying.js list [options]              # 统计列表
node ./bin/miaoying.js vote-list [options]          # 投票列表
node ./bin/miaoying.js chacha-list [options]         # 查查列表
```

**6. 生成二维码**

```bash
node ./bin/miaoying.js qrcode <tongji-id> [options]
```

选项:

- `--output <路径>` - 输出文件路径
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）

**3. 获取统计列表**

```bash
node ./bin/miaoying.js list [options]
```

选项:

- `--limit <数量>` - 返回数量（默认 50）
- `--skip <数量>` - 跳过数量（分页）
- `--title <标题>` - 按标题精确筛选
- `--search <关键词>` - 按关键词搜索（模糊匹配标题和内容）
- `--_search <关键词>` - 同 `--search`（简写形式）

**4. 生成二维码**

```bash
node ./bin/miaoying.js qrcode <tongji-id> [options]
```

选项:

- `--output <路径>` - 输出文件路径
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）

**5. 其他命令**

```bash
node ./bin/miaoying.js totals <tongji-id>     # 获取报名总数
node ./bin/miaoying.js results <tongji-id>    # 获取报名结果
node ./bin/miaoying.js upload <file-path>     # 上传文件到 OSS
node ./bin/miaoying.js help                    # 显示帮助
```

### 使用示例

```bash
# ========== 统计/打卡 ==========
# 简单统计
node ./bin/miaoying.js create --title "每日打卡" --qrcode

# 带表单的统计
node ./bin/miaoying.js create --title "活动报名" \
  --desc "请填写报名信息" \
  --info-forms '[{"type":"0","title":"姓名","required":true},{"type":"11","title":"手机号","required":true}]' \
  --count 50 \
  --qrcode

# ========== 预约 ==========
# 创建全天预约（7:00-23:59）
node ./bin/miaoying.js book --title "图书馆座位预约" --slots 1 --count 50 --qrcode

# 创建分时段预约（上午 + 下午）
node ./bin/miaoying.js book --title "会议室预约" --slots 2 --count 5 --qrcode

# 创建固定名单预约
node ./bin/miaoying.js book --title "设备借用" --fixed-no --no-name "工号" --qrcode

# ========== 考试 ==========
# 创建简单考试
node ./bin/miaoying.js exam --title "期中考试" --duration 90 --qrcode

# 创建考试 + 题目
node ./bin/miaoying.js exam --title "数学测验" --duration 60 \
  --questions '[{"id":"q1","type":"1","title":"1+1=?","options":["1","2","3","4"],"answer":"1","fullScore":10,"order":1}]' \
  --qrcode

# ========== 投票 ==========
# 创建单选投票
node ./bin/miaoying.js vote --title "班级优秀评选" --single --qrcode

# ========== 查询 ==========
# 生成指定路径的二维码
node ./bin/miaoying.js qrcode 69bd03b77dd11cb3b00424a6 --output ./myqrcode.png

# 获取统计列表
node ./bin/miaoying.js list --limit 10

# 搜索统计（关键词匹配）
node ./bin/miaoying.js list --search "打卡"
node ./bin/miaoying.js list --_search "活动报名"
```

### CLI 输出示例

**📋 完整输出模板（包含二维码展示和分享提醒）：**

**统计输出：**

```
ℹ️  正在创建统计...
✅ 统计创建成功！
   ID: 69bd03b77dd11cb3b00424a6
   标题：每日打卡
   字段数：0

ℹ️  正在生成二维码...
✅ 二维码已保存：/path/to/your/folder/qrcodes/tongji_69bd03b77dd11cb3b00424a6.png

---
📱 二维码已生成（见上图/附件）

📲 操作指引：
1. 打开微信，扫描上方二维码
2. 在秒应小程序中打开接龙/投票/查查
3. 点击右上角「转发」按钮
4. 选择要分享的微信群或好友
```

**预约输出：**

```
ℹ️  正在创建预约...
✅ 预约创建成功！
   ID: 69c0945b3a689910620152bf
   标题：图书馆座位预约
   预约模式：是
   每天时段数：1
   预约时段:
     1. 07:00 - 23:59
   表单字段：姓名，手机号

ℹ️  正在生成二维码...
✅ 二维码已保存：/path/to/your/folder/qrcodes/booking_69c0945b3a689910620152bf.png

---
📱 二维码已生成（见上图/附件）

📲 操作指引：
1. 打开微信，扫描上方二维码
2. 在秒应小程序中打开活动
3. 点击右上角「转发」按钮
4. 选择要分享的微信群或好友
```

**考试输出：**

```
ℹ️  正在创建考试...
✅ 考试创建成功！
   ID: 69c098ece7d086b7672980c0
   标题：期中考试
   考试模式：是
   考试时长：90 分钟
   总分：10
   题目数：1
   禁止查看结果：否
   显示排名：是
   固定名单模式：是

ℹ️  正在生成二维码...
✅ 二维码已保存：path/qrcodes/exam_69c098ece7d086b7672980c0.png

---
📱 二维码已生成（见上图/附件）

📲 操作指引：
1. 打开微信，扫描上方二维码
2. 在秒应小程序中打开活动
3. 点击右上角「分享」按钮
4. 选择要分享的微信群或好友
```

### 注意事项

- CLI 工具是独立的，不依赖 package.json 的 bin 配置
- 直接使用 `miaoying` 运行
- 所有功能与 API helper 函数一致
- 自动处理 base64 前缀、目录创建等细节
- **查询功能通过 GraphQL 端点实现**，使用统一接口

**⚠️ 固定名单模式警告：**

- 预约使用 `--fixed-no` 或考试默认开启固定名单模式
- 固定名单模式下，只有名单中的人员才能参加
- 如果未提供名单，CLI 会显示黄色警告提示
- 需要在小程序管理后台单独导入名单
- 使用 `--no-fixed-no` 可关闭固定名单模式

**⚠️ 单选/多选字段选项格式警告（重要）：**

- 当 `type` 为 `"1"`（单选）或 `"2"`（多选）时，使用 `options` 字段
- **`options` 必须是字符串数组（arrayOfString），不是对象数组！**
- ✅ 正确：`"options": ["选项 A", "选项 B", "选项 C"]`
- ❌ 错误：`"options": [{"title": "选项 A"}, {"title": "选项 B"}]`（选项会丢失，保存为空）
- 使用配置文件创建时，确保 options 格式正确，否则选项不会显示在表单中

## 查询数据 (Querying Data)

所有查询操作都通过 CLI 命令实现。

### 查询统计详情

```bash
node ./bin/miaoying.js get <tongji-id>
```

### 查询统计列表

```bash
# 获取统计列表
node ./bin/miaoying.js list

# 分页
node ./bin/miaoying.js list --limit 10 --skip 0

# 关键词搜索
node ./bin/miaoying.js list --search "打卡"
```

### 查询报名数据

```bash
# 报名总数
node ./bin/miaoying.js totals <tongji-id>

# 报名结果
node ./bin/miaoying.js results <tongji-id>
node ./bin/miaoying.js results <tongji-id> --limit 20 --skip 0
```

## 导出数据 (Exporting Data)

### 导出为 xlsx

```bash
# 导出统计报名数据
node ./bin/miaoying.js export <tongji-id> --type tongji

# 导出预约数据
node ./bin/miaoying.js export <booking-id> --type booking

# 导出投票数据
node ./bin/miaoying.js export <toupiao-id> --type toupiao

# 导出查查数据
node ./bin/miaoying.js export <chacha-id> --type chacha
```

### 导出选项

| 选项                   | 说明                                               |
| ---------------------- | -------------------------------------------------- |
| `--type <type>`        | 活动类型：`tongji`, `booking`, `toupiao`, `chacha` |
| `--format <fmt>`       | 输出格式：`xlsx`（默认）或 `jsonl`                 |
| `--output <path>`      | 输出文件路径                                       |
| `--limit <n>`          | 每页记录数（默认 100）                             |
| `--incremental` / `-i` | 增量导出模式                                       |
| `--force` / `-f`       | 强制全量导出                                       |

### 增量导出

```bash
# 首次导出后，后续可使用增量模式
node ./bin/miaoying.js export <tongji-id> --type tongji --incremental

# 强制全量导出
node ./bin/miaoying.js export <tongji-id> --type tongji --force
```

## 文件上传 (File Upload)

当需要上传参考图片、附件等文件时，可以使用 CLI 的上传功能。文件会上传到阿里云 OSS，并返回 OSS 路径，可以直接用于表单字段配置。

### 上传文件

```bash
node ./bin/miaoying.js upload <file-path> [options]
```

**示例：**

```bash
# 上传图片
node ./bin/miaoying.js upload ./photo.jpg

# 上传文件
node ./bin/miaoying.js upload /path/to/document.pdf
```

### 上传成功后的输出

```
ℹ️  正在获取 OSS 签名...
ℹ️  正在上传文件...
✅  文件上传成功！
   OSS 路径：uploads/2026/03/1774273295170844_photo.jpg
```

### 在代码中使用上传功能

如果需要在上创建活动时上传图片（如表单中的图片字段需要先上传），可以在代码中调用上传接口：

```javascript
import { uploadFile } from "./miaoying-cli/src/commands/upload.js";

// 上传参考图片
const ossPath = await uploadFile({
  filePath: "./reference.jpg",
  apiKey: "your_api_key",
});

// 返回的 ossPath 可以直接用于表单字段
// 例如：{"type": "4", "title": "参考图片", "defaultValue": "uploads/2026/03/xxx.jpg"}
```

### 使用场景

- **表单配置**：某些表单字段需要先上传图片或附件
- **参考材料**：活动需要附带参考图片或文档
- **附件上传**：需要上传 PDF、Word 等文档

### OSS 路径说明

返回的 OSS 路径格式为 `uploads/YYYY/MM/timestamp_filename`，可以直接用于：

- 表单字段的 `defaultValue`
- 活动配置的封面图
- 其他需要 OSS 路径的地方
