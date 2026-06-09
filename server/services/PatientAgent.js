const Patient = require('../models/Patient');
const { BLOOD_TEST_REFERENCE, EXAMINATION_TYPES } = require('../models/Examination');
const llmService = require('./LLMService');
const { MEDICINE_DATABASE } = require('../models/Medicine');

// 疾病案例库
const DISEASE_CASES = [
  {
    id: 'cold',
    name: '普通感冒',
    symptoms: ['鼻塞', '流涕', '打喷嚏', '咽痛', '轻微咳嗽', '低热', '头痛', '全身乏力'],
    physicalSigns: {
      temperature: '37.5-38.5',
      pulse: '正常或稍快',
      throat: '充血',
      tonsils: '轻度肿大'
    },
    bloodTest: {
      WBC: { trend: 'normal_or_low', range: [3.5, 9.0] },
      NEUT: { trend: 'normal_or_low', range: [45, 65] },
      LYMPH: { trend: 'high', range: [35, 50] }
    },
    ctFindings: '胸部CT未见明显异常',
    treatment: ['对症治疗', '休息', '多饮水'],
    medicines: ['对乙酰氨基酚片', '复方甘草片']
  },
  {
    id: 'flu',
    name: '流行性感冒',
    symptoms: ['高热', '寒战', '头痛', '全身肌肉酸痛', '乏力', '干咳', '咽痛', '流涕'],
    physicalSigns: {
      temperature: '38.5-40.0',
      pulse: '加快',
      face: '潮红',
      respiratory: '呼吸稍快'
    },
    bloodTest: {
      WBC: { trend: 'low', range: [2.5, 6.0] },
      LYMPH: { trend: 'high', range: [40, 60] }
    },
    ctFindings: '胸部CT可见肺纹理稍增粗',
    treatment: ['抗病毒治疗', '对症治疗', '隔离休息'],
    medicines: ['奥司他韦', '对乙酰氨基酚片', '氨溴索片']
  },
  {
    id: 'pneumonia',
    name: '肺炎',
    symptoms: ['发热', '咳嗽', '咳痰', '胸痛', '呼吸困难', '寒战', '乏力'],
    physicalSigns: {
      temperature: '38.0-40.0',
      pulse: '加快',
      respiration: '加快',
      auscultation: '湿啰音'
    },
    bloodTest: {
      WBC: { trend: 'high', range: [10.0, 20.0] },
      NEUT: { trend: 'high', range: [70, 90] },
      NEUT_ABS: { trend: 'high', range: [7.0, 15.0] }
    },
    ctFindings: '胸部CT可见斑片状阴影，边缘模糊，考虑炎性病变',
    treatment: ['抗生素治疗', '祛痰', '支持治疗'],
    medicines: ['头孢克肟片', '左氧氟沙星片', '氨溴索片']
  },
  {
    id: 'bronchitis',
    name: '急性支气管炎',
    symptoms: ['咳嗽', '咳痰', '胸闷', '气促', '低热', '咽痛'],
    physicalSigns: {
      temperature: '37.0-38.5',
      auscultation: '散在干啰音或湿啰音'
    },
    bloodTest: {
      WBC: { trend: 'normal_or_high', range: [6.0, 12.0] },
      NEUT: { trend: 'normal_or_high', range: [55, 75] }
    },
    ctFindings: '胸部CT可见支气管壁增厚，肺纹理增粗',
    treatment: ['抗感染', '止咳祛痰', '对症处理'],
    medicines: ['阿莫西林胶囊', '氨溴索片', '复方甘草片']
  },
  {
    id: 'gastritis',
    name: '急性胃炎',
    symptoms: ['上腹痛', '恶心', '呕吐', '腹胀', '食欲不振', '反酸'],
    physicalSigns: {
      temperature: '正常或低热',
      abdomen: '上腹部压痛'
    },
    bloodTest: {
      WBC: { trend: 'normal_or_high', range: [5.0, 11.0] }
    },
    ctFindings: '腹部CT未见明显异常，建议胃镜检查',
    treatment: ['抑酸', '保护胃黏膜', '清淡饮食'],
    medicines: ['奥美拉唑肠溶胶囊', '铝碳酸镁片']
  },
  {
    id: 'hypertension',
    name: '高血压',
    symptoms: ['头痛', '头晕', '心悸', '胸闷', '视物模糊', '鼻出血'],
    physicalSigns: {
      bloodPressure: '升高，收缩压140-180mmHg',
      heart: '心音亢进'
    },
    bloodTest: {
      RBC: { trend: 'normal', range: [4.0, 5.5] },
      HGB: { trend: 'normal', range: [120, 160] }
    },
    ctFindings: '头颅CT未见明显异常，建议定期监测血压',
    treatment: ['降压治疗', '低盐饮食', '规律作息'],
    medicines: ['氨氯地平片', '美托洛尔片']
  },
  {
    id: 'diabetes',
    name: '2型糖尿病',
    symptoms: ['多饮', '多尿', '多食', '体重下降', '乏力', '视力模糊', '皮肤瘙痒'],
    physicalSigns: {
      weight: '可能下降',
      skin: '干燥'
    },
    bloodTest: {
      WBC: { trend: 'normal', range: [4.0, 10.0] },
      GLU: { trend: 'high', value: '空腹血糖≥7.0mmol/L' }
    },
    ctFindings: '腹部CT可见脂肪肝可能，建议内分泌科随访',
    treatment: ['降糖治疗', '饮食控制', '运动'],
    medicines: ['二甲双胍片', '格列美脲片']
  },
  {
    id: 'anemia',
    name: '缺铁性贫血',
    symptoms: ['乏力', '头晕', '心悸', '面色苍白', '气短', '注意力不集中'],
    physicalSigns: {
      complexion: '苍白',
      conjunctiva: '苍白',
      nails: '反甲可能'
    },
    bloodTest: {
      RBC: { trend: 'low', range: [2.5, 3.8] },
      HGB: { trend: 'low', range: [70, 110] },
      HCT: { trend: 'low', range: [25, 35] },
      MCV: { trend: 'low', range: [70, 82] },
      MCH: { trend: 'low', range: [22, 27] }
    },
    ctFindings: '检查未见明显异常',
    treatment: ['补铁治疗', '查找病因', '饮食调整'],
    medicines: ['琥珀酸亚铁片', '维生素C片']
  },
  {
    id: 'allergy',
    name: '过敏性鼻炎',
    symptoms: ['鼻痒', '打喷嚏', '清水样鼻涕', '鼻塞', '眼痒', '流泪'],
    physicalSigns: {
      nasalMucosa: '苍白水肿',
      discharge: '清水样'
    },
    bloodTest: {
      WBC: { trend: 'normal', range: [4.0, 10.0] },
      EO: { trend: 'high', range: [5, 15] },
      EO_ABS: { trend: 'high', range: [0.3, 0.8] }
    },
    ctFindings: '副鼻窦CT可见鼻窦黏膜轻度增厚',
    treatment: ['抗过敏', '鼻腔冲洗', '避免过敏原'],
    medicines: ['氯雷他定片', '布地奈德鼻喷剂']
  },
  {
    id: 'insomnia',
    name: '失眠症',
    symptoms: ['入睡困难', '睡眠浅', '早醒', '日间疲劳', '注意力不集中', '情绪烦躁'],
    physicalSigns: {
      mentalState: '疲倦',
      darkCircles: '可能有黑眼圈'
    },
    bloodTest: {
      WBC: { trend: 'normal', range: [4.0, 10.0] }
    },
    ctFindings: '头颅CT未见明显异常',
    treatment: ['改善睡眠习惯', '必要时药物治疗', '心理疏导'],
    medicines: ['佐匹克隆片', '阿普唑仑片']
  }
];

