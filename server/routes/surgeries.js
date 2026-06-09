const express = require('express');
const router = express.Router();
const { Surgery, SURGERY_DATABASE, SURGERY_TYPES, ANESTHESIA_TYPES, SURGERY_STATUS } = require('../models/Surgery');
const dataStore = require('../services/DataStore');
const llmService = require('../services/LLMService');

// GET / - 获取手术列表（支持按patientId过滤）
router.get('/', async (req, res) => {
  try {
    const { patientId } = req.query;
    let surgeries;
    if (patientId) {
      surgeries = dataStore.getPatientSurgeries(patientId);
    } else {
      surgeries = dataStore.getAllSurgeries();
    }
    res.json({ success: true, data: surgeries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /types - 返回手术类型
router.get('/types', (req, res) => {
  res.json({ success: true, data: SURGERY_TYPES });
});

// GET /anesthesia - 返回麻醉类型
router.get('/anesthesia', (req, res) => {
  res.json({ success: true, data: ANESTHESIA_TYPES });
});

// GET /status - 返回手术状态
router.get('/status', (req, res) => {
  res.json({ success: true, data: SURGERY_STATUS });
});

// GET /database - 返回手术库
router.get('/database', (req, res) => {
  res.json({ success: true, data: SURGERY_DATABASE });
});

// GET /search?q=xxx - 搜索手术
router.get('/search', (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    if (!query) {
      return res.json({ success: true, data: SURGERY_DATABASE });
    }
    const results = SURGERY_DATABASE.filter(s =>
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.department && s.department.toLowerCase().includes(query))
    );
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id - 获取单个手术详情
router.get('/:id', async (req, res) => {
  try {
    const surgery = await dataStore.getSurgery(req.params.id);
    if (!surgery) {
      return res.status(404).json({ success: false, message: '手术不存在' });
    }
    res.json({ success: true, data: surgery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST / - 创建手术申请
router.post('/', async (req, res) => {
  try {
    const surgery = new Surgery(req.body);
    const created = await dataStore.createSurgery(surgery);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/status - 更新手术状态
router.put('/:id/status', async (req, res) => {
  try {
    const updated = await dataStore.updateSurgeryStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({ success: false, message: '手术不存在' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - 更新手术信息
router.put('/:id', async (req, res) => {
  try {
    const updated = await dataStore.updateSurgery(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: '手术不存在' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - 删除手术
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteSurgery(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '手术不存在' });
    }
    res.json({ success: true, data: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/ai-arrange - AI一键安排手术（SSE流式）
router.post('/:id/ai-arrange', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const surgery = await dataStore.getSurgery(req.params.id);
    if (!surgery) {
      sendEvent('error', { message: '手术不存在' });
      return res.end();
    }

    const patient = await dataStore.getPatient(surgery.patientId);
    const diagnosis = patient ? (patient.currentDiagnosis || patient.diagnosis || '') : '';

    sendEvent('progress', { message: 'AI正在分析患者信息并安排手术方案...' });

    // 使用统一的患者信息前缀格式
    const agent = dataStore.getPatientAgent(surgery.patientId);
    const conversationHistory = (agent && agent.conversationHistory) ? agent.conversationHistory : [];
    const completedExams = dataStore.getPatientExaminationOrders(surgery.patientId)
      .filter(o => o.status === 'completed');
    const completedSurgeries = dataStore.getPatientSurgeries(surgery.patientId)
      .filter(s => s.status === 'completed' && s.id !== req.params.id);
    const patientInfo = patient ? { name: patient.name, age: patient.age, gender: patient.gender } : {};
    const caseInfo = agent && agent.currentCase ? agent.currentCase : {};
    const patientContext = llmService.buildPatientContextBlock(patientInfo, caseInfo, completedExams, { conversationHistory, completedSurgeries });

    const prompt = `你是一位资深外科主任，请根据以下信息为患者安排手术方案。

${patientContext}

手术名称：${surgery.name || surgery.surgeryName || '待定'}

请以JSON格式返回手术安排方案，包含以下字段：
{
  "recommendedSurgeryType": "推荐的手术类型",
  "surgicalApproach": "手术方式/入路",
  "anesthesiaType": "麻醉方式",
  "surgicalTeam": { "主刀医生": "", "一助": "", "二助": "", "麻醉医生": "", "器械护士": "", "巡回护士": "" },
  "preoperativeDiagnosis": "术前诊断",
  "preoperativeNotes": "术前准备要点",
  "estimatedDuration": "预计手术时长",
  "riskAssessment": "风险评估"
}

只返回JSON，不要其他文字。`;

    const aiResult = await llmService.chat([
      { role: 'system', content: '你是资深外科主任，擅长手术规划。只返回JSON格式数据。' },
      { role: 'user', content: prompt }
    ]);

    sendEvent('progress', { message: 'AI分析完成，正在解析手术方案...' });

    const aiContent = aiResult.success ? aiResult.content : '';
    const aiUsage = aiResult.usage || null;

    let arrangement;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      arrangement = JSON.parse(jsonMatch ? jsonMatch[0] : aiContent);
    } catch (parseErr) {
      arrangement = { rawResponse: aiContent };
    }

    sendEvent('arrangement', { ...arrangement, _usage: aiUsage });

    // 更新手术记录
    const updatedSurgery = await dataStore.updateSurgery(req.params.id, {
      ...surgery,
      aiArrangement: arrangement,
      status: SURGERY_STATUS.SCHEDULED || 'scheduled'
    });

    sendEvent('complete', { message: '手术安排完成', data: updatedSurgery });
    res.end();
  } catch (err) {
    sendEvent('error', { message: err.message });
    res.end();
  }
});

module.exports = router;
