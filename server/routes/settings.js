const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');

// 加密密钥 - 从环境变量或生成固定密钥
const ENCRYPTION_KEY = process.env.MEDICAL_APP_SECRET || crypto.createHash('sha256').update('medical-game-2024-secure-key').digest();
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
      apiKey: maskApiKey(settings.apiKey)
    }
  });
});

// POST /api/settings - Update settings
router.post('/', (req, res) => {
  const { apiUrl, apiKey, model, enabled, generateCases, generateDescriptions, generateExaminations, aiScoring } = req.body;
  const current = readSettings();
  
  // 判断 apiKey 是否是遮罩格式（***xxxx），如果是则保留原值
  let newApiKey = current.apiKey;
  if (apiKey !== undefined) {
    const maskedPattern = /^\*{3}/;
    if (!maskedPattern.test(apiKey)) {
      newApiKey = apiKey.trim();
    }
  }
  
  const updated = {
    ...current,
    ...(apiUrl !== undefined && { apiUrl: apiUrl.trim() }),
    apiKey: newApiKey,
    ...(model !== undefined && { model: model.trim() }),
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
      apiKey: maskApiKey(updated.apiKey) 
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
