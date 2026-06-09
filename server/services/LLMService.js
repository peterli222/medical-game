const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');

// 加密配置 - 必须与 settings.js 一致
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.MEDICAL_APP_SECRET || 'medical-game-2024-secure-key').digest();
const ALGORITHM = 'aes-256-cbc';

class LLMService {
  constructor() {
    // 从环境变量加载默认配置
    this.defaultSettings = {
      apiUrl: process.env.AI_API_URL || '',
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'deepseek-chat',
      enabled: process.env.AI_ENABLED === 'true',
      generateCases: process.env.AI_GENERATE_CASES !== 'false',
      generateDescriptions: process.env.AI_GENERATE_DESCRIPTIONS !== 'false',
      generateExaminations: process.env.AI_GENERATE_EXAMINATIONS !== 'false',
      aiScoring: process.env.AI_SCORING !== 'false'
    };
  }

  // 解密函数
  decrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
      if (!encryptedText.includes(':')) {
        return encryptedText;
      }
      const [ivHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('Decryption error:', e);
      return encryptedText;
    }
  }

  getSettings() {
    try {
      // 优先从文件读取（支持运行时修改）
      if (fs.existsSync(SETTINGS_FILE)) {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        // 解密 apiKey
        if (settings.apiKey) {
          settings.apiKey = this.decrypt(settings.apiKey);
        }
        return settings;
      }
    } catch (e) {
      console.warn('读取AI设置文件失败，使用默认配置:', e.message);
    }
    
    // 如果文件不存在，使用环境变量默认配置
    return this.defaultSettings;
  }

  isEnabled() {
    const s = this.getSettings();
    return s.enabled && s.apiUrl && s.apiKey;
  }

  // 获取用于JSON生成的模型（避免reasoner模型的thinking标签）
  getJsonModel() {
    const settings = this.getSettings();
    // 直接返回原模型，前端会处理thinking标签
    return settings.model || 'deepseek-chat';
  }

  // 清理AI响应中的thinking标签
  cleanThinkingTags(content) {
    if (!content) return content;
    // 移除 <think>...</think> 标签及其内容
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  // 安全解析JSON（带容错和修复）
  safeParseJSON(jsonStr, context = '') {
    if (!jsonStr) return null;
    
    // 第一次尝试：直接解析
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // 记录原始错误
      console.warn(`JSON解析失败 (${context}):`, e.message);
    }

    // 第二次尝试：清理和修复常见问题
    try {
      let cleaned = jsonStr
        // 移除尾部逗号（在 } 或 ] 前）
        .replace(/,(\s*[}\]])/g, '$1')
        // 移除注释
        .replace(/\/\/.*$/gm, '')
        // 修复单引号为双引号（但不替换内容中的单引号）
        .replace(/^(\s*)(\w+)(\s*):/gm, '$1"$2"$3:')
        // 移除控制字符
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn(`JSON修复后仍解析失败 (${context}):`, e.message);
    }

    // 第三次尝试：提取最外层的 JSON 对象
    try {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e) {
      console.warn(`JSON提取后仍解析失败 (${context}):`, e.message);
    }

    // 第四次尝试：修复推理模型常见的属性名损坏
    try {
      const repaired = this.repairCorruptedJSON(jsonStr);
      if (repaired) {
        console.log(`JSON修复成功 (${context}，通过损坏修复)`);
        return repaired;
      }
    } catch (e) {
      console.warn(`损坏修复后仍失败 (${context}):`, e.message);
    }

    // 记录原始内容以便调试（截取前500字符）
    console.error(`JSON解析最终失败 (${context})，原始内容:`, jsonStr.substring(0, 500));
    return null;
  }

  // 修复推理模型（如DeepSeek-R1）常见的JSON属性名损坏
  repairCorruptedJSON(jsonStr) {
    if (!jsonStr) return null;

    // 属性名修复映射表（部分匹配 -> 正确名称）
    const fieldNameMap = [
      [/""\s*:/, '"name":'],
      [/"(blood)?ressure"/i, '"bloodPressure"'],
      [/"reament"/, '"treatment"'],
      [/"reatment"/, '"treatment"'],
      [/"eatment"/, '"treatment"'],
      [/"ament"/, '"treatment"'],
      [/"[Mm]edic(?!ines|al|ine|ation)"/, '"medicines"'],
      [/"[Mm]edicin"/, '"medicines"'],
      [/"edicines"/, '"medicines"'],
      [/"[Dd](?:isease)?[Dd]escription"/, '"diseaseDescription"'],
      [/"[Dd]Description"/, '"diseaseDescription"'],
      [/"[Dd]iseaseDes"/, '"diseaseDescription"'],
      [/"[Dd]escr"/, '"diseaseDescription"'],
      [/"[Dd]Disease"/, '"disease"'],
      [/"isase"/, '"disease"'],
      [/"[Ss]ympto"/, '"symptoms"'],
      [/"[Ss]ympt"/, '"symptoms"'],
      [/"[Gg]ende"/, '"gender"'],
      [/"[Pp]ressure"/, '"bloodPressure"'],
      [/"[Hh]eatRate"/, '"heartRate"'],
      [/"[Hh]eartRat"/, '"heartRate"'],
      [/"[Bb]reathRat"/, '"breathRate"'],
      [/"[Ss]uggestedExamin"/, '"suggestedExaminations"'],
      // 修复更多截断字段名
      [/"[Dd]Descr[^"]*"/, '"diseaseDescription"'],
      [/"[Mm]edic[^"]*?s?"/, '"medicines"'],
      [/"[Tt]reat[^"]*"/, '"treatment"'],
    ];

    let fixed = jsonStr;
    for (const [pattern, replacement] of fieldNameMap) {
      fixed = fixed.replace(pattern, replacement);
    }

    // 修复冒号缺失（如 "gender女" -> "gender":"女"）
    fixed = fixed.replace(/"([a-zA-Z]+)"\s*([\u4e00-\u9fff0-9])/g, '"$1":"$2');
    // 修复 }/] 后直接跟属性名（缺逗号）
    fixed = fixed.replace(/}\s*"([a-zA-Z])/g, ',"$1');
    fixed = fixed.replace(/]\s*"([a-zA-Z])/g, ',"$1');

    // 修复截断的字符串：找到最后一个未闭合的引号并闭合
    // 统计引号数量，奇数说明有未闭合的
    const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // 在字符串末尾、逗号、冒号等可能断开的地方补上闭合引号
      // 先尝试直接在末尾加引号
      fixed = fixed.trimEnd();
      // 如果末尾是中文或字母，直接加引号
      if (/[^\s{[\],}]$/.test(fixed)) {
        fixed += '"';
      }
    }

    // 修复截断的数组元素：如 ["a","b","c 没有闭合引号和括号
    // 在 "后面跟着换行或文件结束的情况
    fixed = fixed.replace(/"([^"]*)$/g, (match, p1) => {
      // 如果最后一个是未闭合的字符串，闭合它
      return '"' + p1 + '"';
    });

    // 补齐缺失的括号
    const openB = (fixed.match(/\[/g) || []).length;
    const closeB = (fixed.match(/\]/g) || []).length;
    const openP = (fixed.match(/\{/g) || []).length;
    const closeP = (fixed.match(/\}/g) || []).length;
    for (let i = 0; i < openB - closeB; i++) fixed += ']';
    for (let i = 0; i < openP - closeP; i++) fixed += '}';
    // 清理尾部逗号
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    try {
      const parsed = JSON.parse(fixed);
      if (parsed && (parsed.name || parsed.disease || parsed.symptoms)) {
        return parsed;
      }
    } catch (e) {
      // 继续尝试正则提取
    }

    // 最后手段：正则提取字段值
    return this.extractFieldsFromCorruptedJSON(jsonStr);
  }

  // 从严重损坏的JSON中用正则提取字段值
  extractFieldsFromCorruptedJSON(jsonStr) {
    if (!jsonStr) return null;
    try {
      const result = {};
      // 提取姓名（中文名字，2-4个字）
      // 优先匹配空键名模式 {"":"张三"} 或 {"name":"张三"}
      const emptyKeyMatch = jsonStr.match(/""\s*[:：]\s*"([^"]{1,10})"/);
      const nameMatch = jsonStr.match(/"(?:name|姓名|患者)"\s*[:：]\s*"([^"]{1,10})"/);
      if (nameMatch) {
        result.name = nameMatch[1];
      } else if (emptyKeyMatch) {
        // 空键名通常就是名字字段
        const val = emptyKeyMatch[1];
        // 验证是中文名字（2-4个汉字）
        if (/^[\u4e00-\u9fff]{2,4}$/.test(val)) {
          result.name = val;
        }
      }
      // 提取性别
      const genderMatch = jsonStr.match(/"gender"\s*[:：]?\s*"(男|女)"/);
      if (genderMatch) result.gender = genderMatch[1];
      // 提取年龄
      const ageMatch = jsonStr.match(/"age"\s*[:：]\s*(\d+)/);
      if (ageMatch) result.age = parseInt(ageMatch[1]);
      // 提取疾病
      const diseaseMatch = jsonStr.match(/"(?:disease|疾病)"\s*[:：]\s*"([^"]+)"/);
      if (diseaseMatch) result.disease = diseaseMatch[1];
      // 提取疾病描述（支持多种截断字段名）
      const descMatch = jsonStr.match(/"(?:diseaseDescription|dDescription|Description|diseaseDes|Descr[^"]*)"\s*[:：]\s*"([^"]+)"/);
      if (descMatch) result.diseaseDescription = descMatch[1];
      // 提取症状数组（支持截断）
      const symptomsMatch = jsonStr.match(/"(?:symptoms|症状)"\s*[:：]\s*\[([^\]]*)/);
      if (symptomsMatch) {
        const raw = symptomsMatch[1];
        // 分割并清理，支持截断的最后一个元素
        const items = raw.split(/","/).map(s => s.replace(/^\s*"?|"?\s*$/g, '')).filter(s => s && s.length > 0);
        if (items.length > 0) result.symptoms = items;
      }
      // 提取药品数组（支持截断）
      const medicinesMatch = jsonStr.match(/"(?:medicines|药品|medic[^"]*)"\s*[:：]\s*\[([^\]]*)/);
      if (medicinesMatch) {
        const raw = medicinesMatch[1];
        const items = raw.split(/","/).map(s => s.replace(/^\s*"?|"?\s*$/g, '')).filter(s => s && s.length > 0);
        if (items.length > 0) result.medicines = items;
      }
      // 提取治疗方案数组（支持截断）
      const treatmentMatch = jsonStr.match(/"(?:treatment|治疗|reatment|treat[^"]*)"\s*[:：]\s*\[([^\]]*)/);
      if (treatmentMatch) {
        const raw = treatmentMatch[1];
        const items = raw.split(/","/).map(s => s.replace(/^\s*"?|"?\s*$/g, '')).filter(s => s && s.length > 0);
        if (items.length > 0) result.treatment = items;
      }
      // 提取建议检查（支持截断）
      const examsMatch = jsonStr.match(/"(?:suggestedExaminations|检查)"\s*[:：]\s*\[([^\]]*)/);
      if (examsMatch) {
        const raw = examsMatch[1];
        const items = raw.split(/","/).map(s => s.replace(/^\s*"?|"?\s*$/g, '')).filter(s => s && s.length > 0);
        if (items.length > 0) result.suggestedExaminations = items;
      }
      // 提取体征
      const tempMatch = jsonStr.match(/"temperature"\s*[:：]\s*"([^"]+)"/);
      const bpMatch = jsonStr.match(/"(?:bloodPressure|Pressure)"\s*[:：]\s*"([^"]+)"/);
      const hrMatch = jsonStr.match(/"heartRate"\s*[:：]\s*"([^"]+)"/);
      const brMatch = jsonStr.match(/"breathRate"\s*[:：]\s*"([^"]+)"/);
      if (tempMatch || bpMatch || hrMatch || brMatch) {
        result.physicalSigns = {};
        if (tempMatch) result.physicalSigns.temperature = tempMatch[1];
        if (bpMatch) result.physicalSigns.bloodPressure = bpMatch[1];
        if (hrMatch) result.physicalSigns.heartRate = hrMatch[1];
        if (brMatch) result.physicalSigns.breathRate = brMatch[1];
      }
      // 提取既往史
      const histMatch = jsonStr.match(/"medicalHistory"\s*[:：]\s*\[([^\]]*)/);
      if (histMatch) {
        const raw = histMatch[1];
        const items = raw.split(/","/).map(s => s.replace(/^\s*"?|"?\s*$/g, '')).filter(s => s && s.length > 0);
        if (items.length > 0) result.medicalHistory = items;
      }
      if (result.name || result.disease || (result.symptoms && result.symptoms.length > 0)) {
        console.log('从损坏JSON中提取到字段:', Object.keys(result).join(', '));
        return result;
      }
    } catch (e) {
      console.warn('字段提取失败:', e.message);
    }
    return null;
  }

  // 规范化AI生成的病例数据（确保类型正确）
  normalizeCaseData(caseData) {
    if (!caseData) return caseData;
    
    // 确保必需字段存在
    if (!caseData.name) {
      caseData.name = '患者' + Math.floor(Math.random() * 1000);
    }
    if (!caseData.symptoms) {
      caseData.symptoms = ['不适'];
    }
    
    const toArray = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') return val.split(/[,，、;；]+/).map(s => s.trim()).filter(s => s);
      return val ? [val] : [];
    };
    caseData.symptoms = toArray(caseData.symptoms);
    caseData.medicalHistory = toArray(caseData.medicalHistory);
    caseData.treatment = toArray(caseData.treatment);
    caseData.medicines = toArray(caseData.medicines);
    caseData.suggestedExaminations = toArray(caseData.suggestedExaminations);
    if (!caseData.physicalSigns || typeof caseData.physicalSigns !== 'object') {
      caseData.physicalSigns = { temperature: '36.5', bloodPressure: '120/80', heartRate: '78', breathRate: '18' };
    }
    return caseData;
  }

  // 构建患者基础信息块（统一格式，放在所有患者相关调用的 user message 最前面，提高 DeepSeek 缓存命中率）
  // 可选传入 completedExams（已完成的检查结果）
  buildPatientContextBlock(patientInfo, diseaseCase, completedExams = [], options = {}) {
    const { conversationHistory = [], completedSurgeries = [], currentPrescriptions = [] } = options;
    const parts = [];
    if (patientInfo) {
      if (patientInfo.name) parts.push(`姓名：${patientInfo.name}`);
      if (patientInfo.age) parts.push(`年龄：${patientInfo.age}岁`);
      if (patientInfo.gender) parts.push(`性别：${patientInfo.gender}`);
    }
    if (diseaseCase) {
      // AI生成的病例：name是患者姓名，disease才是疾病名称
      // AI病例：disease是疾病名，name是患者姓名，不能fallback到name
      const isAICase = !!diseaseCase.diseaseDescription ||
        (!!diseaseCase.disease && diseaseCase.disease !== diseaseCase.name);
      const diseaseName = isAICase
        ? (diseaseCase.disease || diseaseCase.diseaseDescription || '')
        : (diseaseCase.name || '');
      if (diseaseName) parts.push(`疾病：${diseaseName}`);
      // 确保symptoms是数组
      let symptoms = diseaseCase.symptoms;
      if (typeof symptoms === 'string') {
        symptoms = symptoms.split(/[,，、;；\s]+/).filter(s => s.trim());
      }
      if (symptoms && symptoms.length > 0) {
        parts.push(`症状：${symptoms.join('、')}`);
      }
      if (diseaseCase.physicalSigns) {
        const signs = [];
        const ps = diseaseCase.physicalSigns;
        if (ps.temperature) signs.push(`体温${ps.temperature}℃`);
        if (ps.bloodPressure) signs.push(`血压${ps.bloodPressure}mmHg`);
        if (ps.heartRate) signs.push(`心率${ps.heartRate}次/分`);
        if (ps.breathRate) signs.push(`呼吸${ps.breathRate}次/分`);
        if (signs.length > 0) parts.push(`体征：${signs.join(' ')}`);
      }
      // 既往病史
      if (diseaseCase.medicalHistory && diseaseCase.medicalHistory.length > 0) {
        parts.push(`既往史：${Array.isArray(diseaseCase.medicalHistory) ? diseaseCase.medicalHistory.join('、') : diseaseCase.medicalHistory}`);
      }
    }

    let context = `【患者基础信息】${parts.join(' | ')}`;

    // 问诊记录（最近10轮）
    if (conversationHistory && conversationHistory.length > 0) {
      const recent = conversationHistory.filter(h => h && h.content).slice(-20);
      if (recent.length > 0) {
        context += `\n【问诊记录】\n${recent.map(h => `${h.role === 'doctor' ? '医' : '患'}：${h.content}`).join('\n')}`;
      }
    }

    // 已完成检查结果
    if (completedExams && completedExams.length > 0) {
      context += `\n【已完成检查】\n`;
      completedExams.forEach(exam => {
        context += `- ${exam.typeName || exam.type}：${exam.result ? (exam.result.aiDescription || exam.result.description || exam.result.summary || '已完成') : '无结果'}\n`;
      });
    }

    // 手术记录
    if (completedSurgeries && completedSurgeries.length > 0) {
      context += `\n【手术记录】\n`;
      completedSurgeries.forEach(s => {
        const name = (s.surgeryType && typeof s.surgeryType === 'object') ? s.surgeryType.name : (s.surgeryType || '未知');
        context += `- ${name}（${s.typeLabel || s.type || ''}，${s.anesthesiaLabel || s.anesthesiaType || ''}）：经过=${(s.outcome || '无').slice(0, 80)}；发现=${(s.findings || '无').slice(0, 50)}；并发症=${s.complications || '无'}；术后=${(s.postOpNotes || '无').slice(0, 50)}\n`;
      });
    }

    // 当前处方
    if (currentPrescriptions && currentPrescriptions.length > 0) {
      context += `\n【当前处方】\n`;
      currentPrescriptions.forEach(m => {
        context += `- ${m.name || m}（${m.dosage || ''} ${m.frequency || ''} ${m.duration || ''}）\n`;
      });
    }

    return context;
  }

  // 清理消息数组，确保 content 不为 null/undefined（修正格式，不丢弃消息）
  _sanitizeMessages(messages) {
    return messages
      .filter(m => m && m.role)
      .map(m => ({
        ...m,
        content: (m.content != null && m.content !== '') ? String(m.content) : '（无内容）'
      }));
  }

  async chat(messages, temperature = 0.7, maxTokens = null) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.apiUrl || !settings.apiKey) {
      return { success: false, error: 'AI not configured' };
    }

    messages = this._sanitizeMessages(messages);

    try {
      const requestBody = {
        model: this.getJsonModel(),
        messages: messages,
        temperature: temperature,
        stream: false
      };
      // 只有明确指定maxTokens时才添加限制
      if (maxTokens != null && maxTokens > 0) {
        requestBody.max_tokens = maxTokens;
      }

      const response = await axios.post(
        settings.apiUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 0
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const rawContent = response.data.choices[0].message.content;
        return {
          success: true,
          content: this.cleanThinkingTags(rawContent),
          usage: response.data.usage
        };
      }
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      let detail = error.message;
      if (error.response && error.response.status === 429) {
        detail = 'AI服务繁忙（请求过多），请稍后再试';
      }
      console.error('LLM API Error:', detail);
      return { success: false, error: detail };
    }
  }

  // 带拦截器的axios实例（用于流式请求），能正确读取stream类型的错误响应体
  _getStreamAxios() {
    if (this._streamAxios) return this._streamAxios;
    this._streamAxios = axios.create();
    this._streamAxios.interceptors.response.use(
      response => response,
      async error => {
        if (error.response && error.response.data && typeof error.response.data.pipe === 'function') {
          // 错误响应是 stream，异步读取完整 body
          const chunks = [];
          try {
            for await (const chunk of error.response.data) {
              chunks.push(chunk);
              if (Buffer.concat(chunks).length > 2000) break; // 不要读太多
            }
            error.response._bodyText = Buffer.concat(chunks).toString('utf8');
          } catch (e) {
            error.response._bodyText = '[stream read failed]';
          }
        }
        throw error;
      }
    );
    return this._streamAxios;
  }

  async chatStream(messages, temperature = 0.7, maxTokens = null) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.apiUrl || !settings.apiKey) {
      return { success: false, error: 'AI not configured' };
    }

    messages = this._sanitizeMessages(messages);
    const streamAxios = this._getStreamAxios();

    try {
      const requestBody = {
        model: this.getJsonModel(),
        messages: messages,
        temperature: temperature,
        stream: true
      };
      // 只有明确指定maxTokens时才添加限制
      if (maxTokens != null && maxTokens > 0) {
        requestBody.max_tokens = maxTokens;
      }
      console.log('chatStream 请求:', settings.apiUrl, 'model:', requestBody.model, '消息数:', messages.length);
      const response = await streamAxios.post(
        settings.apiUrl,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 0,
          responseType: 'stream'
        }
      );

      return { success: true, stream: response.data };
    } catch (error) {
      let detail = error.message;
      if (error.response) {
        const status = error.response.status;
        // 429 限流错误 - 给出友好提示
        if (status === 429) {
          detail = 'AI服务繁忙（请求过多），请稍后再试';
        } else {
          // 拦截器已将 stream body 读到 _bodyText
          const bodyStr = error.response._bodyText
            || (typeof error.response.data === 'string' ? error.response.data : '')
            || '无响应体';
          detail = `HTTP ${status}: ${String(bodyStr).slice(0, 500)}`;
        }
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        detail = 'AI接口超时，请稍后再试';
      } else if (error.code === 'ECONNREFUSED') {
        detail = `AI接口连接被拒绝: ${error.address || ''}`;
      }
      console.error('LLM Stream Error:', detail);
      console.error('LLM Stream Error 详情:', JSON.stringify({
        status: error.response ? error.response.status : 'no response',
        bodyText: error.response ? error.response._bodyText : 'N/A',
        code: error.code,
        message: error.message
      }));
      console.error('LLM Stream Error 请求:', settings.apiUrl, 'model:', this.getJsonModel());
      return { success: false, error: detail };
    }
  }

  // 生成病例
  async generateCase(availableMedicines = '', availableExaminations = '', recentCases = [], department = '') {
    const recentCasesLimit = recentCases.slice(0, 500); // 最多500个
    const prompt = `你是一个医学病例生成专家。你的任务是生成一个完整的、真实的门诊病例数据。

【核心要求】
1. 你必须返回一个完整的JSON对象，不能缺少任何字段
2. 所有字段都必须有值，不能为null、空字符串或空数组
3. 返回的必须是纯JSON格式，不能包含任何其他文字说明
4. JSON必须用双引号包围所有字符串，数组用方括号，对象用花括号

【病例要求】
1. 病例应该是常见的门诊疾病，不要太罕见或太严重
2. 患者信息要完整真实，姓名必须是中文姓名（如：张三、李四、王五）
3. 症状描述要详细但自然，至少包含3个症状
4. 系统中可用的药品有：${availableMedicines || '暂无'}
5. 系统中可用的检查有：${availableExaminations || '暂无'}
6. 你推荐的药品和检查必须来自上述列表
${department ? `7. 病例必须属于「${department}」科室的疾病范围` : ''}

${recentCasesLimit.length > 0 ? `【重要】最近已生成的疾病（严禁重复这些疾病！必须生成不同的疾病）：\n${recentCasesLimit.map((c, i) => `${i+1}. ${c}`).join('\n')}` : ''}

【JSON格式要求】
请严格按照以下JSON格式返回，每个字段都不能缺少：

{
  "name": "患者姓名（必须是中文姓名，如：张三、李四、王五）",
  "gender": "男或女（只能选一个）",
  "age": 35（必须是数字，不能是字符串）,
  "symptoms": ["症状1", "症状2", "症状3"]（必须是数组，至少3个症状）,
  "disease": "疾病名称（如：急性胃炎、高血压、糖尿病）",
  "diseaseDescription": "疾病详细描述（至少50字）",
  "medicalHistory": ["既往病史1", "既往病史2"]（必须是数组，至少1个病史）,
  "physicalSigns": {
    "temperature": "36.5",
    "bloodPressure": "120/80",
    "heartRate": "78",
    "breathRate": "18"
  }（必须是对象，包含这4个字段）,
  "treatment": ["治疗方案1", "治疗方案2"]（必须是数组，至少1个方案）,
  "medicines": ["推荐药品1", "推荐药品2"]（必须是数组，至少1个药品）,
  "suggestedExaminations": ["推荐检查1", "推荐检查2"]（必须是数组，至少1个检查）,
  "isReturnVisit": false（必须是布尔值）,
  "previousVisit": null（复诊时为对象，初诊时为null）
}

【验证清单】
返回前请检查：
✓ name字段有中文姓名
✓ symptoms数组至少有3个元素
✓ disease字段有疾病名称
✓ 所有数组字段都是数组格式
✓ physicalSigns是对象格式
✓ 没有缺少任何字段
✓ 是纯JSON，没有其他文字

【示例输出】
{
  "name": "张三",
  "gender": "男",
  "age": 45,
  "symptoms": ["上腹痛", "恶心", "呕吐"],
  "disease": "急性胃炎",
  "diseaseDescription": "患者因饮食不规律导致胃黏膜急性炎症，表现为上腹部疼痛、恶心呕吐等症状。",
  "medicalHistory": ["慢性胃炎病史"],
  "physicalSigns": {
    "temperature": "37.2",
    "bloodPressure": "125/80",
    "heartRate": "82",
    "breathRate": "18"
  },
  "treatment": ["抑酸治疗", "保护胃黏膜"],
  "medicines": ["奥美拉唑肠溶胶囊", "铝碳酸镁片"],
  "suggestedExaminations": ["胃镜检查", "血常规"],
  "isReturnVisit": false,
  "previousVisit": null
}`;

    const messages = [
      { role: 'system', content: '你是一个医学病例生成专家。你必须只返回纯JSON格式的病例数据，不能包含任何其他文字、说明或markdown标记。所有数组字段必须用JSON数组格式，所有字符串必须用双引号包围。JSON必须完整，不能缺少任何字段。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.8);
    if (result.success) {
      try {
        // 尝试清理并解析JSON
        let content = result.content;
        // 移除可能的 markdown 代码块标记
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const parsed = this.safeParseJSON(content, 'generateCase');
        if (parsed) {
          return this.normalizeCaseData(parsed);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成病例（流式版本）
  async generateCaseStream(availableMedicines, availableExaminations, onToken, recentCases = [], department = '') {
    const recentCasesLimit = recentCases.slice(0, 500); // 最多500个
    const prompt = `你是一个医学病例生成专家。你的任务是生成一个完整的、真实的门诊病例数据。

【核心要求】
1. 你必须返回一个完整的JSON对象，不能缺少任何字段
2. 所有字段都必须有值，不能为null、空字符串或空数组
3. 返回的必须是纯JSON格式，不能包含任何其他文字说明
4. JSON必须用双引号包围所有字符串，数组用方括号，对象用花括号

【病例要求】
1. 病例应该是常见的门诊疾病，不要太罕见或太严重
2. 患者信息要完整真实，姓名必须是中文姓名（如：张三、李四、王五）
3. 症状描述要详细但自然，至少包含3个症状
4. 系统中可用的药品有：${availableMedicines || '暂无'}
5. 系统中可用的检查有：${availableExaminations || '暂无'}
6. 你推荐的药品和检查必须来自上述列表
${department ? `7. 病例必须属于「${department}」科室的疾病范围` : ''}

${recentCasesLimit.length > 0 ? `【重要】最近已生成的疾病（严禁重复这些疾病！必须生成不同的疾病）：\n${recentCasesLimit.map((c, i) => `${i+1}. ${c}`).join('\n')}` : ''}

【JSON格式要求】
请严格按照以下JSON格式返回，每个字段都不能缺少：

{
  "name": "患者姓名（必须是中文姓名，如：张三、李四、王五）",
  "gender": "男或女（只能选一个）",
  "age": 35（必须是数字，不能是字符串）,
  "symptoms": ["症状1", "症状2", "症状3"]（必须是数组，至少3个症状）,
  "disease": "疾病名称（如：急性胃炎、高血压、糖尿病）",
  "diseaseDescription": "疾病详细描述（至少50字）",
  "medicalHistory": ["既往病史1", "既往病史2"]（必须是数组，至少1个病史）,
  "physicalSigns": {
    "temperature": "36.5",
    "bloodPressure": "120/80",
    "heartRate": "78",
    "breathRate": "18"
  }（必须是对象，包含这4个字段）,
  "treatment": ["治疗方案1", "治疗方案2"]（必须是数组，至少1个方案）,
  "medicines": ["推荐药品1", "推荐药品2"]（必须是数组，至少1个药品）,
  "suggestedExaminations": ["推荐检查1", "推荐检查2"]（必须是数组，至少1个检查）,
  "isReturnVisit": false（必须是布尔值）,
  "previousVisit": null（复诊时为对象，初诊时为null）
}

【验证清单】
返回前请检查：
✓ name字段有中文姓名
✓ symptoms数组至少有3个元素
✓ disease字段有疾病名称
✓ 所有数组字段都是数组格式
✓ physicalSigns是对象格式
✓ 没有缺少任何字段
✓ 是纯JSON，没有其他文字

【示例输出】
{
  "name": "张三",
  "gender": "男",
  "age": 45,
  "symptoms": ["上腹痛", "恶心", "呕吐"],
  "disease": "急性胃炎",
  "diseaseDescription": "患者因饮食不规律导致胃黏膜急性炎症，表现为上腹部疼痛、恶心呕吐等症状。",
  "medicalHistory": ["慢性胃炎病史"],
  "physicalSigns": {
    "temperature": "37.2",
    "bloodPressure": "125/80",
    "heartRate": "82",
    "breathRate": "18"
  },
  "treatment": ["抑酸治疗", "保护胃黏膜"],
  "medicines": ["奥美拉唑肠溶胶囊", "铝碳酸镁片"],
  "suggestedExaminations": ["胃镜检查", "血常规"],
  "isReturnVisit": false,
  "previousVisit": null
}`;

    const messages = [
      { role: 'system', content: '你是一个医学病例生成专家。你必须只返回纯JSON格式的病例数据，不能包含任何其他文字、说明或markdown标记。所有数组字段必须用JSON数组格式，所有字符串必须用双引号包围。JSON必须完整，不能缺少任何字段。' },
      { role: 'user', content: prompt }
    ];

    const streamResult = await this.chatStream(messages, 0.8, 2000);
    if (!streamResult.success) {
      // 流式失败，回退到非流式调用
      console.log('Stream failed, falling back to non-stream:', streamResult.error);
      const result = await this.chat(messages, 0.8);
      if (result.success) {
        try {
          let content = result.content;
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const parsed = this.safeParseJSON(content, 'generateCase-fallback');
          if (parsed) {
            parsed._usage = result.usage;
            return this.normalizeCaseData(parsed);
          }
        } catch (e) {
          console.error('Parse error in fallback:', e);
        }
      }
      throw new Error(streamResult.error || 'AI接口调用失败');
    }

    let fullContent = '';
    let streamUsage = null;
    const stream = streamResult.stream;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) streamUsage = parsed.usage;
              if (parsed.choices && parsed.choices[0]) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  fullContent += delta.content;
                  const visibleContent = this.cleanThinkingTags(fullContent);
                  if (onToken) onToken(delta.content, visibleContent);
                }
              }
            } catch (e) {
              // SSE流数据可能包含不完整的JSON，忽略解析错误
            }
          }
        }
      });

      stream.on('end', async () => {
        fullContent = this.cleanThinkingTags(fullContent);
        
        // 如果流式没有返回任何内容，回退到非流式
        if (!fullContent || fullContent.trim() === '') {
          console.log('Stream returned empty content, falling back to non-stream');
          try {
            const result = await this.chat(messages, 0.8);
            if (result.success) {
              let content = result.content;
              content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              const parsed = this.safeParseJSON(content, 'generateCase-stream-fallback');
              if (parsed) {
                parsed._usage = result.usage;
                return resolve(this.normalizeCaseData(parsed));
              }
            }
          } catch (e) {
            console.error('Fallback chat failed:', e.message);
          }
        }
        
        try {
          let content = fullContent;
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const parsed = this.safeParseJSON(content, 'generateCase-stream');
          if (parsed) {
            parsed._usage = streamUsage;
            resolve(this.normalizeCaseData(parsed));
          } else {
            // 解析失败，重试（最多2次）
            console.log('AI病例JSON解析失败，准备重试...');
            const retryResult = await this._retryGenerateCase(messages, onToken, 2);
            if (retryResult) {
              resolve(retryResult);
            } else {
              resolve(null);
            }
          }
        } catch (e) {
          console.error('Parse error:', e);
          resolve(null);
        }
      });

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
  }


  // 重试病例生成（非流式，用于流式解析失败后的重试）
  async _retryGenerateCase(messages, onToken, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`病例生成重试 ${attempt}/${maxRetries}...`);
      try {
        const result = await this.chat(messages, 0.8);
        if (result.success) {
          let content = result.content;
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const parsed = this.safeParseJSON(content, `generateCase-retry-${attempt}`);
          if (parsed) {
            parsed._usage = result.usage;
            console.log(`重试第${attempt}次成功`);
            return this.normalizeCaseData(parsed);
          }
        }
      } catch (e) {
        console.error(`重试第${attempt}次失败:`, e.message);
      }
      // 等待1秒再重试
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    console.log(`病例生成重试${maxRetries}次均失败`);
    return null;
  }

  // 生成检查报告
  // 获取检查项目的专项提示词
  getExamSpecificPrompt(examName, bodyPart) {
    // 实验室检查
    const labExams = {
      '血常规': '生成血常规报告。必须包含以下指标及参考值：白细胞计数(WBC 3.5-9.5×10⁹/L)、中性粒细胞百分比(NEUT% 40-75%)、淋巴细胞百分比(LYMPH% 20-50%)、红细胞计数(RBC 男4.3-5.8/女3.8-5.1×10¹²/L)、血红蛋白(HGB 男130-175/女115-150g/L)、血小板计数(PLT 125-350×10⁹/L)、血细胞比容(HCT)、平均红细胞体积(MCV 82-100fL)。每个指标给出实测值、单位、参考范围，异常的用↑或↓标注。',
      '尿常规': '生成尿常规报告。必须包含：尿比重(SG 1.005-1.030)、酸碱度(pH 4.5-8.0)、尿蛋白(PRO 阴性)、尿糖(GLU 阴性)、尿潜血(BLD 阴性)、白细胞(LEU 阴性)、亚硝酸盐(NIT 阴性)、酮体(KET 阴性)、胆红素(BIL 阴性)、尿胆原(URO 正常)。异常用"+"标注。',
      '大便常规': '生成大便常规报告。包含：颜色、性状、隐血试验(OB 阴性)、白细胞、红细胞、寄生虫卵、脂肪球。如做培养则报告致病菌。',
      '肝功能': '生成肝功能报告。必须包含：谷丙转氨酶(ALT 0-40U/L)、谷草转氨酶(AST 0-40U/L)、总胆红素(TBIL 3.4-17.1μmol/L)、直接胆红素(DBIL 0-6.8μmol/L)、间接胆红素(IBIL)、白蛋白(ALB 40-55g/L)、球蛋白(GLB 20-30g/L)、总蛋白(TP 65-85g/L)、γ-谷氨酰转肽酶(GGT 男10-60/女7-45U/L)、碱性磷酸酶(ALP 45-125U/L)。',
      '肾功能': '生成肾功能报告。必须包含：肌酐(Cr 男44-133/女70-106μmol/L)、尿素氮(BUN 2.9-8.2mmol/L)、尿酸(UA 男208-428/女155-357μmol/L)、胱抑素C(CysC 0.51-1.09mg/L)、eGFR(>90ml/min/1.73m²)。',
      '血糖': '生成血糖检测报告。包含：空腹血糖(FPG 3.9-6.1mmol/L)、餐后2小时血糖(2hPG <7.8mmol/L)。如有异常注明。',
      '血脂': '生成血脂报告。必须包含：总胆固醇(TC <5.2mmol/L)、甘油三酯(TG <1.7mmol/L)、高密度脂蛋白(HDL-C >1.0mmol/L)、低密度脂蛋白(LDL-C <3.4mmol/L)、载脂蛋白A1(ApoA1)、载脂蛋白B(ApoB)。',
      '电解质': '生成电解质报告。必须包含：钾(K 3.5-5.3mmol/L)、钠(Na 137-147mmol/L)、氯(Cl 99-110mmol/L)、钙(Ca 2.11-2.52mmol/L)、磷(P 0.85-1.51mmol/L)、镁(Mg 0.75-1.02mmol/L)。',
      '凝血功能': '生成凝血功能报告。必须包含：凝血酶原时间(PT 11-13秒)、国际标准化比值(INR 0.8-1.2)、活化部分凝血活酶时间(APTT 25-35秒)、纤维蛋白原(FIB 2-4g/L)、凝血酶时间(TT 14-21秒)、D-二聚体(<0.5mg/L)。',
      '甲状腺功能': '生成甲状腺功能报告。必须包含：促甲状腺激素(TSH 0.27-4.2mIU/L)、游离T3(FT3 3.1-6.8pmol/L)、游离T4(FT4 12-22pmol/L)、总T3(TT3 1.3-3.1nmol/L)、总T4(TT4 66-181nmol/L)、甲状腺过氧化物酶抗体(TPOAb)、甲状腺球蛋白抗体(TgAb)。',
      '肿瘤标志物': '生成肿瘤标志物报告。根据临床怀疑选择：AFP(<20ng/mL 肝癌)、CEA(<5ng/mL 消化道)、CA199(<37U/mL 胰腺/胆道)、CA125(<35U/mL 卵巢)、CA153(<25U/mL 乳腺)、PSA(<4ng/mL 前列腺)、NSE(<16.3ng/mL 小细胞肺癌)、SCC(<1.5ng/mL 鳞癌)、CYFRA21-1(<3.3ng/mL 非小细胞肺癌)。',
      '心肌酶谱': '生成心肌酶谱报告。必须包含：肌酸激酶(CK 男50-310/女40-200U/L)、肌酸激酶同工酶(CK-MB 0-24U/L)、乳酸脱氢酶(LDH 120-250U/L)、α-羟丁酸脱氢酶(HBDH 72-182U/L)、肌钙蛋白I(cTnI <0.04ng/mL)、肌钙蛋白T(cTnT <0.1ng/mL)。',
      'C反应蛋白': '生成CRP报告。包含：超敏C反应蛋白(hs-CRP 0-10mg/L)。注明是否提示炎症。',
      '降钙素原': '生成PCT报告。包含：降钙素原(PCT <0.05ng/mL正常，0.05-0.5局部感染，0.5-2全身感染，>2脓毒症)。',
      '血沉': '生成血沉报告。包含：红细胞沉降率(ESR 男0-15/女0-20mm/h)。',
      '甲流检测': '生成甲流快速检测报告。包含：甲型流感病毒抗原(阴性/阳性)。如阳性注明病毒分型。',
      '乙流检测': '生成乙流快速检测报告。包含：乙型流感病毒抗原(阴性/阳性)。',
      '新冠检测': '生成新冠检测报告。包含：新冠病毒核酸/抗原(阴性/阳性)，CT值(如阳性)。',
      '支原体检测': '生成支原体检测报告。包含：肺炎支原体核酸(阴性/阳性)、支原体抗体IgM(阴性/阳性)。',
      '糖化血红蛋白': '生成HbA1c报告。包含：糖化血红蛋白(<6%正常，6-6.5%糖尿病前期，≥6.5%糖尿病)。反映近2-3个月血糖水平。',
      '性激素六项': '生成性激素报告。必须包含：促卵泡激素(FSH)、促黄体激素(LH)、雌二醇(E2)、孕酮(P)、睾酮(T)、泌乳素(PRL)。注明月经周期阶段。',
      '胰岛素/C肽': '生成胰岛素和C肽报告。包含空腹及餐后各时间点的胰岛素和C肽水平，评估胰岛功能。',
      'HIV检测': '生成HIV抗体检测报告。包含：HIV-1/2抗体(阴性/阳性)、抗原抗体联合检测。',
      '梅毒检测': '生成梅毒检测报告。包含：梅毒螺旋体特异性抗体(TPPA/TPHA)、非特异性抗体(RPR/VDRL)。',
      '乙肝五项': '生成乙肝五项报告。包含：HBsAg、HBsAb、HBeAg、HBeAb、HBcAb，注明"大三阳"或"小三阳"。',
      '结核检测': '生成结核检测报告。包含：T-SPOT.TB(阴性/阳性)、结核菌素试验(PPD)结果。',
      '血培养': '生成血培养报告。包含：培养结果(阴性/阳性)、致病菌种类、药敏结果。',
      '痰培养': '生成痰培养报告。包含：致病菌培养结果、菌落计数、药敏试验。',
      '幽门螺杆菌检测': '生成幽门螺杆菌报告。包含：C13/C14呼气试验结果(DOB值)，阳性/阴性。参考值：<4阴性。',
      '尿培养': '生成尿培养报告。包含：菌落计数(>10⁵CFU/mL有意义)、致病菌种类、药敏结果。',
      '血气分析': '生成血气分析报告。必须包含：pH(7.35-7.45)、PaO₂(80-100mmHg)、PaCO₂(35-45mmHg)、HCO₃⁻(22-27mmol/L)、BE(-3至+3)、SaO₂(95-99%)、乳酸(<2mmol/L)。判断酸碱平衡类型。',
      'D-二聚体': '生成D-二聚体报告。包含：D-二聚体(<0.5mg/L FEU)。升高提示血栓风险。',
      'BNP/NT-proBNP': '生成BNP报告。包含：BNP(<100pg/mL)或NT-proBNP(<125pg/mL排除心衰，>450/900/1800pg/mL按年龄提示心衰)。',
      '铁蛋白': '生成铁蛋白报告。包含：血清铁蛋白(男30-400/女13-150μg/L)。',
      '维生素D检测': '生成维生素D报告。包含：25-羟基维生素D(<20缺乏，20-30不足，30-100充足，>100过量 ng/mL)。',
      '自身抗体检测': '生成自身抗体报告。包含：ANA(阴性/阳性及滴度)、抗dsDNA抗体、抗ENA抗体谱(抗SSA/SSB/Sm/RNP/Jo-1/Scl-70等)。',
      '过敏原检测': '生成过敏原检测报告。包含：血清特异性IgE检测结果，列出常见过敏原(尘螨、花粉、食物等)的IgE水平和分级(0-6级)。',
      '宫颈涂片': '生成TCT报告。包含：标本满意度、鳞状上皮细胞分析、腺上皮细胞分析、微生物检测、诊断意见(NILM/ASC-US/LSIL/HSIL等)。',
      'HPV检测': '生成HPV检测报告。包含：HPV分型结果，高危型(16/18/31/33/35/39/45/51/52/56/58/59/66/68)和低危型(6/11等)。',
    };

    // 影像学检查
    const imagingExams = {
      'X光检查': `生成X光报告。部位：${bodyPart || '胸部'}。格式：检查方法→影像所见→诊断意见。要求描述具体解剖结构、密度、形态、边缘等特征。`,
      'CT检查': `生成CT报告。部位：${bodyPart || '胸部'}。格式：检查方法(平扫/增强)→影像所见→诊断意见。要求描述密度值(HU)、大小(厘米)、形态、增强特征等。`,
      '增强CT': `生成增强CT报告。部位：${bodyPart || '腹部'}。必须描述：平扫密度、动脉期/门脉期/延迟期强化特征、病灶大小/形态/边界、与周围结构关系。`,
      'MRI检查': `生成MRI报告。部位：${bodyPart || '头部'}。必须描述：T1WI/T2WI/FLAIR/DWI信号特征、增强扫描强化方式、病灶大小/形态/位置。`,
      'B超检查': `生成B超报告。部位：${bodyPart || '腹部'}。必须描述：脏器大小/形态/回声、有无占位/积液/结石、血流信号(如做彩超)。`,
      '心电图': '生成心电图报告。必须包含：心率、心律(窦性/异位)、P波形态、PR间期(0.12-0.20秒)、QRS波群(0.06-0.10秒)、ST段、T波、QT间期、心电轴。诊断意见。',
      '心脏彩超': '生成心脏彩超报告。必须包含：各房室腔大小、室壁厚度及运动、瓣膜形态及启闭、左室射血分数(LVEF >50%)、E/A比值、肺动脉压力。有无心包积液。',
      'PET-CT': `生成PET-CT报告。部位：${bodyPart || '全身'}。必须描述：SUVmax值、代谢活性、病灶位置/大小/数量、分期评估。`,
      '增强MRI': `生成增强MRI报告。部位：${bodyPart || '头部'}。描述增强前后信号变化、强化方式(均匀/环形/结节状)、病灶特征。`,
      '磁共振血管成像': `生成MRA报告。部位：${bodyPart || '颅脑'}。描述血管走行、管腔狭窄/扩张/闭塞、动脉瘤、血管畸形等。`,
      'CT血管造影': `生成CTA报告。部位：${bodyPart || '肺动脉'}。描述血管充盈、管腔狭窄程度(%)、斑块性质、有无血栓/栓塞。`,
      '虚拟内镜': `生成虚拟内镜报告。部位：${bodyPart || '结肠'}。描述管腔内壁、息肉/肿块大小/形态、狭窄等。`,
      '骨扫描': '生成骨扫描报告。描述放射性核素分布、异常浓聚灶位置/数量/强度、SUV值。鉴别转移瘤/骨折/炎症。',
      '泌尿系彩超': '生成泌尿系彩超报告。描述双肾大小/形态/回声、肾盂是否扩张、输尿管是否扩张、膀胱壁厚度、前列腺大小(男性)、残余尿量。',
      '甲状腺彩超': '生成甲状腺彩超报告。描述甲状腺大小/形态/回声、结节位置/大小/形态/边界/回声/钙化、TI-RADS分级(1-5级)、颈部淋巴结。',
      '乳腺彩超': '生成乳腺彩超报告。描述腺体回声、结节位置/大小/形态/边界/血流、BI-RADS分级(1-6级)。',
      '颈动脉彩超': '生成颈动脉彩超报告。描述血管内径、内中膜厚度(IMT <1.0mm正常)、斑块位置/大小/性质(软/硬/混合)、狭窄程度(%)、血流速度。',
      '腹部彩超': '生成腹部彩超报告。描述肝脏大小/形态/回声/血管、胆囊壁厚/结石/息肉、胰腺回声、脾脏大小、双肾大小/回声/结石/囊肿。',
      '骨密度检测': '生成骨密度报告。包含：T值(>-1正常，-1至-2.5骨量减少，<-2.5骨质疏松)、Z值、骨密度值(g/cm²)。',
    };

    // 特殊检查
    const specialExams = {
      '胃镜': '生成胃镜报告。描述：食管黏膜、贲门、胃底、胃体、胃角、胃窦、幽门的黏膜形态。如有病变描述大小/形态/颜色、活检情况。诊断意见。',
      '肠镜': '生成肠镜报告。描述：直肠、乙状结肠、降结肠、横结肠、升结肠、回盲部的黏膜形态。如有息肉/肿块描述大小/形态/蒂部。活检情况。',
      '肺功能': '生成肺功能报告。必须包含：FVC(用力肺活量)、FEV1(第一秒用力呼气量)、FEV1/FVC比值(>70%)、PEF(最大呼气流量)、MVV(最大通气量)。判断通气功能障碍类型(阻塞性/限制性/混合性)。',
      '眼底检查': '生成眼底检查报告。描述：视盘形态/颜色/边界、视网膜血管(动脉/静脉比例)、黄斑区、视网膜。如有病变描述微血管瘤、出血、渗出、新生血管等。',
      '24小时动态心电图': '生成Holter报告。必须包含：总心搏数、平均心率、最快/最慢心率及时间、室性早搏(总数/形态)、室上性早搏、ST段改变(持续时间/幅度)、最长RR间期。',
      '24小时动态血压': '生成动态血压报告。必须包含：24小时平均血压、日间平均血压(<135/85)、夜间平均血压(<120/70)、血压晨峰、血压负荷(>140/90的比例)、杓型/非杓型。',
      '冠脉CT造影': '生成冠脉CTA报告。描述：左主干、前降支、回旋支、右冠状动脉的管腔狭窄程度(轻度<50%/中度50-70%/重度>70%)、斑块性质(钙化/非钙化/混合)。',
      '脑电图': '生成脑电图报告。描述：背景活动(α/β/θ/δ波)、有无痫样放电(棘波/尖波/棘慢复合波)、异常部位(局灶/弥漫)。',
      '肌电图': '生成肌电图报告。描述：静息状态(自发电位)、轻收缩(运动单位电位形态)、重收缩(募集相)、神经传导速度(运动/感觉)。',
      '腰椎穿刺': '生成腰穿脑脊液报告。必须包含：压力(80-180mmH₂O)、外观(无色透明)、细胞数(0-8个/μL)、蛋白(0.15-0.45g/L)、糖(2.5-4.5mmol/L)、氯化物(120-130mmol/L)。',
      '数字减影血管造影': `生成DSA报告。部位：${bodyPart || '颅脑'}。描述血管走行、动脉瘤(大小/形态/颈宽)、血管狭窄/闭塞、动静脉瘘、畸形血管团。`,
      '支气管激发试验': '生成支气管激发/舒张试验报告。包含：基础FEV1、激发后FEV1变化率(阳性标准下降≥20%)、PD20值。',
      '胶囊内镜': '生成胶囊内镜报告。描述：食管、胃、小肠各段黏膜，有无出血/溃疡/息肉/肿块/血管畸形。',
      'ERCP': '生成ERCP报告。描述：十二指肠乳头形态、胆管树显影、胰管显影、有无结石/狭窄/扩张。',
      '尿动力学检查': '生成尿动力学报告。包含：最大尿流率(Qmax >15mL/s)、残余尿量(<50mL)、膀胱容量、逼尿肌压力、尿道压力。',
      '关节镜检查': '生成关节镜报告。描述：关节腔内滑膜、软骨、半月板、韧带形态。如有损伤描述位置/程度/分级。',
      'OCT检查': '生成OCT报告。描述：视网膜各层结构、黄斑区厚度、视网膜神经纤维层(RNFL)厚度、有无水肿/脱离/新生血管。',
      '视野检查': '生成视野检查报告。描述：视野范围、缺损类型(中心/旁中心/弓形/颞侧)、平均缺损(MD)、模式标准差(PSD)。',
      '听力检查': '生成听力检查报告。描述：气导/骨导听阈(各频率250-8000Hz)、听阈曲线类型(正常/传导性/感音神经性/混合性)、听力损失程度(轻/中/重/极重度)。',
      '鼻内镜检查': '生成鼻内镜报告。描述：鼻中隔、下鼻甲、中鼻道、嗅裂、鼻咽部形态。如有病变描述息肉/脓性分泌物/新生物。',
      '皮肤活检': '生成皮肤病理报告。描述：表皮(角化/棘层/基底层)、真皮(血管/胶原/附属器)、炎症细胞浸润类型、有无异型细胞。诊断意见。',
    };

    // 优先匹配
    for (const [key, prompt] of Object.entries(labExams)) {
      if (examName.includes(key)) return prompt;
    }
    for (const [key, prompt] of Object.entries(imagingExams)) {
      if (examName.includes(key)) return prompt;
    }
    for (const [key, prompt] of Object.entries(specialExams)) {
      if (examName.includes(key)) return prompt;
    }

    // 默认
    return `生成${examName}检查报告。根据检查类型描述相关指标、测量值、参考范围和诊断意见。`;
  }

  async generateExaminationDescription(examName, bodyPart, patientInfo, diseaseCase, completedExams = [], options = {}) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase, completedExams, options);

    // 构建检查申请描述
    let examDescription = `【检查申请】${examName}`;
    if (bodyPart) {
      examDescription += `\n【检查部位】${bodyPart}`;
    }

    // 获取疾病信息用于生成更准确的报告
    const diseaseName = diseaseCase ? (() => { const isAI = !!diseaseCase.diseaseDescription || (!!diseaseCase.disease && diseaseCase.disease !== diseaseCase.name); return isAI ? (diseaseCase.disease || diseaseCase.diseaseDescription || '') : (diseaseCase.name || ''); })() : '';
    const symptoms = diseaseCase && diseaseCase.symptoms ? (Array.isArray(diseaseCase.symptoms) ? diseaseCase.symptoms.join('、') : diseaseCase.symptoms) : '';
    const physicalSigns = diseaseCase && diseaseCase.physicalSigns ? JSON.stringify(diseaseCase.physicalSigns) : '';

    // 获取该检查项目的专项提示词
    const examSpecificPrompt = this.getExamSpecificPrompt(examName, bodyPart);

    const messages = [
      { role: 'system', content: `你是一个经验丰富的医学检查报告生成专家。根据患者的疾病、症状和检查项目，生成一份真实、专业、详细的检查报告。

报告格式要求：

【检查数据】
${examSpecificPrompt}
- 异常用↑↓箭头标注
- 数据要与患者疾病相关，数值要合理真实

【专科医生意见】
以"经检验，该患者..."开头。分析检查数据的临床意义，结合患者症状列出可能的诊断（按可能性排序），给出进一步检查或治疗建议。最后注明"本科意见仅供参考，建议结合临床综合判断"。

重要：直接返回报告文本，不要包含JSON格式、markdown标记或其他包装。` },
      { role: 'user', content: `${examDescription}\n${patientContext}\n${diseaseName ? `【初步诊断】${diseaseName}` : ''}\n${symptoms ? `【主要症状】${symptoms}` : ''}\n${physicalSigns ? `【体格检查】${physicalSigns}` : ''}\n\n请直接生成两段式检查报告文本，包含【检查数据】和【专科医生意见】两个部分。` }
    ];

    const result = await this.chat(messages, 0.7);
    if (result.success) {
      try {
        let content = result.content;
        // 清理可能的thinking标签
        content = this.cleanThinkingTags(content);
        // 清理可能的markdown代码块
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        // 尝试解析JSON（兼容旧格式）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              report: parsed.report || content,
              _usage: result.usage || null
            };
          } catch (parseError) {
            // JSON解析失败，直接使用内容
          }
        }
        
        // 直接返回内容作为报告
        return {
          report: content,
          _usage: result.usage || null
        };
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成检查报告描述（流式版本）
  async generateExaminationDescriptionStream(examName, bodyPart, patientInfo, diseaseCase, onToken, completedExams = [], options = {}) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase, completedExams, options);

    // 构建检查申请描述
    let examDescription = `【检查申请】${examName}`;
    if (bodyPart) {
      examDescription += `\n【检查部位】${bodyPart}`;
    }

    // 获取疾病信息用于生成更准确的报告
    const diseaseName = diseaseCase ? (() => { const isAI = !!diseaseCase.diseaseDescription || (!!diseaseCase.disease && diseaseCase.disease !== diseaseCase.name); return isAI ? (diseaseCase.disease || diseaseCase.diseaseDescription || '') : (diseaseCase.name || ''); })() : '';
    const symptoms = diseaseCase && diseaseCase.symptoms ? (Array.isArray(diseaseCase.symptoms) ? diseaseCase.symptoms.join('、') : diseaseCase.symptoms) : '';
    const physicalSigns = diseaseCase && diseaseCase.physicalSigns ? JSON.stringify(diseaseCase.physicalSigns) : '';

    // 获取该检查项目的专项提示词
    const examSpecificPrompt = this.getExamSpecificPrompt(examName, bodyPart);

    const messages = [
      { role: 'system', content: `你是一个经验丰富的医学检查报告生成专家。根据患者的疾病、症状和检查项目，生成一份真实、专业、详细的检查报告。

报告格式要求：

【检查数据】
${examSpecificPrompt}
- 异常用↑↓箭头标注
- 数据要与患者疾病相关，数值要合理真实

【专科医生意见】
以"经检验，该患者..."开头。分析检查数据的临床意义，结合患者症状列出可能的诊断（按可能性排序），给出进一步检查或治疗建议。最后注明"本科意见仅供参考，建议结合临床综合判断"。

重要：直接返回报告文本，不要包含JSON格式、markdown标记或其他包装。` },
      { role: 'user', content: `${examDescription}\n${patientContext}\n${diseaseName ? `【初步诊断】${diseaseName}` : ''}\n${symptoms ? `【主要症状】${symptoms}` : ''}\n${physicalSigns ? `【体格检查】${physicalSigns}` : ''}\n\n请直接生成两段式检查报告文本，包含【检查数据】和【专科医生意见】两个部分。` }
    ];

    const streamResult = await this.chatStream(messages, 0.7, 1500);
    if (!streamResult.success) return null;

    let fullContent = '';
    let streamUsage = null;
    const stream = streamResult.stream;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) streamUsage = parsed.usage;
              if (parsed.choices && parsed.choices[0]) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  fullContent += delta.content;
                  const visibleContent = this.cleanThinkingTags(fullContent);
                  if (onToken) onToken(delta.content, visibleContent);
                }
              }
            } catch (e) {
              // SSE流数据可能包含不完整的JSON，忽略解析错误
            }
          }
        }
      });

      stream.on('end', () => {
        fullContent = this.cleanThinkingTags(fullContent);
        // 清理可能的markdown代码块
        fullContent = fullContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        // 尝试解析JSON（兼容旧格式）
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            resolve({ report: parsed.report || fullContent, _usage: streamUsage });
            return;
          } catch (parseError) {
            // JSON解析失败，直接使用内容
          }
        }
        
        // 直接返回内容作为报告
        resolve({ report: fullContent, _usage: streamUsage });
      });

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
  }

  // 评估诊断
  async evaluateDiagnosis(data) {
    const { correctDiagnosis, userDiagnosis, recommended, userMedicines, userExaminations,
            examinationDetails, completedExams, caseInfo, examinationCosts, prescriptionCosts,
            questionCount, conversationHistory, completedSurgeries } = data;

    const patientInfo = caseInfo ? { name: caseInfo.name, age: caseInfo.age, gender: caseInfo.gender } : {};
    const patientContext = this.buildPatientContextBlock(patientInfo, caseInfo || {}, completedExams, { conversationHistory, completedSurgeries });

    const examList = (completedExams || []).map(e => `${e.typeName || e.type}（${e.bodyPart || ''}）：${e.result || '无结果'}`).join('\n') || '无';
    const examDetailList = (examinationDetails || []).map(e => `${e.typeName}：${e.resultDescription || '无结果'}`).join('\n') || '无';

    const prompt = `${patientContext}

【病例标准答案】
疾病：${correctDiagnosis}
症状：${(caseInfo?.symptoms || []).join('、') || '未知'}
体格检查：${caseInfo?.physicalSigns || '未知'}
推荐治疗：${recommended || caseInfo?.treatment || '无'}
推荐药品：${(caseInfo?.medicines || []).join('、') || '无'}

【学生作答】
学生诊断：${userDiagnosis || '未填写'}
学生用药：${(userMedicines || []).join('、') || '无'}
学生检查：${(userExaminations || []).join('、') || '无'}

【检查结果详情】
${examList !== '无' ? examList : examDetailList}

【费用统计】
检查费用：¥${examinationCosts || 0}
药品费用：¥${prescriptionCosts || 0}
问诊问题数：${questionCount || 0}

请从以下5个维度评分（总分100分），并逐项给出详细评价：

1. 诊断准确性（40分）：
   - 完全正确：40分（诊断名称与正确诊断完全一致或为等价表述）
   - 部分正确：28-39分（诊断方向正确，但不够精确，如只诊断到大类而未细分）
   - 错误但相关：14-27分（诊断与正确诊断有某种关联，如同系统疾病但具体错误）
   - 完全错误：0-13分（诊断方向完全偏离）

2. 检查合理性（15分）：
   - 检查项目选择合理、覆盖必要检查、无过度检查：13-15分
   - 基本合理但有1-2项遗漏或多余：9-12分
   - 检查明显过多或过少：5-8分
   - 检查不合理或完全缺失：0-4分

3. 用药合理性（15分）：
   - 用药对症、类别正确、无明显禁忌：13-15分
   - 基本合理但有小问题（如个别药物可优化）：9-12分
   - 有明显问题（如类别错误、缺少必要药物）：5-8分
   - 用药错误或完全未开药：0-4分

4. 问诊质量（10分）：
   - 问诊全面、围绕主诉展开、鉴别诊断思路清晰：9-10分
   - 基本全面但遗漏部分关键问题：6-8分
   - 有明显遗漏（如未问过敏史、未问既往史）：3-5分
   - 问诊严重不足或跑题：0-2分

5. 手术处理（20分）：
   - 如病例需要手术：完成手术且记录详细（手术经过、术中发现等）：18-20分
   - 完成手术但记录简略：12-17分
   - 应做手术但未做：0-5分
   - 如病例不需要手术：给满分20分

返回严格JSON格式，不要输出任何多余文字：
{
  "score": 总分(0-100整数),
  "scoreBreakdown": {
    "diagnosis": {"score": 分数, "comment": "诊断评价（50-100字，详细分析诊断正确性、思路是否清晰、鉴别诊断是否考虑）"},
    "examination": {"score": 分数, "comment": "检查评价（50-100字，分析检查项目选择是否合理、是否有遗漏或过度、费用是否经济）"},
    "medicine": {"score": 分数, "comment": "用药评价（50-100字，分析药物选择是否对症、剂量是否合理、是否有配伍禁忌、费用是否经济）"},
    "consultation": {"score": 分数, "comment": "问诊评价（50-100字，分析问诊是否全面、是否抓住重点、鉴别诊断思路是否清晰）"},
    "surgery": {"score": 分数, "comment": "手术评价（50-100字，分析手术决策是否正确、操作是否规范、记录是否详细）"}
  },
  "errorPoints": [
    {
      "category": "诊断/检查/用药/问诊/手术",
      "error": "具体描述学生犯了什么错（30-50字）",
      "correct": "正确做法是什么（50-100字，详细解释为什么这样做更合理）"
    }
  ],
  "overallComment": "总体评价（400-500字）：首先肯定学生做得好的方面，然后详细分析主要问题和不足，接着给出具体的改进建议和学习方向，最后给出鼓励和总结。内容要专业、详细、有建设性。",
  "matchType": "exact/partial/keyword/wrong",
  "diagnosisMatch": true或false
}

注意：
- overallComment 必须在400-500字左右，内容要专业详细有建设性
- scoreBreakdown 中每个维度的 comment 要在50-100字，详细分析该维度表现
- errorPoints 数组：只列出学生犯错的地方，做对的不列。如果没有错误则返回空数组
- 每个errorPoint必须明确指出"学生做了什么"和"应该怎么做"，并解释原因
- 分数必须严格在各维度满分范围内
- 只返回JSON，不要有任何其他文字。`;

    const messages = [
      { role: 'system', content: '你是一个医学教育评估专家，只返回JSON格式的评分结果。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.3);
    if (result.success) {
      try {
        let content = result.content;
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // 附加usage信息供前端显示缓存命中率
          parsed._usage = result.usage || null;
          return parsed;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成患者描述（用于问诊开始时的流式输出）
  async generatePatientDescriptionStream(diseaseCase, patientInfo, onToken) {
    const returnVisitHint = diseaseCase.isReturnVisit 
      ? `这是一个复诊病人，上次诊断为"${diseaseCase.previousVisit?.lastDiagnosis}"，已服药${diseaseCase.previousVisit?.lastVisitDays}天。请在描述中提到是复诊，并说明上次诊断和用药情况。`
      : '';

    const patientContext = this.buildPatientContextBlock(
      { name: diseaseCase.name, age: diseaseCase.age, gender: diseaseCase.gender },
      diseaseCase
    );

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以第一人称描述症状。用第一人称描述患者的症状和感受。以"医生您好，我是[姓名]"开头，描述主要症状和不适、症状的持续时间和变化。语气自然、符合患者身份，不要直接说出疾病名称，控制在150字以内。' },
      { role: 'user', content: `${patientContext}\n${returnVisitHint}` }
    ];

    const streamResult = await this.chatStream(messages, 0.8, 500);
    if (!streamResult.success) return null;

    let fullContent = '';
    let streamUsage = null;
    const stream = streamResult.stream;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) streamUsage = parsed.usage;
              if (parsed.choices && parsed.choices[0]) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  fullContent += delta.content;
                  const visibleContent = this.cleanThinkingTags(fullContent);
                  if (onToken) onToken(delta.content, visibleContent);
                }
              }
            } catch (e) {
              // SSE流数据可能包含不完整的JSON，忽略解析错误
            }
          }
        }
      });

      stream.on('end', () => {
        fullContent = this.cleanThinkingTags(fullContent);
        resolve({ description: fullContent, _usage: streamUsage });
      });

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
  }

  // 生成患者描述（非流式）
  async generatePatientDescription(diseaseCase, patientInfo) {
    const returnVisitHint = diseaseCase.isReturnVisit 
      ? `这是一个复诊病人，上次诊断为"${diseaseCase.previousVisit?.lastDiagnosis}"，已服药${diseaseCase.previousVisit?.lastVisitDays}天。请在描述中提到是复诊，并说明上次诊断和用药情况。`
      : '';

    const patientContext = this.buildPatientContextBlock(
      { name: diseaseCase.name, age: diseaseCase.age, gender: diseaseCase.gender },
      diseaseCase
    );

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以第一人称描述症状。用第一人称描述患者的症状和感受。以"医生您好，我是[姓名]"开头，描述主要症状和不适、症状的持续时间和变化。语气自然、符合患者身份，不要直接说出疾病名称，控制在150字以内。' },
      { role: 'user', content: `${patientContext}\n${returnVisitHint}` }
    ];

    const result = await this.chat(messages, 0.8);
    return result.success ? result.content : null;
  }

  // 回答医学问题
  async answerMedicalQuestion(question, caseInfo, patientInfo, diseaseCase, conversationHistory = []) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase);

    // 构建多轮对话消息结构
    const messages = [
      { role: 'system', content: `你是患者角色扮演专家。严格按以下规则回答：
1. 你就是这个患者本人，用第一人称"我"回答
2. 回答必须与你的病历信息一致，不能自相矛盾
3. 紧扣医生的提问来回答，不要答非所问
4. 不要直接说出疾病诊断名称
5. 语气自然口语化，像普通患者看病一样
6. 控制在100字以内

${patientContext}` }
    ];

    // 把对话历史转成多轮消息格式（发送全部历史，过滤空content）
    const recentHistory = conversationHistory.filter(h => h && h.content);
    for (const h of recentHistory) {
      messages.push({
        role: h.role === 'doctor' ? 'user' : 'assistant',
        content: h.content
      });
    }
    messages.push({ role: 'user', content: question || '你好' });

    const result = await this.chat(messages, 0.7);
    return result.success ? result.content : null;
  }

  // 回答医疗问题（流式版本）
  async answerMedicalQuestionStream(question, patientInfo, diseaseCase, conversationHistory = [], onToken = null) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase, [], { conversationHistory });

    // 构建多轮对话消息结构，让LLM有真正的上下文理解
    const messages = [
      { role: 'system', content: `你是患者角色扮演专家。严格按以下规则回答：
1. 你就是这个患者本人，用第一人称"我"回答
2. 回答必须与你的病历信息一致，不能自相矛盾
3. 紧扣医生的提问来回答，不要答非所问
4. 不要直接说出疾病诊断名称
5. 语气自然口语化，像普通患者看病一样
6. 控制在100字以内
7. 如果医生问的内容你不确定，就说"不太清楚"或"记不太清了"

${patientContext}` }
    ];

    // 把对话历史转成多轮消息格式（发送全部历史，过滤空content）
    const recentHistory = conversationHistory.filter(h => h && h.content);
    for (const h of recentHistory) {
      messages.push({
        role: h.role === 'doctor' ? 'user' : 'assistant',
        content: h.content
      });
    }
    // 当前医生的问题
    messages.push({ role: 'user', content: question || '你好' });

    const streamResult = await this.chatStream(messages, 0.7, 1028);
    if (!streamResult.success) throw new Error(streamResult.error || 'AI接口调用失败');

    let fullContent = '';
    const stream = streamResult.stream;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  fullContent += delta.content;
                  const visibleContent = this.cleanThinkingTags(fullContent);
                  if (onToken) onToken(delta.content, visibleContent);
                }
              }
            } catch (e) {
              // SSE流数据可能包含不完整的JSON，忽略解析错误
            }
          }
        }
      });

      stream.on('end', async () => {
        fullContent = this.cleanThinkingTags(fullContent);
        console.log('问诊流式结束, fullContent长度:', fullContent.length, '类型:', typeof fullContent);
        // 流式返回空内容时，回退到非流式调用
        if (!fullContent || fullContent.trim() === '') {
          console.log('问诊流式返回空内容，回退到非流式');
          try {
            const result = await this.chat(messages, 0.7);
            if (result.success && result.content) {
              fullContent = this.cleanThinkingTags(result.content);
            }
          } catch (fallbackErr) {
            console.error('非流式回退也失败:', fallbackErr.message);
          }
        }
        resolve(fullContent);
      });

      stream.on('error', (error) => {
        console.error('Chat stream error:', error);
        reject(error);
      });
    });
  }
}

module.exports = new LLMService();
