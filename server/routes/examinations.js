const express = require('express');
const router = express.Router();
const dataStore = require('../services/DataStore');
const { EXAMINATION_TYPES } = require('../models/Examination');
const llmService = require('../services/LLMService');
const { searchDiseases, recommendExamsBySymptoms } = require('../data/diseaseDatabase');

// 获取所有检查项目类型
router.get('/types', (req, res) => {
  res.json({ success: true, data: EXAMINATION_TYPES });
});

// 搜索检查项目（支持按名称和可查疾病模糊搜索）
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.json({ success: true, data: Object.values(EXAMINATION_TYPES) });
  }

  const query = q.trim().toLowerCase();
  const results = Object.values(EXAMINATION_TYPES).filter(type => {
    // 按检查名称匹配
    if (type.name.toLowerCase().includes(query)) return true;
    if (type.id.toLowerCase().includes(query)) return true;
    if (type.description && type.description.toLowerCase().includes(query)) return true;
    if (type.category && type.category.toLowerCase().includes(query)) return true;

    // 按可查疾病匹配
    if (type.searchableDiseases) {
      return type.searchableDiseases.some(disease =>
        disease.toLowerCase().includes(query)
      );
    }
    return false;
  });

  res.json({ success: true, data: results });
});

// 疾病/症状模糊搜索
router.get('/disease-search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length === 0) {
    return res.json({ success: true, data: [] });
  }
  const results = searchDiseases(q);
  res.json({ success: true, data: results });
});

// 根据症状推荐检查项目
router.get('/recommend-exams', (req, res) => {
  const { symptoms } = req.query;
  if (!symptoms || symptoms.trim().length === 0) {
    return res.json({ success: true, data: [] });
  }
  const recommendations = recommendExamsBySymptoms(symptoms);
  // 填充检查项目详情
  const results = recommendations.map(rec => {
    const examType = Object.values(EXAMINATION_TYPES).find(t => t.id === rec.examId);
    return {
      ...rec,
      name: examType ? examType.name : rec.examId,
      category: examType ? examType.category : '',
      price: examType ? examType.price : 0,
      description: examType ? examType.description : ''
    };
  }).filter(r => r.name); // 只返回有效检查
  res.json({ success: true, data: results });
});

// 获取患者的所有检查单
router.get('/patient/:patientId', (req, res) => {
  const orders = dataStore.getPatientExaminationOrders(req.params.patientId);
  res.json({ success: true, data: orders });
});

// 创建检查单
router.post('/', (req, res) => {
  try {
    const { patientId, examinationType, bodyPart } = req.body;
    
    // 获取检查类型信息
    const examTypeInfo = Object.values(EXAMINATION_TYPES).find(t => t.id === examinationType);
    if (!examTypeInfo) {
      return res.status(400).json({ success: false, message: '无效的检查类型' });
    }
    
    // 验证部位（如果需要）
    if (examTypeInfo.bodyParts && !bodyPart) {
      return res.status(400).json({ 
        success: false, 
        message: `请选择检查部位：${examTypeInfo.bodyParts.join('、')}` 
      });
    }
    
    const order = dataStore.createExaminationOrder({
      patientId,
      examinationType,
      examinationName: examTypeInfo.name + (bodyPart ? `(${bodyPart})` : ''),
      bodyPart,
      price: examTypeInfo.price
    });
    
    res.json({ success: true, data: order.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 执行检查并获取结果
router.post('/:id/execute', async (req, res) => {
  try {
    const order = dataStore.getExaminationOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '检查单不存在' });
    }
    
    // 获取患者智能体来生成结果
    const PatientAgent = require('../services/PatientAgent');
    const agent = dataStore.getPatientAgent(order.patientId);
    
    if (!agent) {
      return res.status(404).json({ success: false, message: '患者智能体不存在' });
    }
    
    // 获取患者性别
    const patient = dataStore.getPatient(order.patientId);
    const gender = patient ? patient.gender : '男';
    
    // 生成检查结果（本地基础数据）
    const result = agent.generateExaminationResult(order.examinationType, order.bodyPart, gender);
    
    // 尝试使用AI生成检查报告描述
    if (llmService.isEnabled() && agent.currentCase) {
      try {
        const patientInfo = patient ? { name: patient.name, age: patient.age, gender: patient.gender } : { name: '患者', age: 30, gender };
        const aiDescription = await llmService.generateExaminationDescription(
          order.examinationType,
          order.bodyPart,
          patientInfo,
          agent.currentCase
        );
        if (aiDescription) {
          result.aiDescription = aiDescription;
          result.aiGenerated = true;
        }
      } catch (e) {
        console.error('AI检查报告生成失败，使用本地结果:', e.message);
      }
    }
    
    // 完成检查单
    const completedOrder = dataStore.completeExaminationOrder(req.params.id, result);
    
    res.json({ success: true, data: completedOrder.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 执行检查并获取结果（流式SSE）
router.post('/:id/execute-stream', async (req, res) => {
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
    const order = dataStore.getExaminationOrder(req.params.id);
    if (!order) {
      sendEvent('error', { message: '检查单不存在' });
      return res.end();
    }
    
    // 获取患者智能体来生成结果
    const PatientAgent = require('../services/PatientAgent');
    const agent = dataStore.getPatientAgent(order.patientId);
    
    if (!agent) {
      sendEvent('error', { message: '患者智能体不存在' });
      return res.end();
    }
    
    // 获取患者性别
    const patient = dataStore.getPatient(order.patientId);
    const gender = patient ? patient.gender : '男';
    
    // 生成检查结果（本地基础数据）
    const result = agent.generateExaminationResult(order.examinationType, order.bodyPart, gender);
    
    sendEvent('status', { message: '正在生成检查报告...' });
    
    // 尝试使用AI流式生成检查报告描述
    let aiDescription = '';
    if (llmService.isEnabled() && agent.currentCase) {
      try {
        const patientInfo = patient ? { name: patient.name, age: patient.age, gender: patient.gender } : { name: '患者', age: 30, gender };
        aiDescription = await llmService.generateExaminationDescriptionStream(
          order.examinationType,
          order.bodyPart,
          patientInfo,
          agent.currentCase,
          (token, fullContent) => {
            sendEvent('token', { token, full: fullContent });
          }
        );
        if (aiDescription) {
          result.aiDescription = aiDescription;
          result.aiGenerated = true;
        }
      } catch (e) {
        console.error('AI检查报告流式生成失败:', e.message);
      }
    }
    
    // 完成检查单
    const completedOrder = dataStore.completeExaminationOrder(req.params.id, result);
    
    sendEvent('result', { 
      result: completedOrder.toJSON().result,
      aiDescription: aiDescription || null
    });
    sendEvent('done', { orderId: req.params.id });
    
  } catch (error) {
    console.error('检查流式错误:', error);
    sendEvent('error', { message: error.message });
  }

  res.end();
});

// 获取检查单详情
router.get('/:id', (req, res) => {
  const order = dataStore.getExaminationOrder(req.params.id);
  if (order) {
    res.json({ success: true, data: order.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '检查单不存在' });
  }
});

// 删除检查单
router.delete('/:id', (req, res) => {
  // 这里可以实现删除逻辑
  res.json({ success: true, message: '检查单已删除' });
});

module.exports = router;
