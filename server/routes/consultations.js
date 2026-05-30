const express = require('express');
const router = express.Router();
const { Consultation, CONSULTATION_TYPES, CONSULTATION_STATUS } = require('../models/Consultation');
const dataStore = require('../services/DataStore');
const llmService = require('../services/LLMService');

// 获取所有会诊记录
router.get('/', (req, res) => {
  try {
    const consultations = dataStore.getAllConsultations();
    res.json({ success: true, data: consultations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取会诊类型
router.get('/types', (req, res) => {
  res.json({ success: true, data: CONSULTATION_TYPES });
});

// 获取会诊状态
router.get('/status', (req, res) => {
  res.json({ success: true, data: CONSULTATION_STATUS });
});

// 获取单个会诊详情
router.get('/:id', (req, res) => {
  try {
    const consultation = dataStore.getConsultation(req.params.id);
    if (consultation) {
      res.json({ success: true, data: consultation.toJSON() });
    } else {
      res.status(404).json({ success: false, message: '会诊记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 创建会诊申请
router.post('/', (req, res) => {
  try {
    const consultation = new Consultation(req.body);
    const created = dataStore.createConsultation(consultation);
    res.json({ success: true, data: created.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新会诊信息
router.put('/:id', (req, res) => {
  try {
    const consultation = dataStore.updateConsultation(req.params.id, req.body);
    if (consultation) {
      res.json({ success: true, data: consultation.toJSON() });
    } else {
      res.status(404).json({ success: false, message: '会诊记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新会诊状态
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!CONSULTATION_STATUS[status]) {
      return res.status(400).json({ success: false, message: '无效的会诊状态' });
    }
    const consultation = dataStore.updateConsultation(req.params.id, { status });
    if (consultation) {
      res.json({ success: true, data: consultation.toJSON() });
    } else {
      res.status(404).json({ success: false, message: '会诊记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除会诊记录
router.delete('/:id', (req, res) => {
  try {
    const deleted = dataStore.deleteConsultation(req.params.id);
    if (deleted) {
      res.json({ success: true, message: '会诊记录已删除' });
    } else {
      res.status(404).json({ success: false, message: '会诊记录不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI生成会诊意见（SSE流式）
router.post('/:id/ai-opinion', async (req, res) => {
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
    // 获取会诊记录
    const consultation = dataStore.getConsultation(req.params.id);
    if (!consultation) {
      sendEvent('error', { message: '会诊记录不存在' });
      return res.end();
    }

    // 获取患者信息
    const patient = dataStore.getPatient(consultation.patientId);
    if (!patient) {
      sendEvent('error', { message: '患者信息不存在' });
      return res.end();
    }

    sendEvent('status', { message: '正在收集患者资料...' });

    // 自动获取患者病例作为上下文
    const medicalRecord = dataStore.getPatientMedicalRecord(consultation.patientId);
    const medicalRecordContext = medicalRecord
      ? `病历信息：\n主诉：${medicalRecord.chiefComplaint || '无'}\n现病史：${medicalRecord.presentIllness || '无'}\n既往史：${medicalRecord.pastHistory || '无'}\n诊断：${medicalRecord.diagnosis || '无'}\n中医诊断：${medicalRecord.tcmDiagnosis || '无'}`
      : '暂无病历记录';

    // 获取检查记录
    const examinations = dataStore.getPatientExaminationOrders(consultation.patientId);
    const examContext = examinations.length > 0
      ? `检查记录：\n${examinations.map(e => `- ${e.examinationName}：${e.status === 'completed' ? (e.result?.description || '已完成') : e.status}`).join('\n')}`
      : '暂无检查记录';

    // 获取问诊记录（患者智能体的对话历史）
    const agent = dataStore.getPatientAgent(consultation.patientId);
    let inquiryContext = '暂无问诊记录';
    if (agent && agent.conversationHistory && agent.conversationHistory.length > 0) {
      inquiryContext = `问诊记录：\n${agent.conversationHistory.map(c => `${c.role === 'doctor' ? '医生' : '患者'}：${c.content}`).join('\n')}`;
    }

    sendEvent('status', { message: '正在生成AI会诊意见...' });

    // 构建会诊类型描述
    const typeName = CONSULTATION_TYPES[consultation.type] || consultation.type;

    // 构建AI提示
    const prompt = `你是一位资深医学专家，正在参与${typeName}。请根据以下信息给出专业的会诊意见。

【会诊信息】
会诊类型：${typeName}
申请科室：${consultation.requestingDepartment || '未指定'}
会诊科室：${consultation.consultingDepartment || '未指定'}
申请医生：${consultation.requestingDoctor || '未指定'}
会诊原因：${consultation.reason || '未提供'}
初步诊断：${consultation.diagnosis || '未提供'}

【患者信息】
姓名：${patient.name}
年龄：${patient.age}岁
性别：${patient.gender}

【${medicalRecordContext}】

【${examContext}】

【${inquiryContext}】

请给出详细的会诊意见，包括：
1. 对患者病情的分析和评估
2. 建议的进一步检查（如有需要）
3. 治疗方案建议
4. 注意事项和随访建议

请用专业但易懂的语言回答。`;

    const messages = [
      { role: 'system', content: '你是一位资深医学专家，擅长多学科会诊。请根据提供的患者信息给出专业、详细的会诊意见。' },
      { role: 'user', content: prompt }
    ];

    // 流式调用AI
    let fullOpinion = '';
    let streamUsage = null;
    const streamResult = await llmService.chatStream(messages, 0.7, 2000);

    if (streamResult.success) {
      const stream = streamResult.stream;

      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              // 捕获usage信息（DeepSeek在最后一个chunk返回）
              if (parsed.usage) {
                streamUsage = parsed.usage;
              }
              if (parsed.choices && parsed.choices[0]) {
                const delta = parsed.choices[0].delta;
                if (delta && delta.content) {
                  const token = delta.content;
                  fullOpinion += token;
                  const visibleContent = llmService.cleanThinkingTags(fullOpinion);
                  sendEvent('token', { token, full: visibleContent });
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      stream.on('end', () => {
        // 清理thinking标签
        fullOpinion = llmService.cleanThinkingTags(fullOpinion);

        // 更新会诊记录的aiOpinion字段
        dataStore.updateConsultation(req.params.id, {
          aiOpinion: fullOpinion,
          updatedAt: new Date().toISOString()
        });

        sendEvent('result', { aiOpinion: fullOpinion, _usage: streamUsage });
        sendEvent('done', { consultationId: req.params.id });
        res.end();
      });

      stream.on('error', (error) => {
        console.error('AI会诊意见流式错误:', error);
        sendEvent('error', { message: 'AI生成失败：' + error.message });
        res.end();
      });
    } else {
      // 如果流式失败，尝试非流式调用
      sendEvent('status', { message: '正在使用备用方式生成...' });

      const result = await llmService.chat(messages, 0.7, 2000);
      if (result.success) {
        fullOpinion = result.content;

        // 更新会诊记录
        dataStore.updateConsultation(req.params.id, {
          aiOpinion: fullOpinion,
          updatedAt: new Date().toISOString()
        });

        sendEvent('result', { aiOpinion: fullOpinion });
        sendEvent('done', { consultationId: req.params.id });
      } else {
        sendEvent('error', { message: 'AI服务不可用：' + (result.error || '未知错误') });
      }
      res.end();
    }
  } catch (error) {
    console.error('AI会诊意见生成错误:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

// POST /ai-generate - AI一键填写会诊申请（SSE流式）
router.post('/ai-generate', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive'
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { patientId } = req.body;
    send('progress', { message: '正在获取患者信息...' });

    const patient = dataStore.getPatient(patientId);
    if (!patient) {
      send('error', { message: '患者未找到' });
      res.end();
      return;
    }

    // 获取病历信息作为上下文
    const medicalRecord = dataStore.getPatientMedicalRecord(patientId);
    const medicalRecordContext = medicalRecord
      ? `主诉：${medicalRecord.chiefComplaint || '无'}\n现病史：${medicalRecord.presentIllness || '无'}\n既往史：${medicalRecord.pastHistory || '无'}\n诊断：${medicalRecord.diagnosis || '无'}`
      : '暂无病历记录';

    send('progress', { message: 'AI正在分析病情并生成会诊申请...' });

    const prompt = `你是一名资深主治医师。请根据以下患者信息，生成一份会诊申请。

患者信息：
- 姓名：${patient.name}
- 年龄：${patient.age}
- 性别：${patient.gender}
- 主诉：${patient.chiefComplaint || '无'}
- 现病史：${patient.presentIllness || '无'}
- 既往史：${patient.pastHistory || '无'}
- 当前诊断：${patient.diagnosis || '未明确'}

病历信息：
${medicalRecordContext}

会诊类型说明：
- regular：普通会诊（一般病情需要其他科室协助）
- emergency：急会诊（紧急情况需要立即会诊）
- multi：多学科会诊（涉及多个系统的复杂病情）

请以JSON格式返回（不要其他文字）：
{
  "type": "regular/emergency/multi",
  "requestingDepartment": "申请科室（当前患者所在科室）",
  "consultingDepartment": "会诊科室（根据病情推荐的科室，如心内科、呼吸科、消化科、神经内科、骨科等）",
  "reason": "会诊原因（简述患者病情和需要会诊的具体原因）",
  "diagnosis": "目前诊断（根据症状给出的初步诊断）"
}`;

    const aiResult = await llmService.chat([
      { role: 'system', content: '你是一名资深主治医师，擅长多学科会诊申请。只返回JSON格式数据。' },
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
        type: 'regular',
        requestingDepartment: '内科',
        consultingDepartment: '心内科',
        reason: `患者${patient.name}，${patient.age}岁，${patient.chiefComplaint || '病情需要多学科协助'}，建议会诊进一步评估。`,
        diagnosis: patient.diagnosis || '待查'
      };
    }

    send('result', {
      type: recommendation.type || 'regular',
      requestingDepartment: recommendation.requestingDepartment || '',
      consultingDepartment: recommendation.consultingDepartment || '',
      reason: recommendation.reason || '',
      diagnosis: recommendation.diagnosis || '',
      _usage: aiUsage
    });
    send('done', { message: 'AI会诊申请生成完成' });
    res.end();
  } catch (error) {
    console.error('AI会诊申请生成错误:', error);
    send('error', { message: error.message });
    res.end();
  }
});

module.exports = router;
