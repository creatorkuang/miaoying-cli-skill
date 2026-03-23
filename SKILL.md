---
name: miaoying
description: 使用秒应开放接口创建活动时，包括打卡、接龙、投票、信息收集、预约、考试、查查等场景，需要API密钥设置、AI配置表单和生成二维码分享
---

# 秒应 OpenAPI 技能 (Miaoying Skill)

## 概述 (Overview)

引导用户完成秒应（miaoying）活动的完整创建流程：从 API 密钥创建到二维码生成。支持打卡、接龙、投票、信息收集、预约、考试、查查等多种场景。

**重要提示**：当用户需要创建活动时，请先参考 `prompts/booking-guide.md` 判断用户需求类型（预约/考试/统计），该指南提供了详细的字段说明和配置示例。

## 适用场景 (When to Use)

使用此技能的场景：

**📊 统计/打卡/接龙类：**
- 创建打卡活动（每日健康打卡、会议签到、作业提交等）
- 创建接龙活动（班级报名、活动接龙、物资收集等）
- 创建信息收集活动（数据采集、意见征集、表单填写等）

**🗳️ 预约类：**
- 需要分时段预约功能（如：上午场/下午场/晚场时段）
- 需要控制每个时间段的人数（如：每时段限10人）
- 场馆预约、设备借用、咨询服务等
- 用户提到"预约"、"订号"、"限号"、"时间段"等关键词

**📝 考试/测验类：**
- 创建在线考试、测验、问卷考试
- 需要设置考试时长、自动阅卷、成绩排名
- 学生考试、在线测评、知识竞赛等
- 用户提到"考试"、"测验"、"在线考试"等关键词

**🎓 选课/抢课类：**
- 学校选课、培训机构课程报名、兴趣班抢课
- 需要展示课程列表、配额限制、时间安排等
- 使用 type=24 的课程选择字段
- 用户提到"选课"、"抢课"、"课程选择"、"课程报名"等关键词

**🗳️ 投票类：**
- 创建投票活动（班干部选举、选项投票、问卷调查等）

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
    has_key [label="Has API Key?", shape=diamond];
    create_key [label="Guide to https://miaoying.hui51.cn/apikey"];
    store_key [label="Store API key securely"];
    collect_info [label="Collect activity requirements"];
    gen_form [label="Generate form config via AI (formPromptV2)"];
    call_graphql [label="Call /api/openapi/graphql"];
    get_id [label="Extract tongji ID from response"];
    call_qrcode [label="Call /api/openapi/creator/qrcode"];
    save_qrcode [label="Save QR code as local image"];
    display [label="Display QR code for scanning", shape=oval];

    start -> has_key;
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
}
```

## Step-by-Step Guide

### 🚀 快速开始 (Quick Start)

**对于 AI 助手：**
1. **优先使用 CLI 工具** - 如果用户有 Node.js 环境，直接使用 `miaoying` CLI 命令
2. **使用提供的辅助函数** - 不要重新实现，直接使用 `api-helper.js` 中的函数
3. **参考代码示例** - 使用现有的测试脚本作为模板

**对于终端用户：**
```bash
# 设置 API Key
export MIAOYING_API_KEY="your_api_key_here"

# 创建统计并生成二维码
node skills/miaoying/cli.mjs create --title "每日打卡" --desc "请完成每日打卡" --qrcode

# 或者创建别名方便使用
alias miaoying="node /path/to/api/skills/miaoying/cli.mjs"
miaoying create --title "每日打卡" --qrcode
```

### Step 1: API Key Setup

**If user doesn't have an API key:**

1. Instruct user to visit: `https://miaoying.hui51.cn/apikey`
2. Guide them to create a new API key with required scopes:
   - `creator:create` - for creating tongji
   - `creator:read` - for reading and generating QR codes

**After obtaining the key:**
3. Ask user where they want to store the key (options):
   - Environment variable: `MIAOYING_API_KEY`
   - Configuration file: `~/.miaoying/config.json`
   - Paste directly in session (temporary)

