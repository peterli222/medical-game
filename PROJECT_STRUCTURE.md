# 医疗问诊练习系统 - 文件说明

这个文档告诉你这个项目的文件都是干什么用的。

## 文件夹结构

```
medical-game/
├── README.md                    # 项目说明（你看的这个）
├── LICENSE                      # 许可证（免费用）
├── .gitignore                   # Git忽略文件
├── .env.example                 # 环境变量配置示例
├── install.sh                   # 自动安装脚本
├── PROJECT_STRUCTURE.md         # 本文件（文件说明）
│
├── public/                      # 前端文件（网页部分）
│   ├── index.html              # 主页面
│   ├── app.js                  # 前端程序（控制网页行为）
│   ├── styles.css              # 样式文件（控制网页外观）
│   └── medicalRecord.js        # 病历相关程序
│
└── server/                      # 后端文件（服务器部分）
    ├── app.js                  # 服务器入口（启动服务器）
    ├── package.json            # 依赖配置（需要安装的包）
    │
    ├── routes/                 # API接口（前端调用的接口）
    │   ├── patients.js         # 患者相关接口
    │   ├── examinations.js     # 检查相关接口
    │   ├── medicines.js        # 药品相关接口
    │   ├── medicalRecords.js   # 病历相关接口
    │   └── settings.js         # 设置相关接口
    │
    ├── services/               # 业务逻辑（核心功能）
    │   ├── LLMService.js       # AI接口服务（连接AI）
    │   ├── PatientAgent.js     # 患者生成（创建虚拟患者）
    │   └── DataStore.js        # 数据存储（保存数据）
    │
    ├── models/                 # 数据模型（数据结构定义）
    │   ├── Patient.js          # 患者数据结构
    │   ├── Examination.js      # 检查数据结构
    │   ├── Medicine.js         # 药品数据结构
    │   └── MedicalRecord.js    # 病历数据结构
    │
    ├── data/                   # 数据文件（存储的数据）
    │   └── diseaseDatabase.js  # 疾病数据库
    │
    └── scripts/                # 工具脚本
        └── migrate-encrypt.js  # 数据迁移脚本
```

## 前端文件说明

### index.html - 主页面
这是网页的骨架，定义了页面上有哪些元素：
- 顶部导航栏
- 左边患者信息面板
- 中间聊天问诊区域
- 右边功能面板（检查、开药、病历）
- 各种弹窗（检查单、处方、评分等）

### app.js - 前端程序
这是网页的大脑，控制所有交互行为：
- 创建新患者
- 发送问诊消息
- 开检查单
- 查看检查结果
- 开处方
- 写病历
- 提交评分
- 显示评分结果

大约2400行代码。

### styles.css - 样式文件
这是网页的外观，控制所有元素的样式：
- 颜色
- 字体
- 布局
- 动画
- 响应式设计（手机也能用）

大约4200行代码。

### medicalRecord.js - 病历模块
专门处理病历相关的功能：
- 生成病历模板
- 填充病历数据
- 导出病历

## 后端文件说明

### app.js - 服务器入口
这是服务器的启动文件：
- 创建Express服务器
- 配置中间件
- 注册路由
- 启动监听端口

### routes/ - API接口
这些文件定义了前端可以调用的接口：

**patients.js - 患者接口**
- `GET /api/patients/new` - 创建新患者
- `POST /api/patients/:id/ask` - 问诊（向患者提问）
- `GET /api/patients/:id` - 获取患者信息

**examinations.js - 检查接口**
- `GET /api/examinations/types` - 获取所有检查类型
- `POST /api/examinations/order` - 开检查单
- `GET /api/examinations/:id/result` - 获取检查结果

**medicines.js - 药品接口**
- `GET /api/medicines` - 获取所有药品
- `GET /api/medicines/search` - 搜索药品
- `POST /api/medicines/prescribe` - 开处方

**medicalRecords.js - 病历接口**
- `GET /api/medical-records/:patientId` - 获取病历
- `POST /api/medical-records/:patientId` - 保存病历
- `POST /api/medical-records/:patientId/evaluate` - 提交评分

**settings.js - 设置接口**
- `GET /api/settings` - 获取设置
- `POST /api/settings` - 保存设置
- `POST /api/settings/test` - 测试AI连接

### services/ - 业务逻辑
这些文件包含核心功能：

