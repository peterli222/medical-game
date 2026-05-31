const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');

// 加密密钥 - 从环境变量或生成固定密钥
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.MEDICAL_APP_SECRET || 'medical-game-2024-secure-key').digest();
const ALGORITHM = 'aes-256-cbc';

// Default settings - 优先从环境变量读取
const DEFAULT_SETTINGS = {
  apiUrl: process.env.AI_API_URL || '',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'deepseek-chat',
  enabled: process.env.AI_ENABLED === 'true',
  generateCases: process.env.AI_GENERATE_CASES !== 'false',
  generateDescriptions: process.env.AI_GENERATE_DESCRIPTIONS !== 'false',
  generateExaminations: process.env.AI_GENERATE_EXAMINATIONS !== 'false',
  aiScoring: process.env.AI_SCORING !== 'false'
};

// 预设API网关列表
const API_PRESETS = [
  {
    id: 'xinjianya',
    name: '新剑雅网关',
    apiUrl: 'https://new.xinjianya.top/v1/chat/completions',
    apiKey: 'sk-DqjWMhaVbsSb8L1Jlxs6ssTwpKQfKS6VWwSUlkkVVictV16z',
    model: 'glm-5.1',
    description: '默认网关，GLM-5.1中文效果好'
  },
  {
    id: 'local-proxy',
    name: '本地代理',
    apiUrl: 'http://117.72.172.112:3000/v1/chat/completions',
    apiKey: 'dsr_l1gDqt2SQ_JOXXw6JYvWwnjSyCG1YW4j',
    model: 'deepseek-chat-fast',
    description: '本地DeepSeek代理'
  },
  {
    id: 'siliconflow-r1',
    name: 'SiliconFlow DeepSeek-R1',
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: 'sk-gedldbwqkutrjwjmrjyrngjhljkbqxcpezpkmbsloxewoktc',
    model: 'deepseek-ai/DeepSeek-R1',
    description: 'SiliconFlow平台，DeepSeek-R1推理模型'
  }
];

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 加密函数
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    console.error('Encryption error:', e);
    return text; // 加密失败返回原文
  }
}

// 解密函数
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    // 检查是否是加密格式（包含冒号分隔的iv:encrypted）
    if (!encryptedText.includes(':')) {
      return encryptedText; // 非加密格式，直接返回
    }
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e);
    return encryptedText; // 解密失败返回原文
  }
}

// 遮罩 API key
function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '***' + key;
  return '***' + key.slice(-4);
}

// Read settings
function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      // 解密 apiKey
      if (parsed.apiKey) {
        parsed.apiKey = decrypt(parsed.apiKey);
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Read settings error:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

// Write settings
function writeSettings(settings) {
  ensureDataDir();
  // 加密 apiKey 后存储
  const toSave = {
    ...settings,
    apiKey: encrypt(settings.apiKey)
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2));
}

// GET /api/settings - Get current settings (mask API key)
router.get('/', (req, res) => {
  const settings = readSettings();
  res.json({
    success: true,
    data: {
      ...settings,
      apiKey: maskApiKey(settings.apiKey),
      // 添加当前使用的预设ID（如果匹配）
      currentPreset: API_PRESETS.find(p => settings.apiUrl && settings.apiUrl.includes(new URL(p.apiUrl).hostname))?.id || 'custom'
    }
  });
});

// GET /api/settings/presets - 获取预设API网关列表
router.get('/presets', (req, res) => {
  const settings = readSettings();
  const currentHostname = settings.apiUrl ? new URL(settings.apiUrl).hostname : '';
  
  const presets = API_PRESETS.map(p => ({
    ...p,
    isCurrent: currentHostname && p.apiUrl.includes(currentHostname)
  }));
  
  res.json({ success: true, data: presets });
});

