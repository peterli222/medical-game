# 杏林问诊 - 项目文件说明

## 目录结构

```
medical-game-github/
├── README.md                    # 项目说明文档
├── LICENSE                      # MIT 许可证
├── .gitignore                   # Git 忽略文件
├── .env.example                 # 环境变量示例
├── install.sh                   # 安装脚本
├── PROJECT_STRUCTURE.md         # 本文件
│
├── public/                      # 前端文件
│   ├── index.html              # 主页面
│   ├── app.js                  # 前端逻辑（~2400行）
│   ├── styles.css              # 样式文件（~4200行）
│   └── medicalRecord.js        # 病历模块
│
└── server/                      # 后端文件
    ├── app.js                  # 服务器入口
    ├── package.json            # 依赖配置
    │
    ├── routes/                 # API 路由
    │   ├── patients.js         # 患者相关 API
    │   ├── examinations.js     # 检查相关 API
    │   ├── medicines.js        # 药品相关 API
    │   ├── medicalRecords.js   # 病历相关 API
    │   └── settings.js         # 设置 API
    │
    ├── services/               # 业务逻辑
    │   ├── LLMService.js       # AI 服务（支持环境变量配置）
    │   ├── PatientAgent.js     # 患者生成
    │   └── DataStore.js        # 数据存储
    │
    ├── models/                 # 数据模型
    │   ├── Patient.js
    │   ├── Examination.js
    │   ├── Medicine.js
    │   └── MedicalRecord.js
    │
    ├── data/                   # 数据文件
    │   ├── medicines.json      # 药品数据库（86+药品）
    │   ├── examinations.json   # 检查数据库（100+检查）
    │   └── diseaseDatabase.js  # 疾病数据库
    │
    └── scripts/                # 工具脚本
        └── migrate-encrypt.js  # 数据迁移脚本
```

## 核心文件说明

### 前端文件

#### index.html
- 单页面应用入口
- 包含4个标签页：问诊、检查、开药、病历
- 使用 vanilla JavaScript，无框架依赖

#### app.js
- 前端核心逻辑（约2400行）
- 包含：
  - 患者信息管理
  - 问诊对话系统
  - 检查系统（搜索、开具、查看结果）
  - 开药系统（搜索、开具处方）
  - 病历管理（填写、保存、导出）
  - AI 评分显示
  - 流式输出处理

#### styles.css
- 完整的样式文件（约4200行）
- 包含：
  - 响应式布局（支持移动端）
  - 医院风格病历样式
  - 动画效果
  - 深色/浅色主题支持

### 后端文件

#### app.js
- Express 服务器入口
- 加载环境变量（dotenv）
- 配置路由和中间件

#### routes/patients.js
- `/api/patients/new` - 创建新患者
- `/api/patients/new-stream` - 创建新患者（流式）
- `/api/patients/:id/chat` - 患者对话
- `/api/patients/:id/evaluate` - 结束诊疗（评分）

#### routes/examinations.js
- `/api/examinations/search` - 搜索检查项目
- `/api/examinations/disease-search` - 疾病/症状搜索
- `/api/examinations/:id/result` - 获取检查结果

#### routes/medicines.js
- `/api/medicines/search` - 搜索药品
- `/api/medicines/:id` - 获取药品详情

#### services/LLMService.js
- AI 服务核心类
- 支持：
  - 环境变量配置
  - 运行时配置修改
  - API 密钥加密存储
  - 流式输出
  - thinking 标签清理

#### services/PatientAgent.js
- 患者生成服务
- 支持：
  - AI 生成病例
  - 复诊病人（30%概率）
  - 本地 fallback 生成

#### services/DataStore.js
- 内存数据存储
- 存储：患者、检查单、处方
- 服务器重启后数据丢失

## 数据文件

### medicines.json
- 86+ 常用药品
- 包含：药品名称、适应症、价格、用法用量
- 支持同义词搜索

### examinations.json
- 100+ 检查项目
- 包含：检查名称、类别、价格、描述
- 支持疾病/症状搜索

### diseaseDatabase.js
- 疾病数据库
- 包含：疾病名称、别名、症状、推荐检查
- 用于疾病搜索和检查推荐

## 配置说明

### 环境变量

系统支持两种配置方式：

1. **环境变量（推荐）**
   - 在 `.env` 文件中配置
   - 服务器启动时自动加载
   - 适合首次部署

2. **运行时配置**
   - 通过 Web 界面配置
   - 保存到 `server/data/ai-settings.json`
   - 适合动态修改

### 优先级

1. 运行时配置（ai-settings.json）
2. 环境变量（.env）
3. 默认值

## 安全特性

1. **API 密钥加密**
   - 使用 AES-256-CBC 加密
   - 加密密钥可通过 `MEDICAL_APP_SECRET` 配置

2. **密钥遮罩**
   - 前端显示时自动遮罩（如 `***abcd`）

3. **本地存储**
   - 病历数据存储在浏览器 localStorage
   - 不上传服务器

## 部署方式

### 开发环境

```bash
cd server
npm install
npm run dev
```

### 生产环境

```bash
cd server
npm install --production
npm start
```

### Docker 部署

```bash
docker build -t medical-game .
docker run -p 3003:3003 medical-game
```

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 性能优化

1. **流式输出**
   - AI 生成内容使用流式输出
   - 减少用户等待时间

2. **本地缓存**
   - 药品和检查数据缓存
   - 减少 API 请求

3. **防抖搜索**
   - 搜索输入防抖（300ms）
   - 减少服务器压力

## 扩展指南

### 添加新药品

编辑 `server/data/medicines.json`：

```json
{
  "id": "med_new",
  "name": "新药品名称",
  "category": "类别",
  "indications": ["适应症1", "适应症2"],
  "price": 10.0,
  "unit": "盒",
  "dosage": "用法用量"
}
```

### 添加新检查

编辑 `server/data/examinations.json`：

```json
{
  "id": "exam_new",
  "name": "新检查名称",
  "category": "类别",
  "price": 100,
  "description": "检查描述"
}
```

### 添加新疾病

编辑 `server/data/diseaseDatabase.js`：

```javascript
{
  name: '疾病名称',
  alias: ['别名1', '别名2'],
  symptoms: ['症状1', '症状2'],
  exams: ['exam_id1', 'exam_id2']
}
```

## 常见问题

### Q: 如何修改 AI 模型？

A: 两种方式：
1. 修改 `.env` 文件中的 `AI_MODEL`
2. 在 Web 界面设置中修改

### Q: 如何备份数据？

A: 
- 病历数据：浏览器 localStorage（导出功能）
- 配置数据：复制 `server/data/` 目录
- 药品/检查数据：复制对应的 json 文件

### Q: 如何添加新的 AI 提供商？

A: 只要兼容 OpenAI API 格式即可：
1. 在 `.env` 中配置 `AI_API_URL`
2. 配置 `AI_API_KEY`
3. 配置 `AI_MODEL`

### Q: 服务器重启后数据丢失？

A: 是的，DataStore 使用内存存储。病历数据保存在浏览器 localStorage，不会丢失。

## 技术栈

- **前端**: HTML5, CSS3, Vanilla JavaScript
- **后端**: Node.js, Express
- **AI**: DeepSeek / OpenAI / Ollama
- **存储**: 内存 + localStorage

## 许可证

MIT License - 详见 LICENSE 文件
