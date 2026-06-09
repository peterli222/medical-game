const express = require('express');
const router = express.Router();
const { Admission, DEPARTMENT_CONFIG, ADMISSION_STATUS } = require('../models/Admission');
const dataStore = require('../services/DataStore');
const llmService = require('../services/LLMService');

// GET / - 获取所有住院记录
router.get('/', (req, res) => {
  try {
    const admissions = dataStore.getAllAdmissions();
    res.json({ success: true, data: admissions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /departments - 返回科室配置
router.get('/departments', (req, res) => {
  res.json({ success: true, data: DEPARTMENT_CONFIG });
});

// GET /status - 返回住院状态枚举
router.get('/status', (req, res) => {
  res.json({ success: true, data: ADMISSION_STATUS });
});

// GET /:id - 获取单个住院详情
router.get('/:id', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    res.json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST / - 创建住院申请
router.post('/', (req, res) => {
  try {
    const admission = new Admission(req.body);
    dataStore.createAdmission(admission);
    res.status(201).json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - 更新住院信息
router.put('/:id', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    Object.assign(admission, req.body);
    dataStore.updateAdmission(admission);
    res.json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/daily-record - 添加每日病程记录
router.post('/:id/daily-record', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    const { content, doctor } = req.body;
    admission.addDailyRecord({ content, doctor });
    dataStore.updateAdmission(admission);
    res.json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/transfer - 转科
router.post('/:id/transfer', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    const { newDepartment, reason } = req.body;
    const deptConfig = DEPARTMENT_CONFIG[newDepartment];
    const newBed = deptConfig ? `${newDepartment}-1` : '未知';
    admission.transfer(newDepartment, newBed, reason);
    dataStore.updateAdmission(admission);
    res.json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/discharge - 出院
router.post('/:id/discharge', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    const { dischargeSummary } = req.body;
    admission.discharge(dischargeSummary);
    dataStore.updateAdmission(admission);
    res.json({ success: true, data: admission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - 删除住院记录
router.delete('/:id', (req, res) => {
  try {
    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: '住院记录未找到' });
    }
    dataStore.deleteAdmission(req.params.id);
    res.json({ success: true, message: '住院记录已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /ai-admit - AI一键收治住院（SSE流式）
router.post('/ai-admit', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const patientId = req.body.patientId;
    send('progress', { message: '正在获取患者信息...' });

    const patient = dataStore.getPatient(patientId);
    if (!patient) {
      send('error', { message: '患者未找到' });
      res.end();
      return;
    }

    send('progress', { message: 'AI正在分析病情并推荐科室...' });

    // 使用统一的患者信息前缀格式
    const agent = dataStore.getPatientAgent(patientId);
    const conversationHistory = (agent && agent.conversationHistory) ? agent.conversationHistory : [];
    const completedExams = dataStore.getPatientExaminationOrders(patientId)
      .filter(o => o.status === 'completed');
    const completedSurgeries = dataStore.getPatientSurgeries(patientId)
      .filter(s => s.status === 'completed');
    const patientInfo = { name: patient.name, age: patient.age, gender: patient.gender };
    const caseInfo = agent && agent.currentCase ? agent.currentCase : {};
    const patientContext = llmService.buildPatientContextBlock(patientInfo, caseInfo, completedExams, { conversationHistory, completedSurgeries });

    const prompt = `你是一名资深住院医师。请根据以下患者信息，给出住院建议。

${patientContext}

可用科室：${Object.keys(DEPARTMENT_CONFIG).join(', ')}

请以JSON格式返回（不要其他文字）：
{
  "department": "推荐科室",
  "admissionDiagnosis": "入院诊断",
  "treatmentPlan": "治疗方案",
  "attendingDoctor": "主治医生姓名",
  "severity": "普通/急/危重",
  "reasoning": "推荐理由"
}`;

    const aiResult = await llmService.chat([
      { role: 'system', content: '你是一名资深住院医师，擅长住院管理。只返回JSON格式数据。' },
      { role: 'user', content: prompt }
    ]);
    const aiContent = aiResult.success ? aiResult.content : '';
    const aiUsage = aiResult.usage || null;
    let recommendation;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      recommendation = JSON.parse(jsonMatch ? jsonMatch[0] : aiContent);
    } catch {
      recommendation = {
        department: '内科',
        admissionDiagnosis: patient.diagnosis || '待查',
        treatmentPlan: '待进一步评估',
        attendingDoctor: '待分配',
        severity: '普通',
        reasoning: '无法解析AI建议，使用默认值'
      };
    }

    send('progress', { message: `推荐科室：${recommendation.department}，正在分配床位...` });

    // 分配床位
    const deptConfig = DEPARTMENT_CONFIG[recommendation.department];
    const totalBeds = deptConfig ? deptConfig.beds : 20;
    const allAdmissions = dataStore.getAllAdmissions() || [];
    const occupiedBeds = allAdmissions
      .filter(a => a.department === recommendation.department && a.status === ADMISSION_STATUS.ADMITTED)
      .map(a => a.bed);
    let assignedBed = null;
    for (let i = 1; i <= totalBeds; i++) {
      const bedId = `${recommendation.department}-${i}`;
      if (!occupiedBeds.includes(bedId)) {
        assignedBed = bedId;
        break;
      }
    }
    if (!assignedBed) {
      assignedBed = `${recommendation.department}-${totalBeds + 1}`;
    }

    const admission = new Admission({
      patientId,
      patientName: patient.name,
      department: recommendation.department,
      bed: assignedBed,
      admissionDiagnosis: recommendation.admissionDiagnosis,
      treatmentPlan: recommendation.treatmentPlan,
      attendingDoctor: recommendation.attendingDoctor,
      severity: recommendation.severity,
      status: ADMISSION_STATUS.ADMITTED
    });

    dataStore.createAdmission(admission);

    send('result', {
      admission,
      recommendation,
      bed: assignedBed,
      _usage: aiUsage
    });
    send('done', { message: '住院收治完成' });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
});

// POST /:id/ai-daily-tracking - AI每日追踪（SSE流式）
router.post('/:id/ai-daily-tracking', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send('progress', { message: '正在获取住院记录...' });

    const admission = dataStore.getAdmission(req.params.id);
    if (!admission) {
      send('error', { message: '住院记录未找到' });
      res.end();
      return;
    }

    const patient = dataStore.getPatient(admission.patientId);

    send('progress', { message: 'AI正在生成每日病程记录...' });

    // 使用统一的患者信息前缀格式
    const agent = dataStore.getPatientAgent(admission.patientId);
    const conversationHistory = (agent && agent.conversationHistory) ? agent.conversationHistory : [];
    const completedExams = dataStore.getPatientExaminationOrders(admission.patientId)
      .filter(o => o.status === 'completed');
    const completedSurgeries = dataStore.getPatientSurgeries(admission.patientId)
      .filter(s => s.status === 'completed');
    const patientInfo = patient ? { name: patient.name, age: patient.age, gender: patient.gender } : {};
    const caseInfo = agent && agent.currentCase ? agent.currentCase : {};
    const patientContext = llmService.buildPatientContextBlock(patientInfo, caseInfo, completedExams, { conversationHistory, completedSurgeries });

    const previousRecords = (admission.dailyRecords || [])
      .map((r, i) => `第${i + 1}天 (${r.date}): ${r.content}`)
      .join('\n');

    const prompt = `你是一名主治医师，请为以下住院患者生成今日病程记录。

${patientContext}

科室：${admission.department} | 床号：${admission.bed}
入院诊断：${admission.admissionDiagnosis}
治疗方案：${admission.treatmentPlan}

${previousRecords ? `之前的病程记录：\n${previousRecords}` : '这是首次病程记录。'}

请生成今日病程记录，包括：
1. 患者今日状况
2. 治疗执行情况
3. 检查结果（如有）
4. 下一步治疗计划
5. 注意事项

请直接输出病程记录内容，不要额外的JSON格式。`;

    const content = await llmService.chat(prompt);

    const record = {
      content,
      doctor: admission.attendingDoctor || 'AI助手',
      date: new Date().toISOString().split('T')[0]
    };

    admission.addDailyRecord(record);
    dataStore.updateAdmission(admission);

    send('result', { record, admission });
    send('done', { message: '病程记录生成完成' });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
});

module.exports = router;