**LLMService.js - AI接口服务**
负责和AI服务通信：
- 发送请求给AI
- 接收AI回复
- 解析AI返回的数据

支持的AI服务：
- DeepSeek
- OpenAI
- Ollama（本地AI）

**PatientAgent.js - 患者生成**
负责创建虚拟患者：
- 随机选择疾病
- 生成患者基本信息
- 生成症状描述
- 处理问诊对话

**DataStore.js - 数据存储**
负责保存和读取数据：
- 保存患者数据
- 保存检查结果
- 保存处方数据
- 保存评分记录

### models/ - 数据模型
这些文件定义了数据的结构：

**Patient.js - 患者数据**
```javascript
{
  id: "患者ID",
  name: "姓名",
  age: 年龄,
  gender: "性别",
  disease: "疾病",
  symptoms: ["症状1", "症状2"],
  medicalHistory: "病史"
}
```

**Examination.js - 检查数据**
```javascript
{
  id: "检查ID",
  patientId: "患者ID",
  type: "检查类型",
  result: "检查结果",
  cost: 费用
}
```

**Medicine.js - 药品数据**
```javascript
{
  id: "药品ID",
  name: "药品名",
  category: "分类",
  price: 价格,
  indications: ["适应症1", "适应症2"]
}
```

**MedicalRecord.js - 病历数据**
```javascript
{
  patientId: "患者ID",
  chiefComplaint: "主诉",
  presentIllness: "现病史",
  pastHistory: "既往史",
  personalHistory: "个人史",
  familyHistory: "家族史",
  physicalExam: "体格检查",
  auxiliaryExam: "辅助检查",
  diagnosis: "诊断",
  treatment: "治疗方案"
}
```

### data/ - 数据文件
存放系统数据：

**diseaseDatabase.js - 疾病数据库**
包含系统内置的疾病信息：
- 疾病名称
- 症状列表
- 检查结果
- 治疗方案
- 推荐药品

### scripts/ - 工具脚本
**migrate-encrypt.js - 数据迁移脚本**
用于数据迁移和加密。

## 配置文件说明

### .env.example - 环境变量示例
这个文件告诉你怎么配置系统：
- AI接口地址
- API密钥
- 模型名称
- 服务器端口
- 其他配置项

### .gitignore - Git忽略规则
告诉Git哪些文件不需要上传：
- node_modules/（依赖包）
- .env（真实配置文件）
- data/*.json（数据文件）

### install.sh - 安装脚本
自动安装脚本，帮你：
- 检查Node.js版本
- 安装依赖包
- 创建配置文件

### LICENSE - 许可证
MIT许可证，意思是：
- 可以免费用
- 可以修改
- 可以分发
- 出了问题别找我

## 怎么修改代码

### 想加新的检查项目？

编辑 `server/data/diseaseDatabase.js`，在对应疾病里加新的检查。

### 想加新的药品？

编辑 `server/models/Medicine.js`，在 `MEDICINE_DATABASE` 里加新药。

### 想改页面样式？

编辑 `public/styles.css`，修改对应的CSS。

### 想改页面功能？

编辑 `public/app.js`，修改对应的JavaScript。

### 想改后端逻辑？

编辑 `server/services/` 目录下对应的文件。

## 数据存储位置

所有数据都保存在 `server/data/` 目录下：
- `patients.json` - 患者数据
- `examinations.json` - 检查数据
- `prescriptions.json` - 处方数据
- `medical-records.json` - 病历数据
- `scores.json` - 评分数据
- `ai-settings.json` - AI配置（包含密钥，不要上传）

## 技术栈

前端：
- HTML5
- CSS3
- 原生JavaScript（没有用框架）

后端：
- Node.js
- Express
- 文件存储（没有用数据库）

AI：
- 支持OpenAI接口格式
- 支持DeepSeek、OpenAI、Ollama等

## 常见修改需求

**Q: 想改端口号？**
A: 在 `.env` 文件里加 `PORT=3004`

**Q: 想加新疾病？**
A: 编辑 `server/data/diseaseDatabase.js`

**Q: 想加新药品？**
A: 编辑 `server/models/Medicine.js`

**Q: 想改评分标准？**
A: 编辑 `server/services/LLMService.js` 里的 `evaluateDiagnosis` 函数

**Q: 想改患者生成逻辑？**
A: 编辑 `server/services/PatientAgent.js`

**Q: 想改页面布局？**
A: 编辑 `public/index.html` 和 `public/styles.css`