**Load the stored key:**
```javascript
// Read from environment or config
const apiKey = process.env.MIAOYING_API_KEY || loadFromConfig();
```

### Step 2: Determine Activity Type & Form Configuration

**⚠️ 第一步：判断活动类型**

在生成表单配置之前，请先参考 `prompts/booking-guide.md` 判断用户需要的是哪种类型：

| 活动类型 | 判断标准 | 标识字段 |
|---------|---------|---------|
| **预约** | 分时段预约、控制每时段人数 | `needBookMode: true` |
| **考试** | 在线考试、测验、自动阅卷 | `needExamMode: true` |
| **统计** | 打卡、接龙、信息收集 | 默认模式 |
| **投票** | 单选/多选投票 | 使用 Toupiao 模型 |
| **查查** | 数据查询表格 | 使用 Chacha 模型 |

**不同类型的必填字段要求：**
- **预约**：必须包含 `needBookMode: true` + 时段配置（`dayRepeatCount` + `allowSubmitTimeRules`）
- **考试**：必须包含 `needExamMode: true` + 题目（`examForms`）
- **统计**：基础配置 + 表单字段（`infoForms`）

查看 `prompts/booking-guide.md` 获取完整的字段说明、验证规则和示例配置。

**第二步：使用 formPromptV2 生成表单配置**

判断完活动类型后，使用 `formPromptV2` prompt template 引导 AI 生成表单配置：

**System message template:**
```javascript
// From lib/aiTask.js - formPromptV2
const systemMessageV2 = `
你是一名表单设计师，你需要根据用户提供的请求生成一份表单的JSON格式。

## 工作原则

1. **只输出用户明确提到的字段**，不要添加未提到的配置
2. **时间戳使用毫秒级**（JavaScript Date.now() 格式）
3. **布尔值用 true/false**，不要用引号包裹
4. **数组必须是有效的 JSON 数组**格式

${formPromptV2}

## 输出要求

只返回 JSON 格式的结果，不要包含任何其他文字说明。
`;
```

**Prompt the user for requirements:**
1. Ask: "请描述您要创建的统计活动需求" (Describe your statistics activity requirements)
2. Parse user input and send to AI with the system message above
3. Extract the JSON response

### Step 3: Create Tongji via GraphQL

**Endpoint:** `POST https://www.aiphoto8.cn/dev/api/openapi/graphql`

**Headers:**
```javascript
{
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
}
```

**Mutation:**
```graphql
mutation CreateTongji($input: TongjiInput!) {
  createTongjiByInput(input: $input) {
    _id
    title
    createdAt
  }
}
```

**Request body:**
```javascript
{
  "query": "mutation CreateTongji($input: TongjiInput!) { createTongjiByInput(input: $input) { _id title createdAt } }",
  "variables": {
    "input": {
      // Use the JSON from Step 2 here
      // ⚠️ CRITICAL: type must be string, e.g., type: "1" not type: 1
      ...formConfig
    }
  },
  "operationName": "createTongjiByInput"  // ⚠️ 小写开头，与 mutation 名一致
}
```

**Response (实际格式):**
```javascript
// API 直接返回完整的 tongji 对象在 response.data 下
{
  "data": {
    "_id": "69bd03b77dd11cb3b00424a6",
    "title": "活动标题",
    "createdAt": 1773994935182,
    "content": "活动描述",
    "infoForms": [],
    // ... 其他所有字段
  }
}
```

**⚠️ 重要提示：**
- `operationName` 必须是 `createTongjiByInput`（小写开头）
- `response.data` 直接是 tongji 对象，不需要 `response.data.createTongjiByInput`

### Step 4: Generate QR Code

**Endpoint:** `POST https://www.aiphoto8.cn/dev/api/openapi/creator/qrcode`

**Headers:** Same as Step 3