class PatientAgent {
  constructor() {
    this.currentCase = null;
    this.conversationHistory = [];
    this.patient = null;
    this.useLLM = true; // 聊天对话使用大模型
  }

  // 确保symptoms是数组
  static ensureSymptomsArray(symptoms) {
    if (typeof symptoms === 'string') {
      return symptoms.split(/[,，、;；\s]+/).filter(s => s.trim());
    }
    return Array.isArray(symptoms) ? symptoms : [];
  }

  // 生成新患者
  generatePatient(recentCases = [], department = '') {
    // Check if AI case generation is enabled
    if (llmService.isEnabled()) {
      return this.generatePatientWithAI(recentCases, department);
    }

    // Fallback: random selection from local cases (filter out recent ones)
    let availableCases = DISEASE_CASES;
    if (recentCases && recentCases.length > 0) {
      availableCases = DISEASE_CASES.filter(c => !recentCases.includes(c.name));
      if (availableCases.length === 0) availableCases = DISEASE_CASES; // fallback if all filtered out
    }
    const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
    this.currentCase = JSON.parse(JSON.stringify(randomCase));
    
    // 判断是否为复诊病人（30%概率）
    const isReturnVisit = Math.random() < 0.3;
    this.currentCase.isReturnVisit = isReturnVisit;
    if (isReturnVisit) {
      this.currentCase.previousVisit = {
        lastDiagnosis: randomCase.name,
        lastVisitDays: Math.floor(Math.random() * 14) + 3,
        chiefComplaint: '症状未完全缓解，前来复诊'
      };
    }

    // 创建患者对象
    this.patient = new Patient();
    
    // 根据疾病设置症状（随机选择3-5个主要症状）
    const symptomsArray = PatientAgent.ensureSymptomsArray(this.currentCase.symptoms);
    const shuffledSymptoms = symptomsArray.sort(() => 0.5 - Math.random());
    this.patient.symptoms = shuffledSymptoms.slice(0, Math.floor(Math.random() * 3) + 3);
    
    // 设置病史
    this.patient.medicalHistory = this.generateMedicalHistory();
    this.patient.allergies = Math.random() > 0.7 ? ['青霉素', '磺胺类药物'][Math.floor(Math.random() * 2)] : [];
    
    return this.patient;
  }

