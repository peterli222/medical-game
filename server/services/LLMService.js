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

  // 规范化AI生成的病例数据（确保类型正确）
  normalizeCaseData(caseData) {
    if (!caseData) return caseData;
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
    if (typeof caseData.physicalSigns === 'string') {
      caseData.physicalSigns = { temperature: '36.5', bloodPressure: '120/80', heartRate: '78', breathRate: '18' };
    }
    return caseData;
  }

  // 构建患者基础信息块（统一格式，放在所有患者相关调用的 user message 最前面，提高 DeepSeek 缓存命中率）
  buildPatientContextBlock(patientInfo, diseaseCase) {
    const parts = [];
    if (patientInfo) {
      if (patientInfo.name) parts.push(`姓名：${patientInfo.name}`);
      if (patientInfo.age) parts.push(`年龄：${patientInfo.age}岁`);
      if (patientInfo.gender) parts.push(`性别：${patientInfo.gender}`);
    }
    if (diseaseCase) {
      // AI生成的病例用disease字段，本地病例用name字段
      const diseaseName = diseaseCase.disease || diseaseCase.name;
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
    }
    return `【患者基础信息】${parts.join(' | ')}`;
  }

  async chat(messages, temperature = 0.7, maxTokens = 1000) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.apiUrl || !settings.apiKey) {
      return { success: false, error: 'AI not configured' };
    }

    try {
      const response = await axios.post(
        settings.apiUrl,
        {
          model: this.getJsonModel(),
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
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

  async chatStream(messages, temperature = 0.7, maxTokens = 2000) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.apiUrl || !settings.apiKey) {
      return { success: false, error: 'AI not configured' };
    }

    try {
      const response = await axios.post(
        settings.apiUrl,
        {
          model: this.getJsonModel(),
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${settings.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000,
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
          try {
            const bodyStr = typeof error.response.data === 'string' 
              ? error.response.data 
              : (Buffer.isBuffer(error.response.data) 
                ? error.response.data.toString('utf8', 0, 200) 
                : JSON.stringify(error.response.data));
            detail = `HTTP ${status}: ${String(bodyStr).slice(0, 200)}`;
          } catch (jsonErr) {
            detail = `HTTP ${status}: 服务器错误`;
          }
        }
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        detail = 'AI接口超时（120秒无响应）';
      } else if (error.code === 'ECONNREFUSED') {
        detail = `AI接口连接被拒绝: ${error.address || ''}`;
      }
      console.error('LLM Stream Error:', detail);
      return { success: false, error: detail };
    }
  }

  // 生成病例
  async generateCase(availableMedicines = '', availableExaminations = '', recentCases = [], department = '') {
    const prompt = `你是一个医学病例生成专家。请生成一个真实的门诊病例。

要求：
1. 病例应该是常见的门诊疾病，不要太罕见或太严重
2. 患者信息要完整真实
3. 症状描述要详细但自然
4. 系统中可用的药品有：${availableMedicines || '暂无'}
5. 系统中可用的检查有：${availableExaminations || '暂无'}
6. 你推荐的药品和检查必须来自上述列表
${department ? `7. 病例必须属于「${department}」科室的疾病范围` : ''}

${recentCases.length > 0 ? `最近已生成的病例，请避免重复：${recentCases.join('、')}` : ''}

请返回 JSON 格式：
{
  "name": "患者姓名（中文）",
  "gender": "男/女",
  "age": 年龄（数字）,
  "symptoms": ["症状1", "症状2", "症状3"],
  "disease": "疾病名称",
  "diseaseDescription": "疾病详细描述",
  "medicalHistory": ["既往病史1", "既往病史2"],
  "physicalSigns": {"temperature": "36.5", "bloodPressure": "120/80", "heartRate": "78", "breathRate": "18"},
  "treatment": ["治疗方案1", "治疗方案2"],
  "medicines": ["推荐药品1", "推荐药品2"],
  "suggestedExaminations": ["推荐检查1", "推荐检查2"],
  "isReturnVisit": false,
  "previousVisit": null
}

重要：symptoms、medicalHistory、treatment、medicines、suggestedExaminations 必须是数组格式！physicalSigns 必须是对象格式！`;

    const messages = [
      { role: 'system', content: '你是一个医学病例生成专家，只返回JSON格式的病例数据。所有数组字段必须用JSON数组格式。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.8, 2000);
    if (result.success) {
      try {
        // 尝试清理并解析JSON
        let content = result.content;
        // 移除可能的 markdown 代码块标记
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        // 尝试提取JSON对象
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return this.normalizeCaseData(JSON.parse(jsonMatch[0]));
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成病例（流式版本）
  async generateCaseStream(availableMedicines, availableExaminations, onToken, recentCases = [], department = '') {
    const prompt = `你是一个医学病例生成专家。请生成一个真实的门诊病例。

要求：
1. 病例应该是常见的门诊疾病，不要太罕见或太严重
2. 患者信息要完整真实
3. 症状描述要详细但自然
4. 系统中可用的药品有：${availableMedicines || '暂无'}
5. 系统中可用的检查有：${availableExaminations || '暂无'}
6. 你推荐的药品和检查必须来自上述列表
${department ? `7. 病例必须属于「${department}」科室的疾病范围` : ''}

${recentCases.length > 0 ? `最近已生成的病例，请避免重复：${recentCases.join('、')}` : ''}

请返回 JSON 格式：
{
  "name": "患者姓名（中文）",
  "gender": "男/女",
  "age": 年龄（数字）,
  "symptoms": ["症状1", "症状2", "症状3"],
  "disease": "疾病名称",
  "diseaseDescription": "疾病详细描述",
  "medicalHistory": ["既往病史1", "既往病史2"],
  "physicalSigns": {"temperature": "36.5", "bloodPressure": "120/80", "heartRate": "78", "breathRate": "18"},
  "treatment": ["治疗方案1", "治疗方案2"],
  "medicines": ["推荐药品1", "推荐药品2"],
  "suggestedExaminations": ["推荐检查1", "推荐检查2"]
}

重要：symptoms、medicalHistory、treatment、medicines、suggestedExaminations 必须是数组格式！physicalSigns 必须是对象格式！`;

    const messages = [
      { role: 'system', content: '你是一个医学病例生成专家，只返回JSON格式的病例数据。所有数组字段必须用JSON数组格式。' },
      { role: 'user', content: prompt }
    ];

    const streamResult = await this.chatStream(messages, 0.8, 2000);
    if (!streamResult.success) {
      // 流式失败，回退到非流式调用
      console.log('Stream failed, falling back to non-stream:', streamResult.error);
      const result = await this.chat(messages, 0.8, 2000);
      if (result.success) {
        try {
          let content = result.content;
          content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
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
            const result = await this.chat(messages, 0.8, 2000);
            if (result.success) {
              let content = result.content;
              content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
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
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            parsed._usage = streamUsage;
            resolve(this.normalizeCaseData(parsed));
          } else {
            resolve(null);
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

  // 生成检查报告
  async generateExaminationDescription(examName, bodyPart, patientInfo, diseaseCase) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase);

    // 构建检查申请描述
    let examDescription = `【检查申请】${examName}`;
    if (bodyPart) {
      examDescription += `\n【检查部位】${bodyPart}`;
    }

    // 获取疾病信息用于生成更准确的报告
    const diseaseName = diseaseCase ? (diseaseCase.disease || diseaseCase.name || '') : '';
    const symptoms = diseaseCase && diseaseCase.symptoms ? (Array.isArray(diseaseCase.symptoms) ? diseaseCase.symptoms.join('、') : diseaseCase.symptoms) : '';
    const physicalSigns = diseaseCase && diseaseCase.physicalSigns ? JSON.stringify(diseaseCase.physicalSigns) : '';

    const messages = [
      { role: 'system', content: '你是一个经验丰富的医学检查报告生成专家。你需要根据患者的疾病、症状和检查项目，生成一份真实、专业、详细的检查报告。\n\n报告格式要求（两段式）：\n\n【检查数据】\n列出该检查项目的客观数据和指标。要求：\n- 包含正常值范围和实际测量值\n- 异常用↑↓箭头标注\n- 数据要与患者疾病相关，不能随意编造\n- 不同检查项目要生成对应的专科数据（如血常规看白细胞/红细胞/血小板，CT看影像密度/大小/形态等）\n\n【专科医生意见】\n以"经检验，该患者..."开头。要求：\n- 分析检查数据的临床意义\n- 结合患者症状，列出"考虑"或"疑似"的诊断（按可能性排序）\n- 给出进一步检查或治疗建议\n- 最后注明"本科意见仅供参考，建议结合临床综合判断"\n\n重要：直接返回报告文本，不要包含JSON格式、markdown标记或其他包装。' },
      { role: 'user', content: `${examDescription}\n${patientContext}\n${diseaseName ? `【初步诊断】${diseaseName}` : ''}\n${symptoms ? `【主要症状】${symptoms}` : ''}\n${physicalSigns ? `【体格检查】${physicalSigns}` : ''}\n\n请直接生成两段式检查报告文本，包含【检查数据】和【专科医生意见】两个部分。` }
    ];

    const result = await this.chat(messages, 0.7, 1500);
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
  async generateExaminationDescriptionStream(examName, bodyPart, patientInfo, diseaseCase, onToken) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase);

    // 构建检查申请描述
    let examDescription = `【检查申请】${examName}`;
    if (bodyPart) {
      examDescription += `\n【检查部位】${bodyPart}`;
    }

    // 获取疾病信息用于生成更准确的报告
    const diseaseName = diseaseCase ? (diseaseCase.disease || diseaseCase.name || '') : '';
    const symptoms = diseaseCase && diseaseCase.symptoms ? (Array.isArray(diseaseCase.symptoms) ? diseaseCase.symptoms.join('、') : diseaseCase.symptoms) : '';
    const physicalSigns = diseaseCase && diseaseCase.physicalSigns ? JSON.stringify(diseaseCase.physicalSigns) : '';

    const messages = [
      { role: 'system', content: '你是一个经验丰富的医学检查报告生成专家。你需要根据患者的疾病、症状和检查项目，生成一份真实、专业、详细的检查报告。\n\n报告格式要求（两段式）：\n\n【检查数据】\n列出该检查项目的客观数据和指标。要求：\n- 包含正常值范围和实际测量值\n- 异常用↑↓箭头标注\n- 数据要与患者疾病相关，不能随意编造\n- 不同检查项目要生成对应的专科数据（如血常规看白细胞/红细胞/血小板，CT看影像密度/大小/形态等）\n\n【专科医生意见】\n以"经检验，该患者..."开头。要求：\n- 分析检查数据的临床意义\n- 结合患者症状，列出"考虑"或"疑似"的诊断（按可能性排序）\n- 给出进一步检查或治疗建议\n- 最后注明"本科意见仅供参考，建议结合临床综合判断"\n\n重要：直接返回报告文本，不要包含JSON格式、markdown标记或其他包装。' },
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
  async evaluateDiagnosis(caseData, userDiagnosis, userData) {
    const patientContext = this.buildPatientContextBlock(
      userData.patientInfo || { name: caseData.name, age: caseData.age, gender: caseData.gender },
      caseData
    );

    const prompt = `${patientContext}

【病例信息】
疾病：${caseData.disease}
症状：${caseData.symptoms}
体格检查：${caseData.physicalSigns}
推荐治疗：${caseData.treatment}
推荐药品：${(caseData.medicines || []).join('、')}

正确诊断：${caseData.disease}
学生诊断：${userDiagnosis}

推荐治疗方案：${caseData.treatment || '无'}
学生用药：${(userData.userMedicines || []).join('、') || '无'}
学生检查：${(userData.userExaminations || []).join('、') || '无'}

检查费用：¥${userData.examinationCosts || 0}
药品费用：¥${userData.prescriptionCosts || 0}
问诊问题数：${userData.questionCount || 0}

【检查结果详情】
${userData.examinationDetails ? userData.examinationDetails.map(e => `${e.typeName}：${e.resultDescription || '无结果'}`).join('\n') : '无'}

【问诊记录】
${caseData.conversationHistory || '无'}

请从以下4个维度评分（总分100分）：

1. 诊断准确性（45分）：
   - 完全正确：45分（诊断名称与正确诊断完全一致）
   - 部分正确：30-44分（诊断方向正确，但不够精确，如只诊断到大类）
   - 错误但相关：15-29分（诊断与正确诊断有某种关联）
   - 完全错误：0-14分

2. 检查合理性（20分）：
   - 检查项目选择合理、覆盖必要检查：18-20分
   - 基本合理但有遗漏：12-17分
   - 检查过多或过少：6-11分
   - 检查不合理：0-5分

3. 用药合理性（20分）：
   - 用药对症、剂量合理：18-20分
   - 基本合理：12-17分
   - 有明显问题：6-11分
   - 用药错误：0-5分

4. 问诊质量（15分）：
   - 问诊全面、重点突出：13-15分
   - 基本全面：8-12分
   - 有遗漏：4-7分
   - 问诊不足：0-3分

返回 JSON 格式（scoreBreakdown中每个维度必须包含score和comment字段）：
{
  "score": 总分,
  "scoreBreakdown": {
    "diagnosis": {"score": 分数, "comment": "诊断点评（30字以内）"},
    "examination": {"score": 分数, "comment": "检查点评（30字以内）"},
    "medicine": {"score": 分数, "comment": "用药点评（30字以内）"},
    "consultation": {"score": 分数, "comment": "问诊点评（30字以内）"}
  },
  "overallComment": "总体评价，包含优点和改进建议（200字以内）",
  "matchType": "exact/partial/keyword/wrong",
  "diagnosisMatch": true/false
}`;

    const messages = [
      { role: 'system', content: '你是一个医学教育评估专家，只返回JSON格式的评分结果。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.3, 1500);
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

    const result = await this.chat(messages, 0.8, 500);
    return result.success ? result.content : null;
  }

  // 回答医学问题
  async answerMedicalQuestion(question, caseInfo, patientInfo, diseaseCase, conversationHistory = []) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase);
    const historyContext = conversationHistory.length > 0 
      ? '\n之前的对话：\n' + conversationHistory.slice(-6).map(h => (h.role === 'doctor' ? '医生' : '患者') + '：' + h.content).join('\n')
      : '';

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以患者身份回答问题。以患者的身份回答，回答要符合病例描述，不要直接说出疾病名称，语气自然、口语化，控制在100字以内。' },
      { role: 'user', content: `${patientContext}${historyContext}\n\n医生问：${question}\n请用第一人称回答。` }
    ];

    const result = await this.chat(messages, 0.7, 300);
    return result.success ? result.content : null;
  }

  // 回答医疗问题（流式版本）
  async answerMedicalQuestionStream(question, patientInfo, diseaseCase, conversationHistory = [], onToken = null) {
    const patientContext = this.buildPatientContextBlock(patientInfo, diseaseCase);
    const historyContext = conversationHistory.length > 0
      ? '\n之前的对话：\n' + conversationHistory.slice(-6).map(h => (h.role === 'doctor' ? '医生' : '患者') + '：' + h.content).join('\n')
      : '';

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以患者身份回答问题。以患者的身份回答，回答要符合病例描述，不要直接说出疾病名称，语气自然、口语化，控制在100字以内。' },
      { role: 'user', content: `${patientContext}${historyContext}\n\n医生问：${question}\n请用第一人称回答。` }
    ];

    const streamResult = await this.chatStream(messages, 0.7, 300);
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

      stream.on('end', () => {
        fullContent = this.cleanThinkingTags(fullContent);
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
