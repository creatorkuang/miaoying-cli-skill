/**
 * Miaoying OpenAPI Helper Functions
 *
 * Helper functions for creating miaoying statistics via OpenAPI
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// API 基础 URL
const API_BASE_URL = 'https://www.aiphoto8.cn'; // OpenAPI 调用地址

// API Key 管理页面 URL (用于用户创建密钥)
const APIKEY_MANAGE_URL = 'https://miaoying.hui51.cn/apikey';

/**
 * Load API key from environment variable or config file
 * @returns {string} The API key
 */
export function loadApiKey() {
  // Try environment variable first
  if (process.env.MIAOYING_API_KEY) {
    return process.env.MIAOYING_API_KEY;
  }

  // Try config file
  const configPath = path.join(process.env.HOME || '.', '.miaoying', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.apiKey;
  }

  throw new Error(`API key not found. Please visit ${APIKEY_MANAGE_URL} to create one, or set MIAOYING_API_KEY environment variable.`);
}

/**
 * Store API key to config file
 * @param {string} apiKey - The API key to store
 */
export function storeApiKey(apiKey) {
  const configDir = path.join(process.env.HOME || '.', '.miaoying');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ apiKey }, null, 2));
  console.log(`API key stored to: ${configPath}`);
}

/**
 * Make a GraphQL request to the OpenAPI
 * @param {string} query - GraphQL query/mutation
 * @param {object} variables - Query variables
 * @param {string} operationName - Operation name
 * @returns {Promise<object>} Response data
 */