  // 强制本地生成患者（不尝试AI，用于AI失败后的回退）
  _forceLocalGenerate(recentCases = [], department = '') {
    let availableCases = DISEASE_CASES;
    if (recentCases && recentCases.length > 0) {
      availableCases = DISEASE_CASES.filter(c => !recentCases.includes(c.name));
      if (availableCases.length === 0) availableCases = DISEASE_CASES;
    }
    // 如果指定了科室，优先匹配
    if (department) {
      const deptCases = availableCases.filter(c => c.department === department);
      if (deptCases.length > 0) availableCases = deptCases;
    }
    const randomCase = availableCases[Math.floor(Math.random() * availableCases.length)];
    this.currentCase = JSON.parse(JSON.stringify(randomCase));

    const isReturnVisit = Math.random() < 0.3;
    this.currentCase.isReturnVisit = isReturnVisit;
    if (isReturnVisit) {
      this.currentCase.previousVisit = {
        lastDiagnosis: randomCase.name,
        lastVisitDays: Math.floor(Math.random() * 14) + 3,
        chiefComplaint: '症状未完全缓解，前来复诊'
      };
    }

    this.patient = new Patient();
    const symptomsArray = PatientAgent.ensureSymptomsArray(this.currentCase.symptoms);
    const shuffledSymptoms = symptomsArray.sort(() => 0.5 - Math.random());
    this.patient.symptoms = shuffledSymptoms.slice(0, Math.floor(Math.random() * 3) + 3);
    this.patient.medicalHistory = this.generateMedicalHistory();
    this.patient.allergies = Math.random() > 0.7 ? ['青霉素', '磺胺类药物'][Math.floor(Math.random() * 2)] : [];

    return this.patient;
  }