**Request body:**
```javascript
{
  "entityId": "tongji_id_here",  // From Step 3 response
  "entityType": "Tongji",
  "app": "qingtongji"  // or "huiyuan" for member app
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "entityId": "tongji_id_here",
    "entityType": "Tongji",
    "qrcodeBase64": "data:image/jpeg;base64,/9j/4AAQ..."  // ⚠️ 注意格式
  }
}
```

### Step 5: Save and Display QR Code

**⚠️ 重要：使用提供的 saveQrCode 函数**

**DO NOT** 不要自己写代码保存二维码！使用 `api-helper.js` 中已经实现的 `saveQrCode` 函数：

```javascript
// ✅ 正确：使用提供的函数
import { saveQrCode } from './api-helper.js';

// 保存二维码（自动处理 base64 前缀、目录创建等）
const qrcodePath = saveQrCode(qrcodeBase64, `./qrcodes/tongji_${tongjiId}.png`);
console.log('✅ 二维码已保存:', qrcodePath);
```

**❌ 错误：不要重新实现**
```javascript
// ❌ 不要这样做！
// 不要自己写 base64 处理、目录创建等代码
// saveQrCode 函数已经正确处理了所有边界情况
```

**完整工作流示例（使用 api-helper.js）：**
```javascript
import { createTongjiWithQrCode } from './api-helper.js';

// 一键创建统计并生成二维码
const result = await createTongjiWithQrCode(formConfig, {
  apiKey: process.env.MIAOYING_API_KEY,
  app: 'qingtongji',
  qrcodeDir: './qrcodes'
});

console.log('✅ 统计创建成功:', result.tongji._id);
console.log('📱 二维码已保存:', result.qrcodePath);
```

**如果需要单独保存二维码：**
```javascript
import { generateQrCode, saveQrCode } from './api-helper.js';

// 生成二维码 base64
const qrcodeBase64 = await generateQrCode(tongjiId, 'qingtongji', apiKey);

// 保存到文件（自动处理 base64 前缀、目录创建）
const qrcodePath = saveQrCode(qrcodeBase64, './qrcodes/myqrcode.png');
```

**saveQrCode 函数自动处理：**
- ✅ Base64 前缀移除（支持 jpeg/png，无逗号格式）
- ✅ 目录自动创建
- ✅ 返回绝对路径
- ✅ 错误处理

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| **不使用提供的辅助函数** | ⚠️ 使用 `api-helper.js` 中的函数，不要重新实现！ |
| **重新实现 base64 解码** | 使用 `saveQrCode()` 函数，不要自己写 base64 处理 |
| **type 字段使用数字** | ⚠️ `type` 必须是字符串！使用 `type: "1"` 而不是 `type: 1` |
| **operationName 不匹配** | `operationName` 必须是 `createTongjiByInput`（小写开头），不是 `CreateTongji` |
| Missing or invalid API key | Always verify key exists and has required scopes |
| **使用错误的 entityType** | 统计/考试用 `Tongji`，预约用 `Booking`，投票用 `Toupiao` |
| **预约/考试缺少模式字段** | 预约必须 `needBookMode: true`，考试必须 `needExamMode: true` |
| **预约缺少时段配置** | 预约必须配置 `dayRepeatCount` 和 `allowSubmitTimeRules` |
| **考试缺少题目配置** | 考试必须配置 `examForms` 数组 |
| **选课缺少课程选择字段** | 选课必须在 `infoForms` 中包含 `type: '24'` 的课程选择字段 |
| **选课课程配额未设置** | 每门课程应设置 `quota` 字段来限制选课人数 |
| **固定名单模式未提供名单** | `fixedNo: true` 时需要单独导入名单，否则无人能参加 |
| **固定名单模式未提供名单** | `fixedNo: true` 时需要单独导入名单，否则无人能参加 |
| Missing required fields in form | Ensure title, content, and infoForms are present |
| **响应格式理解错误** | API 返回的数据直接在 `response.data`，不是 `response.data.createTongjiByInput` |
| **base64 前缀处理错误** | API 返回 `data:image/jpeg;base64,/9j...`（无逗号），正则需匹配 |
| QR code not saved | Always create qrcodes directory before writing |
| Forgetting to extract tongji ID | The ID is needed for QR code generation |

