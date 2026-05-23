const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');

// 加密配置 - 必须与 settings.js 一致
const ENCRYPTION_KEY = process.env.MEDICAL_APP_SECRET || crypto.createHash('sha256').update('medical-game-2024-secure-key').digest();
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
    } catch (e) {}
    
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
      console.error('LLM API Error:', error.message);
      return { success: false, error: error.message };
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
      console.error('LLM Stream Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // 生成病例
  async generateCase(availableMedicines = '', availableExaminations = '', recentCases = []) {
    const prompt = `你是一个医学病例生成专家。请生成一个真实的门诊病例。

要求：
1. 病例应该是常见的门诊疾病，不要太罕见或太严重
2. 患者信息要完整真实
3. 症状描述要详细但自然
4. 系统中可用的药品有：${availableMedicines || '暂无'}
5. 系统中可用的检查有：${availableExaminations || '暂无'}
6. 你推荐的药品和检查必须来自上述列表

${recentCases.length > 0 ? `最近已生成的病例，请避免重复：${recentCases.join('、')}` : ''}

请返回 JSON 格式：
{
  "name": "患者姓名（中文）",
  "gender": "男/女",
  "age": 年龄（数字）,
  "symptoms": "主要症状（简短描述）",
  "disease": "疾病名称",
  "diseaseDescription": "疾病详细描述",
  "medicalHistory": "既往病史",
  "physicalSigns": "体格检查发现",
  "treatment": "推荐治疗方案",
  "medicines": ["推荐药品1", "推荐药品2"],
  "suggestedExaminations": ["推荐检查1", "推荐检查2"],
  "isReturnVisit": false,
  "previousVisit": null
}`;

    const messages = [
      { role: 'system', content: '你是一个医学病例生成专家，只返回JSON格式的病例数据。' },
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
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成检查报告
  async generateExaminationDescription(examName, patientInfo, diseaseCase) {
    const prompt = `你是一个${examName}检查报告生成专家。

患者信息：${patientInfo}
疑似疾病：${diseaseCase}

请生成一份详细的${examName}检查报告，采用两段式格式：

第一段【检查数据】：
- 列出客观的检查数据和指标
- 包含正常值范围和实际测量值
- 标注异常指标

第二段【专科医生意见】：
- 以"经检验，该患者..."开头
- 分析检查数据的临床意义
- 列出"考虑"或"疑似"的诊断（按可能性排序）
- 给出进一步检查或治疗建议
- 最后注明"本科意见仅供参考，建议结合临床综合判断"

返回 JSON 格式：
{
  "report": "完整的两段式检查报告文本"
}`;

    const messages = [
      { role: 'system', content: '你是一个医学检查报告生成专家，只返回JSON格式。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.7, 1500);
    if (result.success) {
      try {
        let content = result.content;
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.report || content;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 评估诊断
  async evaluateDiagnosis(caseData, userDiagnosis, userData) {
    const prompt = `你是一个医学教育评估专家。请评估学生的诊断。

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
   - 完全正确：45分
   - 部分正确：20-30分
   - 错误但相关：10-15分
   - 完全错误：0分

2. 检查合理性（20分）：
   - 检查项目选择合理、覆盖必要检查：18-20分
   - 基本合理但有遗漏：10-15分
   - 检查过多或过少：5-10分
   - 检查不合理：0-5分

3. 用药合理性（20分）：
   - 用药对症、剂量合理：18-20分
   - 基本合理：10-15分
   - 有明显问题：5-10分
   - 用药错误：0-5分

4. 问诊质量（15分）：
   - 问诊全面、重点突出：13-15分
   - 基本全面：8-12分
   - 有遗漏：4-7分
   - 问诊不足：0-3分

返回 JSON 格式：
{
  "score": 总分,
  "scoreBreakdown": {
    "diagnosis": 诊断分数,
    "examination": 检查分数,
    "medicine": 用药分数,
    "consultation": 问诊分数
  },
  "overallComment": "总体评价（150字以内）",
  "matchType": "完全正确/部分正确/诊断错误",
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
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    return null;
  }

  // 生成患者描述（用于问诊开始时的流式输出）
  async generatePatientDescriptionStream(diseaseCase, patientInfo) {
    const returnVisitHint = diseaseCase.isReturnVisit 
      ? `这是一个复诊病人，上次诊断为"${diseaseCase.previousVisit?.lastDiagnosis}"，已服药${diseaseCase.previousVisit?.lastVisitDays}天。请在描述中提到是复诊，并说明上次诊断和用药情况。`
      : '';

    const prompt = `你是一个患者角色扮演专家。请以第一人称描述患者的症状和感受。

患者信息：${patientInfo}
疾病：${diseaseCase.disease}
症状：${diseaseCase.symptoms}
${returnVisitHint}

要求：
1. 以"医生您好，我是[姓名]"开头
2. 描述主要症状和不适
3. 描述症状的持续时间和变化
4. 语气自然、符合患者身份
5. 不要直接说出疾病名称
6. 控制在150字以内`;

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以第一人称描述症状。' },
      { role: 'user', content: prompt }
    ];

    return await this.chatStream(messages, 0.8, 500);
  }

  // 生成患者描述（非流式）
  async generatePatientDescription(diseaseCase, patientInfo) {
    const returnVisitHint = diseaseCase.isReturnVisit 
      ? `这是一个复诊病人，上次诊断为"${diseaseCase.previousVisit?.lastDiagnosis}"，已服药${diseaseCase.previousVisit?.lastVisitDays}天。请在描述中提到是复诊，并说明上次诊断和用药情况。`
      : '';

    const prompt = `你是一个患者角色扮演专家。请以第一人称描述患者的症状和感受。

患者信息：${patientInfo}
疾病：${diseaseCase.disease}
症状：${diseaseCase.symptoms}
${returnVisitHint}

要求：
1. 以"医生您好，我是[姓名]"开头
2. 描述主要症状和不适
3. 描述症状的持续时间和变化
4. 语气自然、符合患者身份
5. 不要直接说出疾病名称
6. 控制在150字以内`;

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以第一人称描述症状。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.8, 500);
    return result.success ? result.content : null;
  }

  // 回答医学问题
  async answerMedicalQuestion(question, caseInfo) {
    const prompt = `你正在扮演一个患者。根据以下病例信息回答医生的问题。

病例信息：${caseInfo}
医生问：${question}

要求：
1. 以患者的身份回答
2. 回答要符合病例描述
3. 不要直接说出疾病名称
4. 语气自然、口语化
5. 控制在100字以内`;

    const messages = [
      { role: 'system', content: '你是一个患者角色扮演专家，以患者身份回答问题。' },
      { role: 'user', content: prompt }
    ];

    const result = await this.chat(messages, 0.7, 300);
    return result.success ? result.content : null;
  }
}

module.exports = new LLMService();