  // Generate patient using AI
  async generatePatientWithAI(recentCases = [], department = '') {
    try {
      // Get available medicine names and indications
      const medicineInfo = [];
      for (const med of MEDICINE_DATABASE) {
        medicineInfo.push(`${med.name}(${med.indications.join('、')})`);
      }
      const availableMedicines = medicineInfo.join('、');

      // Get available examination types
      const examInfo = [];
      for (const [key, exam] of Object.entries(EXAMINATION_TYPES)) {
        examInfo.push(`${exam.name}(${exam.id}, ¥${exam.price})`);
      }
      const availableExaminations = examInfo.join('、');

      const aiCase = await llmService.generateCase(availableMedicines, availableExaminations, recentCases, department);
      if (aiCase) {
        // 确保必需字段存在（AI可能返回部分数据）
        if (!aiCase.name) {
          aiCase.name = '患者' + Math.floor(Math.random() * 1000);
          console.warn('AI病例(非流式)缺少name字段，使用默认值:', aiCase.name);
        }
        if (!aiCase.symptoms || (Array.isArray(aiCase.symptoms) && aiCase.symptoms.length === 0)) {
          aiCase.symptoms = ['不适'];
          console.warn('AI病例(非流式)缺少symptoms字段，使用默认值');
        }
        this.currentCase = aiCase;
        this.patient = new Patient();

        // 判断是否为复诊病人（30%概率）
        const isReturnVisit = Math.random() < 0.3;
        this.currentCase.isReturnVisit = isReturnVisit;
        if (isReturnVisit) {
          // 复诊病人设置前次就诊信息
          this.currentCase.previousVisit = {
            lastDiagnosis: aiCase.name,
            lastVisitDays: Math.floor(Math.random() * 14) + 3, // 3-17天前
            chiefComplaint: '症状未完全缓解，前来复诊'
          };
        }

        // Set symptoms from AI case
        const symptomsArray = PatientAgent.ensureSymptomsArray(aiCase.symptoms);
        const shuffledSymptoms = symptomsArray.sort(() => 0.5 - Math.random());
        this.patient.symptoms = shuffledSymptoms.slice(0, Math.floor(Math.random() * 3) + 3);

        this.patient.medicalHistory = this.generateMedicalHistory();
        this.patient.allergies = Math.random() > 0.7 ? ['青霉素', '磺胺类药物'][Math.floor(Math.random() * 2)] : [];

        return this.patient;
      }
    } catch (error) {
      console.error('AI case generation failed, falling back:', error.message);
    }

    // Fallback to local cases
    const randomCase = DISEASE_CASES[Math.floor(Math.random() * DISEASE_CASES.length)];
    this.currentCase = JSON.parse(JSON.stringify(randomCase));
    // 复诊标记
    const isReturnVisit = Math.random() < 0.3;
    this.currentCase.isReturnVisit = isReturnVisit;
    if (isReturnVisit) {
      this.currentCase.previousVisit = {
        lastDiagnosis: randomCase.name,
        lastVisitDays: Math.floor(Math.random() * 14) + 3,
        chiefComplaint: '症状未完全缓解，前来复诊'
      };
    }
    this.patient = new Patient();
    const symptomsArray = PatientAgent.ensureSymptomsArray(this.currentCase.symptoms);
    const shuffledSymptoms = symptomsArray.sort(() => 0.5 - Math.random());
    this.patient.symptoms = shuffledSymptoms.slice(0, Math.floor(Math.random() * 3) + 3);
    this.patient.medicalHistory = this.generateMedicalHistory();
    this.patient.allergies = Math.random() > 0.7 ? ['青霉素', '磺胺类药物'][Math.floor(Math.random() * 2)] : [];
    return this.patient;
  }

  generateMedicalHistory() {
    const histories = ['无特殊病史', '高血压病史', '糖尿病病史', '慢性胃炎', '过敏性鼻炎', '哮喘病史'];
    const selected = [];
    if (Math.random() > 0.3) {
      selected.push(histories[Math.floor(Math.random() * histories.length)]);
    }
    return selected;
  }

  // 获取患者初始描述（使用本地生成，不调用LLM）
  async getInitialDescription() {
    if (!this.patient || !this.currentCase) {
      return '医生您好，我是来看病的。';
    }

    // Try AI description first when AI is enabled
    if (llmService.isEnabled()) {
      try {
        const aiDescription = await llmService.generatePatientDescription(this.patient, this.currentCase);
        if (aiDescription) return aiDescription;
      } catch (error) {
        console.error('AI description failed, using fallback:', error.message);
      }
    }

    return this.getFallbackDescription();
  }

