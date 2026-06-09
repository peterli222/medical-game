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

// 获取历史病例列表（最多500个，用于避免重复疾病）
router.get('/history-cases', (req, res) => {
  const agents = dataStore.patientAgents;
  const cases = [];
  
  for (const [patientId, agent] of agents) {
    if (agent.currentCase && agent.currentCase.disease) {
      cases.push({
        disease: agent.currentCase.disease,
        name: agent.currentCase.name,
        patientId: patientId
      });
    }
  }
  
  // 按时间倒序，最多500个
  const recentCases = cases.slice(-500).reverse();
  
  res.json({ 
    success: true, 
    data: recentCases,
    total: cases.length
  });
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
      agent._forceLocalGenerate(recentCases || [], department || '');
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

    // 返回病例数据（包含disease字段）
    const caseData = agent.currentCase ? {
      name: agent.currentCase.name,
      disease: agent.currentCase.disease,
      diseaseDescription: agent.currentCase.diseaseDescription,
      symptoms: agent.currentCase.symptoms,
      physicalSigns: agent.currentCase.physicalSigns,
      treatment: agent.currentCase.treatment,
      medicines: agent.currentCase.medicines,
      suggestedExaminations: agent.currentCase.suggestedExaminations
    } : null;

    res.json({
      success: true,
      data: {
        patient: patientData,
        case: caseData,
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
    try {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } catch (e) {
      console.warn('sendEvent JSON序列化失败:', type, e.message);
      res.write(`data: ${JSON.stringify({ type, message: '数据序列化错误' })}\n\n`);
    }
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

        if (aiCase) {
          // 确保必需字段存在（AI可能返回部分数据）
          if (!aiCase.name) {
            // 从disease或diseaseDescription中尝试提取名字，否则用默认值
            aiCase.name = '患者' + Math.floor(Math.random() * 1000);
            console.warn('AI病例缺少name字段，使用默认值:', aiCase.name);
          }
          if (!aiCase.symptoms || (Array.isArray(aiCase.symptoms) && aiCase.symptoms.length === 0)) {
            aiCase.symptoms = ['不适'];
            console.warn('AI病例缺少symptoms字段，使用默认值');
          }
          agent.currentCase = aiCase;
          agent.patient = new (require('../models/Patient'))();
          // 确保symptoms是数组（AI有时返回字符串）
          let symptomsList = aiCase.symptoms;
          if (typeof symptomsList === 'string') {
            symptomsList = symptomsList.split(/[，,、;；]/).map(s => s.trim()).filter(s => s);
          }
          if (!Array.isArray(symptomsList)) {
            symptomsList = [String(symptomsList)];
          }
          const shuffledSymptoms = symptomsList.sort(() => 0.5 - Math.random());
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
          sendEvent('status', { message: 'AI病例生成成功' });
        } else {
          sendEvent('ai-failed', { message: 'AI返回的病例数据不完整（缺少姓名或症状）', stage: 'parse' });
          // AI返回数据不完整，回退到本地病例
          agent._forceLocalGenerate(recentCases || [], department || '');
        }
      } catch (e) {
        console.error('AI case generation failed, using local:', e.message);
        sendEvent('ai-failed', { message: e.message || 'AI生成病例失败', stage: 'case' });
        // 回退到本地病例
        agent._forceLocalGenerate(recentCases || [], department || '');
      }
    } else {
      sendEvent('ai-failed', { message: 'AI未配置或已禁用', stage: 'config' });
      agent._forceLocalGenerate(recentCases || [], department || '');
    }

    if (!agent.patient) {
      // 最终兜底：强制本地生成
      agent._forceLocalGenerate(recentCases || [], department || '');
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

    // 返回病例数据（包含disease字段）
    const caseData = agent.currentCase ? {
      name: agent.currentCase.name,
      disease: agent.currentCase.disease,
      diseaseDescription: agent.currentCase.diseaseDescription,
      symptoms: agent.currentCase.symptoms,
      physicalSigns: agent.currentCase.physicalSigns,
      treatment: agent.currentCase.treatment,
      medicines: agent.currentCase.medicines,
      suggestedExaminations: agent.currentCase.suggestedExaminations
    } : null;

    sendEvent('patient', { patient: patientData, case: caseData });

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
    try {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } catch (e) {
      console.warn('sendEvent JSON序列化失败:', type, e.message);
      res.write(`data: ${JSON.stringify({ type, message: '数据序列化错误' })}\n\n`);
    }
  };

  try {
    let answer = '';

    if (llmService.isEnabled() && agent.currentCase && agent.patient) {
      // 最多重试2次（应对503等临时错误）
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
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
          lastError = null;
          break; // 成功，跳出重试循环
        } catch (e) {
          lastError = e;
          const is503 = (e.message || '').includes('503');
          if (is503 && attempt < 2) {
            console.warn(`LLM流式回答503，第${attempt + 1}次重试...`);
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          break; // 非503或最后一次，跳出
        }
      }
      if (lastError) {
        console.error('LLM流式回答失败:', lastError.message);
        sendEvent('error', { message: lastError.message || 'AI回答失败' });
        res.end();
        return;
      }
    } else {
      sendEvent('error', { message: !llmService.isEnabled() ? 'AI未配置' : '患者数据不完整' });
      res.end();
      return;
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

  // 获取手术记录
  const patientSurgeries = dataStore.getPatientSurgeries(req.params.id);
  const completedSurgeries = patientSurgeries.filter(s => s.status === 'completed');

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
        conversationHistory: conversationHistory,
        completedSurgeries: completedSurgeries
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
            errorPoints: aiResult.errorPoints || [],
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
    score += 40;
    scoreBreakdown.diagnosis = { score: 40, comment: '诊断完全正确' };
  } else if (matchType === 'partial') {
    score += 32;
    scoreBreakdown.diagnosis = { score: 32, comment: '诊断基本正确' };
  } else if (matchType === 'keyword') {
    score += 20;
    scoreBreakdown.diagnosis = { score: 20, comment: '诊断部分正确' };
  } else {
    scoreBreakdown.diagnosis = { score: 0, comment: '诊断不正确' };
  }

  const examCount = totalExamCost > 0 ? Math.ceil(totalExamCost / 50) : 0;
  if (examCount === 0) {
    score += 3;
    scoreBreakdown.examination = { score: 3, cost: totalExamCost, comment: '未做任何检查' };
  } else if (examCount <= 3) {
    score += 15;
    scoreBreakdown.examination = { score: 15, cost: totalExamCost, comment: '检查精简高效' };
  } else if (examCount <= 6) {
    score += 9;
    scoreBreakdown.examination = { score: 9, cost: totalExamCost, comment: '检查项目偏多' };
  } else {
    score += 3;
    scoreBreakdown.examination = { score: 3, cost: totalExamCost, comment: '检查过度' };
  }

  if (totalMedCost === 0) {
    score += 0;
    scoreBreakdown.medicine = { score: 0, cost: 0, comment: '未开药' };
  } else if (totalMedCost <= 50) {
    score += 15;
    scoreBreakdown.medicine = { score: 15, cost: totalMedCost, comment: '用药经济合理' };
  } else if (totalMedCost <= 100) {
    score += 12;
    scoreBreakdown.medicine = { score: 12, cost: totalMedCost, comment: '花费适中' };
  } else if (totalMedCost <= 200) {
    score += 8;
    scoreBreakdown.medicine = { score: 8, cost: totalMedCost, comment: '花费偏高' };
  } else {
    score += 3;
    scoreBreakdown.medicine = { score: 3, cost: totalMedCost, comment: '花费过高' };
  }

  const qCount = questionCount || 0;
  let consultingScore = 0;
  let consultingComment = '';
  if (qCount >= 8) {
    consultingScore = 10;
    consultingComment = '问诊详尽，信息收集全面';
  } else if (qCount >= 5) {
    consultingScore = 8;
    consultingComment = '问诊充分，信息收集良好';
  } else if (qCount >= 3) {
    consultingScore = 6;
    consultingComment = '问诊基本充分，建议多了解病史';
  } else if (qCount >= 1) {
    consultingScore = 3;
    consultingComment = '问诊不足，建议增加问诊内容';
  } else {
    consultingScore = 0;
    consultingComment = '未进行问诊';
  }
  score += consultingScore;
  scoreBreakdown.consultation = { score: consultingScore, maxScore: 10, questionCount: qCount, comment: consultingComment };

  // 手术评分（20分）
  let surgeryScore = 0;
  let surgeryComment = '';
  if (completedSurgeries.length > 0) {
    const hasOutcome = completedSurgeries.some(s => s.outcome && s.outcome.trim().length > 10);
    if (hasOutcome) {
      surgeryScore = 18;
      surgeryComment = '完成手术且记录详细';
    } else {
      surgeryScore = 12;
      surgeryComment = '完成手术但记录简略';
    }
  } else {
    surgeryScore = 20;
    surgeryComment = '无需手术处理';
  }
  score += surgeryScore;
  scoreBreakdown.surgery = { score: surgeryScore, maxScore: 20, comment: surgeryComment };

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
      errorPoints: [],
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
      surgeries: completedSurgeries.map(s => ({
        name: (s.surgeryType && typeof s.surgeryType === 'object') ? s.surgeryType.name : (s.surgeryType || '未知'),
        typeLabel: s.typeLabel || s.type,
        anesthesiaLabel: s.anesthesiaLabel || s.anesthesiaType,
        outcome: s.outcome || '',
        findings: s.findings || '',
        complications: s.complications || '',
        postOpNotes: s.postOpNotes || ''
      })),
      aiScored: false
    }
  });
});

