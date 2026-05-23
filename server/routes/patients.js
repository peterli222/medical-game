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
    const { recentCases } = req.body || {};
    // generatePatient可能是同步或异步，统一用await
    let patient = agent.generatePatient(recentCases || []);
    if (patient && typeof patient.then === 'function') {
      patient = await patient;
    }

    // 确保patient是有效的Patient对象
    if (!patient || !patient.toJSON) {
      // 回退：强制生成本地患者
      agent.generatePatient(recentCases || []);
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
    const { recentCases } = req.body || {};

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
          recentCases || []
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
        agent.generatePatient(recentCases || []);
      }
    } else {
      agent.generatePatient(recentCases || []);
    }

    if (!agent.patient) {
      agent.generatePatient(recentCases || []);
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
    sendEvent('patient', { patient: patientData });

    // 流式生成患者描述
    sendEvent('status', { message: 'AI正在生成患者描述...' });

    let description = '';
    try {
      description = await llmService.generatePatientDescriptionStream(
        patient,
        agent.currentCase,
        (token, fullContent) => {
          sendEvent('description-progress', { token, full: fullContent });
        }
      );
    } catch (e) {
      console.error('AI description failed:', e.message);
    }

    if (!description) {
      description = agent.getFallbackDescription();
    }

    sendEvent('description', { description });
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
            aiScored: true
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

module.exports = router;
