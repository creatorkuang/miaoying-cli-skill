# 秒应 Skill (Miaoying Skill)

秒应 OpenAPI 技能，用于创建打卡、接龙、投票、信息收集、预约、考试等活动。

## ⚠️ 使用前须知 (Before You Start)

### 凭证要求

**本技能需要秒应 API Key 才能使用。**

- **获取方式**：[API Key 管理页面](https://miaoying.hui51.cn/apikey)
- **存储方式**：推荐使用环境变量 `MIAOYING_API_KEY`

### 域名说明

秒应服务使用多个域名，各司其职：

| 域名 | 用途 | 说明 |
|------|------|------|
| `miaoying.hui51.cn` | 用户管理后台 | API Key 管理、账户设置 |
| `www.aiphoto8.cn` | API 服务器 | 实际的 API 调用端点 |

这是正常的多域名架构，管理后台和 API 服务分离。

### 安全最佳实践

1. ✅ **使用环境变量存储 API Key**
2. ✅ **验证 npm 包来源后再安装**
3. ❌ **不要在聊天会话中直接粘贴 API Key**
4. ❌ **不要将 API Key 提交到代码仓库**

## 安装指南 (Installation Guide for AI Agents)

### 前置要求

- Node.js >= 16.0.0
- npm
- 秒应 API Key（从 [API Key 管理页面](https://miaoying.hui51.cn/apikey) 获取）

### 安装步骤

#### 1. 安装 CLI 工具

```bash
npm install -g @miaoying-ai/miaoying-cli
```

#### 2. 配置 API Key

**方式一：环境变量（推荐）**

```bash
export MIAOYING_API_KEY="your_api_key_here"

# 永久保存（添加到 shell 配置文件）
echo 'export MIAOYING_API_KEY="your_api_key_here"' >> ~/.zshrc  # zsh
echo 'export MIAOYING_API_KEY="your_api_key_here"' >> ~/.bashrc # bash
```

**方式二：配置文件**

创建 `~/.miaoying/config.json`：

```json
{
  "apiKey": "your_api_key_here"
}
```

#### 3. 验证安装

```bash
miaoying help
```

### ✅ 安装检查清单

在首次使用前，请确认：

- [ ] 已从官方渠道 [miaoying.hui51.cn/apikey](https://miaoying.hui51.cn/apikey) 获取 API Key
- [ ] 已验证 npm 包 `@miaoying-ai/miaoying-cli` 的来源
- [ ] 已使用环境变量存储 API Key（而非直接粘贴）
- [ ] 了解本技能会访问 `~/.miaoying/config.json` 和 `./qrcodes/` 目录
- [ ] 了解 API 调用会发送到 `www.aiphoto8.cn`

### 快速开始

```bash
# 创建打卡活动并生成二维码
miaoying create --title "每日打卡" --qrcode

# 创建带表单的报名
miaoying create --title "活动报名" \
  --info-forms '[{"type":"0","title":"姓名","required":true}]' \
  --qrcode

# 创建预约
miaoying book --title "会议室预约" --slots 2 --count 10 --qrcode

# 创建考试
miaoying exam --title "期中考试" --duration 90 --qrcode
```

## 作为 AI Agent Skill 使用

本技能可安装到 Claude Code、OpenClaw 等 AI Agent 中。

### 安装到 Claude Code

```bash
# 复制到 Claude Code skills 目录
cp -r . ~/.claude/skills/miaoying
```

### 安装到 OpenClaw

```bash
# 复制到 OpenClaw skills 目录
cp -r . ~/.openclaw/skills/miaoying
```

### 通用安装（适用于其他 AI Agent）

将此 skill 复制到你使用的 AI Agent 的 skills 目录：

```bash
# 替换 <agent-name> 为你的 AI Agent 名称
cp -r . ~/.<agent-name>/skills/miaoying
```

### 目录结构

```
~/.<agent>/skills/miaoying/
├── SKILL.md                      # 技能定义文件
├── prompts/
│   ├── ai-form-prompt.md         # 表单配置参考
│   ├── ai-form-display-conditions.md  # 显示条件配置
│   └── booking-guide.md          # 预约/考试指南
└── README.md                     # 本文件
```

### 自动识别关键词

安装后，当用户提到以下关键词时，AI Agent 会自动加载此技能：

- "创建打卡/接龙/投票"
- "预约/报名"
- "考试/测验"
- "秒应" / "miaoying"

## 功能列表

| 功能 | CLI 命令 | 说明 |
|------|----------|------|
| 创建统计/打卡 | `miaoying create` | 打卡、接龙、信息收集 |
| 创建预约 | `miaoying book` | 分时段预约 |
| 创建考试 | `miaoying exam` | 在线考试、测验 |
| 创建投票 | `miaoying vote` | 单选/多选投票 |
| 生成二维码 | `miaoying qrcode <id>` | 生成活动二维码 |
| 查看列表 | `miaoying list` | 获取活动列表 |
| 导出数据 | `miaoying export <id>` | 导出为 xlsx/jsonl |
| 上传文件 | `miaoying upload <file>` | 上传到 OSS |

## 文件说明

- **SKILL.md** - 技能主定义文件，包含完整的工作流程和 API 说明
- **prompts/ai-form-prompt.md** - 表单字段配置完整参考
- **prompts/ai-form-display-conditions.md** - 表单显示条件配置
- **prompts/booking-guide.md** - 预约/考试/选课判断指南

## 获取帮助

- **微信客服**：搜索「秒应服务」关注后联系
- **API Key 管理**：https://miaoying.hui51.cn/apikey

## 常见问题 (FAQ)

### Q: 为什么有两个不同的域名？

**A:** `miaoying.hui51.cn` 是用户管理后台，用于获取 API Key 和管理账户；`www.aiphoto8.cn` 是 API 服务器，用于实际的 API 调用。这是常见的微服务架构设计，管理后台和 API 服务分离部署。

### Q: API Key 泄露了怎么办？

**A:** 立即登录 [API Key 管理页面](https://miaoying.hui51.cn/apikey) 删除泄露的 Key，然后创建新的 Key。建议使用环境变量存储，避免在聊天中直接粘贴。

### Q: 如何验证 npm 包是官方的？

**A:** 运行 `npm view @miaoying-ai/miaoying-cli` 查看包信息，确认：
- 包名正确
- 仓库地址指向官方 GitHub
- 维护者是秒应团队

### Q: 本地存储的配置文件安全吗？

**A:** `~/.miaoying/config.json` 存储在本地，建议：
- 确保 `.gitignore` 包含此文件
- 不要将此文件提交到代码仓库
- 使用文件系统权限限制访问

## 许可证

MIT License