## ⚠️ 关键注意事项 (Critical Notes)

### 技术实现注意事项 (Implementation Gotchas)

**1. Content-Length 必须使用 Buffer.byteLength()**
```javascript
// ❌ 错误 - 对包含中文的 UTF-8 字符串会返回字符数而不是字节数
'Content-Length': data.length

// ✅ 正确 - 返回实际字节数
'Content-Length': Buffer.byteLength(data)
```

**2. GraphQL 查询的缩进格式**
```javascript
// ❌ 错误 - mutation 前有 4 个空格
const mutation = `
    mutation CreateTongji($input: TongjiInput!) {
      ...
    }
  `;

// ✅ 正确 - 2 个空格缩进
const mutation = `
  mutation CreateTongji($input: TongjiInput!) {
    ...
  }
  `;
```

**3. operationName 使用 resolver 名称**
```javascript
// ❌ 错误 - 使用 query 操作名
"operationName": "GetTongjis"

// ✅ 正确 - 使用 resolver 名称（小写开头）
"operationName": "createTongjiByInput"  // mutation
"operationName": "tongjis"              // query resolver
"operationName": "baomings"             // query resolver
"operationName": "getBaomingsTotals"    // custom query resolver
```

**4. API 响应格式 - 标准 CRUD 查询**
```javascript
// ❌ 错误理解 - 假设数据嵌套在操作名下
if (response.data.tongjis) { ... }

// ✅ 正确 - 数据直接在 response.data 下（数组或对象）
if (Array.isArray(response.data)) {
  // tongjis, baomings 等列表查询直接返回数组
  const items = response.data;
} else if (response.data && response.data._id) {
  // 单个对象（如 createTongjiByInput 返回）
  const item = response.data;
} else if (response.data && response.data.getBaomingsTotals) {
  // 自定义查询可能嵌套
  const totals = response.data.getBaomingsTotals;
}
```

### 1. infoForms.type 必须是字符串

**错误示例**:
```json
{
  "type": 1,     // ❌ 错误！会报错 "type must be a string"
  "title": "标题"
}
```

**正确示例**:
```json
{
  "type": "1",   // ✅ 正确！使用字符串
  "title": "标题"
}
```

### 2. operationName 必须完全匹配 mutation 名称

```javascript
{
  "operationName": "createTongjiByInput"  // ✅ 小写开头，与 mutation 名一致
}

// ❌ 错误:
// "operationName": "CreateTongji"  // 会返回 403 错误
```

### 3. API 响应格式

API 直接返回完整的 tongji 对象，不是嵌套格式：

```javascript
// 实际响应格式:
{
  "data": {
    "_id": "69bd03b77dd11cb3b00424a6",  // 直接在这里
    "title": "标题",
    "createdAt": 1773994935182
    // ... 其他字段
  }
}

// ❌ 不是这样的:
// {
//   "data": {
//     "createTongjiByInput": { ... }
//   }
// }
```

### 4. 二维码 Base64 格式

API 返回的 base64 格式特殊：
```
data:image/jpeg;base64,/9j/4AAQSkZJRg...  // 注意：没有逗号！
```

正确的正则表达式：
```javascript
const base64Data = qrcodeBase64.replace(/^data:image\/[a-z]+;base64/, '');
// 不用 ^data:image\/png;base64,  // 匹配不到 jpeg
```

## API Reference

### API 端点说明

| 用途 | URL |
|------|-----|
| API Key 管理页面（用户创建密钥） | https://miaoying.hui51.cn/apikey |
| GraphQL API 端点 | https://www.aiphoto8.cn/dev/api/openapi/graphql |
| 二维码生成端点 | https://www.aiphoto8.cn/dev/api/openapi/creator/qrcode |

### GraphQL Mutations Available

