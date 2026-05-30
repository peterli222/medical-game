const express = require('express');
const router = express.Router();
const dataStore = require('../services/DataStore');
const PatientAgent = require('../services/PatientAgent');
const llmService = require('../services/LLMService');

// 获取所有患者
router.get('/', (req, res) => {
  const patients = dataStore.getAllPatients();
  res.json({ success: true, data: patients });
});

// 获取当前患者
router.get('/current', (req, res) => {
  const patient = dataStore.getCurrentPatient();
  if (patient) {
    res.json({ success: true, data: patient.toJSON() });
  } else {
    res.json({ success: false, message: '当前没有患者' });
  }
});

// 生成新患者（非流式，保留兼容）
router.post('/new', async (req, res) => {
  try {
    const agent = new PatientAgent();
    const { recentCases, department } = req.body || {};
    // generatePatient可能是同步或异步，统一用await
    let patient = agent.generatePatient(recentCases || [], department || '');
    if (patient && typeof patient.then === 'function') {
      patient = await patient;
    }

    // 确保patient是有效的Patient对象
    if (!patient || !patient.toJSON) {
      // 回退：强制生成本地患者
      agent.generatePatient(recentCases || [], department || '');
      patient = agent.patient;
    }

    dataStore.createPatient(patient.toJSON());
    dataStore.setPatientAgent(patient.id, agent);

    const initialDescription = await agent.getInitialDescription();

    // 包含复诊信息
    const patientData = patient.toJSON();
    if (agent.currentCase && agent.currentCase.isReturnVisit) {
      patientData.isReturnVisit = true;
      patientData.previousVisit = agent.currentCase.previousVisit;
    }

    res.json({
      success: true,
      data: {
        patient: patientData,
        initialDescription: initialDescription
      }
    });
  } catch (error) {
    console.error('创建患者错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 生成新患者（流式SSE）
router.post('/new-stream', async (req, res) => {
  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const agent = new PatientAgent();
    const { recentCases, department } = req.body || {};

    // 如果AI启用，尝试流式生成病例
    if (llmService.isEnabled()) {
      sendEvent('status', { message: 'AI正在生成病例...' });

      try {
        const { MEDICINE_DATABASE } = require('../models/Medicine');
        const { EXAMINATION_TYPES } = require('../models/Examination');

        // 准备药品信息
        const medicineInfo = [];
        for (const med of MEDICINE_DATABASE) {
          medicineInfo.push(`${med.name}(${med.indications.join('、')})`);
        }

        // 准备检查项目信息
        const examInfo = [];
        for (const [key, exam] of Object.entries(EXAMINATION_TYPES)) {
          examInfo.push(`${exam.name}(${exam.id}, ¥${exam.price})`);
        }

        const aiCase = await llmService.generateCaseStream(
          medicineInfo.join('、'),
          examInfo.join('、'),
          (token, fullContent) => {
            sendEvent('case-progress', { token, full: fullContent });
          },
          recentCases || [],
          department || ''
        );

        if (aiCase && aiCase.name && aiCase.symptoms) {
          agent.currentCase = aiCase;
          agent.patient = new (require('../models/Patient'))();
          const shuffledSymptoms = aiCase.symptoms.sort(() => 0.5 - Math.random());
          agent.patient.symptoms = shuffledSymptoms.slice(0, Math.floor(Math.random() * 3) + 3);
          agent.patient.medicalHistory = agent.generateMedicalHistory();
          agent.patient.allergies = Math.random() > 0.7 ? ['青霉素', '磺胺类药物'][Math.floor(Math.random() * 2)] : [];

          // 判断是否为复诊病人（30%概率）
          const isReturnVisit = Math.random() < 0.3;
          agent.currentCase.isReturnVisit = isReturnVisit;
          if (isReturnVisit) {
            agent.currentCase.previousVisit = {
              lastDiagnosis: aiCase.name,
              lastVisitDays: Math.floor(Math.random() * 14) + 3,
              chiefComplaint: '症状未完全缓解，前来复诊'
            };
          }
        }
      } catch (e) {
        console.error('AI case generation failed, using local:', e.message);
        // 回退到本地病例
        agent.generatePatient(recentCases || [], department || '');
      }
    } else {
      agent.generatePatient(recentCases || [], department || '');
    }

    if (!agent.patient) {
      agent.generatePatient(recentCases || [], department || '');
    }

    const patient = agent.patient;
    dataStore.createPatient(patient.toJSON());
    dataStore.setPatientAgent(patient.id, agent);

    // 包含复诊信息的患者数据
    const patientData = patient.toJSON();
    if (agent.currentCase && agent.currentCase.isReturnVisit) {
      patientData.isReturnVisit = true;
      patientData.previousVisit = agent.currentCase.previousVisit;
    }
    // 添加病例生成的usage信息
    if (agent.currentCase && agent.currentCase._usage) {
      patientData._caseUsage = agent.currentCase._usage;
    }
    sendEvent('patient', { patient: patientData });

    // 流式生成患者描述
    sendEvent('status', { message: 'AI正在生成患者描述...' });

    let description = '';
    let descriptionUsage = null;
    try {
      const descResult = await llmService.generatePatientDescriptionStream(
        patient,
        agent.currentCase,
        (token, fullContent) => {
          sendEvent('description-progress', { token, full: fullContent });
        }
      );
      if (descResult && descResult.description) {
        description = descResult.description;
        descriptionUsage = descResult._usage || null;
      }
    } catch (e) {
      console.error('AI description failed:', e.message);
    }

    if (!description) {
      description = agent.getFallbackDescription();
    }

    sendEvent('description', { description, _usage: descriptionUsage });
    sendEvent('done', { patientId: patient.id });

  } catch (error) {
    console.error('创建患者流式错误:', error);
    sendEvent('error', { message: error.message });
  }

  res.end();
});

// 获取指定患者
router.get('/:id', (req, res) => {
  const patient = dataStore.getPatient(req.params.id);
  if (patient) {
    res.json({ success: true, data: patient.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '患者不存在' });
  }
});

// 与患者对话（非流式，保留兼容）
router.post('/:id/chat', async (req, res) => {
  const { question } = req.body;
  const agent = dataStore.getPatientAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({ success: false, message: '患者智能体不存在' });
  }

  try {
    const response = await agent.answerQuestion(question);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('对话错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 与患者对话（流式SSE）
router.post('/:id/chat-stream', async (req, res) => {
  const { question } = req.body;
  const agent = dataStore.getPatientAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({ success: false, message: '患者智能体不存在' });
  }

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    let answer = '';

    if (llmService.isEnabled() && agent.currentCase && agent.patient) {
      try {
        answer = await llmService.answerMedicalQuestionStream(
          question,
          agent.patient,
          agent.currentCase,
          agent.conversationHistory,
          (token, fullContent) => {
            sendEvent('token', { token, full: fullContent });
          }
        );
      } catch (e) {
        console.error('LLM流式回答失败，使用本地:', e.message);
      }
    }

    if (!answer) {
      answer = agent.getFallbackAnswer(question);
      sendEvent('token', { token: answer, full: answer });
    }

    // 记录对话历史
    agent.conversationHistory.push({
      role: 'doctor',
      content: question,
      timestamp: new Date().toISOString()
    });
    agent.conversationHistory.push({
      role: 'patient',
      content: answer,
      timestamp: new Date().toISOString()
    });

    sendEvent('done', { answer, history: agent.conversationHistory });

  } catch (error) {
    console.error('对话流式错误:', error);
    sendEvent('error', { message: error.message });
  }

  res.end();
});

// 获取患者对话历史
router.get('/:id/chat-history', (req, res) => {
  const agent = dataStore.getPatientAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({ success: false, message: '患者智能体不存在' });
  }

  res.json({ success: true, data: agent.conversationHistory });
});

// 更新患者信息
router.put('/:id', (req, res) => {
  const patient = dataStore.updatePatient(req.params.id, req.body);
  if (patient) {
    res.json({ success: true, data: patient.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '患者不存在' });
  }
});

// 获取患者正确诊断（用于评估）
router.get('/:id/diagnosis', (req, res) => {
  const agent = dataStore.getPatientAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({ success: false, message: '患者智能体不存在' });
  }

  res.json({
    success: true,
    data: {
      diagnosis: agent.getCorrectDiagnosis(),
      recommendedTreatment: agent.getRecommendedTreatment()
    }
  });
});

// 评估诊疗结果
router.post('/:id/evaluate', async (req, res) => {
  const { userDiagnosis, examinationCosts, prescriptionCosts, questionCount, userMedicines, userExaminations, examinationDetails } = req.body;
  const agent = dataStore.getPatientAgent(req.params.id);
  const patient = dataStore.getPatient(req.params.id);

  if (!agent || !agent.currentCase) {
    return res.status(404).json({ success: false, message: '患者数据不存在' });
  }

  const correctDiagnosis = agent.getCorrectDiagnosis();
  const recommended = agent.getRecommendedTreatment();
  
  // 获取问诊对话历史
  const conversationHistory = agent.conversationHistory || [];

  // 获取检查结果（从后端dataStore获取已完成的检查单）
  const examOrders = dataStore.getPatientExaminationOrders(req.params.id);
  const completedExams = examOrders.filter(o => o.status === 'completed').map(o => ({
    type: o.type,
    typeName: o.typeName,
    bodyPart: o.bodyPart,
    result: o.result
  }));

  // 获取病例信息（疾病案例数据）
  const caseInfo = agent.currentCase ? {
    name: agent.currentCase.name,
    symptoms: agent.currentCase.symptoms,
    physicalSigns: agent.currentCase.physicalSigns,
    treatment: agent.currentCase.treatment,
    medicines: agent.currentCase.medicines
  } : null;

  // 尝试使用 AI 评分
  if (llmService.isEnabled()) {
    try {
      const aiResult = await llmService.evaluateDiagnosis({
        correctDiagnosis,
        userDiagnosis: userDiagnosis || '未填写',
        recommended,
        userMedicines: userMedicines || [],
        userExaminations: userExaminations || [],
        examinationDetails: examinationDetails || [],
        completedExams: completedExams,
        caseInfo: caseInfo,
        examinationCosts: examinationCosts || 0,
        prescriptionCosts: prescriptionCosts || 0,
        questionCount: questionCount || 0,
        conversationHistory: conversationHistory
      });

      if (aiResult && aiResult.score !== undefined) {
        let grade = '';
        let gradeColor = '';
        if (aiResult.score >= 90) { grade = 'S'; gradeColor = '#FFD700'; }
        else if (aiResult.score >= 80) { grade = 'A'; gradeColor = '#4CAF50'; }
        else if (aiResult.score >= 70) { grade = 'B'; gradeColor = '#2196F3'; }
        else if (aiResult.score >= 60) { grade = 'C'; gradeColor = '#FF9800'; }
        else { grade = 'D'; gradeColor = '#F44336'; }

        return res.json({
          success: true,
          data: {
            score: aiResult.score,
            grade: grade,
            gradeColor: gradeColor,
            matchType: aiResult.matchType || 'wrong',
            diagnosisMatch: aiResult.diagnosisMatch || false,
            correctDiagnosis,
            userDiagnosis: userDiagnosis || '未填写',
            recommended,
            scoreBreakdown: aiResult.scoreBreakdown || {},
            overallComment: aiResult.overallComment || null,
            costs: {
              examination: examinationCosts || 0,
              medicine: prescriptionCosts || 0,
              total: (examinationCosts || 0) + (prescriptionCosts || 0)
            },
            patientInfo: patient ? {
              name: patient.name,
              age: patient.age,
              gender: patient.gender
            } : null,
            aiScored: true,
            _usage: aiResult._usage || null
          }
        });
      }
    } catch (error) {
      console.error('AI evaluation failed, using local scoring:', error.message);
    }
  }

  // 本地评分算法
  const userDiagLower = (userDiagnosis || '').toLowerCase().trim();
  const correctDiagLower = correctDiagnosis.toLowerCase().trim();

  let diagnosisMatch = false;
  let matchType = 'wrong';

  if (userDiagLower === correctDiagLower) {
    diagnosisMatch = true;
    matchType = 'exact';
  } else if (userDiagLower.includes(correctDiagLower) || correctDiagLower.includes(userDiagLower)) {
    diagnosisMatch = true;
    matchType = 'partial';
  } else {
    const keywords = correctDiagnosis.replace(/[（）()]/g, '').split(/[\s，,]+/);
    const matchedKeywords = keywords.filter(k => k.length > 1 && userDiagLower.includes(k));
    if (matchedKeywords.length > 0) {
      diagnosisMatch = true;
      matchType = 'keyword';
    }
  }

  const totalExamCost = examinationCosts || 0;
  const totalMedCost = prescriptionCosts || 0;
  const totalCost = totalExamCost + totalMedCost;

  let score = 0;
  let scoreBreakdown = {};

  if (matchType === 'exact') {
    score += 45;
    scoreBreakdown.diagnosis = { score: 45, comment: '诊断完全正确' };
  } else if (matchType === 'partial') {
    score += 36;
    scoreBreakdown.diagnosis = { score: 36, comment: '诊断基本正确' };
  } else if (matchType === 'keyword') {
    score += 22;
    scoreBreakdown.diagnosis = { score: 22, comment: '诊断部分正确' };
  } else {
    scoreBreakdown.diagnosis = { score: 0, comment: '诊断不正确' };
  }

  const examCount = totalExamCost > 0 ? Math.ceil(totalExamCost / 50) : 0;
  if (examCount === 0) {
    score += 4;
    scoreBreakdown.examination = { score: 4, cost: totalExamCost, comment: '未做任何检查' };
  } else if (examCount <= 3) {
    score += 20;
    scoreBreakdown.examination = { score: 20, cost: totalExamCost, comment: '检查精简高效' };
  } else if (examCount <= 6) {
    score += 12;
    scoreBreakdown.examination = { score: 12, cost: totalExamCost, comment: '检查项目偏多' };
  } else {
    score += 4;
    scoreBreakdown.examination = { score: 4, cost: totalExamCost, comment: '检查过度' };
  }

  if (totalMedCost === 0) {
    score += 0;
    scoreBreakdown.medicine = { score: 0, cost: 0, comment: '未开药' };
  } else if (totalMedCost <= 50) {
    score += 20;
    scoreBreakdown.medicine = { score: 20, cost: totalMedCost, comment: '用药经济合理' };
  } else if (totalMedCost <= 100) {
    score += 16;
    scoreBreakdown.medicine = { score: 16, cost: totalMedCost, comment: '花费适中' };
  } else if (totalMedCost <= 200) {
    score += 10;
    scoreBreakdown.medicine = { score: 10, cost: totalMedCost, comment: '花费偏高' };
  } else {
    score += 4;
    scoreBreakdown.medicine = { score: 4, cost: totalMedCost, comment: '花费过高' };
  }

  const qCount = questionCount || 0;
  let consultingScore = 0;
  let consultingComment = '';
  if (qCount >= 8) {
    consultingScore = 15;
    consultingComment = '问诊详尽，信息收集全面';
  } else if (qCount >= 5) {
    consultingScore = 12;
    consultingComment = '问诊充分，信息收集良好';
  } else if (qCount >= 3) {
    consultingScore = 8;
    consultingComment = '问诊基本充分，建议多了解病史';
  } else if (qCount >= 1) {
    consultingScore = 4;
    consultingComment = '问诊不足，建议增加问诊内容';
  } else {
    consultingScore = 0;
    consultingComment = '未进行问诊';
  }
  score += consultingScore;
  scoreBreakdown.consultation = { score: consultingScore, maxScore: 15, questionCount: qCount, comment: consultingComment };

  let efficiencyComment = '';
  if (score > 100) {
    efficiencyComment = '🏥 效率极佳！以最少的步骤完成了高质量诊疗。';
    score = 100;
  }
  if (score < 0) score = 0;

  if (!efficiencyComment && score >= 80 && qCount <= 5 && examCount <= 3) {
    efficiencyComment = '⚡ 诊疗效率很高，问诊和检查都很精简。';
  }

  let grade = '';
  let gradeColor = '';
  if (score >= 90) { grade = 'S'; gradeColor = '#FFD700'; }
  else if (score >= 80) { grade = 'A'; gradeColor = '#4CAF50'; }
  else if (score >= 70) { grade = 'B'; gradeColor = '#2196F3'; }
  else if (score >= 60) { grade = 'C'; gradeColor = '#FF9800'; }
  else { grade = 'D'; gradeColor = '#F44336'; }

  res.json({
    success: true,
    data: {
      score,
      grade,
      gradeColor,
      matchType,
      diagnosisMatch,
      correctDiagnosis,
      userDiagnosis: userDiagnosis || '未填写',
      recommended,
      scoreBreakdown,
      efficiencyComment: efficiencyComment || null,
      costs: {
        examination: totalExamCost,
        medicine: totalMedCost,
        total: totalCost
      },
      patientInfo: patient ? {
        name: patient.name,
        age: patient.age,
        gender: patient.gender
      } : null,
      aiScored: false
    }
  });
});

// 评估诊疗结果（流式SSE）
router.post('/:id/evaluate-stream', async (req, res) => {
  const { userDiagnosis, examinationCosts, prescriptionCosts, questionCount, userMedicines, userExaminations, examinationDetails } = req.body;
  const agent = dataStore.getPatientAgent(req.params.id);
  const patient = dataStore.getPatient(req.params.id);

  if (!agent || !agent.currentCase) {
    return res.status(404).json({ success: false, message: '患者数据不存在' });
  }

  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const correctDiagnosis = agent.getCorrectDiagnosis();
  const recommended = agent.getRecommendedTreatment();
  const conversationHistory = agent.conversationHistory || [];

  // 获取检查结果（从后端dataStore获取已完成的检查单）
  const examOrders = dataStore.getPatientExaminationOrders(req.params.id);
  const completedExams = examOrders.filter(o => o.status === 'completed').map(o => ({
    type: o.type,
    typeName: o.typeName,
    bodyPart: o.bodyPart,
    result: o.result
  }));

  // 获取病例信息
  const caseInfo = agent.currentCase ? {
    name: agent.currentCase.name,
    symptoms: agent.currentCase.symptoms,
    physicalSigns: agent.currentCase.physicalSigns,
    treatment: agent.currentCase.treatment,
    medicines: agent.currentCase.medicines
  } : null;

  try {
    sendEvent('status', { message: 'AI正在评估诊疗结果...' });

    let aiScored = false;
    let resultData = null;

    // 尝试AI流式评分
    if (llmService.isEnabled()) {
      try {
        // 构建患者基础信息块（与 LLMService.buildPatientContextBlock 一致）
        const patientContextParts = [];
        if (patient) {
          if (patient.name) patientContextParts.push(`姓名：${patient.name}`);
          if (patient.age) patientContextParts.push(`年龄：${patient.age}岁`);
          if (patient.gender) patientContextParts.push(`性别：${patient.gender}`);
        }
        if (caseInfo) {
          if (caseInfo.name) patientContextParts.push(`疾病：${caseInfo.name}`);
          if (caseInfo.symptoms && caseInfo.symptoms.length > 0) {
            patientContextParts.push(`症状：${caseInfo.symptoms.join('、')}`);
          }
          if (caseInfo.physicalSigns) {
            const signs = [];
            const ps = caseInfo.physicalSigns;
            if (ps.temperature) signs.push(`体温${ps.temperature}℃`);
            if (ps.bloodPressure) signs.push(`血压${ps.bloodPressure}`);
            if (ps.heartRate) signs.push(`心率${ps.heartRate}次/分`);
            if (ps.breathing) signs.push(`呼吸${ps.breathing}次/分`);
            if (signs.length > 0) patientContextParts.push(`体征：${signs.join('、')}`);
          }
        }
        const patientContext = patientContextParts.join('；');

        const symptoms = caseInfo && caseInfo.symptoms ? (Array.isArray(caseInfo.symptoms) ? caseInfo.symptoms.join('、') : caseInfo.symptoms) : '无';
        const physicalSignsStr = caseInfo && caseInfo.physicalSigns ? JSON.stringify(caseInfo.physicalSigns) : '无';
        const treatmentStr = caseInfo ? caseInfo.treatment || '无' : '无';
        const medicinesStr = caseInfo && caseInfo.medicines ? (Array.isArray(caseInfo.medicines) ? caseInfo.medicines.join('、') : caseInfo.medicines) : '无';

        // 与 evaluateDiagnosis 相同的 prompt 模板
        const prompt = `${patientContext}

【病例信息】
疾病：${correctDiagnosis}
症状：${symptoms}
体格检查：${physicalSignsStr}
推荐治疗：${treatmentStr}
推荐药品：${medicinesStr}

正确诊断：${correctDiagnosis}
学生诊断：${userDiagnosis || '未填写'}

推荐治疗方案：${recommended || '无'}
学生用药：${(userMedicines || []).join('、') || '无'}
学生检查：${(userExaminations || []).join('、') || '无'}

检查费用：¥${examinationCosts || 0}
药品费用：¥${prescriptionCosts || 0}
问诊问题数：${questionCount || 0}

【检查结果详情】
${examinationDetails ? examinationDetails.map(e => `${e.typeName}：${e.resultDescription || '无结果'}`).join('\n') : '无'}

【问诊记录】
${conversationHistory.length > 0 ? conversationHistory.map(h => `${h.role === 'doctor' ? '医生' : '患者'}：${h.content}`).join('\n') : '无'}

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

        const streamResult = await llmService.chatStream(messages, 0.3, 1500);

        if (streamResult.success) {
          let fullContent = '';
          const stream = streamResult.stream;

          await new Promise((resolve, reject) => {
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
                        sendEvent('token', { token: delta.content, full: fullContent });
                      }
                    }
                  } catch (e) {}
                }
              }
            });

            stream.on('end', () => {
              fullContent = llmService.cleanThinkingTags(fullContent);
              try {
                let content = fullContent;
                content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.score !== undefined) {
                    let grade = '';
                    let gradeColor = '';
                    if (parsed.score >= 90) { grade = 'S'; gradeColor = '#FFD700'; }
                    else if (parsed.score >= 80) { grade = 'A'; gradeColor = '#4CAF50'; }
                    else if (parsed.score >= 70) { grade = 'B'; gradeColor = '#2196F3'; }
                    else if (parsed.score >= 60) { grade = 'C'; gradeColor = '#FF9800'; }
                    else { grade = 'D'; gradeColor = '#F44336'; }

                    resultData = {
                      score: parsed.score,
                      grade,
                      gradeColor,
                      matchType: parsed.matchType || 'wrong',
                      diagnosisMatch: parsed.diagnosisMatch || false,
                      correctDiagnosis,
                      userDiagnosis: userDiagnosis || '未填写',
                      recommended,
                      scoreBreakdown: parsed.scoreBreakdown || {},
                      overallComment: parsed.overallComment || null,
                      costs: {
                        examination: examinationCosts || 0,
                        medicine: prescriptionCosts || 0,
                        total: (examinationCosts || 0) + (prescriptionCosts || 0)
                      },
                      patientInfo: patient ? {
                        name: patient.name,
                        age: patient.age,
                        gender: patient.gender
                      } : null,
                      aiScored: true
                    };
                    aiScored = true;
                  }
                }
              } catch (e) {
                console.error('AI评分结果解析失败:', e.message);
              }
              resolve();
            });

            stream.on('error', (error) => {
              console.error('评分流式错误:', error);
              reject(error);
            });
          });
        }
      } catch (e) {
        console.error('AI流式评分失败，使用本地评分:', e.message);
      }
    }

    // 如果AI评分失败，使用本地评分算法
    if (!aiScored) {
      const userDiagLower = (userDiagnosis || '').toLowerCase().trim();
      const correctDiagLower = correctDiagnosis.toLowerCase().trim();

      let diagnosisMatch = false;
      let matchType = 'wrong';

      if (userDiagLower === correctDiagLower) {
        diagnosisMatch = true;
        matchType = 'exact';
      } else if (userDiagLower.includes(correctDiagLower) || correctDiagLower.includes(userDiagLower)) {
        diagnosisMatch = true;
        matchType = 'partial';
      } else {
        const keywords = correctDiagnosis.replace(/[（）()]/g, '').split(/[\s，,]+/);
        const matchedKeywords = keywords.filter(k => k.length > 1 && userDiagLower.includes(k));
        if (matchedKeywords.length > 0) {
          diagnosisMatch = true;
          matchType = 'keyword';
        }
      }

      const totalExamCost = examinationCosts || 0;
      const totalMedCost = prescriptionCosts || 0;
      const totalCost = totalExamCost + totalMedCost;

      let score = 0;
      let scoreBreakdown = {};

      if (matchType === 'exact') {
        score += 45;
        scoreBreakdown.diagnosis = { score: 45, comment: '诊断完全正确' };
      } else if (matchType === 'partial') {
        score += 36;
        scoreBreakdown.diagnosis = { score: 36, comment: '诊断基本正确' };
      } else if (matchType === 'keyword') {
        score += 22;
        scoreBreakdown.diagnosis = { score: 22, comment: '诊断部分正确' };
      } else {
        scoreBreakdown.diagnosis = { score: 0, comment: '诊断不正确' };
      }

      const examCount = totalExamCost > 0 ? Math.ceil(totalExamCost / 50) : 0;
      if (examCount === 0) {
        score += 4;
        scoreBreakdown.examination = { score: 4, cost: totalExamCost, comment: '未做任何检查' };
      } else if (examCount <= 3) {
        score += 20;
        scoreBreakdown.examination = { score: 20, cost: totalExamCost, comment: '检查精简高效' };
      } else if (examCount <= 6) {
        score += 12;
        scoreBreakdown.examination = { score: 12, cost: totalExamCost, comment: '检查项目偏多' };
      } else {
        score += 4;
        scoreBreakdown.examination = { score: 4, cost: totalExamCost, comment: '检查过度' };
      }

      if (totalMedCost === 0) {
        score += 0;
        scoreBreakdown.medicine = { score: 0, cost: 0, comment: '未开药' };
      } else if (totalMedCost <= 50) {
        score += 20;
        scoreBreakdown.medicine = { score: 20, cost: totalMedCost, comment: '用药经济合理' };
      } else if (totalMedCost <= 100) {
        score += 16;
        scoreBreakdown.medicine = { score: 16, cost: totalMedCost, comment: '花费适中' };
      } else if (totalMedCost <= 200) {
        score += 10;
        scoreBreakdown.medicine = { score: 10, cost: totalMedCost, comment: '花费偏高' };
      } else {
        score += 4;
        scoreBreakdown.medicine = { score: 4, cost: totalMedCost, comment: '花费过高' };
      }

      const qCount = questionCount || 0;
      let consultingScore = 0;
      let consultingComment = '';
      if (qCount >= 8) {
        consultingScore = 15;
        consultingComment = '问诊详尽，信息收集全面';
      } else if (qCount >= 5) {
        consultingScore = 12;
        consultingComment = '问诊充分，信息收集良好';
      } else if (qCount >= 3) {
        consultingScore = 8;
        consultingComment = '问诊基本充分，建议多了解病史';
      } else if (qCount >= 1) {
        consultingScore = 4;
        consultingComment = '问诊不足，建议增加问诊内容';
      } else {
        consultingScore = 0;
        consultingComment = '未进行问诊';
      }
      score += consultingScore;
      scoreBreakdown.consultation = { score: consultingScore, maxScore: 15, questionCount: qCount, comment: consultingComment };

      if (score > 100) score = 100;
      if (score < 0) score = 0;

      let grade = '';
      let gradeColor = '';
      if (score >= 90) { grade = 'S'; gradeColor = '#FFD700'; }
      else if (score >= 80) { grade = 'A'; gradeColor = '#4CAF50'; }
      else if (score >= 70) { grade = 'B'; gradeColor = '#2196F3'; }
      else if (score >= 60) { grade = 'C'; gradeColor = '#FF9800'; }
      else { grade = 'D'; gradeColor = '#F44336'; }

      resultData = {
        score,
        grade,
        gradeColor,
        matchType,
        diagnosisMatch,
        correctDiagnosis,
        userDiagnosis: userDiagnosis || '未填写',
        recommended,
        scoreBreakdown,
        overallComment: null,
        costs: {
          examination: totalExamCost,
          medicine: totalMedCost,
          total: totalCost
        },
        patientInfo: patient ? {
          name: patient.name,
          age: patient.age,
          gender: patient.gender
        } : null,
        aiScored: false
      };
    }

    sendEvent('result', resultData);
    sendEvent('done', {});

  } catch (error) {
    console.error('评估流式错误:', error);
    sendEvent('error', { message: error.message });
  }

  res.end();
});

module.exports = router;
