const express = require('express');
const router = express.Router();
const dataStore = require('../services/DataStore');
const MedicalRecord = require('../models/MedicalRecord');

// 获取患者的病历
router.get('/patient/:patientId', (req, res) => {
  const record = dataStore.getPatientMedicalRecord(req.params.patientId);
  if (record) {
    res.json({ success: true, data: record.toJSON() });
  } else {
    res.json({ success: false, message: '病历不存在' });
  }
});

// 创建病历
router.post('/', (req, res) => {
  try {
    const recordData = req.body;
    const record = dataStore.createMedicalRecord(recordData);
    res.json({ success: true, data: record.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新病历
router.put('/:id', (req, res) => {
  const record = dataStore.updateMedicalRecord(req.params.id, req.body);
  if (record) {
    res.json({ success: true, data: record.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '病历不存在' });
  }
});

// 获取病历详情
router.get('/:id', (req, res) => {
  const record = dataStore.getMedicalRecord(req.params.id);
  if (record) {
    res.json({ success: true, data: record.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '病历不存在' });
  }
});

// 生成病历模板（根据患者信息预填充）
router.get('/template/:patientId', (req, res) => {
  const patient = dataStore.getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ success: false, message: '患者不存在' });
  }
  
  // 获取患者的检查单和处方信息
  const examinations = dataStore.getPatientExaminationOrders(req.params.patientId);
  const prescriptions = dataStore.getPatientPrescriptions(req.params.patientId);
  
  // 自动生成现病史描述
  const generatePresentIllness = (patient) => {
    const symptoms = patient.symptoms || [];
    const duration = '2天';
    
    let description = `患者${patient.name}，${patient.age}岁，${patient.gender}性。`;
    description += `因"${symptoms.join('、')}"${duration}来诊。`;
    description += `患者自诉${duration}前无明显诱因出现${symptoms[0] || '不适'}，`;
    if (symptoms.length > 1) {
      description += `伴${symptoms.slice(1).join('、')}，`;
    }
    description += '病程中患者精神、食欲可，睡眠欠佳，大小便正常。';
    
    return description;
  };

  const template = {
    patientId: patient.id,
    patientName: patient.name,
    patientAge: patient.age,
    patientGender: patient.gender,
    // 主诉
    chiefComplaint: patient.symptoms ? `${patient.symptoms.slice(0, 2).join('、')}${Math.floor(Math.random() * 3) + 1}天` : '',
    // 现病史
    presentIllness: generatePresentIllness(patient),
    // 既往史
    pastHistory: patient.medicalHistory && patient.medicalHistory.length > 0 
      ? `否认高血压病史，否认糖尿病史，否认冠心病史。${patient.medicalHistory.join('、')}。否认食物药物过敏史。`
      : '否认高血压病史，否认糖尿病史，否认冠心病史。无特殊病史。否认食物药物过敏史。',
    // 流行病学史
    epidemicHistory: '患者近14天内无登革热、基孔肯雅热疫区旅居史。无蚊虫叮咬史。',
    // 体格检查
    physicalExamination: {
      temperature: '36.7',
      pulse: '88',
      respiration: '20',
      bloodPressure: '112/68',
      oxygenSaturation: '97',
      generalAppearance: '神志清楚，对答切切，精神可。发育正常，营养中等，自动体位，查体合作。',
      skin: '全身皮肤巩膜无黄染，无皮疹及出血点。',
      lymphNodes: '未触及肿大淋巴结。',
      headAndNeck: '头颅无畸形，双侧瞳孔等大等圆，约2.5mm，对光反射灵敏。双肺呼吸音粗，未闻及干湿啰音。心率70次/分，律齐，心脏各瓣膜区未闻及病理性杂音。',
      neck: '气管居中，甲状腺未触及肿大，颈静脉无怒张。',
      chest: '胸廓对称无畸形，呼吸运动双侧对称。',
      lungs: '双肺呼吸音清，未闻及干湿啰音。',
      heart: '心率70次/分，律齐，心脏各瓣膜区未闻及病理性杂音。',
      abdomen: '腹软，无压痛、反跳痛，肝脾肋下未及，墨菲氏征阴性，麦氏点无压痛，肠鸣音约4次/分。',
      rectumGenital: '（未查）',
      extremities: '四肢肌力、肌张力正常，生理反射存在，病理反射未引出。双肾区无叩击痛。',
      nervousSystem: '生理反射存在，病理反射未引出。'
    },
    // 中医四诊
    tcmExamination: {
      inspection: '神志清楚，口唇色淡红，舌质淡红，苔薄白，舌色古的。',
      auscultation: '发声自然，声调和谐，语言流畅。',
      inquiry: '应答自如，呼吸正常。',
      palpation: '脉象：平。全身未及瘿瘤瘰疬。'
    },
    // 辅助检查
    auxiliaryExaminations: examinations.filter(e => e.status === 'completed').map(e => ({
      type: e.examinationName,
      result: e.result
    })),
    // 诊断
    tcmDiagnosis: '腹痛（湿热内蕴证）',
    diagnosis: '腹痛查因：胃肠炎？',
    differentialDiagnosis: '',
    // 诊疗意见
    treatmentPlan: '1. 口服药物治疗\n2. 清淡饮食，多饮水\n3. 注意休息',
    doctorOrders: prescriptions.length > 0 ? '详见处方' : '1. 建议患者完善大便常规检查，患者暂暂无大便无法送检。\n2. 嘱患者出现症状加重、发热或转移性右下腹疼痛即回院就诊。\n3. 休息壹天，清淡饮食，忌辛辣，专科门诊定期复查，不适随诊。'
  };
  
  res.json({ success: true, data: template });
});

module.exports = router;