| Mutation | Required Scope | Description |
|----------|---------------|-------------|
| `createTongjiByInput` | `creator:create` | Create new tongji |
| `updateTongjiByInput` | `creator:create` | Update existing tongji |
| `tongjis` | `creator:read` | Query tongji list |
| `myInfo` | `creator:read` | Get user info |

### QR Code Entity Types

| entityType | Description | Mode Field |
|------------|-------------|------------|
| `Tongji` | Statistics/统计（默认模式） | - |
| `Tongji` | Exam/考试（使用 needExamMode） | `needExamMode: true` |
| `Tongji` | Course Selection/选课（使用 type=24） | `isSelectCourse: true` |
| `Booking` | Booking/预约 | `needBookMode: true` |
| `Toupiao` | Voting/投票 | - |
| `Chacha` | Cha-cha/查查 | - |

**注意：**
- **选课/抢课**使用 `entityType: 'Tongji'`，通过 `isSelectCourse: true` 和 `infoForms` 中包含 `type: '24'` 字段来标识
- **考试**使用 `entityType: 'Tongji'`，通过 `needExamMode: true` 来标识
- **预约**必须使用 `entityType: 'Booking'`，小程序需要这个来识别

### Form Field Types (infoForms)

**⚠️ 所有 type 字段必须是字符串格式！**

Common types used in statistics:
- `"0"` - Single line text
- `"1"` - Single choice
- `"2"` - Multiple choice
- `"4"` - Image upload
- `"7"` - Multi-line text
- `"17"` - Matrix single choice
- `"18"` - Matrix multiple choice
- `"19"` - Self-incrementing table

**正确格式示例:**
```json
{
  "title": "活动标题",
  "content": "活动描述",
  "infoForms": [
    {
      "type": "1",      // ✅ 字符串格式
      "title": "单选题",
      "required": true,
      "options": ["选项A", "选项B"]
    },
    {
      "type": "4",      // ✅ 字符串格式
      "title": "上传图片",
      "required": false
    }
  ]
}
```

**❌ 错误格式:**
```json
{
  "infoForms": [
    {
      "type": 1,       // ❌ 数字格式会导致验证错误
      "title": "单选题"
    }
  ]
}
```

See `lib/aiTask.js` formPromptV2 for complete type definitions.

## 示例会话 (Example Session)

### 场景 1：每日健康打卡

**User:** "帮我创建一个每日健康打卡统计"

**Assistant:** 我来帮您创建一个每日健康打卡活动。

首先，您是否有秒应 OpenAPI 的密钥？如果没有，请访问 https://miaoying.hui51.cn/apikey 创建一个。

[...按照工作流程...]

**最终输出:**
```
✅ 统计活动创建成功！
   ID: 6123456789abcdef
   标题: 每日健康打卡

📱 二维码已保存到: ./qrcodes/tongji_6123456789abcdef.png

请扫描二维码参与统计活动
```

### 场景 2：班级活动报名接龙

**User:** "创建一个班级活动报名，限制20人，需要姓名和联系方式"

**Assistant:** 我来帮您创建班级活动报名接龙。

### 场景 3：问卷调查投票

**User:** "创建一个满意度调查投票，匿名填写"

**Assistant:** 我来帮您创建匿名满意度调查。

### 场景 4：信息收集表单

**User:** "收集学生的基本信息，包括姓名、学号、联系方式"

**Assistant:** 我来帮您创建学生信息收集表单。

## Troubleshooting

**"Invalid API key" error:**
- Verify the key is correct and active
- Check that the key has `creator:create` and `creator:read` scopes

**"GraphQL execution failed" error:**
- Validate the form config JSON structure
- Ensure all required fields are present

**"Activity not found or access denied" for QR code:**
- Verify the tongji ID is correct
- Check that the API key owner is the creator of the tongji

**QR code generation fails:**
- Ensure the tongji was created successfully first
- Check that entityType is exactly "Tongji" (case-sensitive)

