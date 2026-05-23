# 🏥 杏林问诊 - 医疗问诊模拟系统

一个基于 AI 的医疗问诊模拟平台，专为医学生和医疗培训设计。系统模拟真实医院环境，提供完整的问诊、检查、开药和病历管理流程。

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## ✨ 核心功能

### 🩺 智能问诊系统
- **AI 驱动的患者模拟**：每个患者都有独特的病史、症状和性格
- **自然语言对话**：支持自由问诊，AI 患者会根据病情回答问题
- **复诊病人支持**：30% 概率生成复诊病人，携带历史诊断信息

### 🔬 检查系统
- **100+ 检查项目**：覆盖血常规、影像学、生化检查等
- **疾病/症状搜索**：输入症状或疾病名，自动推荐相关检查
- **智能检查报告**：AI 生成专业的检查报告，包含专科医生意见

### 💊 开药系统
- **86+ 常用药品**：覆盖内科、外科、妇科等各科室
- **适应症搜索**：支持同义词扩展（如"感冒"→"上呼吸道感染"）
- **处方管理**：完整的处方开具、保存和管理功能

### 📋 病历管理
- **医院标准格式**：模仿真实医院门诊病历
- **完整字段**：主诉、现病史、既往史、个人史、家族史、体格检查等
- **自动同步**：检查结果自动同步到病历辅助检查字段
- **评分详情**：AI 评分后显示详细的诊疗评估报告

### 📊 AI 评分系统
- **四维度评分**：诊断(45分)、检查(20分)、用药(20分)、问诊(15分)
- **详细反馈**：分项评分、费用统计、诊断匹配度、总体评价
- **历史记录**：保存所有评分记录，支持回顾和对比

## 🚀 快速开始

### 环境要求

- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本
- **操作系统**: Linux / macOS / Windows

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-username/medical-game.git
cd medical-game
```

#### 2. 安装依赖

```bash
cd server
npm install
```

#### 3. 配置 AI API

复制示例配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置你的 AI API：

```env
# AI API 配置
AI_API_URL=https://api.deepseek.com/v1/chat/completions
AI_API_KEY=your_api_key_here
AI_MODEL=deepseek-chat

# 服务器配置
PORT=3003
HOST=0.0.0.0

# 安全配置（可选）
MEDICAL_APP_SECRET=your_secret_key_here
```

#### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

#### 5. 访问系统

打开浏览器访问：`http://localhost:3003`

## 🔧 API 配置指南

### 支持的 AI 提供商

系统支持任何兼容 OpenAI API 格式的 AI 服务：

#### DeepSeek（推荐）

```env
AI_API_URL=https://api.deepseek.com/v1/chat/completions
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=deepseek-chat
```

#### OpenAI

```env
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=gpt-4
```

#### 本地部署（Ollama）

```env
AI_API_URL=http://localhost:11434/v1/chat/completions
AI_API_KEY=ollama
AI_MODEL=qwen2.5
```

#### 其他兼容服务

```env
AI_API_URL=https://your-api-endpoint.com/v1/chat/completions
AI_API_KEY=your_api_key
AI_MODEL=your_model_name
```

### API 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `AI_API_URL` | API 端点地址 | `https://api.deepseek.com/v1/chat/completions` |
| `AI_API_KEY` | API 密钥 | 无（必填） |
| `AI_MODEL` | 模型名称 | `deepseek-chat` |
| `PORT` | 服务器端口 | `3003` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `MEDICAL_APP_SECRET` | 加密密钥 | 自动生成 |

### 运行时修改 API 配置

系统支持在 Web 界面中动态修改 API 配置：

1. 点击右上角 ⚙️ 设置按钮
2. 输入 API URL、API Key 和模型名称
3. 点击"保存设置"

配置会自动加密保存到 `server/data/ai-settings.json`。

## 📁 项目结构

```
medical-game/
├── public/                    # 前端文件
│   ├── index.html            # 主页面
│   ├── app.js                # 前端逻辑
│   ├── styles.css            # 样式文件
│   └── medicalRecord.js      # 病历模块
├── server/                    # 后端文件
│   ├── routes/               # API 路由
│   │   ├── patients.js       # 患者相关 API
│   │   ├── examinations.js   # 检查相关 API
│   │   ├── medicines.js      # 药品相关 API
│   │   ├── medicalRecords.js # 病历相关 API
│   │   └── settings.js       # 设置 API
│   ├── services/             # 业务逻辑
│   │   ├── LLMService.js     # AI 服务
│   │   ├── PatientAgent.js   # 患者生成
│   │   └── DataStore.js      # 数据存储
│   ├── models/               # 数据模型
│   │   ├── Patient.js
│   │   ├── Examination.js
│   │   ├── Medicine.js
│   │   └── MedicalRecord.js
│   ├── data/                 # 数据文件
│   │   ├── medicines.json    # 药品数据库
│   │   ├── examinations.json # 检查数据库
│   │   └── diseases.json     # 疾病数据库
│   ├── package.json
│   └── server.js             # 服务器入口
├── .env.example              # 环境变量示例
├── .gitignore
├── LICENSE
└── README.md
```