export async function graphqlRequest(query, variables = {}, operationName = null, apiKey = null) {
  const key = apiKey || loadApiKey();

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query,
      variables,
      operationName
    });

    const options = {
      hostname: new URL(API_BASE_URL).hostname,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(`GraphQL error: ${JSON.stringify(response.errors)}`));
          } else {
            resolve(response.data);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Create a tongji via GraphQL API
 * @param {object} formConfig - Form configuration (from AI generation)
 * @param {string} apiKey - Optional API key
 * @returns {Promise<object>} Created tongji data
 *
 * NOTE: This API returns data directly at response.data level, NOT nested under
 * the mutation name. Response format: { _id, title, infoForms, ... }
 */
export async function createTongji(formConfig, apiKey = null) {
  const mutation = `
    mutation CreateTongji($input: TongjiInput!) {
      createTongjiByInput(input: $input) {
        _id
        title
        createdAt
      }
    }
  `;

  const result = await graphqlRequest(
    mutation,
    { input: formConfig },
    'createTongjiByInput', // 注意：这里要用正确的 operationName
    apiKey
  );

  // API returns data directly, not nested under mutation name
  // Check if result has _id directly (API's behavior)
  if (result._id) {
    return result;
  }
  // Fallback for standard GraphQL format
  else if (result.createTongjiByInput && result.createTongjiByInput._id) {
    return result.createTongjiByInput;
  }
  else {
    throw new Error('Unexpected API response format');
  }
}

/**
 * Generate QR code for a tongji
 * @param {string} tongjiId - Tongji ID
 * @param {string} app - App name ('qingtongji' or 'huiyuan')
 * @param {string} apiKey - Optional API key
 * @returns {Promise<string>} Base64 encoded QR code
 */
export async function generateQrCode(tongjiId, app = 'qingtongji', apiKey = null) {
  const key = apiKey || loadApiKey();

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      entityId: tongjiId,
      entityType: 'Tongji',
      app
    });

    const options = {
      hostname: new URL(API_BASE_URL).hostname,
      port: 443,
      path: '/dev/api/openapi/creator/qrcode',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.success) {
            resolve(response.data.qrcodeBase64);
          } else {
            reject(new Error(`QR code generation failed: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Save QR code base64 to local file
 * @param {string} qrcodeBase64 - Base64 encoded QR code (with or without data URI prefix)
 * @param {string} outputPath - Output file path
 * @returns {string} Absolute path to saved file
 */
export function saveQrCode(qrcodeBase64, outputPath) {
  // Create directory if not exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Extract base64 data (remove data URI prefix if present)
  // API returns format: "data:image/jpeg;base64,/9j..." (note: no comma after base64)
  const base64Data = qrcodeBase64.replace(/^data:image\/[a-z]+;base64/, '');

  // Write to file
  fs.writeFileSync(outputPath, base64Data, 'base64');

  return path.resolve(outputPath);
}

/**
 * Complete workflow: Create tongji and generate QR code
 * @param {object} formConfig - Form configuration
 * @param {object} options - Options { apiKey, app, qrcodeDir }
 * @returns {Promise<object>} Result with tongji info and QR code path
 */
export async function createTongjiWithQrCode(formConfig, options = {}) {
  const {
    apiKey = null,
    app = 'qingtongji',
    qrcodeDir = './qrcodes'
  } = options;

  // Step 1: Create tongji
  console.log('Creating tongji...');
  const tongji = await createTongji(formConfig, apiKey);
  console.log(`✅ Tongji created: ${tongji._id}`);

  // Step 2: Generate QR code
  console.log('Generating QR code...');
  const qrcodeBase64 = await generateQrCode(tongji._id, app, apiKey);

  // Step 3: Save QR code
  const qrcodePath = path.join(qrcodeDir, `tongji_${tongji._id}.png`);
  const savedPath = saveQrCode(qrcodeBase64, qrcodePath);
  console.log(`✅ QR Code saved to: ${savedPath}`);

  return {
    tongji,
    qrcodePath: savedPath,
    qrcodeBase64
  };
}

/**
 * Get formPromptV2 template for AI form generation
 * @returns {string} The formPromptV2 template
 */
export function getFormPromptV2() {
  return `
你是一名表单设计师，需要根据用户提供的请求生成一份表单的JSON格式。

## JSON 结构说明

### 必填字段（所有表单都需要）
===JSON格式开始===
{
  "title": "表单标题（必填，最多20字符）",
  "content": "表单描述（选填，给填写者看，最多2000字符，采用热情的口吻）",
  "infoForms": [ /* infoForms 数组，见下方说明 */ ]
}
===JSON格式结束===

### 可选字段（根据用户描述按需添加）

#### 1. 基础内容模块
===JSON格式开始===
{
  // 封面与媒体
  "cover": "封面图URL，当用户提到封面、头图时添加",
  "pictures": "图片数组，最多15张，当用户提到配图、展示图时添加",
  "bigPictures": "大图数组（全屏展示），当用户提到大图、长图时添加",
  "videoArr": "视频数组，当用户提到视频说明、介绍视频时添加",
  "files": "附件数组，当用户提到附件、文档时添加",
  "sharePoster": "分享海报图，当用户提到海报、分享图时添加",

  // 引导链接
  "intros": "引导链接数组，当用户提到引导、跳转、小程序链接时添加",

  // 位置信息
  "locationInfos": "地图位置信息数组，当用户提到位置、地点、地址时添加",

  // 作者信息
  "hideAuthorInfo": "隐藏发布人信息（名称和头像），当用户提到匿名发布时设置 true",
  "authorName": "发布人名称，如'2年1班班主任'，当hideAuthorInfo为true时可以添加",
  "wxLogo": "发布人头像，当hideAuthorInfo为true时可以添加"
}
===JSON格式结束===

#### 2. 名单打卡模块
===JSON格式开始===
{
  // 打卡模式
  "fixedNo": "是否固定序号，当用户提到名单、学号、工号时设置 true",
  "showNameList": "是否导入名单，当用户提到需要名单、名单导入时设置 true",
  "nameList": "名单数组，包含{no, name, groupName}，当用户提供名单内容时添加",

  // 名单字段自定义
  "noName": "序号标签名称，默认'学号'，当用户提到工号、序号、座位号时添加",
  "nameLabel": "姓名标签名称，默认'姓名'，当用户需要自定义时添加",
  "groupLabelName": "班级/分组标签名称，默认'班级'，当用户提到部门、分组时添加",

  // 名单隐私
  "hideNameListNo": "隐藏名单的序号，当用户提到隐藏学号、隐藏序号时设置 true",
  "isHideNameList": "隐藏整个名单（名单隐私），当用户提到隐私名单、保密名单时设置 true",
  "needNameListQRCode": "生成名单专属二维码，当用户提到专属码、个人码时设置 true",

  // 人数限制
  "count": "打卡数量限制（不按名单时），当用户提到限制人数、限多少人时添加",
  "totalAllow": "总结果条数限制，0为不限，当用户提到限制总人数时添加",
  "removeNos": "需要剔除的序号数组，当用户提到剔除、排除某些序号时添加"
}
===JSON格式结束===

#### 3. 时间控制模块
===JSON格式开始===
{
  // 填报时间
  "needTimeLimit": "是否需要时间限制，当用户提到开始时间、结束时间、截止时间时设置 true",
  "startTime": "开始时间（时间戳，毫秒），当needTimeLimit为true时添加",
  "endTime": "结束时间（时间戳，毫秒），当needTimeLimit为true时添加",

  // 连续打卡
  "isRepeat": "是否连续打卡，当用户提到每天、每周、重复、连续时设置 true",
  "repeatDaysType": "打卡频率：0-每天，1-单号，2-双号，3-自定义，4-每周，当isRepeat为true时必须添加",
  "repeatDays": "重复日期数组（星期几），当repeatDaysType为0或4时添加，值为[0-6]（0是周日，1是周一，依此类推）",
  "repeatDates": "自定义日期数组（YYYY-MM-DD格式），当repeatDaysType为3时添加",
  "repeatStartDate": "打卡开始日期（时间戳，毫秒），当isRepeat为true时建议添加",
  "repeatEndDate": "打卡结束日期（时间戳，毫秒），当isRepeat为true时建议添加",
  "dayRepeatCount": "每天打卡次数，默认1，当用户提到每天几次时添加",
  "allowSubmitTimeRules": "允许提交时间段规则数组，当用户提到特定时间段可提交时添加"
}
===JSON格式结束===


#### 4. 位置限制模块
===JSON格式开始===
{
  // 地点限制
  "needLocation": "是否限制地点范围打卡，当用户提到指定地点、范围内打卡时设置 true",
  "locations": "地点数组，包含{latitude, longitude, name, distance(米)}，当needLocation为true时必须添加",

  // 打卡位置收集
  "needSubmitLocation": "是否收集打卡实时位置，当用户提到需要位置、定位时设置 true",
  "openLocationInfo": "是否公开位置信息，当needSubmitLocation为true时可以添加",

  // WiFi限制
  "needWifi": "是否必须连接指定WiFi签到，当用户提到WiFi、连接WiFi时设置 true",
  "wifiInfos": "WiFi数组，包含{ssid, bssid}，当needWifi为true时必须添加"
}
===JSON格式结束===

#### 5. 权限设置模块
===JSON格式开始===
{
  // 填写次数限制
  "limitCount": "是否限制可提交微信号个数，当用户提到限制次数时设置 true",
  "allowBaomingCount": "每个微信号允许报名次数，默认1，0为不限，当用户提到限制每人几次时添加",
  "userAllowBaomingCount": "有名单时每个微信号可打卡总数，当有名单且需要限制时添加",

  // 修改权限
  "allowManagerChangeResult": "允许管理员修改已提交信息，当用户提到管理员修改时设置 true",
  "canUpdateDuration": "打卡后多少分钟内可修改或删除，当用户提到可以修改、提交后可改时添加",
  "banUpdate": "禁止更新报名，当用户提到不能修改、禁止修改时设置 true",

  // 代填权限
  "fillInLicensee": "代替填写权限：0-不允许，1-创建人，2-创建人和管理员，当用户提到代填、帮填时添加",

  // 结果可见性
  "publishResult": "允许打卡结果所有人可见，当用户提到公开结果、所有人可见时设置 true",
  "restrictGroupMember": "禁止转发（更加私密），当用户提到禁止转发、不能转发时设置 true",
  "isAnonymous": "匿名填写，当用户提到匿名、保密时设置 true"
}
===JSON格式结束===

#### 6. 通知配置模块
===JSON格式开始===
{
  // 定时通知
  "needNotify": "是否需要定时通知，当用户提到定时通知、提醒打卡时设置 true",
  "notifyTime": "定时通知的时间（时间戳，毫秒），当needNotify为true时必须添加",
  "notifyGroupId": "通知群组ID，当needNotify为true时建议添加",
  "notifyDays": "通知包含周几，值为[0-6]，当用户提到每周几通知时添加",
  "notifyDayTime": "通知时间字符串，如'09:00'，当用户提到具体时间时添加",

  // 实时通知
  "newBaomingNotify": "有新填写时提醒通知，当用户提到新提交提醒时设置 true",
  "closeBaomingProgressNotify": "项目完成情况提醒，当用户提到完成进度提醒时设置 true"
}
===JSON格式结束===

#### 7. 高级功能模块
===JSON格式开始===
{
  "needSignature": "需要手写签名确认，当用户提到签名、签字确认时设置 true",
  "isOpenRanking": "是否开启打卡排行榜，当用户提到排行榜、排名时设置 true",
  "needCorrectsMode": "开启反馈内容的点评&点赞&批改，当用户提到点评、批改时设置 true",
  "baomingCommentPermission": "反馈内容权限：0-仅发起人，1-允许互相点评，当needCorrectsMode为true时添加",
  "isPreFill": "允许成员在接龙开始前预填内容，当用户提到提前填、预填时设置 true"
}
===JSON格式结束===

#### 8. UI自定义模块
===JSON格式开始===
{
  "infoFormsDisplayPosition": "表单填写页位置，'在底部按钮后'或'在第一页显示'，当用户提到表单位置时添加",
  "dakaBtnText": "参与接龙按钮文字，默认'立即打卡'，当用户提到按钮文字时添加",
  "multiSubmitBtnText": "再次打卡按钮文字，当用户提到再次打卡、继续打卡时添加",
  "submitSuccessText": "提交成功提示文字，默认'您已提交成功'，当用户提到成功提示时添加"
}
===JSON格式结束===

## infoForms 表单项配置

infoForms 是表单项数组，每个表单项包含以下字段：

===JSON格式开始===
{
  "type": "表单项类型（数字），必填，见下方类型列表",
  "title": "表单项名称，必填",
  "desc": "解释说明，非必填，非必要不填写",
  "required": "是否必填，值为 true/false",

  // 以下字段按类型触发，非必填，如果不需要，不用输出
  "options": ["选项1", "选项2"], // type为1/2/14时需要
  "maxSelect": "多选最多可选数量，type为2时填写",
  "minSelect": "多选最少可选数量，type为2时填写",
  "allowOther": "选择题是否允许填写'其他'，type为1/2/3时可选",
  "optionIsDropDown": "选项是否下拉显示（选项>20时），type为2/3时可选",
  "groupInfoForms": [{ /* 子表单配置 */ }], // type为19时需要，格式与infoForms一致
  "infoOptions": [{"title": "列标题"}], // type为17/18时使用，矩阵题的列
  "questionOptions": [{"title": "行标题"}], // type为17/18时使用，矩阵题的行
  "collectAddressType": "0/1/2/3，type为10时使用，0-省，1-省市，2-省市区，3-省市区详细地址",
  "fullScore": "3-10，type为16时使用，评分满分"
}
===JSON格式结束===

## infoForms 类型说明（27种）

(0)  单行文本填空题
(1)  单选，非性别及民族等特殊字段
(2)  多选，若选项只有两个且互斥需使用单选
(3)  文件（只图片除外）收集
(4)  图片收集，适用于图片类的信息收集
(5)  录音收集，适用于需要录音场景，如跟读作业
(6)  视频收集，适用于需要上传视频
(7)  多行文本填空题，适用于需要回答的内容较多时
(8)  日期选择题，适用于时间选择，起止时间可拆为两个
(9)  数字填空题（非身份证号/手机号码等长数字）
(10) 省市区三级联动选择，适用于地址/籍贯等地理位置相关
(11) 手机号码
(12) 身份证，身份证相关字段必须用此类型
(13) 出生日期
(14) 知情确认，涉及法律效力、责任归属等，需明确告知具体事项，仅提供单一确认选项，位置放最后
(15) 拼图，需要上传多张图并拼在一起
(16) 评分，星级评分或问卷，非矩阵评分，仅一个维度
(17) 矩阵单选，评估多个相似主题的统一维度。行标题=被评估对象（至少2个），列标题=统一量表
(18) 矩阵多选，类似矩阵单选，列量表可选多个
(19) 自增表格，可动态增减条目的表格题。需配置groupInfoForms子表单
(20) 多项填空，一题多空，常用于考试
(21) 手写签名，涉及法律效力、责任归属、文件确认或身份核验时必须，放最后
(22) 地图地点选择，收集用户自己的地点
(23) 扫码录入，适用于商品入库，设备巡检等
(31) 性别
(32) 民族
(33) 政治面貌
(34) 学历
(35) 水印拍照，上传照片自带定位信息，如巡检拍照

## 注意事项

1. 合并的表格可能涉及矩阵类型或自增表单类型
2. 如果有多个单选题的选项相同且跟评分相关，考虑合并为矩阵题
3. 表格中的"相"一般指相片
4. 只输出用户描述中提到的字段，不要添加未提到的配置
5. 时间戳使用毫秒级时间戳（JavaScript格式）

## 场景示例

### 场景1：每日健康打卡
用户描述："创建一个每日健康打卡，需要上传照片和位置，每天早上8点提醒"

应生成：
===JSON格式开始===
{
  "title": "每日健康打卡",
  "content": "请每日完成健康打卡，上传照片并记录位置信息",
  "isRepeat": true,
  "repeatDaysType": 0,
  "infoForms": [
    { "type": 4, "title": "上传照片", "required": true },
    { "type": 22, "title": "定位地点", "required": true }
  ],
  "needSubmitLocation": true,
  "needNotify": true,
  "notifyDayTime": "08:00"
}
===JSON格式结束===

### 场景2：活动报名接龙
用户描述："班级活动报名，限制20人，需要填写姓名和联系方式，截止到本周五"

应生成：
===JSON格式开始===
{
  "title": "班级活动报名",
  "content": "请填写信息完成活动报名",
  "count": 20,
  "totalAllow": 20,
  "needTimeLimit": true,
  "endTime": 1760000000000, // 示例时间戳
  "infoForms": [
    { "type": 0, "title": "姓名", "required": true },
    { "type": 11, "title": "手机号码", "required": true }
  ]
}
===JSON格式结束===

### 场景3：会议签到
用户描述："会议签到，需要连接指定WiFi，限制地点范围100米"

应生成：
===JSON格式开始===
{
  "title": "会议签到",
  "content": "请在会场范围内完成签到",
  "needWifi": true,
  "wifiInfos": [{"ssid": "会议室WiFi", "bssid": "xx:xx:xx:xx:xx:xx"}],
  "needLocation": true,
  "locations": [{"latitude": 39.9, "longitude": 116.4, "name": "会议室", "distance": 100}],
  "needSubmitLocation": true
}
===JSON格式结束===

### 场景4：作业提交
用户描述："语文作业提交，需要上传录音（必填）和图片，开启批改点评"

应生成：
===JSON格式开始===
{
  "title": "语文作业提交",
  "content": "请完成语文作业并提交",
  "infoForms": [
    { "type": 5, "title": "上传录音", "required": true },
    { "type": 4, "title": "上传图片", "required": false }
  ],
  "needCorrectsMode": true,
  "baomingCommentPermission": 1
}
===JSON格式结束===

### 场景5：问卷调查
用户描述："客户满意度调查，匿名填写，包含矩阵评分题"

应生成：
===JSON格式开始===
{
  "title": "客户满意度调查",
  "content": "请根据您的真实体验填写",
  "isAnonymous": true,
  "publishResult": false,
  "infoForms": [
    {
      "type": 17,
      "title": "服务满意度评分",
      "required": true,
      "infoOptions": [{"title": "非常满意"}, {"title": "满意"}, {"title": "一般"}, {"title": "不满意"}],
      "questionOptions": [{"title": "服务态度"}, {"title": "专业水平"}, {"title": "响应速度"}]
    }
  ]
}
===JSON格式结束===

## 重要提示

1. **只输出用户明确提到的字段**，不要添加未提到的配置
2. **时间戳使用毫秒级**（JavaScript Date.now() 格式）
3. **数组格式**：locations, wifiInfos 等必须输出为 JSON 数组
4. **布尔值**：true/false 不要用引号包裹
5. **必填字段**：title, content, infoForms 必须有
6. **信息类型处理**：当用户提到"需要上传照片/录音/视频/文件/签名"等功能时，**应将其转为对应的infoForms表单项类型**，而非使用旧的needImage、needVideo等字段。对应关系如下：
    - 照片/图片 -> 在infoForms中添加 type=4
    - 录音 -> 在infoForms中添加 type=5
    - 视频 -> 在infoForms中添加 type=6
    - 文件 -> 在infoForms中添加 type=3
    - 手写签名 -> 在infoForms中添加 type=21
`;
}

/**
 * Create a toupiao via GraphQL API
 * @param {object} formConfig - Toupiao configuration (from AI generation)
 * @param {string} apiKey - Optional API key
 * @returns {Promise<object>} Created toupiao data
 */
export async function createToupiao(formConfig, apiKey = null) {
  const mutation = `
    mutation CreateToupiao($input: createToupiaoInput!) {
      createToupiaoByInput(input: $input) {
        _id
        title
        createdAt
      }
    }
  `;

  const result = await graphqlRequest(
    mutation,
    { input: formConfig },
    'createToupiaoByInput',
    apiKey
  );

  // API returns data directly
  if (result._id) {
    return result;
  } else if (result.createToupiaoByInput && result.createToupiaoByInput._id) {
    return result.createToupiaoByInput;
  } else {
    throw new Error('Unexpected API response format');
  }
}

/**
 * Generate QR code for a toupiao
 * @param {string} toupiaoId - Toupiao ID
 * @param {string} app - App name ('qingtongji' or 'huiyuan')
 * @param {string} apiKey - Optional API key
 * @returns {Promise<string>} Base64 encoded QR code
 */
export async function generateToupiaoQrCode(toupiaoId, app = 'qingtongji', apiKey = null) {
  const key = apiKey || loadApiKey();

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      entityId: toupiaoId,
      entityType: 'Toupiao',
      app
    });

    const options = {
      hostname: new URL(API_BASE_URL).hostname,
      port: 443,
      path: '/dev/api/openapi/creator/qrcode',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.success) {
            resolve(response.data.qrcodeBase64);
          } else {
            reject(new Error(`QR code generation failed: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Complete workflow: Create toupiao and generate QR code
 * @param {object} formConfig - Toupiao configuration
 * @param {object} options - Options { apiKey, app, qrcodeDir }
 * @returns {Promise<object>} Result with toupiao info and QR code path
 */
export async function createToupiaoWithQrCode(formConfig, options = {}) {
  const {
    apiKey = null,
    app = 'qingtongji',
    qrcodeDir = './qrcodes'
  } = options;

  // Step 1: Create toupiao
  console.log('Creating toupiao...');
  const toupiao = await createToupiao(formConfig, apiKey);
  console.log(`✅ Toupiao created: ${toupiao._id}`);

  // Step 2: Generate QR code
  console.log('Generating QR code...');
  const qrcodeBase64 = await generateToupiaoQrCode(toupiao._id, app, apiKey);

  // Step 3: Save QR code
  const qrcodePath = path.join(qrcodeDir, `toupiao_${toupiao._id}.png`);
  const savedPath = saveQrCode(qrcodeBase64, qrcodePath);
  console.log(`✅ QR Code saved to: ${savedPath}`);

  return {
    toupiao,
    qrcodePath: savedPath,
    qrcodeBase64
  };
}

export default {
  loadApiKey,
  storeApiKey,
  graphqlRequest,
  createTongji,
  createToupiao,
  generateQrCode,
  generateToupiaoQrCode,
  saveQrCode,
  createTongjiWithQrCode,
  createToupiaoWithQrCode,
  getFormPromptV2
};