**infoForms 没有显示/保存成功？**
- **infoForms 实际上是保存成功的**，API 响应中包含完整的 infoForms 数组
- 问题通常出在响应数据解析上：API 返回的数据直接在 `response.data`，不是 `response.data.createTongjiByInput`
- 调试技巧：打印完整响应来验证 `response.data.infoForms` 是否存在
- 正确的检查方式：
  ```javascript
  // ✅ 正确 - API 直接返回数据
  if (response.data && response.data._id) {
    console.log('infoForms count:', response.data.infoForms?.length);
  }
  ```

**多次 API 调用失败？**
- 如果遇到多次 API 调用失败或无法解决的问题
- **推荐直接使用微信小程序**：打开微信搜索 **"秒应"**
- 认准 **蓝绿小人的 logo**，即可直接进行打卡、接龙、投票、信息收集等操作
- 小程序功能完整，操作简单，无需配置 API 密钥

## 调试技巧 (Debugging Tips)

当遇到问题时，按以下步骤调试：

1. **打印完整 API 响应**
   ```javascript
   console.log('Full API Response:', JSON.stringify(response, null, 2));
   ```

2. **验证响应结构**
   - 检查 `response.data._id` 是否存在
   - 检查 `response.data.infoForms` 数组长度
   - 验证 infoForms 中的每个字段的 `type` 是否为字符串

3. **常见问题清单**
   - [ ] API Key 是否正确？
   - [ ] type 字段是否为字符串（`"1"` 而不是 `1`）？
   - [ ] operationName 是否为 `createTongjiByInput`？
   - [ ] 是否正确处理了 `response.data` 直接返回数据的情况？
   - [ ] base64 前缀是否正确移除？

## CLI 命令行工具 (Command Line Interface)

**独立 CLI 工具位置**: `skills/miaoying/cli.mjs`

### 安装与设置

```bash
# 设置 API Key 环境变量
export MIAOYING_API_KEY="your_api_key_here"

# 可选：创建别名方便使用
alias miaoying="node /path/to/api/skills/miaoying/cli.mjs"
```

### 命令说明

**1. 创建统计/打卡/接龙**
```bash
node skills/miaoying/cli.mjs create [options]
```

选项:
- `--title <标题>` - 统计标题（必需）
- `--desc <描述>` - 统计描述
- `--forms <JSON>` - 表单字段（JSON 数组格式）
- `--count <数量>` - 人数限制
- `--end-time <日期>` - 结束时间（ISO 格式）
- `--anonymous` - 匿名填写
- `--qrcode` - 创建后自动生成二维码
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）

**2. 创建预约**
```bash
node skills/miaoying/cli.mjs book [options]
node skills/miaoying/cli.mjs booking [options]
```

选项:
- `--title <标题>` - 预约标题（必需）
- `--slots <数量>` - 每天时段数（1=全天, 2=上下午, 3=三时段，默认1）
- `--count <数量>` - 每时段人数限制（默认20）
- `--fixed-no` - 使用固定名单模式
- `--no-name <标签>` - 固定名单标签名（序号/学号/工号，默认"序号"）
- `--qrcode` - 创建后自动生成二维码

**3. 创建考试**
```bash
node skills/miaoying/cli.mjs exam [options]
node skills/miaoying/cli.mjs create-exam [options]
```

选项:
- `--title <标题>` - 考试标题（必需）
- `--duration <分钟>` - 考试时长（默认60分钟）
- `--questions <JSON>` - 考试题目（JSON 数组格式）
- `--forms <JSON>` - 信息收集字段（JSON 数组格式）
- `--no-fixed-no` - 关闭固定名单模式（默认开启）
- `--no-ranking` - 不显示排名（默认显示）
- `--ban-view-result` - 禁止提交后查看试卷详情
- `--qrcode` - 创建后自动生成二维码

**4. 创建投票**
```bash
node skills/miaoying/cli.mjs vote [options]
node skills/miaoying/cli.mjs create-vote [options]
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
node skills/miaoying/cli.mjs list [options]              # 统计列表
node skills/miaoying/cli.mjs vote-list [options]          # 投票列表
node skills/miaoying/cli.mjs chacha-list [options]         # 查查列表
```