// 评估诊疗结果（流式SSE）
// 生成本地评分总体评价
function generateLocalComment(matchType, score, consultingComment, examCost, medCost) {
  let comment = '';
  if (matchType === 'exact') {
    comment = '诊断准确，';
  } else if (matchType === 'partial') {
    comment = '诊断方向正确但不够精确，';
  } else if (matchType === 'keyword') {
    comment = '诊断部分正确，需加强对疾病特征的识别，';
  } else {
    comment = '诊断有误，建议复习相关疾病知识，';
  }
  if (examCost === 0) {
    comment += '未做检查不利于确诊；';
  } else if (examCost > 200) {
    comment += '检查费用偏高，注意合理选择；';
  }
  if (medCost === 0) {
    comment += '未开药；';
  } else if (medCost > 150) {
    comment += '用药费用偏高；';
  }
  comment += consultingComment + '。';
  if (score >= 80) comment += '整体表现良好，继续保持！';
  else if (score >= 60) comment += '有进步空间，注意诊疗细节。';
  else comment += '需要加强学习，多做练习。';
  return comment;
}

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
    try {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } catch (e) {
      console.warn('sendEvent JSON序列化失败:', type, e.message);
      res.write(`data: ${JSON.stringify({ type, message: '数据序列化错误' })}\n\n`);
    }
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

  // 获取手术记录
  const patientSurgeries = dataStore.getPatientSurgeries(req.params.id);
  const completedSurgeries = patientSurgeries.filter(s => s.status === 'completed');

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
        // 使用统一的患者信息前缀格式（与所有其他AI调用一致，提高缓存命中率）
        const patientInfo = patient ? { name: patient.name, age: patient.age, gender: patient.gender } : {};
        const patientContext = llmService.buildPatientContextBlock(patientInfo, caseInfo || {}, completedExams, { conversationHistory, completedSurgeries });

        const symptoms = caseInfo && caseInfo.symptoms ? (Array.isArray(caseInfo.symptoms) ? caseInfo.symptoms.join('、') : caseInfo.symptoms) : '无';
        const physicalSignsStr = caseInfo && caseInfo.physicalSigns ? JSON.stringify(caseInfo.physicalSigns) : '无';
        const treatmentStr = caseInfo ? caseInfo.treatment || '无' : '无';
        const medicinesStr = caseInfo && caseInfo.medicines ? (Array.isArray(caseInfo.medicines) ? caseInfo.medicines.join('、') : caseInfo.medicines) : '无';


        const prompt = `${patientContext}

【病例标准答案】
疾病：${correctDiagnosis}
症状：${symptoms}
体格检查：${physicalSignsStr}
推荐治疗：${treatmentStr}
推荐药品：${medicinesStr}

【学生作答】
学生诊断：${userDiagnosis || '未填写'}
学生用药：${(userMedicines || []).join('、') || '无'}
学生检查：${(userExaminations || []).join('、') || '无'}
检查费用：¥${examinationCosts || 0} 药品费用：¥${prescriptionCosts || 0} 问诊数：${questionCount || 0}

【检查结果详情】
${(completedExams || []).map(e => `${e.typeName || e.type}（${e.bodyPart || ''}）：${e.result || '无结果'}`).join('\n') || '无'}

【手术记录】
${(completedSurgeries || []).length > 0 ? (completedSurgeries || []).map(s => `${(s.surgeryType && typeof s.surgeryType === 'object') ? s.surgeryType.name : (s.surgeryType || '未知')}：${s.outcome || '无记录'}`).join('\n') : '未进行手术'}

请从以下5个维度评分（总分100分），并逐项给出详细评价：

1. 诊断准确性（40分）：
   - 完全正确：40分（诊断名称与正确诊断完全一致或为等价表述）
   - 部分正确：28-39分（诊断方向正确，但不够精确，如只诊断到大类而未细分）
   - 错误但相关：14-27分（诊断与正确诊断有某种关联，如同系统疾病但具体错误）
   - 完全错误：0-13分（诊断方向完全偏离）

2. 检查合理性（15分）：
   - 检查项目选择合理、覆盖必要检查、无过度检查：13-15分
   - 基本合理但有1-2项遗漏或多余：9-12分
   - 检查明显过多或过少：5-8分
   - 检查不合理或完全缺失：0-4分

3. 用药合理性（15分）：
   - 用药对症、类别正确、无明显禁忌：13-15分
   - 基本合理但有小问题（如个别药物可优化）：9-12分
   - 有明显问题（如类别错误、缺少必要药物）：5-8分
   - 用药错误或完全未开药：0-4分

4. 问诊质量（10分）：
   - 问诊全面、围绕主诉展开、鉴别诊断思路清晰：9-10分
   - 基本全面但遗漏部分关键问题：6-8分
   - 有明显遗漏（如未问过敏史、未问既往史）：3-5分
   - 问诊严重不足或跑题：0-2分

5. 手术处理（20分）：
   - 如病例需要手术：完成手术且记录详细（手术经过、术中发现等）：18-20分
   - 完成手术但记录简略：12-17分
   - 应做手术但未做：0-5分
   - 如病例不需要手术：给满分20分

返回严格JSON格式，不要输出任何多余文字：
{
  "score": 总分(0-100整数),
  "scoreBreakdown": {
    "diagnosis": {"score": 分数, "comment": "诊断评价（50-100字，详细分析诊断正确性、思路是否清晰、鉴别诊断是否考虑）"},
    "examination": {"score": 分数, "comment": "检查评价（50-100字，分析检查项目选择是否合理、是否有遗漏或过度、费用是否经济）"},
    "medicine": {"score": 分数, "comment": "用药评价（50-100字，分析药物选择是否对症、剂量是否合理、是否有配伍禁忌、费用是否经济）"},
    "consultation": {"score": 分数, "comment": "问诊评价（50-100字，分析问诊是否全面、是否抓住重点、鉴别诊断思路是否清晰）"},
    "surgery": {"score": 分数, "comment": "手术评价（50-100字，分析手术决策是否正确、操作是否规范、记录是否详细）"}
  },
  "errorPoints": [
    {
      "category": "诊断/检查/用药/问诊/手术",
      "error": "具体描述学生犯了什么错（30-50字）",
      "correct": "正确做法是什么（50-100字，详细解释为什么这样做更合理）"
    }
  ],
  "overallComment": "总体评价（400-500字）：首先肯定学生做得好的方面，然后详细分析主要问题和不足，接着给出具体的改进建议和学习方向，最后给出鼓励和总结。内容要专业、详细、有建设性。",
  "matchType": "exact/partial/keyword/wrong",
  "diagnosisMatch": true或false
}

注意：
- overallComment 必须在400-500字左右，内容要专业详细有建设性
- scoreBreakdown 中每个维度的 comment 要在50-100字，详细分析该维度表现
- errorPoints 数组：只列出学生犯错的地方，做对的不列。如果没有错误则返回空数组
- 每个errorPoint必须明确指出"学生做了什么"和"应该怎么做"，并解释原因
- 分数必须严格在各维度满分范围内
- 只返回JSON，不要有任何其他文字`;

        const messages = [
          { role: 'system', content: '你是一个医学教育评估专家，只返回JSON格式的评分结果。' },
          { role: 'user', content: prompt }
        ];

        const streamResult = await llmService.chatStream(messages, 0.3);

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
                        const visibleContent = llmService.cleanThinkingTags(fullContent);
                        sendEvent('token', { token: delta.content, full: visibleContent });
                      }
                    }
                  } catch (e) {
                    // SSE流数据可能包含不完整的JSON，忽略解析错误
                  }
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
                  let jsonStr = jsonMatch[0];
                  let parsed;
                  try {
                    parsed = JSON.parse(jsonStr);
                  } catch (parseErr) {
                    // JSON被截断，尝试修复
                    console.warn('AI评分JSON解析失败，尝试正则提取. 错误:', parseErr.message);
                    console.warn('原始内容前200字:', jsonStr.slice(0, 200));
                    parsed = {};
                    // 尝试用正则提取各个字段
                    const scoreMatch = jsonStr.match(/"score"\s*:\s*(\d+)/);
                    const matchTypeMatch = jsonStr.match(/"matchType"\s*:\s*"(\w+)"/);
                    const diagnosisMatchBool = jsonStr.match(/"diagnosisMatch"\s*:\s*(true|false)/);
                    const overallCommentMatch = jsonStr.match(/"overallComment"\s*:\s*"([^"]*)"/);
                    if (scoreMatch) parsed.score = parseInt(scoreMatch[1]);
                    if (matchTypeMatch) parsed.matchType = matchTypeMatch[1];
                    if (diagnosisMatchBool) parsed.diagnosisMatch = diagnosisMatchBool[1] === 'true';
                    if (overallCommentMatch) parsed.overallComment = overallCommentMatch[1];
                    // 提取分项评分
                    parsed.scoreBreakdown = {};
                    const dims = ['diagnosis', 'examination', 'medicine', 'consultation', 'surgery'];
                    for (const dim of dims) {
                      const dimRegex = new RegExp(`"${dim}"\\s*:\\s*\\{[^}]*"score"\\s*:\\s*(\\d+)[^}]*"comment"\\s*:\\s*"([^"]*)"`, 'g');
                      const dimMatch = dimRegex.exec(jsonStr);
                      if (dimMatch) {
                        parsed.scoreBreakdown[dim] = { score: parseInt(dimMatch[1]), comment: dimMatch[2] };
                      }
                    }
                    console.warn('正则提取结果: score=', parsed.score, 'matchType=', parsed.matchType, 'breakdown dims:', Object.keys(parsed.scoreBreakdown).join(','));
                  }
                  console.warn('准备检查score, parsed.score=', parsed.score, 'type=', typeof parsed.score);
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
                      errorPoints: parsed.errorPoints || [],
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
                      surgeries: completedSurgeries.map(s => ({
                        name: (s.surgeryType && typeof s.surgeryType === 'object') ? s.surgeryType.name : (s.surgeryType || '未知'),
                        typeLabel: s.typeLabel || s.type,
                        anesthesiaLabel: s.anesthesiaLabel || s.anesthesiaType,
                        outcome: s.outcome || '',
                        findings: s.findings || '',
                        complications: s.complications || '',
                        postOpNotes: s.postOpNotes || ''
                      })),
                      aiScored: true
                    };
                    aiScored = true;
                    console.warn('resultData已设置, aiScored=', aiScored, 'score=', resultData.score);
                  } else {
                    console.warn('parsed.score为undefined, 跳过AI评分');
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
        score += 40;
        scoreBreakdown.diagnosis = { score: 40, comment: '诊断完全正确' };
      } else if (matchType === 'partial') {
        score += 32;
        scoreBreakdown.diagnosis = { score: 32, comment: '诊断基本正确' };
      } else if (matchType === 'keyword') {
        score += 20;
        scoreBreakdown.diagnosis = { score: 20, comment: '诊断部分正确' };
      } else {
        scoreBreakdown.diagnosis = { score: 0, comment: '诊断不正确' };
      }

      const examCount = totalExamCost > 0 ? Math.ceil(totalExamCost / 50) : 0;
      if (examCount === 0) {
        score += 3;
        scoreBreakdown.examination = { score: 3, cost: totalExamCost, comment: '未做任何检查' };
      } else if (examCount <= 3) {
        score += 15;
        scoreBreakdown.examination = { score: 15, cost: totalExamCost, comment: '检查精简高效' };
      } else if (examCount <= 6) {
        score += 9;
        scoreBreakdown.examination = { score: 9, cost: totalExamCost, comment: '检查项目偏多' };
      } else {
        score += 3;
        scoreBreakdown.examination = { score: 3, cost: totalExamCost, comment: '检查过度' };
      }

      if (totalMedCost === 0) {
        score += 0;
        scoreBreakdown.medicine = { score: 0, cost: 0, comment: '未开药' };
      } else if (totalMedCost <= 50) {
        score += 15;
        scoreBreakdown.medicine = { score: 15, cost: totalMedCost, comment: '用药经济合理' };
      } else if (totalMedCost <= 100) {
        score += 12;
        scoreBreakdown.medicine = { score: 12, cost: totalMedCost, comment: '花费适中' };
      } else if (totalMedCost <= 200) {
        score += 8;
        scoreBreakdown.medicine = { score: 8, cost: totalMedCost, comment: '花费偏高' };
      } else {
        score += 3;
        scoreBreakdown.medicine = { score: 3, cost: totalMedCost, comment: '花费过高' };
      }

      const qCount = questionCount || 0;
      let consultingScore = 0;
      let consultingComment = '';
      if (qCount >= 8) {
        consultingScore = 10;
        consultingComment = '问诊详尽，信息收集全面';
      } else if (qCount >= 5) {
        consultingScore = 8;
        consultingComment = '问诊充分，信息收集良好';
      } else if (qCount >= 3) {
        consultingScore = 6;
        consultingComment = '问诊基本充分，建议多了解病史';
      } else if (qCount >= 1) {
        consultingScore = 3;
        consultingComment = '问诊不足，建议增加问诊内容';
      } else {
        consultingScore = 0;
        consultingComment = '未进行问诊';
      }
      score += consultingScore;
      scoreBreakdown.consultation = { score: consultingScore, maxScore: 10, questionCount: qCount, comment: consultingComment };

      // 手术评分（20分）
      let surgeryScore = 0;
      let surgeryComment = '';
      if (completedSurgeries.length > 0) {
        const hasOutcome = completedSurgeries.some(s => s.outcome && s.outcome.trim().length > 10);
        if (hasOutcome) {
          surgeryScore = 18;
          surgeryComment = '完成手术且记录详细';
        } else {
          surgeryScore = 12;
          surgeryComment = '完成手术但记录简略';
        }
      } else {
        // 没有手术记录，给满分（不是所有病例都需要手术）
        surgeryScore = 20;
        surgeryComment = '无需手术处理';
      }
      score += surgeryScore;
      scoreBreakdown.surgery = { score: surgeryScore, maxScore: 20, comment: surgeryComment };

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
        errorPoints: [],
        overallComment: generateLocalComment(matchType, score, consultingComment, totalExamCost, totalMedCost),
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
        surgeries: completedSurgeries.map(s => ({
          name: (s.surgeryType && typeof s.surgeryType === 'object') ? s.surgeryType.name : (s.surgeryType || '未知'),
          typeLabel: s.typeLabel || s.type,
          anesthesiaLabel: s.anesthesiaLabel || s.anesthesiaType,
          outcome: s.outcome || '',
          findings: s.findings || '',
          complications: s.complications || '',
          postOpNotes: s.postOpNotes || ''
        })),
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
