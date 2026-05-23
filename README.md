# 医疗问诊模拟器

这是一个医疗问诊练习系统，专门给医学生和医护人员用来练习看病问诊的。

用这个系统可以模拟真实的看病过程：患者来看病，你作为医生进行问诊、开检查、开药，最后系统会给你打分评价。

## 系统能做什么

### 看病问诊

- 系统会自动生成虚拟患者，每个患者有不同的病情
- 你可以用自然语言和患者对话，问患者哪里不舒服
- 患者会根据自己的病情回答你的问题
- 有时候会出现复诊的病人，带着以前的病历来看病

### 做检查

- 系统有100多种检查项目，包括抽血化验、拍片子、B超等
- 可以根据症状或者疾病名称搜索应该做什么检查
- 检查结果会自动生成，包含专业医生的意见

### 开药

- 系统有86种常用药，覆盖各个科室
- 可以根据适应症搜索药品
- 可以开处方，管理处方

### 写病历

- 病历格式和真实医院门诊病历一样
- 包含主诉、现病史、既往史、个人史、家族史、体格检查等
- 检查结果会自动填到病历里
- 打分后会显示详细的评价报告

### 系统打分

- 从4个方面打分：诊断(45分)、检查(20分)、用药(20分)、问诊(15分)
- 会告诉你哪里做得好，哪里需要改进
- 会统计检查花了多少钱，开药花了多少钱
- 会保存你的所有成绩，可以回顾

## 怎么安装使用

### 需要什么环境

- Node.js 18.0 或更高版本
- npm 9.0 或更高版本
- Windows、Mac、Linux 都可以用

### 安装步骤

**第一步：下载代码**

```bash
git clone https://github.com/peterli222/medical-game.git
cd medical-game
```

**第二步：安装依赖**

```bash
cd server
npm install
```

**第三步：配置AI（可选）**

如果想用AI功能（智能生成病例、AI打分等），需要配置AI接口：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的AI接口信息：

```bash
# DeepSeek接口（推荐，便宜好用）
AI_API_URL=https://api.deepseek.com/v1/chat/completions
AI_API_KEY=你的API密钥
AI_MODEL=deepseek-chat

# 或者用OpenAI
# AI_API_URL=https://api.openai.com/v1/chat/completions
# AI_API_KEY=你的API密钥
# AI_MODEL=gpt-4

# 或者用本地AI（Ollama）
# AI_API_URL=http://localhost:11434/v1/chat/completions# AI_API_KEY=ollama
# AI_MODEL=qwen2.5
```

**第四步：启动服务**

```bash
npm start
```

**第五步：打开浏览器**

访问 http://localhost:3003

## 怎么用这个系统

### 开始看病

1. 点击"新患者"按钮，系统会生成一个虚拟患者
2. 患者会告诉你哪里不舒服
3. 你可以问患者问题，了解病情
4. 根据病情开检查单
5. 查看检查结果
6. 写诊断、开处方
7. 点击"完成诊疗"
8. 系统会给你打分，告诉你哪里做得好，哪里需要改进

### 功能按钮说明

- **新患者**：生成新的虚拟患者
- **病历**：查看和编辑病历
- **检查**：开检查单、查看检查结果
- **开药**：开处方
- **完成诊疗**：结束看病，让系统打分
- **提示**：如果你不知道该做什么，可以点这个按钮
- **设置**：配置AI接口

### 配置AI功能

点击右上角的齿轮按钮，可以配置AI功能：

- **AI接口地址**：填写AI服务的网址
- **API密钥**：填写你的密钥
- **模型名称**：填写使用的AI模型
- **测试连接**：测试能不能连上AI服务

配置好后，可以打开这些开关：
- AI生成病例：让AI随机生成各种疾病病例
- AI生成患者描述：让AI扮演患者，用更自然的方式描述病情
- AI生成检查报告：让AI生成更专业的检查报告
- AI智能评分：让AI给你的诊疗过程打分

## 项目结构

```
medical-game/
├── public/                  # 前端文件（网页）
│   ├── index.html          # 主页面
│   ├── app.js              # 主要程序
│   ├── styles.css          # 样式
│   └── medicalRecord.js    # 病历相关程序
│
├── server/                  # 后端文件（服务器）
│   ├── app.js              # 服务器入口
│   ├── package.json        # 依赖配置
│   ├── routes/             # API接口
│   │   ├── patients.js     # 患者相关接口
│   │   ├── examinations.js # 检查相关接口
│   │   ├── medicines.js    # 药品相关接口
│   │   ├── medicalRecords.js # 病历相关接口
│   │   └── settings.js     # 设置相关接口
│   ├── services/           # 业务逻辑
│   │   ├── PatientAgent.js # 患者生成和问诊
│   │   ├── LLMService.js   # AI接口服务
│   │   └── DataStore.js    # 数据存储
│   ├── models/             # 数据模型
│   │   ├── Patient.js      # 患者数据结构
│   │   ├── Examination.js  # 检查数据结构
│   │   ├── Medicine.js     # 药品数据结构
│   │   └── MedicalRecord.js # 病历数据结构
│   └── data/               # 数据文件
│       └── diseaseDatabase.js # 疾病数据库
│
├── .env.example             # 环境变量配置示例
├── .gitignore               # Git忽略规则
├── install.sh               # 自动安装脚本
├── LICENSE                  # MIT许可证
└── README.md                # 本文档
```

## AI接口配置说明

### 推荐使用DeepSeek

DeepSeek是国内的AI服务，价格便宜，速度快，中文效果好。

注册地址：https://platform.deepseek.com

注册后，在API密钥页面创建一个密钥，复制下来填入 `.env` 文件。

价格：大约每100万字1块钱。

### 使用OpenAI

如果你有OpenAI的账号，也可以用GPT-4。

注册地址：https://platform.openai.com

注意：需要科学上网，价格较贵。

### 使用本地AI（Ollama）

如果你想完全免费，可以在自己电脑上跑AI。

1. 安装Ollama：https://ollama.ai
2. 下载模型：`ollama pull qwen2.5`
3. 启动Ollama服务
4. 在 `.env` 里配置：
   ```
   AI_API_URL=http://localhost:11434/v1/chat/completions
   AI_API_KEY=ollama
   AI_MODEL=qwen2.5
   ```

注意：本地AI需要较好的电脑配置，建议至少16G内存。

## 不用AI也能玩

即使不配置AI，这个系统也能正常使用：

- 系统内置了多种常见疾病
- 检查结果会自动生成
- 开药功能完全可用
- 只是不能用AI打分和AI生成病例

## 常见问题

### 问：安装时报错怎么办？

答：检查Node.js版本是不是18以上：
```bash
node --version
```
如果版本太低，去 https://nodejs.org 下载最新版本。

### 问：启动后打不开网页？

答：检查端口3003有没有被占用：
```bash
lsof -i :3003
```
如果被占用，可以改端口，在 `.env` 里加一行：
```
PORT=3004
```

### 问：AI功能不工作？

答：点击设置里的"测试连接"按钮，看看能不能连上AI服务。如果连不上，检查：
1. API地址对不对
2. API密钥对不对
3. 网络能不能访问AI服务

### 问：怎么备份数据？

答：数据文件在 `server/data/` 目录下，直接复制这个文件夹就行。

## 许可证

这个项目使用 MIT 许可证，可以免费使用，也可以修改和分发。

## 联系方式

有问题或者建议，可以在GitHub上提Issue。

项目地址：https://github.com/peterli222/medical-game