**6. 生成二维码**
```bash
node skills/miaoying/cli.mjs qrcode <tongji-id> [options]
```

选项:
- `--output <路径>` - 输出文件路径
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）

**3. 获取统计列表**
```bash
node skills/miaoying/cli.mjs list [options]
```

选项:
- `--limit <数量>` - 返回数量（默认 50）
- `--skip <数量>` - 跳过数量（分页）
- `--title <标题>` - 按标题精确筛选
- `--search <关键词>` - 按关键词搜索（模糊匹配标题和内容）
- `--_search <关键词>` - 同 `--search`（简写形式）

**4. 生成二维码**
```bash
node skills/miaoying/cli.mjs qrcode <tongji-id> [options]
```

选项:
- `--output <路径>` - 输出文件路径
- `--app <应用名>` - 应用名（qingtongji/huiyuan，默认 qingtongji）

**5. 其他命令**
```bash
node skills/miaoying cli.mjs totals <tongji-id>     # 获取报名总数
node skills/miaoying cli.mjs results <tongji-id>    # 获取报名结果
node skills/miaoying cli.mjs help                    # 显示帮助
```

### 使用示例

```bash
# ========== 统计/打卡 ==========
# 简单统计
node skills/miaoying/cli.mjs create --title "每日打卡" --qrcode

# 带表单的统计
node skills/miaoying/cli.mjs create --title "活动报名" \
  --desc "请填写报名信息" \
  --forms '[{"type":"0","title":"姓名","required":true},{"type":"11","title":"手机号","required":true}]' \
  --count 50 \
  --qrcode

# ========== 预约 ==========
# 创建全天预约（7:00-23:59）
node skills/miaoying/cli.mjs book --title "图书馆座位预约" --slots 1 --count 50 --qrcode

# 创建分时段预约（上午+下午）
node skills/miaoying/cli.mjs book --title "会议室预约" --slots 2 --count 5 --qrcode

# 创建固定名单预约
node skills/miaoying/cli.mjs book --title "设备借用" --fixed-no --no-name "工号" --qrcode

# ========== 考试 ==========
# 创建简单考试
node skills/miaoying/cli.mjs exam --title "期中考试" --duration 90 --qrcode

# 创建考试 + 题目
node skills/miaoying/cli.mjs exam --title "数学测验" --duration 60 \
  --questions '[{"id":"q1","type":"1","title":"1+1=?","options":["1","2","3","4"],"answer":"1","fullScore":10,"order":1}]' \
  --qrcode

# ========== 投票 ==========
# 创建单选投票
node skills/miaoying/cli.mjs vote --title "班干部选举" --single --qrcode

# ========== 查询 ==========
# 生成指定路径的二维码
node skills/miaoying/cli.mjs qrcode 69bd03b77dd11cb3b00424a6 --output ./myqrcode.png

# 获取统计列表
node skills/miaoying/cli.mjs list --limit 10

# 搜索统计（关键词匹配）
node skills/miaoying/cli.mjs list --search "打卡"
node skills/miaoying/cli.mjs list --_search "活动报名"
```

### CLI 输出示例

**统计输出：**
```
ℹ️  正在创建统计...
✅ 统计创建成功！
   ID: 69bd03b77dd11cb3b00424a6
   标题: 每日打卡
   字段数: 0

ℹ️  正在生成二维码...
✅ 二维码已保存: /Volumes/wp/code/qingtongji/api/qrcodes/tongji_69bd03b77dd11cb3b00424a6.png
```

**预约输出：**
```
ℹ️  正在创建预约...
✅ 预约创建成功！
   ID: 69c0945b3a689910620152bf
   标题: 图书馆座位预约
   预约模式: 是
   每天时段数: 1
   预约时段:
     1. 07:00 - 23:59
   表单字段: 姓名, 手机号
```