  getFallbackDescription() {
    const isReturnVisit = this.currentCase && this.currentCase.isReturnVisit;
    const prevVisit = this.currentCase && this.currentCase.previousVisit;
    const days = prevVisit ? prevVisit.lastVisitDays : Math.floor(Math.random() * 5) + 2;

    if (isReturnVisit && prevVisit) {
      const returnDescriptions = [
        `医生您好，我是${this.patient.name}，${this.patient.age}岁。我${days}天前来过，当时诊断的是${prevVisit.lastDiagnosis}，吃了药感觉好了一些，但${this.patient.symptoms[0]}还没完全好，今天来复诊。`,
        `您好医生，我是来复诊的。上次来看过${prevVisit.lastDiagnosis}，开了药吃了${days}天，现在还有${this.patient.symptoms.slice(0, 2).join('、')}的情况。`,
        `医生好，我是复诊病人。${days}天前在您这看过${prevVisit.lastDiagnosis}，药快吃完了，${this.patient.symptoms[0]}比之前好一些但还是有，想再看看。`,
        `医生您好，我是${this.patient.name}，之前来看过${prevVisit.lastDiagnosis}。吃了${days}天药了，${this.patient.symptoms.slice(0, 2).join('、')}还有一点，来复查一下。`
      ];
      return returnDescriptions[Math.floor(Math.random() * returnDescriptions.length)];
    }

    const descriptions = [
      `医生您好，我是${this.patient.name}，${this.patient.age}岁。我最近${this.patient.symptoms.slice(0, 2).join('、')}，已经持续${days}天了。`,
      `您好，我${this.patient.age}岁，最近感觉${this.patient.symptoms[0]}，还有${this.patient.symptoms.slice(1, 3).join('、')}的情况。`,
      `医生，我最近身体不太舒服，主要是${this.patient.symptoms.join('、')}，想来看看是什么问题。`
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  // 回答医生问诊（使用大模型）
  async answerQuestion(question) {
    if (!this.currentCase || !this.patient) {
      return { error: '尚未生成患者' };
    }

    let answer = '';

    if (this.useLLM) {
      try {
        answer = await llmService.answerMedicalQuestion(
          question,
          this.patient,
          this.currentCase,
          this.conversationHistory
        );
      } catch (error) {
        console.error('LLM回答问题失败:', error);
        answer = this.getFallbackAnswer(question);
      }
    } else {
      answer = this.getFallbackAnswer(question);
    }

    // 记录对话历史
    this.conversationHistory.push({
      role: 'doctor',
      content: question,
      timestamp: new Date().toISOString()
    });
    this.conversationHistory.push({
      role: 'patient',
      content: answer,
      timestamp: new Date().toISOString()
    });

    return { answer, history: this.conversationHistory };
  }

  getFallbackAnswer(question) {
    const question_lower = question.toLowerCase();

    if (question_lower.includes('做') || question_lower.includes('检查') || 
        question_lower.includes('血常规') || question_lower.includes('ct') || 
        question_lower.includes('b超') || question_lower.includes('x光') ||
        question_lower.includes('化验') || question_lower.includes('检验')) {
      return '好的。';
    }
    
    if (question_lower.includes('症状') || question_lower.includes('不舒服') || question_lower.includes('哪里')) {
      return this.currentCase.symptoms.slice(0, 3).join('、') + (this.currentCase.symptoms.length > 3 ? '，还有其他症状。' : '。');
    }
    
    if (question_lower.includes('多久') || question_lower.includes('时间') || question_lower.includes('几天')) {
      const days = Math.floor(Math.random() * 5) + 2;
      return `${days}天。`;
    }
    
    if (question_lower.includes('疼') || question_lower.includes('痛')) {
      const painDescriptions = ['隐痛', '疼痛明显', '阵发性疼痛', '持续疼痛'];
      return painDescriptions[Math.floor(Math.random() * painDescriptions.length)] + '。';
    }
    
    if (question_lower.includes('发烧') || question_lower.includes('发热') || question_lower.includes('体温')) {
      return this.currentCase.physicalSigns.temperature ? 
        `体温${this.currentCase.physicalSigns.temperature}℃。` : '体温正常。';
    }
    
    if (question_lower.includes('以前') || question_lower.includes('病史') || question_lower.includes('得过')) {
      return Math.random() > 0.5 ? '无特殊病史。' : '有高血压病史。';
    }
    
    if (question_lower.includes('药') || question_lower.includes('吃过')) {
      return '自行服用过感冒药，效果不佳。';
    }
    
    if (question_lower.includes('过敏')) {
      return Math.random() > 0.7 ? '对青霉素过敏。' : '无药物过敏史。';
    }
    
    if (question_lower.includes('吃饭') || question_lower.includes('饮食') || question_lower.includes('睡眠')) {
      return '食欲差，睡眠不佳。';
    }
    
    if (question_lower.includes('大便') || question_lower.includes('小便') || question_lower.includes('排便')) {
      return '大小便正常。';
    }
    
    const defaultAnswers = ['不清楚。', '无此症状。', '没有。', '如上述。'];
    return defaultAnswers[Math.floor(Math.random() * defaultAnswers.length)];
  }

  // 生成检查结果
  generateExaminationResult(examinationType, bodyPart = null, patientGender = '男') {
    if (!this.currentCase) {
      return { error: '尚未生成患者' };
    }

    switch (examinationType) {
      case 'blood_routine':
        return this.generateBloodTestResult(patientGender);
      case 'ct_scan':
        return this.generateCTResult(bodyPart);
      case 'x_ray':
        return this.generateXRayResult(bodyPart);
      case 'ultrasound':
        return this.generateUltrasoundResult(bodyPart);
      case 'crp':
        return this.generateCRPResult();
      case 'flu_a':
        return this.generateVirusResult('甲流');
      case 'flu_b':
        return this.generateVirusResult('乙流');
      case 'covid_19':
        return this.generateVirusResult('新冠');
      case 'mycoplasma':
        return this.generateVirusResult('支原体');
      default:
        return { description: '检查结果正常。' };
    }
  }

  // 生成血常规结果
  generateBloodTestResult(gender) {
    const results = {};
    const caseBloodTest = this.currentCase.bloodTest || {};

    for (const [key, ref] of Object.entries(BLOOD_TEST_REFERENCE)) {
      let value;
      let isAbnormal = false;
      let abnormalDirection = '';

      // 根据疾病案例调整数值
      if (caseBloodTest[key]) {
        const caseRef = caseBloodTest[key];
        if (caseRef.range) {
          value = this.randomInRange(caseRef.range[0], caseRef.range[1]);
        } else if (caseRef.value) {
          value = caseRef.value;
        }
      } else {
        // 正常范围内随机
        let min, max;
        if (ref.minMale !== undefined) {
          min = gender === '男' ? ref.minMale : ref.minFemale;
          max = gender === '男' ? ref.maxMale : ref.maxFemale;
        } else {
          min = ref.min;
          max = ref.max;
        }
        value = this.randomInRange(min, max);
      }

      // 添加一些随机波动
      if (typeof value === 'number') {
        value = parseFloat(value.toFixed(2));
        
        // 判断是否在正常范围
        let min, max;
        if (ref.minMale !== undefined) {
          min = gender === '男' ? ref.minMale : ref.minFemale;
          max = gender === '男' ? ref.maxMale : ref.maxFemale;
        } else {
          min = ref.min;
          max = ref.max;
        }
        
        if (value < min) {
          isAbnormal = true;
          abnormalDirection = '偏低';
        } else if (value > max) {
          isAbnormal = true;
          abnormalDirection = '偏高';
        }
      }

      results[key] = {
        name: ref.name,
        value: value,
        unit: ref.unit,
        reference: this.getReferenceString(ref, gender),
        isAbnormal,
        abnormalDirection
      };
    }

    return {
      type: 'blood_routine',
      description: '血常规检查结果',
      items: results,
      summary: this.generateBloodTestSummary(results)
    };
  }

  getReferenceString(ref, gender) {
    if (ref.minMale !== undefined) {
      if (gender === '男') {
        return `${ref.minMale}-${ref.maxMale}`;
      } else {
        return `${ref.minFemale}-${ref.maxFemale}`;
      }
    }
    return `${ref.min}-${ref.max}`;
  }

  randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  generateBloodTestSummary(results) {
    const abnormalItems = Object.entries(results)
      .filter(([_, item]) => item.isAbnormal)
      .map(([_, item]) => `${item.name}${item.abnormalDirection}`);
    
    if (abnormalItems.length === 0) {
      return '血常规检查结果基本正常。';
    } else {
      return `血常规显示：${abnormalItems.join('、')}，建议结合临床表现进一步诊治。`;
    }
  }

  // 生成CT检查结果
  generateCTResult(bodyPart) {
    const findings = this.currentCase.ctFindings || '检查未见明显异常。';
    
    const ctTemplates = {
      '头部': `头颅CT平扫：脑实质未见明显异常密度影，脑室系统形态、大小正常，脑沟、脑裂未见明显增宽，中线结构居中。${findings.includes('头颅') ? findings : '诊断意见：头颅CT未见明显异常。'}`,
      '胸部': `胸部CT平扫：双肺纹理清晰，肺内未见明显异常密度影，气管及支气管通畅，纵隔内未见明显肿大淋巴结，心影大小形态正常。${findings.includes('胸部') || findings.includes('肺') ? findings : '诊断意见：胸部CT未见明显异常。'}`,
      '腹部': `腹部CT平扫：肝脏大小形态正常，实质密度均匀，胆囊、胰腺、脾脏、双肾未见明显异常，腹腔内未见明显积液及肿大淋巴结。${findings.includes('腹部') ? findings : '诊断意见：腹部CT未见明显异常。'}`,
      '盆腔': `盆腔CT平扫：膀胱充盈良好，壁光滑，子宫/前列腺大小形态正常，盆腔内未见明显占位性病变及积液。诊断意见：盆腔CT未见明显异常。`,
      '脊柱': `脊柱CT平扫：椎体序列整齐，生理曲度存在，椎体边缘可见轻度骨质增生，椎间隙未见明显狭窄。诊断意见：脊柱退行性改变。`,
      '四肢': `${bodyPart}CT平扫：骨质结构完整，关节间隙正常，周围软组织未见明显肿胀。诊断意见：${bodyPart}CT未见明显异常。`
    };

    return {
      type: 'ct_scan',
      bodyPart: bodyPart || '胸部',
      description: ctTemplates[bodyPart] || ctTemplates['胸部'],
      findings: findings
    };
  }

  // 生成X光检查结果
  generateXRayResult(bodyPart) {
    const xrayTemplates = {
      '胸部': '胸部X光：双肺纹理清晰，肺野未见明显实质性病变，心影大小形态正常，双膈面光滑，肋膈角锐利。诊断意见：心肺膈未见明显异常。',
      '腹部': '腹部X光：肠管未见明显扩张及气液平面，双膈下未见游离气体，腹部未见明显异常高密度影。诊断意见：腹部X光未见明显异常。',
      '骨骼': '骨骼X光：骨质结构完整，骨皮质连续，未见明显骨折线及骨质破坏，关节间隙正常。诊断意见：骨骼X光未见明显异常。',
      '关节': '关节X光：关节面光滑，关节间隙正常，周围软组织未见明显肿胀。诊断意见：关节X光未见明显异常。'
    };

    return {
      type: 'x_ray',
      bodyPart: bodyPart || '胸部',
      description: xrayTemplates[bodyPart] || xrayTemplates['胸部']
    };
  }

  // 生成超声检查结果
  generateUltrasoundResult(bodyPart) {
    const ultrasoundTemplates = {
      '腹部': '腹部超声：肝脏大小形态正常，实质回声均匀，胆囊壁光滑，未见结石，胰腺、脾脏、双肾未见明显异常，腹腔未见明显积液。',
      '心脏': '心脏超声：各房室腔大小正常，室壁运动协调，瓣膜启闭良好，心功能正常。',
      '甲状腺': '甲状腺超声：甲状腺大小形态正常，实质回声均匀，未见明显占位性病变。',
      '乳腺': '乳腺超声：双侧乳腺层次清晰，腺体回声均匀，未见明显占位性病变，BI-RADS分级：1级。',
      '泌尿系': '泌尿系超声：双肾大小形态正常，实质回声均匀，肾盂肾盏未见扩张，输尿管未见扩张，膀胱充盈良好，壁光滑。'
    };

    return {
      type: 'ultrasound',
      bodyPart: bodyPart || '腹部',
      description: ultrasoundTemplates[bodyPart] || ultrasoundTemplates['腹部']
    };
  }

  // 生成C反应蛋白结果
  generateCRPResult() {
    const hasInfection = this.currentCase.id === 'pneumonia' || 
                         this.currentCase.id === 'bronchitis' || 
                         this.currentCase.id === 'flu';
    
    if (hasInfection) {
      const value = this.randomInRange(15, 100);
      return {
        type: 'crp',
        description: `C反应蛋白检测结果：${value.toFixed(1)}mg/L（参考值：0-10mg/L），结果异常（↑）。提示体内存在炎症反应。`,
        value: value.toFixed(1),
        unit: 'mg/L',
        reference: '0-10',
        isAbnormal: true
      };
    } else {
      const value = this.randomInRange(0, 8);
      return {
        type: 'crp',
        description: `C反应蛋白检测结果：${value.toFixed(1)}mg/L（参考值：0-10mg/L），结果正常。`,
        value: value.toFixed(1),
        unit: 'mg/L',
        reference: '0-10',
        isAbnormal: false
      };
    }
  }

  // 生成病毒检测结果
  generateVirusResult(virusName) {
    const virusMap = {
      '甲流': ['flu', '流行性感冒'],
      '乙流': ['flu', '流行性感冒'],
      '新冠': ['cold', '普通感冒'],
      '支原体': ['pneumonia', '肺炎', 'bronchitis', '急性支气管炎']
    };
    
    const relatedDiseases = virusMap[virusName] || [];
    const isPositive = relatedDiseases.some(d => this.currentCase.id === d);
    
    if (isPositive) {
      return {
        type: virusName.toLowerCase(),
        description: `${virusName}核酸检测结果：阳性（+）。\n\n检测方法：实时荧光定量PCR\n检测结果：${virusName}核酸阳性\n建议：及时就医，遵医嘱治疗。`
      };
    } else {
      return {
        type: virusName.toLowerCase(),
        description: `${virusName}核酸检测结果：阴性（-）。\n\n检测方法：实时荧光定量PCR\n检测结果：${virusName}核酸阴性`
      };
    }
  }

  // 获取正确诊断
  getCorrectDiagnosis() {
    if (!this.currentCase) return '';
    // AI生成的病例：name是患者姓名，disease才是疾病名称
    // 本地病例：name就是疾病名称
    // 判断是否为AI生成的病例：有diseaseDescription或有disease字段（且与name不同）
    const isAICase = !!this.currentCase.diseaseDescription ||
      (!!this.currentCase.disease && this.currentCase.disease !== this.currentCase.name);
    if (isAICase) {
      // AI病例：disease是疾病名，不能fallback到name（那是患者姓名）
      return this.currentCase.disease || this.currentCase.diseaseDescription || '';
    }
    // 本地病例：name就是疾病名
    return this.currentCase.name || '';
  }

  // 获取推荐治疗
  getRecommendedTreatment() {
    return this.currentCase ? {
      treatment: this.currentCase.treatment,
      medicines: this.currentCase.medicines
    } : null;
  }

  // 重置患者
  reset() {
    this.currentCase = null;
    this.conversationHistory = [];
    this.patient = null;
  }
}

module.exports = PatientAgent;
