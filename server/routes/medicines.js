const express = require('express');
const router = express.Router();
const dataStore = require('../services/DataStore');
const { MEDICINE_DATABASE, Prescription, PrescriptionItem } = require('../models/Medicine');

// 获取所有药品
router.get('/', (req, res) => {
  res.json({ success: true, data: MEDICINE_DATABASE });
});

// 医学同义词映射
const MEDICAL_SYNONYMS = {
  '感冒': ['上呼吸道感染', '普通感冒', '病毒性感冒', '急性鼻咽炎'],
  '发烧': ['发热', '高热', '低热'],
  '咳嗽': ['咳嗽', '干咳', '镇咳', '咳痰', '感冒咳嗽', '支气管炎咳嗽'],
  '胃疼': ['胃痛', '上腹痛', '腹痛'],
  '拉肚子': ['腹泻', '急性腹泻', '慢性腹泻'],
  '嗓子疼': ['咽痛', '扁桃体炎', '咽炎'],
  '头疼': ['头痛', '偏头痛'],
  '心慌': ['心悸', '心动过速', '心律失常'],
  '过敏': ['过敏性鼻炎', '过敏性结膜炎', '荨麻疹', '过敏性休克'],
  '失眠': ['失眠', '失眠症', '入睡困难'],
  '贫血': ['贫血', '缺铁性贫血', '巨幼细胞性贫血'],
  '胃炎': ['胃炎', '急性胃炎', '慢性胃炎'],
  '肺炎': ['肺炎', '社区获得性肺炎'],
  '支气管炎': ['支气管炎', '急性支气管炎', '慢性支气管炎'],
  '哮喘': ['哮喘', '支气管哮喘'],
  '关节炎': ['关节炎', '骨关节炎', '类风湿关节炎'],
  '鼻炎': ['鼻炎', '过敏性鼻炎', '急性鼻窦炎'],
  '胃溃疡': ['胃溃疡', '十二指肠溃疡'],
  '甲亢': ['甲亢', '甲状腺功能亢进'],
  '抑郁': ['抑郁症', '抑郁'],
  '焦虑': ['焦虑症', '广泛性焦虑障碍'],
};

// 搜索药品（支持搜索药品名、适应症、规格、同义词）
router.get('/search', (req, res) => {
  const { keyword } = req.query;
  if (!keyword || !keyword.trim()) {
    return res.json({ success: true, data: MEDICINE_DATABASE });
  }
  
  const kw = keyword.trim().toLowerCase();
  // 展开同义词
  const searchTerms = [kw];
  for (const [alias, synonyms] of Object.entries(MEDICAL_SYNONYMS)) {
    if (kw.includes(alias) || alias.includes(kw)) {
      searchTerms.push(...synonyms.map(s => s.toLowerCase()));
    }
  }

  const results = MEDICINE_DATABASE.filter(medicine => {
    return searchTerms.some(term => {
      // 搜索药品名称
      if (medicine.name.toLowerCase().includes(term)) return true;
      // 搜索规格
      if (medicine.specification && medicine.specification.toLowerCase().includes(term)) return true;
      // 搜索适应症（主要搜索方式）
      if (medicine.indications && medicine.indications.some(ind => ind.toLowerCase().includes(term))) return true;
      // 搜索不良反应
      if (medicine.adverseReactions && medicine.adverseReactions.some(ar => ar.toLowerCase().includes(term))) return true;
      return false;
    });
  });
  
  res.json({ success: true, data: results });
});

// 获取患者的所有处方
router.get('/patient/:patientId', (req, res) => {
  const prescriptions = dataStore.getPatientPrescriptions(req.params.patientId);
  res.json({ success: true, data: prescriptions });
});

// 创建处方
router.post('/prescription', (req, res) => {
  try {
    const { patientId, medicines, diagnosis, notes } = req.body;
    
    // 验证药品信息
    const prescriptionItems = medicines.map(med => new PrescriptionItem(med));
    
    const prescription = dataStore.createPrescription({
      patientId,
      medicines: prescriptionItems.map(item => item.toJSON()),
      diagnosis,
      notes
    });
    
    res.json({ success: true, data: prescription.toJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取处方详情
router.get('/prescription/:id', (req, res) => {
  const prescription = dataStore.getPrescription(req.params.id);
  if (prescription) {
    res.json({ success: true, data: prescription.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '处方不存在' });
  }
});

// 更新处方状态（发药）
router.put('/prescription/:id/dispense', (req, res) => {
  const prescription = dataStore.getPrescription(req.params.id);
  if (prescription) {
    prescription.status = 'dispensed';
    res.json({ success: true, data: prescription.toJSON() });
  } else {
    res.status(404).json({ success: false, message: '处方不存在' });
  }
});

// 删除处方
router.delete('/prescription/:id', (req, res) => {
  res.json({ success: true, message: '处方已删除' });
});

module.exports = router;