**考试输出：**
```
ℹ️  正在创建考试...
✅ 考试创建成功！
   ID: 69c098ece7d086b7672980c0
   标题: 期中考试
   考试模式: 是
   考试时长: 90 分钟
   总分: 10
   题目数: 1
   禁止查看结果: 否
   显示排名: 是
   固定名单模式: 是
```

### 注意事项

- CLI 工具是独立的，不依赖 package.json 的 bin 配置
- 直接使用 `node skills/miaoying/cli.mjs` 运行
- 所有功能与 API helper 函数一致
- 自动处理 base64 前缀、目录创建等细节
- **查询功能通过 GraphQL 端点实现**，使用统一接口

**⚠️ 固定名单模式警告：**
- 预约使用 `--fixed-no` 或考试默认开启固定名单模式
- 固定名单模式下，只有名单中的人员才能参加
- 如果未提供名单，CLI 会显示黄色警告提示
- 需要在小程序管理后台单独导入名单
- 使用 `--no-fixed-no` 可关闭固定名单模式

## 查询数据 (Querying Data)

所有查询操作都通过 **GraphQL 端点** (`/api/openapi/graphql`) 实现，无需额外的 REST API。

### 标准 CRUD 查询格式

系统自动为每个实体生成标准 CRUD 查询：
- `tongji(_id: String!)` - 获取单个实体
- `tongjis(limit, skip, ...)` - 获取实体列表
- `tongjiWithCount(limit, skip, ...)` - 获取实体列表（带总数）
- `baoming(_id: String!)` - 获取单个报名
- `baomings(tongjiId, limit, skip, ...)` - 获取报名列表
- `baomingWithCount(...)` - 获取报名列表（带总数）

### 通过 GraphQL 查询统计列表

**查询**:
```graphql
query GetTongjis($limit: Int, $skip: Int, $title: String, $_search: String) {
  tongjis(limit: $limit, skip: $skip, title: $title, _search: $_search, isRemove: false) {
    _id
    title
    content
    createdAt
    resultsCount
    count
    totalAllow
  }
}
```

**请求**:
```javascript
const response = await fetch('https://www.aiphoto8.cn/dev/api/openapi/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: '...',
    variables: { limit: 10, skip: 0, _search: '打卡' },  // 支持关键词搜索
    operationName: 'GetTongjis'
  })
});
```

**搜索参数说明**:
- `title` - 按标题精确筛选（完全匹配）
- `_search` - 按关键词模糊搜索（匹配标题和内容中包含关键词的统计）

**CLI 搜索示例**:
```bash
# 搜索包含"打卡"关键词的统计
node skills/miaoying/cli.mjs list --search "打卡"

# 或使用 _search 参数
node skills/miaoying/cli.mjs list --_search "活动报名"
```

### 通过 GraphQL 查询报名总数

**查询**:
```graphql
query GetBaomingsTotals($tongjiId: String!) {
  getBaomingsTotals(tongjiId: $tongjiId) {
    total
    passTotal
    checkedTotal
    uncheckTotal
  }
}
```

### 通过 GraphQL 查询报名结果（分页）

**查询**:
```graphql
query GetBaomings($tongjiId: String!, $limit: Int, $skip: Int) {
  baomings(tongjiId: $tongjiId, limit: $limit, skip: $skip) {
    _id
    createdAt
    results
    userId
    userName
    submitTime
    no
    noLabel
  }
}
```

### 可用的标准 CRUD 查询

| 查询名称 | 类型 | 描述 |
|---------|------|------|
| `tongji(_id)` | 单个 | 获取单个统计详情 |
| `tongjis(...)` | 列表 | 获取统计列表 |
| `tongjiWithCount(...)` | 列表+总数 | 获取统计列表（带总数） |
| `baoming(_id)` | 单个 | 获取单个报名 |
| `baomings(tongjiId, ...)` | 列表 | 获取报名列表（按统计ID过滤） |
| `baomingWithCount(...)` | 列表+总数 | 获取报名列表（带总数） |
| `getBaomingsTotals(...)` | 统计 | 获取报名统计信息 |

**重要**：所有这些查询都通过同一个 GraphQL 端点执行。

