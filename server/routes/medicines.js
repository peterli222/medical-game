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
  // 品牌名映射（完整版）
  // 抗生素品牌
  '阿莫西林': ['阿莫西林胶囊', '羟氨苄青霉素'],
  '头孢': ['头孢克肟', '头孢呋辛', '头孢地尼', '头孢克洛', '头孢丙烯', '头孢泊肟'],
  '阿奇霉素': ['阿奇霉素片', '阿奇霉素干混悬剂', '希舒美'],
  '青霉素': ['青霉素', '阿莫西林'],
  // 感冒药品牌
  '感康': ['复方氨酚烷胺片'],
  '快克': ['复方氨酚烷胺胶囊'],
  '泰诺': ['酚麻美敏片', '对乙酰氨基酚'],
  '白加黑': ['氨酚伪麻美芬片'],
  '新康泰克': ['盐酸伪麻黄碱', '氯苯那敏'],
  '999感冒灵': ['感冒灵颗粒'],
  // 退烧止痛品牌
  '芬必得': ['布洛芬缓释胶囊', '布洛芬'],
  '美林': ['布洛芬混悬液'],
  '泰诺林': ['对乙酰氨基酚混悬滴剂', '对乙酰氨基酚'],
  '散利痛': ['复方对乙酰氨基酚片'],
  // 肠胃药品牌
  '思密达': ['蒙脱石散'],
  '思连康': ['双歧杆菌四联活菌片'],
  '培菲康': ['双歧杆菌三联活菌胶囊'],
  '整肠生': ['地衣芽孢杆菌活菌胶囊'],
  '吗丁啉': ['多潘立酮片'],
  '达喜': ['铝碳酸镁片'],
  '耐信': ['艾司奥美拉唑肠溶片'],
  '洛赛克': ['奥美拉唑肠溶胶囊'],
  // 过敏药品牌
  '贝雪': ['枸地氯雷他定片'],
  '开瑞坦': ['氯雷他定片'],
  '仙特明': ['西替利嗪片'],
  '皿治林': ['依巴斯汀片'],
  // 心血管品牌
  '络活喜': ['氨氯地平片'],
  '代文': ['缬沙坦胶囊'],
  '拜阿司匹灵': ['阿司匹林肠溶片'],
  '立普妥': ['阿托伐他汀钙片'],
  '可定': ['瑞舒伐他汀钙片'],
  '倍他乐克': ['美托洛尔片'],
  '波立维': ['氯吡格雷片'],
  // 降糖药品牌
  '拜唐苹': ['阿卡波糖片'],
  '格华止': ['二甲双胍片'],
  '达美康': ['格列齐特缓释片'],
  '诺和龙': ['瑞格列奈片'],
  '安达唐': ['达格列净片'],
  '欧唐静': ['恩格列净片'],
  // 皮肤科品牌
  '达克宁': ['咪康唑乳膏'],
  '金达克宁': ['酮康唑乳膏'],
  '兰美抒': ['特比萘芬片'],
  '皮炎平': ['地奈德乳膏', '醋酸地塞米松'],
  '百多邦': ['莫匹罗星软膏'],
  '扶他林': ['双氯芬酸钠片', '双氯芬酸钠缓释胶囊'],
  // 眼科品牌
  '左氧氟沙星': ['左氧氟沙星滴眼液'],
  '海露': ['玻璃酸钠滴眼液'],
  // 中成药品牌
  '板蓝根': ['板蓝根颗粒'],
  '连花清瘟': ['连花清瘟胶囊'],
  '双黄连': ['双黄连口服液'],
  '六味地黄丸': ['六味地黄丸'],
  '金匮肾气丸': ['金匮肾气丸'],
  // 儿童药品牌
  '小快克': ['小儿氨酚黄那敏颗粒'],
  '希刻劳': ['头孢克洛干混悬剂'],
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