## 🎯 使用指南

### 1. 开始问诊

- 点击右上角"🔄 新患者"按钮
- AI 会生成一个虚拟患者，包含基本信息和症状
- 在问诊标签页与患者对话

### 2. 开具检查

- 切换到"🔬 检查"标签页
- 使用疾病/症状搜索获取推荐检查
- 或手动搜索并添加检查项目
- 查看检查结果（自动同步到病历）

### 3. 开具处方

- 切换到"💊 开药"标签页
- 搜索药品（支持适应症、药品名称）
- 设置用法用量
- 保存处方

### 4. 填写病历

- 切换到"📋 病历"标签页
- 填写完整的门诊病历
- 检查结果会自动同步到"辅助检查"字段

### 5. 结束诊疗

- 点击"✅ 结束诊疗"按钮
- 输入你的诊断
- AI 会给出评分和详细反馈

## 🔌 API 接口文档

### 患者相关

#### 创建新患者
```http
POST /api/patients/new
Content-Type: application/json

{
  "recentCases": ["案例1", "案例2"]
}
```

#### 创建新患者（流式）
```http
POST /api/patients/new-stream
Content-Type: application/json

{
  "recentCases": []
}
```

#### 患者对话
```http
POST /api/patients/:id/chat
Content-Type: application/json

{
  "message": "你哪里不舒服？"
}
```

#### 结束诊疗（评分）
```http
POST /api/patients/:id/evaluate
Content-Type: application/json

{
  "userDiagnosis": "急性上呼吸道感染",
  "examinationCosts": 150,
  "prescriptionCosts": 80,
  "questionCount": 10,
  "userMedicines": ["阿莫西林", "布洛芬"],
  "userExaminations": ["血常规", "胸部X光"],
  "examinationDetails": [...]
}
```

### 检查相关

#### 搜索检查项目
```http
GET /api/examinations/search?q=血常规
```

#### 疾病/症状搜索
```http
GET /api/examinations/disease-search?q=发热咳嗽
```

#### 获取检查结果
```http
GET /api/examinations/:id/result
```

### 药品相关

#### 搜索药品
```http
GET /api/medicines/search?q=感冒
```

#### 获取药品详情
```http
GET /api/medicines/:id
```

### 设置相关

#### 获取设置
```http
GET /api/settings
```

#### 更新设置
```http
POST /api/settings
Content-Type: application/json

{
  "apiUrl": "https://api.deepseek.com/v1/chat/completions",
  "apiKey": "sk-xxxx",
  "model": "deepseek-chat",
  "enabled": true
}
```

## 🛡️ 安全特性

- **API 密钥加密**：所有 API 密钥使用 AES-256-CBC 加密存储
- **密钥遮罩**：前端显示时自动遮罩（如 `***abcd`）
- **本地存储**：病历数据存储在浏览器 localStorage，不上传服务器
- **无数据收集**：系统不收集任何用户数据

## 🎨 自定义配置

### 修改药品数据库

编辑 `server/data/medicines.json`：

```json
{
  "id": "med_001",
  "name": "阿莫西林胶囊",
  "category": "抗生素",
  "indications": ["上呼吸道感染", "泌尿系统感染"],
  "price": 15.5,
  "unit": "盒",
  "dosage": "口服，一次1粒，一日3次"
}
```

### 修改检查数据库

编辑 `server/data/examinations.json`：

```json
{
  "id": "exam_blood",
  "name": "血常规",
  "category": "检验科",
  "price": 25,
  "description": "血常规检查"
}
```

### 修改疾病数据库

编辑 `server/data/diseases.json`：

```json
{
  "name": "急性上呼吸道感染",
  "alias": ["感冒", "上感"],
  "symptoms": ["发热", "咳嗽", "咽痛"],
  "exams": ["exam_blood", "exam_crp"]
}
```

## 🐳 Docker 部署（可选）

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --production

COPY . .

EXPOSE 3003

CMD ["node", "server/server.js"]
```

```bash
docker build -t medical-game .
docker run -p 3003:3003 -v ./data:/app/server/data medical-game
```

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 更新日志

### v1.0.0 (2026-05-23)
- ✨ 初始发布
- 🩺 完整的问诊系统
- 🔬 100+ 检查项目
- 💊 86+ 常用药品
- 📋 医院标准病历格式
- 📊 AI 评分系统
- 🔍 疾病/症状搜索
- 🔄 复诊病人支持

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [DeepSeek](https://deepseek.com/) - 提供 AI API 支持
- [Node.js](https://nodejs.org/) - 运行时环境
- [Express](https://expressjs.com/) - Web 框架
- 所有贡献者和测试人员

## 📞 联系方式

- 问题反馈：[GitHub Issues](https://github.com/your-username/medical-game/issues)
- 邮箱：your-email@example.com

---

**⚕️ 免责声明**：本系统仅用于医疗教育和培训目的，不构成医疗建议。请勿将本系统用于实际医疗诊断或治疗。
