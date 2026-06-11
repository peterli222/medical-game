     1|const express = require('express');
     2|const router = express.Router();
     3|const fs = require('fs');
     4|const path = require('path');
     5|const crypto = require('crypto');
     6|
     7|const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');
     8|
     9|// 加密密钥 - 从环境变量或生成固定密钥
    10|const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.MEDICAL_APP_SECRET || 'your-secret-key-here').digest();
    11|const ALGORITHM = 'aes-256-cbc';
    12|
    13|// Default settings - 优先从环境变量读取
    14|const DEFAULT_SETTINGS = {
    15|  apiUrl: process.env.AI_API_URL || '',
    16|  apiKey: process.env.AI_API_KEY || '',
    17|  model: process.env.AI_MODEL || 'deepseek-chat',
    18|  enabled: process.env.AI_ENABLED === 'true',
    19|  generateCases: process.env.AI_GENERATE_CASES !== 'false',
    20|  generateDescriptions: process.env.AI_GENERATE_DESCRIPTIONS !== 'false',
    21|  generateExaminations: process.env.AI_GENERATE_EXAMINATIONS !== 'false',
    22|  aiScoring: process.env.AI_SCORING !== 'false'
    23|};
    24|
    25|// 预设API网关列表
    26|const API_PRESETS = [
    27|  {
    28|    id: 'xinjianya',
    29|    name: '新剑雅网关',
    30|    apiUrl: 'https://new.xinjianya.top/v1/chat/completions',
    31|    apiKey: 'your-api-key-here',
    32|    model: 'glm-5.1',
    33|    description: '默认网关，GLM-5.1中文效果好'
    34|  },
    35|  {
    36|    id: 'local-proxy',
    37|    name: '本地代理',
    38|    apiUrl: 'http://your-server-ip:3000/v1/chat/completions',
    39|    apiKey: 'your-api-key-here',
    40|    model: 'deepseek-chat-fast',
    41|    description: '本地DeepSeek代理'
    42|  },
    43|  {
    44|    id: 'siliconflow-r1',
    45|    name: 'SiliconFlow DeepSeek-R1',
    46|    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    47|    apiKey: 'your-api-key-here',
    48|    model: 'deepseek-ai/DeepSeek-R1',
    49|    description: 'SiliconFlow平台，DeepSeek-R1推理模型'
    50|  },
    51|  {
    52|    id: 'xinjianya-v2',
    53|    name: '新剑雅网关V2',
    54|    apiUrl: 'https://new.xinjianya.top/v1/chat/completions',
    55|    apiKey: 'your-api-key-here',
    56|    model: 'deepseek-chat',
    57|    description: '新剑雅备用网关'
    58|  },
    59|  {
    60|    id: 'sensenova',
    61|    name: 'SenseNova DeepSeek-V4',
    62|    apiUrl: 'https://token.sensenova.cn/v1/chat/completions',
    63|    apiKey: 'your-api-key-here',
    64|    model: 'deepseek-v4-flash',
    65|    description: 'SenseNova平台，DeepSeek-V4-Flash，无限制'
    66|  }
    67|];
    68|
    69|// Ensure data directory exists
    70|function ensureDataDir() {
    71|  const dir = path.dirname(SETTINGS_FILE);
    72|  if (!fs.existsSync(dir)) {
    73|    fs.mkdirSync(dir, { recursive: true });
    74|  }
    75|}
    76|
    77|// 加密函数
    78|function encrypt(text) {
    79|  if (!text) return '';
    80|  try {
    81|    const iv = crypto.randomBytes(16);
    82|    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    83|    let encrypted = cipher.update(text, 'utf8', 'hex');
    84|    encrypted += cipher.final('hex');
    85|    return iv.toString('hex') + ':' + encrypted;
    86|  } catch (e) {
    87|    console.error('Encryption error:', e);
    88|    return text; // 加密失败返回原文
    89|  }
    90|}
    91|
    92|// 解密函数
    93|function decrypt(encryptedText) {
    94|  if (!encryptedText) return '';
    95|  try {
    96|    // 检查是否是加密格式（包含冒号分隔的iv:encrypted）
    97|    if (!encryptedText.includes(':')) {
    98|      return encryptedText; // 非加密格式，直接返回
    99|    }
   100|    const [ivHex, encrypted] = encryptedText.split(':');
   101|    const iv = Buffer.from(ivHex, 'hex');
   102|    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
   103|    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
   104|    decrypted += decipher.final('utf8');
   105|    return decrypted;
   106|  } catch (e) {
   107|    console.error('Decryption error:', e);
   108|    return encryptedText; // 解密失败返回原文
   109|  }
   110|}
   111|
   112|// 遮罩 API key
   113|function maskApiKey(key) {
   114|  if (!key) return '';
   115|  if (key.length <= 8) return '***' + key;
   116|  return '***' + key.slice(-4);
   117|}
   118|
   119|// Read settings
   120|function readSettings() {
   121|  try {
   122|    if (fs.existsSync(SETTINGS_FILE)) {
   123|      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
   124|      const parsed = JSON.parse(data);
   125|      // 解密 apiKey
   126|      if (parsed.apiKey) {
   127|        parsed.apiKey = decrypt(parsed.apiKey);
   128|      }
   129|      return { ...DEFAULT_SETTINGS, ...parsed };
   130|    }
   131|  } catch (e) {
   132|    console.error('Read settings error:', e);
   133|  }
   134|  return { ...DEFAULT_SETTINGS };
   135|}
   136|
   137|// Write settings
   138|function writeSettings(settings) {
   139|  ensureDataDir();
   140|  // 加密 apiKey 后存储
   141|  const toSave = {
   142|    ...settings,
   143|    apiKey: encrypt(settings.apiKey)
   144|  };
   145|  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2));
   146|}
   147|
   148|// GET /api/settings - Get current settings (mask API key)
   149|router.get('/', (req, res) => {
   150|  const settings = readSettings();
   151|  res.json({
   152|    success: true,
   153|    data: {
   154|      ...settings,
   155|      apiKey: maskApiKey(settings.apiKey),
   156|      // 添加当前使用的预设ID（通过apiUrl+apiKey+model精确匹配）
   157|      currentPreset: API_PRESETS.find(p => p.apiUrl === settings.apiUrl && p.apiKey === settings.apiKey && p.model === settings.model)?.id || 'custom'
   158|    }
   159|  });
   160|});
   161|
   162|// GET /api/settings/presets - 获取预设API网关列表
   163|router.get('/presets', (req, res) => {
   164|  const settings = readSettings();
   165|  const currentHostname = settings.apiUrl ? new URL(settings.apiUrl).hostname : '';
   166|  
   167|  const presets = API_PRESETS.map(p => ({
   168|    ...p,
   169|    // 通过apiUrl+apiKey+model精确匹配，避免同域名不同key的误判
   170|    isCurrent: p.apiUrl === settings.apiUrl && p.apiKey === settings.apiKey && p.model === settings.model
   171|  }));
   172|  
   173|  res.json({ success: true, data: presets });
   174|});
   175|
   176|// POST /api/settings - Update settings
   177|router.post('/', (req, res) => {
   178|  const { apiUrl, apiKey, model, enabled, generateCases, generateDescriptions, generateExaminations, aiScoring, presetId } = req.body;
   179|  const current = readSettings();
   180|  
   181|  // 如果指定了预设ID，使用预设的apiUrl、apiKey和model
   182|  let newApiUrl = current.apiUrl;
   183|  let newApiKey = current.apiKey;
   184|  let newModel = current.model;
   185|  if (presetId) {
   186|    const preset = API_PRESETS.find(p => p.id === presetId);
   187|    if (preset) {
   188|      newApiUrl = preset.apiUrl;
   189|      if (preset.apiKey) {
   190|        newApiKey = preset.apiKey;
   191|      }
   192|      if (preset.model) {
   193|        newModel = preset.model;
   194|      }
   195|    }
   196|  } else {
   197|    if (apiUrl !== undefined) {
   198|      newApiUrl = apiUrl.trim();
   199|    }
   200|    if (model !== undefined) {
   201|      newModel = model.trim();
   202|    }
   203|  }
   204|  
   205|  // 判断 apiKey 是否是遮罩格式（***xxxx），如果是则保留原值
   206|  if (apiKey !== undefined && !presetId) {
   207|    const maskedPattern = /^\*{3}/;
   208|    if (!maskedPattern.test(apiKey)) {
   209|      newApiKey = apiKey.trim();
   210|    }
   211|  }
   212|  
   213|  const updated = {
   214|    ...current,
   215|    apiUrl: newApiUrl,
   216|    apiKey: newApiKey,
   217|    model: newModel,
   218|    ...(enabled !== undefined && { enabled: !!enabled }),
   219|    ...(generateCases !== undefined && { generateCases: !!generateCases }),
   220|    ...(generateDescriptions !== undefined && { generateDescriptions: !!generateDescriptions }),
   221|    ...(generateExaminations !== undefined && { generateExaminations: !!generateExaminations }),
   222|    ...(aiScoring !== undefined && { aiScoring: !!aiScoring })
   223|  };
   224|  
   225|  writeSettings(updated);
   226|  res.json({ 
   227|    success: true, 
   228|    message: '设置已保存', 
   229|    data: { 
   230|      ...updated, 
   231|      apiKey: maskApiKey(updated.apiKey),
   232|      currentPreset: API_PRESETS.find(p => p.apiUrl === updated.apiUrl && p.apiKey === updated.apiKey && p.model === updated.model)?.id || 'custom'
   233|    } 
   234|  });
   235|});
   236|
   237|// POST /api/settings/test - Test AI connection
   238|router.post('/test', async (req, res) => {
   239|  const settings = readSettings();
   240|  if (!settings.apiUrl || !settings.apiKey) {
   241|    return res.json({ success: false, message: '请先配置API地址和密钥' });
   242|  }
   243|  
   244|  try {
   245|    const axios = require('axios');
   246|    const response = await axios.post(settings.apiUrl, {
   247|      model: settings.model,
   248|      messages: [{ role: 'user', content: '你好，请回复"连接成功"' }],
   249|      max_tokens: 50,
   250|      stream: false
   251|    }, {
   252|      headers: {
   253|        'Authorization': `Bearer ${settings.apiKey}`,
   254|        'Content-Type': 'application/json'
   255|      },
   256|      timeout: 30000
   257|    });
   258|    
   259|    if (response.data && response.data.choices) {
   260|      res.json({ success: true, message: '连接成功！', model: settings.model });
   261|    } else {
   262|      res.json({ success: false, message: '返回数据格式异常' });
   263|    }
   264|  } catch (error) {
   265|    res.json({ success: false, message: `连接失败: ${error.message}` });
   266|  }
   267|});
   268|
   269|// GET /api/settings/models - List available models
   270|router.get('/models', async (req, res) => {
   271|  const settings = readSettings();
   272|  if (!settings.apiUrl || !settings.apiKey) {
   273|    return res.json({ success: false, message: '请先配置API地址和密钥' });
   274|  }
   275|
   276|  try {
   277|    const axios = require('axios');
   278|    // Convert chat completions URL to models list URL
   279|    let modelsUrl = settings.apiUrl;
   280|    if (modelsUrl.includes('/chat/completions')) {
   281|      modelsUrl = modelsUrl.replace('/chat/completions', '/models');
   282|    } else if (modelsUrl.endsWith('/')) {
   283|      modelsUrl += 'models';
   284|    } else {
   285|      modelsUrl += '/models';
   286|    }
   287|
   288|    const response = await axios.get(modelsUrl, {
   289|      headers: {
   290|        'Authorization': `Bearer ${settings.apiKey}`,
   291|        'Content-Type': 'application/json'
   292|      },
   293|      timeout: 30000
   294|    });
   295|
   296|    if (response.data && response.data.data) {
   297|      // 过滤掉不适合对话的模型（embedding、vision、tts、rerank等）
   298|      const skipKeywords = ['embed', 'rerank', 'tts', 'vl-', 'vision', 'clip', 'safety', 'guard', 'parse', 'translate', 'codegemma', 'codellama', 'starcoder', 'granite-34b-code', 'granite-8b-code', 'deplot', 'recurrentgemma', 'fuyu', 'kosmos', 'nv-embed', 'nvclip', 'sarvam', 'sea-lion', 'zamba', 'ising', 'nemoretriever'];
   299|      const models = response.data.data
   300|        .filter(m => {
   301|          const id = m.id.toLowerCase();
   302|          return !skipKeywords.some(kw => id.includes(kw));
   303|        })
   304|        .map(m => ({ id: m.id, name: m.id }))
   305|        .sort((a, b) => a.id.localeCompare(b.id));
   306|      res.json({ success: true, data: models });
   307|    } else {
   308|      res.json({ success: false, message: '无法获取模型列表' });
   309|    }
   310|  } catch (error) {
   311|    res.json({ success: false, message: `获取模型列表失败: ${error.message}` });
   312|  }
   313|});
   314|
   315|module.exports = router;
   316|