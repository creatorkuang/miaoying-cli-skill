#!/usr/bin/env node
/**
 * Miaoying CLI Tool
 *
 * 秒应开放接口命令行工具
 *
 * 使用方法:
 *   miaoying create "活动标题" --desc "活动描述" --forms '[
 *     {"type":"0","title":"姓名","required":true},
 *     {"type":"1","title":"性别","required":true,"options":["男","女"]}
 *   ]'
 *
 * 环境变量:
 *   MIAOYING_API_KEY - 秒应 API 密钥（从 https://miaoying.hui51.cn/apikey 获取）
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

function error(...args) {
  log(colors.red, '❌', ...args);
}

function success(...args) {
  log(colors.green, '✅', ...args);
}

function info(...args) {
  log(colors.cyan, 'ℹ️', ...args);
}

function warn(...args) {
  log(colors.yellow, '⚠️', ...args);
}

// 解析命令行参数
function parseArgs(args) {
  const result = {
    command: null,
    args: [], // 位置参数（除了命令之外）
    options: {}
  };

  let currentOption = null;

  // 将 kebab-case 转换为 camelCase
  function toCamelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const optionPart = arg.slice(2);
      // 处理 --key=value 格式
      const equalIndex = optionPart.indexOf('=');
      if (equalIndex !== -1) {
        let key = optionPart.slice(0, equalIndex);
        const value = optionPart.slice(equalIndex + 1);
        // 转换为 camelCase
        key = toCamelCase(key);
        result.options[key] = value;
        currentOption = null;
      } else {
        let key = optionPart;
        key = toCamelCase(key);
        currentOption = key;
        result.options[currentOption] = true;
      }
    } else if (currentOption) {
      result.options[currentOption] = arg;
      currentOption = null;
    } else if (!result.command) {
      result.command = arg;
    } else {
      // 其他位置参数
      result.args.push(arg);
    }
  }

  // 处理布尔选项
  for (const key in result.options) {
    if (result.options[key] === true && !args.includes(`--${key}`)) {
      // 这意味着没有提供值，保持为 true（用于 --help 等）
    }
  }

  return result;
}

// 获取 API Key
function getApiKey(providedKey) {
  const key = providedKey || process.env.MIAOYING_API_KEY;
  if (!key) {
    error('未找到 MIAOYING_API_KEY 环境变量或 --api-key 参数');
    info('请访问 https://miaoying.hui51.cn/apikey 创建 API 密钥');
    info('然后设置环境变量: export MIAOYING_API_KEY="your_key_here"');
    info('或者使用参数: --api-key="your_key_here"');
    process.exit(1);
  }
  return key;
}

// HTTPS 请求封装
function httpsRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(JSON.stringify(response.errors)));
          } else {
            resolve(response);
          }
        } catch (e) {
          reject(new Error(`Failed to parse: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 创建统计
async function createTongji(options) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  // 构建表单配置
  const formConfig = {
    title: options.title || '未命名统计',
    content: options.desc || '',
    infoForms: options.forms ? JSON.parse(options.forms) : []
  };

  // 可选字段
  if (options.count) formConfig.count = parseInt(options.count);
  if (options.endTime) formConfig.endTime = new Date(options.endTime).getTime();
  if (options.anonymous) formConfig.isAnonymous = true;

  info('正在创建统计...');

  const mutation = `
  mutation CreateTongji($input: TongjiInput!) {
    createTongjiByInput(input: $input) {
      _id
      title
      createdAt
      infoForms {
        title
        type
        required
      }
    }
  }
`;

  const data = JSON.stringify({
    query: mutation,
    variables: { input: formConfig },
    operationName: 'createTongjiByInput'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    // 调试输出
    if (response.errors) {
      error('GraphQL 错误:', JSON.stringify(response.errors));
      process.exit(1);
    }

    // API 返回 data 直接是 tongji 对象
    if (response.data && response.data._id) {
      success('统计创建成功！');
      log(colors.bright, '   ID:', response.data._id);
      log(colors.bright, '   标题:', response.data.title);
      log(colors.bright, '   字段数:', response.data.infoForms?.length || 0);

      if (options.qrcode) {
        info('正在生成二维码...');
        await generateQrCode(response.data._id, options);
      } else {
        info('使用以下命令生成二维码:');
        log(colors.cyan, `   miaoying qrcode ${response.data._id}`);
      }

      return response.data._id;
    } else {
      error('响应格式异常:', JSON.stringify(response));
      process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 创建投票
async function createToupiao(options) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  // 构建投票配置
  const formConfig = {
    title: options.title || '未命名投票',
    content: options.desc || '',
    singleOption: options.single ? true : false,
    startTime: options.startTime ? new Date(options.startTime).getTime() : new Date().getTime(),
    endTime: options.endTime ? new Date(options.endTime).getTime() : (new Date().getTime() + 7 * 24 * 3600 * 1000),
    optionForms: options.options ? JSON.parse(options.options) : getDefaultOptionForms(),
    isMultiOptions: true,  // optionForms requires isMultiOptions=true
    publishResult: options.publishResult !== undefined ? options.publishResult === 'true' : true,
    isAnonymous: options.anonymous === 'true'
  };

  // 可选字段
  if (options.count) formConfig.count = parseInt(options.count);
  if (options.limitCount) formConfig.limitCount = true;
  if (options.allowVoteCount) formConfig.allowVoteCount = parseInt(options.allowVoteCount);
  if (options.minSelect) formConfig.minSelect = parseInt(options.minSelect);
  if (options.maxSelect) formConfig.maxSelect = parseInt(options.maxSelect);
  if (options.optionAllowOther) formConfig.optionAllowOther = true;

  info('正在创建投票...');

  const mutation = `
  mutation CreateToupiao($input: createToupiaoInput!) {
    createToupiaoByInput(input: $input) {
      _id
      title
      createdAt
      singleOption
      optionForms {
        title
        options {
          title
        }
      }
    }
  }
`;

  const data = JSON.stringify({
    query: mutation,
    variables: { input: formConfig },
    operationName: 'createToupiaoByInput'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    // API 返回 data 直接是 toupiao 对象
    if (response.data && response.data._id) {
      success('投票创建成功！');
      log(colors.bright, '   ID:', response.data._id);
      log(colors.bright, '   标题:', response.data.title);
      log(colors.bright, '   类型:', response.data.singleOption ? '单选' : '多选');
      log(colors.bright, '   选项数:', response.data.optionForms?.length || 0);

      if (options.qrcode) {
        info('正在生成二维码...');
        await generateToupiaoQrCode(response.data._id, options);
      } else {
        info('使用以下命令生成二维码:');
        log(colors.cyan, `   miaoying toupiao-qrcode ${response.data._id}`);
      }

      return response.data._id;
    } else {
      error('响应格式异常:', JSON.stringify(response));
      process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取默认选项格式
function getDefaultOptionForms() {
  return [{
    id: Date.now().toString(),
    title: '投票标题',
    required: true,
    options: [
      { title: "选项1", isImage: false, imageUrl: "" },
      { title: "选项2", isImage: false, imageUrl: "" },
      { title: "选项3", isImage: false, imageUrl: "" },
      { title: "选项4", isImage: false, imageUrl: "" }
    ],
    optionAllowOther: false,
    singleOption: false
  }];
}

// 生成投票二维码
async function generateToupiaoQrCode(toupiaoId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  const data = JSON.stringify({
    entityId: toupiaoId,
    entityType: 'Toupiao',
    app: options.app || 'qingtongji'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/creator/qrcode',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    if (response.success && response.data && response.data.qrcodeBase64) {
      const qrcodeBase64 = response.data.qrcodeBase64;

      // 保存到文件
      const fs = await import('fs');
      const path = await import('path');

      const qrcodeDir = options.output ? path.dirname(options.output) : './qrcodes';
      const qrcodePath = options.output || path.join(qrcodeDir, `toupiao_${toupiaoId}.png`);

      // 创建目录
      if (!fs.existsSync(qrcodeDir)) {
        fs.mkdirSync(qrcodeDir, { recursive: true });
      }

      // 移除 base64 前缀并保存
      const base64Data = qrcodeBase64.replace(/^data:image\/[a-z]+;base64/, '');
      fs.writeFileSync(qrcodePath, base64Data, 'base64');

      success('二维码已保存:', qrcodePath);
      return qrcodePath;
    } else {
      throw new Error('生成二维码失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取投票列表
async function listToupiaos(options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  const searchKeyword = options.search || options._search;
  if (searchKeyword) {
    info(`正在搜索包含 "${searchKeyword}" 的投票...`);
  } else {
    info('正在获取投票列表...');
  }

  // 使用标准的 CRUD 查询格式
  const query = `
    query GetToupiaos($limit: Int, $skip: Int, $title: String, $_search: String) {
      toupiaos(limit: $limit, skip: $skip, title: $title, _search: $_search, isRemove: false) {
        _id
        title
        content
        createdAt
        singleOption
        allowVoteCount
        voteTimeType
      }
    }
  `;

  const variables = {
    limit: options.limit ? parseInt(options.limit) : 50,
    skip: options.skip ? parseInt(options.skip) : 0,
    title: options.title || undefined,
    _search: searchKeyword || undefined
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'toupiaos'
    }));

    // API 返回 data 直接是数组
    let toupiaos = null;
    if (Array.isArray(response.data)) {
      toupiaos = response.data;
    } else if (response.data && response.data.toupiaos) {
      toupiaos = response.data.toupiaos;
    }

    if (toupiaos) {
      success(`找到 ${toupiaos.length} 个投票`);
      console.log('');

      toupiaos.forEach((toupiao, index) => {
        log(colors.bright, `${index + 1}. ${toupiao.title}`);
        log(colors.cyan, `   ID: ${toupiao._id}`);
        log(colors.cyan, `   类型: ${toupiao.singleOption ? '单选' : '多选'}`);
        if (toupiao.allowVoteCount) log(colors.cyan, `   投票次数: ${toupiao.voteTimeType || '总共'} ${toupiao.allowVoteCount}次`);
        log(colors.cyan, `   创建时间: ${new Date(toupiao.createdAt).toLocaleString('zh-CN')}`);
        console.log('');
      });

      return toupiaos;
    } else {
      throw new Error('获取投票列表失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取单个投票详情
async function getToupiao(toupiaoId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取投票 ${toupiaoId} 的详情...`);

  // 使用列表查询通过 _id 过滤来获取单个实体
  const query = `
    query GetToupiaos($_id: ID) {
      toupiaos(_id: $_id, isRemove: false) {
        _id
        title
        content
        createdAt
        singleOption
        allowVoteCount
        voteTimeType
        allowUpdateVote
        publishResult
        endTime
        optionForms {
          title
          options {
            title
            isImage
            imageUrl
          }
          required
          minSelect
          maxSelect
        }
      }
    }
  `;

  const variables = {
    _id: toupiaoId
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'toupiaos'
    }));

    // API 返回 data 直接是数组
    let toupiaos = null;
    if (Array.isArray(response.data)) {
      toupiaos = response.data;
    } else if (response.data && response.data.toupiaos) {
      toupiaos = response.data.toupiaos;
    }

    if (toupiaos && toupiaos.length > 0) {
      const toupiao = toupiaos[0];
      success('投票详情');
      log(colors.bright, `   ID: ${toupiao._id}`);
      log(colors.bright, `   标题: ${toupiao.title}`);
      if (toupiao.content) log(colors.cyan, `   描述: ${toupiao.content.substring(0, 100)}${toupiao.content.length > 100 ? '...' : ''}`);
      log(colors.cyan, `   类型: ${toupiao.singleOption ? '单选' : '多选'}`);
      if (toupiao.allowVoteCount) log(colors.cyan, `   投票次数限制: ${toupiao.voteTimeType || '总共'} ${toupiao.allowVoteCount}次`);
      if (toupiao.allowUpdateVote) log(colors.cyan, `   允许修改: 是`);
      if (toupiao.publishResult !== undefined) log(colors.cyan, `   公开结果: ${toupiao.publishResult ? '是' : '否'}`);
      if (toupiao.endTime) log(colors.cyan, `   结束时间: ${new Date(toupiao.endTime).toLocaleString('zh-CN')}`);
      if (toupiao.optionForms && toupiao.optionForms.length > 0) {
        log(colors.cyan, `   投票项 (${toupiao.optionForms.length} 个):`);
        toupiao.optionForms.forEach((form, index) => {
          log(colors.cyan, `     ${index + 1}. ${form.title} ${form.required ? '(必填)' : ''}`);
          if (form.options && form.options.length > 0) {
            form.options.forEach((opt, i) => {
              const imgStr = opt.isImage ? ' [图片]' : '';
              log(colors.cyan, `       ${String.fromCharCode(97 + i)}) ${opt.title}${imgStr}`);
            });
          }
        });
      }

      return toupiao;
    } else {
      throw new Error('未找到该投票');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取投票结果
async function getVotes(toupiaoId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取投票 ${toupiaoId} 的结果...`);

  // 先查询 toupiao 获取基本信息 - 使用内联值避免变量问题
  const toupiaoQuery = `
    query {
      toupiaos(_id: "${toupiaoId}", limit: "1") {
        _id
        title
        voteResults
        options
        allowVoteCount
        isMultiOptions
        optionForms {
          id
          title
          voteResults
        }
      }
    }
  `;

  try {
    const toupiaoResponse = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query: toupiaoQuery
    }));

    // API 返回 data 直接是 toupiao 数组
    let toupiao = null;
    if (toupiaoResponse.data && Array.isArray(toupiaoResponse.data) && toupiaoResponse.data.length > 0) {
      toupiao = toupiaoResponse.data[0];
    } else if (toupiaoResponse.data && toupiaoResponse.data.toupiao) {
      toupiao = toupiaoResponse.data.toupiao;
    }

    if (!toupiao) {
      throw new Error('获取投票结果失败');
    }

    success(`投票详情`);
    log(colors.bright, `   ID: ${toupiao._id}`);
    log(colors.bright, `   标题: ${toupiao.title}`);

    if (toupiao.isMultiOptions && toupiao.optionForms) {
      // 多选项投票
      log(colors.cyan, `   投票项结果:`);
      toupiao.optionForms.forEach((form, index) => {
        const count = form.voteResults || 0;
        log(colors.cyan, `     ${index + 1}. ${form.title}: ${count} 票`);
      });
    } else if (toupiao.voteResults && Array.isArray(toupiao.voteResults)) {
      // 简单投票结果
      log(colors.cyan, `   投票结果:`);
      toupiao.options.forEach((opt, index) => {
        const count = toupiao.voteResults[index] || 0;
        log(colors.cyan, `     ${index + 1}. ${opt}: ${count} 票`);
      });
    }

    return { toupiao };
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 生成预约二维码（使用 entityType: Booking）
// 通用二维码生成函数（支持 Tongji、Booking、Toupiao、Chacha）
async function generateQrCode(entityId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  // entityType 默认为 Tongji，可通过 options.entityType 指定
  const entityType = options.entityType || 'Tongji';
  const entityPrefix = entityType.toLowerCase(); // tongji, booking, toupiao, chacha

  const data = JSON.stringify({
    entityId: entityId,
    entityType: entityType,  // Tongji, Booking, Toupiao, Chacha
    app: options.app || 'qingtongji'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/creator/qrcode',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    if (response.success && response.data && response.data.qrcodeBase64) {
      const qrcodeBase64 = response.data.qrcodeBase64;

      // 保存到文件
      const fs = await import('fs');
      const path = await import('path');

      const qrcodeDir = options.output ? path.dirname(options.output) : './qrcodes';
      // 根据实际的图片格式选择扩展名
      const imageFormat = qrcodeBase64.match(/^data:image\/([a-z]+);base64,/)?.[1] || 'png';
      const qrcodePath = options.output || path.join(qrcodeDir, `${entityPrefix}_${entityId}.${imageFormat}`);

      // 创建目录
      if (!fs.existsSync(qrcodeDir)) {
        fs.mkdirSync(qrcodeDir, { recursive: true });
      }

      // 移除 base64 前缀并保存（支持 jpeg/png 等多种格式）
      const base64Data = qrcodeBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      fs.writeFileSync(qrcodePath, base64Data, 'base64');

      success('二维码已保存:', qrcodePath);
      return qrcodePath;
    } else {
      throw new Error('生成二维码失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 生成预约二维码（保留用于向后兼容）
async function generateBookingQrCode(bookingId, options = {}) {
  return generateQrCode(bookingId, { ...options, entityType: 'Booking' });
}

// 创建预约（预约本质上是 needBookMode=true 的统计）
async function createBooking(options) {
  const apiKey = getApiKey(options.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  // 获取当前时间
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekFromNow = todayStart + 7 * 24 * 60 * 60 * 1000;

  // 解析预约时间段配置
  let allowSubmitTimeRules = [];
  let dayRepeatCount = 1;

  if (options.slots) {
    dayRepeatCount = parseInt(options.slots);
    if (dayRepeatCount === 1) {
      // 全天开放
      allowSubmitTimeRules = [{
        _id: 1,
        startTime: "07:00",
        endTime: "23:59",
        notifyTime: "07:00"
      }];
    } else if (dayRepeatCount === 2) {
      // 上午、下午两个时段
      allowSubmitTimeRules = [{
        _id: 1,
        startTime: "07:00",
        endTime: "09:00",
        notifyTime: "07:00"
      }, {
        _id: 2,
        startTime: "12:00",
        endTime: "14:00",
        notifyTime: "12:00"
      }];
    } else if (dayRepeatCount === 3) {
      // 上午、下午、晚上三个时段
      allowSubmitTimeRules = [{
        _id: 1,
        startTime: "07:00",
        endTime: "09:00",
        notifyTime: "07:00"
      }, {
        _id: 2,
        startTime: "12:00",
        endTime: "14:00",
        notifyTime: "12:00"
      }, {
        _id: 3,
        startTime: "18:00",
        endTime: "20:00",
        notifyTime: "18:00"
      }];
    }
  }

  // 构建表单配置
  const formConfig = {
    title: options.title || '未命名预约',
    content: options.desc || '',
    // 关键：设置为预约模式
    needBookMode: true,
    // 预约时间段配置
    dayRepeatCount: dayRepeatCount,
    allowSubmitTimeRules: allowSubmitTimeRules,
    // 重复配置
    repeatDays: [0, 1, 2, 3, 4, 5, 6], // 默认每天
    repeatStartDate: todayStart,
    repeatEndDate: weekFromNow,
    // 基础配置
    count: options.count ? parseInt(options.count) : 20,
    limitCount: options.limitCount !== 'false',
    allowBaomingCount: options.allowBaomingCount ? parseInt(options.allowBaomingCount) : 1,
    // 固定名单模式
    fixedNo: options.fixedNo === 'true' || options.fixedNo === true,
    noName: options.noName || '序号',
    // 是否允许补卡
    allowBuka: options.allowBuka !== 'false',
    // 通知
    needNotify: options.needNotify === 'true',
    notifyTime: options.notifyTime ? parseInt(options.notifyTime.split(':')[0]) * 3600000 + parseInt(options.notifyTime.split(':')[1]) * 60000 : 32400000,
    // 公开结果
    publishResult: options.publishResult !== 'false'
  };

  // 添加表单字段
  if (options.forms) {
    formConfig.infoForms = JSON.parse(options.forms);
  } else {
    // 默认表单字段
    formConfig.infoForms = [
      { title: "姓名", required: true, type: "0" },
      { title: "手机号", required: true, type: "11" }
    ];
    formConfig.requiredFields = ["姓名", "手机号"];
  }

  // 时间范围
  if (options.startTime) formConfig.startTime = new Date(options.startTime).getTime();
  if (options.endTime) formConfig.endTime = new Date(options.endTime).getTime();

  // 每人预约次数限制
  if (options.userLimit) formConfig.allowBaomingCount = parseInt(options.userLimit);

  info('正在创建预约...');

  const mutation = `
    mutation CreateBooking($input: TongjiInput!) {
      createTongjiByInput(input: $input) {
        _id
        title
        needBookMode
        dayRepeatCount
        allowSubmitTimeRules {
          startTime
          endTime
        }
        repeatDays
        createdAt
        infoForms {
          title
          type
          required
        }
      }
    }
  `;

  const data = JSON.stringify({
    query: mutation,
    variables: { input: formConfig },
    operationName: 'createTongjiByInput'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    // API 返回 data 直接是对象
    if (response.data && response.data._id) {
      success('预约创建成功！');
      log(colors.bright, '   ID:', response.data._id);
      log(colors.bright, '   标题:', response.data.title);
      log(colors.bright, '   预约模式:', response.data.needBookMode ? '是' : '否');
      log(colors.bright, '   每天时段数:', response.data.dayRepeatCount);
      if (response.data.allowSubmitTimeRules && response.data.allowSubmitTimeRules.length > 0) {
        log(colors.cyan, '   预约时段:');
        response.data.allowSubmitTimeRules.forEach((rule, index) => {
          log(colors.cyan, `     ${index + 1}. ${rule.startTime} - ${rule.endTime}`);
        });
      }
      log(colors.cyan, '   表单字段:', response.data.infoForms?.map(f => f.title).join(', ') || '无');
      log(colors.cyan, '   固定名单模式:', formConfig.fixedNo ? '是' : '否');

      // 如果使用固定名单但没有提供名单，给出警告
      if (formConfig.fixedNo && !options.nameList) {
        console.log('');
        log(colors.yellow, '⚠️  注意：当前使用固定名单模式，但未提供名单！');
        log(colors.yellow, '   只有名单中的人员才能预约。');
        log(colors.yellow, '   请在小程序管理后台导入预约名单，或移除 --fixed-no 参数关闭固定名单模式。');
        console.log('');
      }

      if (options.qrcode) {
        info('正在生成二维码...');
        // 预约使用 entityType: 'Booking'，这样小程序能正确识别
        await generateBookingQrCode(response.data._id, options);
      } else {
        info('使用以下命令生成二维码:');
        log(colors.cyan, `   miaoying qrcode ${response.data._id}`);
      }

      return response.data._id;
    } else {
      error('响应格式异常:', JSON.stringify(response));
      process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 创建考试（考试本质上是 needExamMode=true 的统计）
async function createExam(options) {
  const apiKey = getApiKey(options.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  // 获取当前时间
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekFromNow = todayStart + 7 * 24 * 60 * 60 * 1000;

  // 解析考试时长
  const examDuration = options.duration ? parseInt(options.duration) : 60; // 默认60分钟

  // 构建表单配置
  const formConfig = {
    title: options.title || '未命名考试',
    content: options.desc || '',
    // 关键：设置为考试模式
    needExamMode: true,
    // 考试时长（分钟）
    examDuration: examDuration,
    // 是否禁止提交后查看试卷详情
    banViewExamResult: options.banViewResult === 'true',
    // 基础配置
    count: options.count ? parseInt(options.count) : 0, // 考试不限制人数
    limitCount: false, // 考试不限制人数
    allowBaomingCount: options.allowBaomingCount ? parseInt(options.allowBaomingCount) : 1,
    // 固定名单模式（考试通常需要固定名单）
    fixedNo: options.fixedNo !== 'false', // 默认开启
    noName: options.noName || '学号',
    nameLabel: options.nameLabel || '姓名',
    showNameList: true,
    // 按钮文本
    dakaBtnText: options.btnText || '开始答卷',
    submitSuccessText: options.successText || '您已提交成功',
    // 排名
    isOpenRanking: options.ranking !== 'false', // 默认显示排名
    // 公开结果
    publishResult: options.publishResult === 'true',
    // 时间范围
    startTime: options.startTime ? new Date(options.startTime).getTime() : todayStart,
    endTime: options.endTime ? new Date(options.endTime).getTime() : weekFromNow,
    needTimeLimit: true
  };

  // 添加考试题目
  if (options.questions) {
    formConfig.examForms = JSON.parse(options.questions);
  } else {
    // 默认示例题目
    formConfig.examForms = [
      {
        id: `${Date.now()}_1`,
        type: '1', // 单选题
        title: '示例题目：以下哪项是正确的？',
        options: ['选项A', '选项B', '选项C', '选项D'],
        answer: '0', // 索引，0表示第一个选项
        fullScore: 10,
        order: 1
      }
    ];
  }

  // 添加信息收集字段（可选）
  if (options.forms) {
    formConfig.infoForms = JSON.parse(options.forms);
  }

  info('正在创建考试...');

  const mutation = `
    mutation CreateExam($input: TongjiInput!) {
      createTongjiByInput(input: $input) {
        _id
        title
        needExamMode
        examDuration
        examFullScore
        banViewExamResult
        isOpenRanking
        createdAt
        examForms {
          title
          type
          fullScore
          required
        }
      }
    }
  `;

  const data = JSON.stringify({
    query: mutation,
    variables: { input: formConfig },
    operationName: 'createTongjiByInput'
  });

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, data);

    // API 返回 data 直接是对象
    if (response.data && response.data._id) {
      success('考试创建成功！');
      log(colors.bright, '   ID:', response.data._id);
      log(colors.bright, '   标题:', response.data.title);
      log(colors.bright, '   考试模式:', response.data.needExamMode ? '是' : '否');
      log(colors.bright, '   考试时长:', formConfig.examDuration, '分钟');
      if (response.data.examFullScore) log(colors.cyan, '   总分:', response.data.examFullScore);
      log(colors.cyan, '   题目数:', response.data.examForms?.length || 0);
      log(colors.cyan, '   禁止查看结果:', response.data.banViewExamResult ? '是' : '否');
      log(colors.cyan, '   显示排名:', response.data.isOpenRanking ? '是' : '否');
      log(colors.cyan, '   固定名单模式:', formConfig.fixedNo ? '是' : '否');

      // 如果使用固定名单但没有提供名单，给出警告
      if (formConfig.fixedNo && !options.nameList) {
        console.log('');
        log(colors.yellow, '⚠️  注意：当前使用固定名单模式，但未提供名单！');
        log(colors.yellow, '   只有名单中的人员才能参加考试。');
        log(colors.yellow, '   请在小程序管理后台导入考试名单，或使用 --no-fixed-no 关闭固定名单模式。');
        console.log('');
      }

      if (options.qrcode) {
        info('正在生成二维码...');
        // 考试使用 entityType: 'Tongji'（与统计相同）
        await generateQrCode(response.data._id, { ...options, entityType: 'Tongji' });
      } else {
        info('使用以下命令生成二维码:');
        log(colors.cyan, `   miaoying qrcode ${response.data._id} --type exam`);
      }

      return response.data._id;
    } else {
      error('响应格式异常:', JSON.stringify(response));
      process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取统计列表（通过标准 CRUD 查询）
async function listTongjis(options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  const searchKeyword = options.search || options._search;
  if (searchKeyword) {
    info(`正在搜索包含 "${searchKeyword}" 的统计...`);
  } else {
    info('正在获取统计列表...');
  }

  // 使用标准的 CRUD 查询格式
  const query = `
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
  `;

  const variables = {
    limit: options.limit ? parseInt(options.limit) : 50,
    skip: options.skip ? parseInt(options.skip) : 0,
    title: options.title || undefined,
    _search: searchKeyword || undefined
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'tongjis'
    }));

    // API 返回 data 直接是数组
    let tongjis = null;
    if (Array.isArray(response.data)) {
      tongjis = response.data;
    } else if (response.data && response.data.tongjis) {
      tongjis = response.data.tongjis;
    }

    if (tongjis) {
      success(`找到 ${tongjis.length} 个统计`);
      console.log('');

      tongjis.forEach((tongji, index) => {
        log(colors.bright, `${index + 1}. ${tongji.title}`);
        log(colors.cyan, `   ID: ${tongji._id}`);
        log(colors.cyan, `   报名数: ${tongji.resultsCount || 0}/${tongji.totalAllow || tongji.count || '不限'}`);
        log(colors.cyan, `   创建时间: ${new Date(tongji.createdAt).toLocaleString('zh-CN')}`);
        console.log('');
      });

      return tongjis;
    } else {
      throw new Error('获取统计列表失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取报名总数
async function getBaomingsTotals(tongjiId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取统计 ${tongjiId} 的报名总数...`);

  const query = `
    query GetBaomingsTotals($tongjiId: String) {
      getBaomingsTotals(tongjiId: $tongjiId) {
        total
        passTotal
        checkedTotal
        uncheckTotal
      }
    }
  `;

  const variables = {
    tongjiId: tongjiId
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'getBaomingsTotals'
    }));

    // 处理响应格式 - 可能是直接的 totals 对象，也可能是嵌套的
    let totals = null;
    if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
      // 如果 data 直接是 totals 对象
      if ('total' in response.data || 'passTotal' in response.data) {
        totals = response.data;
      } else if (response.data.getBaomingsTotals) {
        totals = response.data.getBaomingsTotals;
      }
    }

    if (totals) {
      success('报名统计');
      log(colors.bright, `   总数: ${totals.total || 0}`);
      log(colors.bright, `   通过: ${totals.passTotal || 0}`);
      log(colors.bright, `   已审核: ${totals.checkedTotal || 0}`);
      log(colors.bright, `   未审核: ${totals.uncheckTotal || 0}`);

      return totals;
    } else {
      throw new Error('获取报名总数失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取报名结果（通过标准 CRUD 查询）
async function getBaomings(tongjiId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取统计 ${tongjiId} 的报名结果...`);

  // 使用标准的 CRUD 查询格式
  const query = `
    query GetBaomings($tongjiId: String, $limit: Int, $skip: Int) {
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
  `;

  const variables = {
    tongjiId: tongjiId,
    limit: options.limit ? parseInt(options.limit) : 20,
    skip: options.skip ? parseInt(options.skip) : 0
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'baomings'
    }));

    // API 返回 data 直接是数组
    let baomings = null;
    if (Array.isArray(response.data)) {
      baomings = response.data;
    } else if (response.data && response.data.baomings) {
      baomings = response.data.baomings;
    }

    if (baomings) {
      success(`获取到 ${baomings.length} 条报名记录`);
      console.log('');

      baomings.forEach((baoming, index) => {
        const name = baoming.userName || baoming.userId || '未知';
        const time = baoming.submitTime ? new Date(baoming.submitTime).toLocaleString('zh-CN') : '-';
        log(colors.bright, `${index + 1}. ${name}`);
        log(colors.cyan, `   ID: ${baoming._id}`);
        log(colors.cyan, `   提交时间: ${time}`);
        if (baoming.no !== undefined) log(colors.cyan, `   序号: ${baoming.no}`);
        if (baoming.results) {
          const results = typeof baoming.results === 'string' ? baoming.results : JSON.stringify(baoming.results);
          log(colors.cyan, `   结果: ${results.substring(0, 50)}${results.length > 50 ? '...' : ''}`);
        }
        console.log('');
      });

      return baomings;
    } else {
      throw new Error('获取报名结果失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取单个统计详情
async function getTongji(tongjiId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取统计 ${tongjiId} 的详情...`);

  // 使用列表查询通过 _id 过滤来获取单个实体
  const query = `
    query GetTongjis($_id: ID) {
      tongjis(_id: $_id, isRemove: false) {
        _id
        title
        content
        createdAt
        resultsCount
        count
        totalAllow
        isSelectCourse
        needExamMode
        needInfo
        infoForms {
          id
          type
          title
          required
          options
          courseSetting {
            id
            title
            quota
            schedule {
              dayOfWeek
              startTime
              endTime
            }
            teacher
            location
            price
          }
        }
        isAnonymous
        isRepeat
        endTime
        cover
        pictures
        needBookMode
        dayRepeatCount
        allowSubmitTimeRules {
          startTime
          endTime
        }
      }
    }
  `;

  const variables = {
    _id: tongjiId
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'tongjis'
    }));

    // API 返回 data 直接是数组
    let tongjis = null;
    if (Array.isArray(response.data)) {
      tongjis = response.data;
    } else if (response.data && response.data.tongjis) {
      tongjis = response.data.tongjis;
    }

    if (tongjis && tongjis.length > 0) {
      const tongji = tongjis[0];
      success('统计详情');
      log(colors.bright, `   ID: ${tongji._id}`);
      log(colors.bright, `   标题: ${tongji.title}`);
      if (tongji.content) log(colors.cyan, `   描述: ${tongji.content.substring(0, 100)}${tongji.content.length > 100 ? '...' : ''}`);
      log(colors.cyan, `   报名数: ${tongji.resultsCount || 0}/${tongji.totalAllow || tongji.count || '不限'}`);
      log(colors.cyan, `   创建时间: ${new Date(tongji.createdAt).toLocaleString('zh-CN')}`);
      if (tongji.endTime) log(colors.cyan, `   结束时间: ${new Date(tongji.endTime).toLocaleString('zh-CN')}`);
      if (tongji.isAnonymous) log(colors.cyan, `   匿名填写: 是`);
      if (tongji.isRepeat) log(colors.cyan, `   重复打卡: 是`);
      if (tongji.isSelectCourse) log(colors.cyan, `   选课模式: 是`);
      if (tongji.needExamMode) log(colors.cyan, `   考试模式: 是`);
      if (tongji.needInfo) log(colors.cyan, `   信息收集: 是`);
      if (tongji.needBookMode) log(colors.cyan, `   预约模式: 是`);
      if (tongji.dayRepeatCount) log(colors.cyan, `   每天时段数: ${tongji.dayRepeatCount}`);
      if (tongji.allowSubmitTimeRules && tongji.allowSubmitTimeRules.length > 0) {
        log(colors.cyan, `   预约时段:`);
        tongji.allowSubmitTimeRules.forEach((rule, index) => {
          log(colors.cyan, `     ${index + 1}. ${rule.startTime} - ${rule.endTime}`);
        });
      }
      if (tongji.infoForms && tongji.infoForms.length > 0) {
        log(colors.cyan, `   表单字段 (${tongji.infoForms.length} 个):`);
        tongji.infoForms.forEach((form, index) => {
          const requiredStr = form.required ? '(必填)' : '';
          if (form.type === '24' && form.courseSetting) {
            log(colors.cyan, `     ${index + 1}. ${form.title} ${requiredStr}[类型: 24 - 课程选择]`);
            log(colors.cyan, `        可选课程 (${form.courseSetting.length} 门):`);
            form.courseSetting.forEach((course, idx) => {
              const scheduleInfo = course.schedule && course.schedule.length > 0
                ? course.schedule.map(s => {
                    const dayMap = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' };
                    const day = dayMap[s.dayOfWeek] || s.dayOfWeek;
                    return `${day} ${s.startTime}-${s.endTime}${course.location ? '@' + course.location : ''}`;
                  }).join('; ')
                : '';
              log(colors.cyan, `          ${idx + 1}. ${course.title} (配额:${course.quota}) ${scheduleInfo ? '[' + scheduleInfo + ']' : ''}`);
            });
          } else {
            const optionsStr = form.options ? ` [选项: ${form.options.join(', ')}]` : '';
            log(colors.cyan, `     ${index + 1}. ${form.title} ${requiredStr}[类型: ${form.type}]${optionsStr}`);
          }
        });
      }

      return tongji;
    } else {
      throw new Error('未找到该统计');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取查查列表
async function listChachas(options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  const searchKeyword = options.search || options._search;
  if (searchKeyword) {
    info(`正在搜索包含 "${searchKeyword}" 的查查...`);
  } else {
    info('正在获取查查列表...');
  }

  // 使用标准的 CRUD 查询格式
  const query = `
    query GetChachas($limit: Int, $skip: Int, $title: String, $_search: String) {
      chachas(limit: $limit, skip: $skip, title: $title, _search: $_search, isRemove: false) {
        _id
        title
        content
        sharePoster
        authorName
        wxLogo
        isNewForm
        sheets {
          id
          title
          headers
        }
        createdAt
      }
    }
  `;

  const variables = {
    limit: options.limit ? parseInt(options.limit) : 50,
    skip: options.skip ? parseInt(options.skip) : 0
  };

  if (options.title) {
    variables.title = options.title;
  }
  if (searchKeyword) {
    variables._search = searchKeyword;
  }

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'chachas'
    }));

    let chachas = null;
    if (Array.isArray(response.data)) {
      chachas = response.data;
    } else if (response.data && response.data.chachas) {
      chachas = response.data.chachas;
    }

    if (chachas) {
      success(`找到 ${chachas.length} 个查查`);
      chachas.forEach((chacha, index) => {
        log(colors.bright, `${index + 1}. ${chacha.title}`);
        log(colors.cyan, `   ID: ${chacha._id}`);
        if (chacha.content) log(colors.cyan, `   描述: ${chacha.content.substring(0, 100)}${chacha.content.length > 100 ? '...' : ''}`);
        if (chacha.authorName) log(colors.cyan, `   作者: ${chacha.authorName}`);
        if (chacha.isNewForm !== undefined) log(colors.cyan, `   新表单: ${chacha.isNewForm ? '是' : '否'}`);
        if (chacha.sheets && chacha.sheets.length > 0) {
          log(colors.cyan, `   表格数: ${chacha.sheets.length}`);
          chacha.sheets.forEach((sheet, idx) => {
            log(colors.cyan, `     ${idx + 1}. ${sheet.title || '未命名'} (${sheet.headers?.length || 0} 列)`);
          });
        }
        log(colors.cyan, `   创建时间: ${new Date(chacha.createdAt).toLocaleString('zh-CN')}`);
        console.log('');
      });

      return chachas;
    } else {
      throw new Error('获取查查列表失败');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 获取单个查查详情
async function getChacha(chachaId, options = {}) {
  const apiKey = getApiKey(options?.apiKey);
  const API_HOST = 'www.aiphoto8.cn';

  info(`正在获取查查 ${chachaId} 的详情...`);

  // 使用列表查询通过 _id 过滤来获取单个实体
  const query = `
    query GetChachas($_id: ID) {
      chachas(_id: $_id, isRemove: false) {
        _id
        title
        content
        sharePoster
        authorName
        wxLogo
        managers
        isNewForm
        sheets {
          id
          title
          headers
          searchConditionSettings
          allowChangeKeys
          hideKeys
          needConfirm
          confirmType
          limitQueryCount
          limitQueryTime
          startTime
          endTime
          imageSearchRules {
            headerIndex
            headerName
            values
            images
          }
        }
        createdAt
      }
    }
  `;

  const variables = {
    _id: chachaId
  };

  try {
    const response = await httpsRequest({
      hostname: API_HOST,
      port: 443,
      path: '/dev/api/openapi/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, JSON.stringify({
      query,
      variables,
      operationName: 'chachas'
    }));

    let chachas = null;
    if (Array.isArray(response.data)) {
      chachas = response.data;
    } else if (response.data && response.data.chachas) {
      chachas = response.data.chachas;
    }

    if (chachas && chachas.length > 0) {
      const chacha = chachas[0];
      success('查查详情');
      log(colors.bright, `   ID: ${chacha._id}`);
      log(colors.bright, `   标题: ${chacha.title}`);
      if (chacha.content) log(colors.cyan, `   描述: ${chacha.content.substring(0, 200)}${chacha.content.length > 200 ? '...' : ''}`);
      if (chacha.authorName) log(colors.cyan, `   作者: ${chacha.authorName}`);
      if (chacha.managers && chacha.managers.length > 0) log(colors.cyan, `   管理员: ${chacha.managers.length} 人`);
      if (chacha.isNewForm !== undefined) log(colors.cyan, `   新表单: ${chacha.isNewForm ? '是' : '否'}`);
      log(colors.cyan, `   创建时间: ${new Date(chacha.createdAt).toLocaleString('zh-CN')}`);

      if (chacha.sheets && chacha.sheets.length > 0) {
        log(colors.cyan, `   表格 (${chacha.sheets.length} 个):`);
        chacha.sheets.forEach((sheet, index) => {
          log(colors.cyan, `     ${index + 1}. ${sheet.title || '未命名'}`);
          if (sheet.headers && sheet.headers.length > 0) {
            log(colors.cyan, `        表头: ${sheet.headers.join(', ')}`);
          }
          if (sheet.searchConditionSettings && sheet.searchConditionSettings.length > 0) {
            const conditionHeaders = sheet.searchConditionSettings.map(idx => sheet.headers[idx]).join(', ');
            log(colors.cyan, `        查询条件: ${conditionHeaders}`);
          }
          if (sheet.limitQueryCount && sheet.limitQueryCount > 0) {
            log(colors.cyan, `        查询限制: 每个微信号仅可查 ${sheet.limitQueryCount} 条`);
          }
          if (sheet.limitQueryTime) {
            log(colors.cyan, `        时间限制: ${new Date(sheet.startTime).toLocaleString('zh-CN')} - ${new Date(sheet.endTime).toLocaleString('zh-CN')}`);
          }
          if (sheet.imageSearchRules && sheet.imageSearchRules.length > 0) {
            log(colors.cyan, `        图片搜索规则: ${sheet.imageSearchRules.length} 条`);
            sheet.imageSearchRules.forEach((rule, ruleIdx) => {
              log(colors.cyan, `          ${ruleIdx + 1}. ${rule.headerName}: ${rule.values?.join(', ') || '无'} (${rule.images?.length || 0} 张图片)`);
            });
          }
        });
      }

      return chacha;
    } else {
      throw new Error('未找到该查查');
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// 显示帮助
function showHelp() {
  console.log(`
${colors.bright}${colors.cyan}秒应 CLI 工具${colors.reset}

${colors.bright}━━━ 如何选择：预约 vs 统计 ━━━${colors.reset}

${colors.green}📅 使用预约 (miaoying book) 的情况：${colors.reset}
  • 需要"分时段预约"功能（如：上午/下午/晚上时段）
  • 需要控制每个时间段的人数（如：每时段限10人）
  • 用户提到：预约、订号、限号、时间段、时段预约

${colors.green}📊 使用统计 (miaoying create) 的情况：${colors.reset}
  • 需要收集信息、报名、打卡、问卷
  • 用户提到：统计、报名、问卷、收集信息、填表

${colors.green}📝 使用考试 (miaoying exam) 的情况：${colors.reset}
  • 需要创建在线考试、测验、问卷考试
  • 需要设置考试时长、自动阅卷、成绩排名
  • 用户提到：考试、测验、在线考试、问卷考试

${colors.green}🎓 使用选课 (miaoying create + type=24) 的情况：${colors.reset}
  • 学校选课、培训机构课程报名、兴趣班抢课
  • 需要展示课程列表、配额限制、时间安排
  • 用户提到：选课、抢课、课程选择、课程报名
  • ⚠️ 选课需要在 forms 中包含 type="24" 的课程选择字段

${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.bright}使用方法:${colors.reset}
  miaoying create [options]              创建新的统计
  miaoying list [options]                获取统计列表
  miaoying get <tongji-id>               获取单个统计详情
  miaoying totals <tongji-id> [options]  获取报名总数
  miaoying results <tongji-id> [options] 获取报名结果
  miaoying qrcode <tongji-id> [options]  生成二维码

  miaoying vote [options]                创建新的投票
  miaoying vote-list [options]            获取投票列表
  miaoying vote-get <toupiao-id>         获取投票详情
  miaoying vote-results <toupiao-id>     获取投票结果
  miaoying vote-qrcode <toupiao-id>      生成投票二维码

  miaoying book [options]                创建新的预约
  miaoying exam [options]                创建新的考试
  miaoying chacha-list [options]         获取查查列表
  miaoying chacha-get <chacha-id>        获取查查详情
  miaoying help                           显示帮助

${colors.bright}创建统计选项:${colors.reset}
  --title <标题>          统计标题 (必需)
  --desc <描述>           统计描述
  --forms <JSON>          表单字段 (JSON 数组)
  --count <数量>          人数限制
  --end-time <日期>       结束时间 (ISO 格式)
  --anonymous             匿名填写
  --qrcode                创建后自动生成二维码
  --app <应用名>           应用名 (qingtongji/huiyuan，默认 qingtongji)

${colors.bright}创建投票选项:${colors.reset}
  --title <标题>          投票标题 (必需)
  --desc <描述>           投票描述
  --options <JSON>        投票项配置 (JSON 格式)
  --single                单选投票
  --multi                 多选项投票
  --count <数量>          投票人数限制
  --end-time <日期>       结束时间 (ISO 格式)
  --allow-vote <次数>     允许投票次数
  --min-select <数量>      最少选择数
  --max-select <数量>      最多选择数
  --publish-result        公开结果 (true/false)
  --anonymous             匿名投票
  --qrcode                创建后自动生成二维码

${colors.bright}创建预约选项:${colors.reset}
  --title <标题>          预约标题 (必需)
  --desc <描述>           预约描述
  --forms <JSON>          表单字段 (JSON 数组)
  --slots <数量>           每天时段数 (1=全天 7:00-23:59, 2=上午下午, 3=上下午晚上, 默认1)
  --count <数量>          每时段人数限制 (默认 20)
  --user-limit <次数>     每人预约次数限制 (默认 1)
  --start-time <日期>     开始时间 (ISO 格式)
  --end-time <日期>       结束时间 (ISO 格式)
  --fixed-no              使用固定名单模式
  --no-name <标签>        固定名单标签名 (序号/学号/工号/座位号，默认"序号")
  --allow-buka            允许补卡 (默认允许)
  --no-allow-buka         不允许补卡
  --publish-result        公开结果 (默认公开)
  --no-publish-result      不公开结果
  --notify                开启提醒通知
  --notify-time <时间>    通知时间 (HH:MM 格式，默认 09:00)
  --qrcode                创建后自动生成二维码

${colors.bright}创建考试选项:${colors.reset}
  --title <标题>          考试标题 (必需)
  --desc <描述>           考试描述
  --duration <分钟>       考试时长 (默认 60 分钟)
  --questions <JSON>      考试题目 (JSON 数组)
  --forms <JSON>          信息收集字段 (JSON 数组)
  --start-time <日期>     开始时间 (ISO 格式)
  --end-time <日期>       结束时间 (ISO 格式)
  --fixed-no              使用固定名单模式 (默认启用)
  --no-fixed-no           不使用固定名单模式
  --no-name <标签>        固定名单标签名 (默认"学号")
  --name-label <标签>     姓名标签名 (默认"姓名")
  --btn-text <文本>       按钮文本 (默认"开始答卷")
  --success-text <文本>   提交成功文本 (默认"您已提交成功")
  --no-ranking            不显示排名 (默认显示)
  --publish-result        公开结果 (默认不公开)
  --ban-view-result       禁止提交后查看试卷详情
  --qrcode                创建后自动生成二维码

${colors.yellow}考试必填说明:${colors.reset}
  • ${colors.cyan}needExamMode${colors.reset} 会自动设置为 true（考试模式标识）
  • 考试默认使用固定名单模式，需要单独导入名单
  • 考试时长单位为分钟，0 表示不限时
  • 题目类型：1=单选, 2=多选, 7=简答, 0=单项填空, 20=多项填空, 5=录音

${colors.yellow}预约必填说明:${colors.reset}
  • ${colors.cyan}needBookMode${colors.reset} 会自动设置为 true（预约模式标识）
  • ${colors.cyan}slots/preset${colors.reset} 决定每天有几个预约时段可选
  • 预约模式下不限制总人数（limitCount=false, count=0）
  • 如果使用固定名单（--fixed-no），需要单独导入名单

${colors.bright}获取统计/投票/预约列表选项:${colors.reset}
  --limit <数量>          返回数量 (默认 50)
  --skip <数量>           跳过数量 (分页)
  --title <标题>          按标题筛选（精确匹配）
  --search <关键词>       按关键词搜索（模糊匹配标题和内容）
  --_search <关键词>      同 --search（简写形式）

${colors.bright}获取投票结果选项:${colors.reset}
  --skip <跳过数>         跳过数量 (分页)
  --verbose               显示详细投票记录

${colors.bright}生成二维码选项:${colors.reset}
  --output <路径>         输出文件路径
  --app <应用名>           应用名 (qingtongji/huiyuan，默认 qingtongji)

${colors.bright}环境变量:${colors.reset}
  MIAOYING_API_KEY         秒应 API 密钥 (必需)

${colors.bright}统计示例:${colors.reset}
  ${colors.cyan}# 创建简单统计${colors.reset}
  miaoying create --title "每日打卡" --desc "请完成每日打卡" --qrcode

  ${colors.cyan}# 获取统计列表${colors.reset}
  miaoying list --limit 10

  ${colors.cyan}# 搜索统计${colors.reset}
  miaoying list --search "打卡"

${colors.bright}投票示例:${colors.reset}
  ${colors.cyan}# 创建简单投票（单选）${colors.reset}
  miaoying vote --title "选择班干部" --single --qrcode

  ${colors.cyan}# 创建多选项投票${colors.reset}
  miaoying vote --title "班级活动投票" --multi \\
    --options '[{"title":"选择你喜欢的活动","required":true,"options":[{"title":"春游"},{"title":"秋游"},{"title":"运动会"}]}]' \\
    --max-select 2 --qrcode

  ${colors.cyan}# 获取投票列表${colors.reset}
  miaoying vote-list --limit 10

  ${colors.cyan}# 获取投票详情${colors.reset}
  miaoying vote-get <toupiao-id>

  ${colors.cyan}# 获取投票结果${colors.reset}
  miaoying vote-results <toupiao-id>

  ${colors.cyan}# 生成投票二维码${colors.reset}
  miaoying vote-qrcode <toupiao-id>

${colors.bright}预约示例:${colors.reset}
  ${colors.cyan}# 创建简单预约（单时段）${colors.reset}
  miaoying book --title "医生咨询预约" --slots 1 --count 20 --qrcode

  ${colors.cyan}# 创建多时段预约${colors.reset}
  miaoying book --title "会议室预约" --slots 2 --count 5 --qrcode

  ${colors.cyan}# 创建固定名单预约${colors.reset}
  miaoying book --title "设备借用预约" --fixed-no --no-name "工号" --qrcode

  ${colors.cyan}# 预约 + 表单字段${colors.reset}
  miaoying book --title "课程预约" \\
    --forms '[{"title":"姓名","required":true,"type":"0"},{"title":"手机号","required":true,"type":"11"}]'

${colors.bright}考试示例:${colors.reset}
  ${colors.cyan}# 创建简单考试${colors.reset}
  miaoying exam --title "期中考试" --duration 90 --qrcode

  ${colors.cyan}# 创建考试 + 题目${colors.reset}
  miaoying exam --title "数学测验" --duration 60 \\
    --questions '[{"id":"q1","type":"1","title":"1+1=?","options":["1","2","3","4"],"answer":"1","fullScore":10,"required":true,"order":1}]' \\
    --qrcode

  ${colors.cyan}# 生成考试二维码${colors.reset}
  miaoying qrcode <exam-id> --type exam

${colors.bright}选课示例:${colors.reset}
  ${colors.cyan}# 创建选课活动（使用 type=24 字段）${colors.reset}
  miaoying create --title "选修课选课" \\
    --forms '[{"id":"course_1","type":"24","title":"请选择课程","required":true,"courseSetting":[{"id":"c001","title":"Python编程","quota":30,"schedule":[{"dayOfWeek":1,"startTime":"14:00","endTime":"16:00"}],"location":"A101","teacher":"张老师","order":1},{"id":"c002","title":"数据分析","quota":25,"schedule":[{"dayOfWeek":2,"startTime":"10:00","endTime":"12:00"}],"location":"B203","teacher":"李老师","order":2]}]' \\
    --qrcode

  ${colors.cyan}# 创建选课 + 多门课程限制${colors.reset}
  miaoying create --title "兴趣班报名" \\
    --forms '[{"id":"course_1","type":"24","title":"请选择兴趣班","required":true,"courseSetting":[{"id":"art001","title":"美术班","quota":20},{"id":"music001","title":"音乐班","quota":15},{"id":"dance001","title":"舞蹈班","quota":25}]}' \\
    --count 1 \\
    --qrcode

${colors.bright}查找示例:${colors.reset}
  ${colors.cyan}# 获取查查列表${colors.reset}
  miaoying chacha-list --limit 10

  ${colors.cyan}# 搜索查查${colors.reset}
  miaoying chacha-list --search "员工"

  ${colors.cyan}# 获取查查详情${colors.reset}
  miaoying chacha-get <chacha-id>

${colors.bright}获取 API Key:${colors.reset}
  访问 https://miaoying.hui51.cn/apikey 创建密钥

${colors.bright}表单字段类型:${colors.reset}
  "0"  - 单行文本
  "1"  - 单选
  "2"  - 多选
  "4"  - 图片上传
  "7"  - 多行文本
  "11" - 手机号
  "31" - 性别
  ...
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const parsedArgs = parseArgs(args);
  const { command, options } = parsedArgs;

  if (!command || command === 'help' || options.help) {
    showHelp();
    return;
  }

  switch (command) {
    case 'create':
      if (!options.title) {
        error('--title 参数是必需的');
        process.exit(1);
      }
      await createTongji(options);
      break;

    case 'list':
      await listTongjis(options);
      break;

    case 'get':
      if (parsedArgs.args.length === 0) {
        error('请提供统计 ID');
        info('使用方法: miaoying get <tongji-id>');
        process.exit(1);
      }
      await getTongji(parsedArgs.args[0], options);
      break;

    case 'qrcode':
      if (parsedArgs.args.length === 0) {
        error('请提供实体 ID');
        info('使用方法: miaoying qrcode <entity-id> [--type <tongji|booking|toupiao|chacha>]');
        process.exit(1);
      }
      // 根据 type 参数选择 entityType，默认为 Tongji
      const entityTypeMap = {
        'tongji': 'Tongji',
        'booking': 'Booking',
        'toupiao': 'Toupiao',
        'chacha': 'Chacha',
        'vote': 'Toupiao',
        'exam': 'Tongji'  // 考试使用与统计相同的 entityType
      };
      const entityType = options.type ? entityTypeMap[options.type] || 'Tongji' : 'Tongji';
      await generateQrCode(parsedArgs.args[0], { ...options, entityType });
      break;

    case 'totals':
      if (parsedArgs.args.length === 0) {
        error('请提供统计 ID');
        info('使用方法: miaoying totals <tongji-id>');
        process.exit(1);
      }
      await getBaomingsTotals(parsedArgs.args[0], options);
      break;

    case 'results':
      if (parsedArgs.args.length === 0) {
        error('请提供统计 ID');
        info('使用方法: miaoying results <tongji-id>');
        process.exit(1);
      }
      await getBaomings(parsedArgs.args[0], options);
      break;

    // 投票相关命令
    case 'vote':
    case 'create-vote':
      if (!options.title) {
        error('--title 参数是必需的');
        process.exit(1);
      }
      await createToupiao(options);
      break;

    case 'vote-list':
    case 'list-votes':
      await listToupiaos(options);
      break;

    case 'vote-get':
    case 'get-vote':
      if (parsedArgs.args.length === 0) {
        error('请提供投票 ID');
        info('使用方法: miaoying vote-get <toupiao-id>');
        process.exit(1);
      }
      await getToupiao(parsedArgs.args[0], options);
      break;

    case 'vote-results':
      if (parsedArgs.args.length === 0) {
        error('请提供投票 ID');
        info('使用方法: miaoying vote-results <toupiao-id>');
        process.exit(1);
      }
      await getVotes(parsedArgs.args[0], options);
      break;

    case 'vote-qrcode':
      if (parsedArgs.args.length === 0) {
        error('请提供投票 ID');
        info('使用方法: miaoying vote-qrcode <toupiao-id>');
        process.exit(1);
      }
      await generateToupiaoQrCode(parsedArgs.args[0], options);
      break;

    // 预约相关命令
    case 'book':
    case 'booking':
    case 'create-book':
      if (!options.title) {
        error('--title 参数是必需的');
        process.exit(1);
      }
      await createBooking(options);
      break;

    // 考试相关命令
    case 'exam':
    case 'create-exam':
      if (!options.title) {
        error('--title 参数是必需的');
        process.exit(1);
      }
      await createExam(options);
      break;

    // 查查相关命令
    case 'chacha':
    case 'chacha-list':
    case 'list-chachas':
      await listChachas(options);
      break;

    case 'chacha-get':
    case 'get-chacha':
      if (parsedArgs.args.length === 0) {
        error('请提供查查 ID');
        info('使用方法: miaoying chacha-get <chacha-id>');
        process.exit(1);
      }
      await getChacha(parsedArgs.args[0], options);
      break;

    default:
      error('未知命令:', command);
      info('使用 "miaoying help" 查看帮助');
      process.exit(1);
  }
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