// POST /api/settings - Update settings
router.post('/', (req, res) => {
  const { apiUrl, apiKey, model, enabled, generateCases, generateDescriptions, generateExaminations, aiScoring, presetId } = req.body;
  const current = readSettings();
  
  // 如果指定了预设ID，使用预设的apiUrl、apiKey和model
  let newApiUrl = current.apiUrl;
  let newApiKey = current.apiKey;
  let newModel = current.model;
  if (presetId) {
    const preset = API_PRESETS.find(p => p.id === presetId);
    if (preset) {
      newApiUrl = preset.apiUrl;
      if (preset.apiKey) {
        newApiKey = preset.apiKey;
      }
      if (preset.model) {
        newModel = preset.model;
      }
    }
  } else if (apiUrl !== undefined) {
    newApiUrl = apiUrl.trim();
  }
  
  // 判断 apiKey 是否是遮罩格式（***xxxx），如果是则保留原值
  if (apiKey !== undefined && !presetId) {
    const maskedPattern = /^\*{3}/;
    if (!maskedPattern.test(apiKey)) {
      newApiKey = apiKey.trim();
    }
  }
  
  const updated = {
    ...current,
    apiUrl: newApiUrl,
    apiKey: newApiKey,
    model: newModel,
    ...(enabled !== undefined && { enabled: !!enabled }),
    ...(generateCases !== undefined && { generateCases: !!generateCases }),
    ...(generateDescriptions !== undefined && { generateDescriptions: !!generateDescriptions }),
    ...(generateExaminations !== undefined && { generateExaminations: !!generateExaminations }),
    ...(aiScoring !== undefined && { aiScoring: !!aiScoring })
  };
  
  writeSettings(updated);
  res.json({ 
    success: true, 
    message: '设置已保存', 
    data: { 
      ...updated, 
      apiKey: maskApiKey(updated.apiKey),
      currentPreset: API_PRESETS.find(p => updated.apiUrl && updated.apiUrl.includes(new URL(p.apiUrl).hostname))?.id || 'custom'
    } 
  });
});

// POST /api/settings/test - Test AI connection
router.post('/test', async (req, res) => {
  const settings = readSettings();
  if (!settings.apiUrl || !settings.apiKey) {
    return res.json({ success: false, message: '请先配置API地址和密钥' });
  }
  
  try {
    const axios = require('axios');
    const response = await axios.post(settings.apiUrl, {
      model: settings.model,
      messages: [{ role: 'user', content: '你好，请回复"连接成功"' }],
      max_tokens: 50,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    if (response.data && response.data.choices) {
      res.json({ success: true, message: '连接成功！', model: settings.model });
    } else {
      res.json({ success: false, message: '返回数据格式异常' });
    }
  } catch (error) {
    res.json({ success: false, message: `连接失败: ${error.message}` });
  }
});

// GET /api/settings/models - List available models
router.get('/models', async (req, res) => {
  const settings = readSettings();
  if (!settings.apiUrl || !settings.apiKey) {
    return res.json({ success: false, message: '请先配置API地址和密钥' });
  }

  try {
    const axios = require('axios');
    // Convert chat completions URL to models list URL
    let modelsUrl = settings.apiUrl;
    if (modelsUrl.includes('/chat/completions')) {
      modelsUrl = modelsUrl.replace('/chat/completions', '/models');
    } else if (modelsUrl.endsWith('/')) {
      modelsUrl += 'models';
    } else {
      modelsUrl += '/models';
    }

    const response = await axios.get(modelsUrl, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    if (response.data && response.data.data) {
      // 过滤掉不适合对话的模型（embedding、vision、tts、rerank等）
      const skipKeywords = ['embed', 'rerank', 'tts', 'vl-', 'vision', 'clip', 'safety', 'guard', 'parse', 'translate', 'codegemma', 'codellama', 'starcoder', 'granite-34b-code', 'granite-8b-code', 'deplot', 'recurrentgemma', 'fuyu', 'kosmos', 'nv-embed', 'nvclip', 'sarvam', 'sea-lion', 'zamba', 'ising', 'nemoretriever'];
      const models = response.data.data
        .filter(m => {
          const id = m.id.toLowerCase();
          return !skipKeywords.some(kw => id.includes(kw));
        })
        .map(m => ({ id: m.id, name: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
      res.json({ success: true, data: models });
    } else {
      res.json({ success: false, message: '无法获取模型列表' });
    }
  } catch (error) {
    res.json({ success: false, message: `获取模型列表失败: ${error.message}` });
  }
});

module.exports = router;
