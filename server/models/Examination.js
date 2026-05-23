const { v4: uuidv4 } = require('uuid');

// 血常规参考值（最新临床标准）
const BLOOD_TEST_REFERENCE = {
  WBC: { name: '白细胞计数', unit: '×10⁹/L', min: 4.0, max: 10.0 },
  RBC: { name: '红细胞计数', unit: '×10¹²/L', minMale: 4.3, maxMale: 5.8, minFemale: 3.8, maxFemale: 5.1 },
  HGB: { name: '血红蛋白', unit: 'g/L', minMale: 130, maxMale: 175, minFemale: 115, maxFemale: 150 },
  HCT: { name: '红细胞压积', unit: '%', minMale: 40, maxMale: 50, minFemale: 35, maxFemale: 45 },
  MCV: { name: '平均红细胞体积', unit: 'fL', min: 82, max: 100 },
  MCH: { name: '平均红细胞血红蛋白量', unit: 'pg', min: 27, max: 34 },
  MCHC: { name: '平均红细胞血红蛋白浓度', unit: 'g/L', min: 316, max: 354 },
  PLT: { name: '血小板计数', unit: '×10⁹/L', min: 125, max: 350 },
  NEUT: { name: '中性粒细胞百分比', unit: '%', min: 50, max: 70 },
  LYMPH: { name: '淋巴细胞百分比', unit: '%', min: 20, max: 40 },
  MONO: { name: '单核细胞百分比', unit: '%', min: 3, max: 10 },
  EO: { name: '嗜酸性粒细胞百分比', unit: '%', min: 0.5, max: 5 },
  BASO: { name: '嗜碱性粒细胞百分比', unit: '%', min: 0, max: 1 },
  NEUT_ABS: { name: '中性粒细胞绝对值', unit: '×10⁹/L', min: 2.0, max: 7.0 },
  LYMPH_ABS: { name: '淋巴细胞绝对值', unit: '×10⁹/L', min: 0.8, max: 4.0 },
  MONO_ABS: { name: '单核细胞绝对值', unit: '×10⁹/L', min: 0.12, max: 0.8 },
  EO_ABS: { name: '嗜酸性粒细胞绝对值', unit: '×10⁹/L', min: 0.02, max: 0.5 },
  BASO_ABS: { name: '嗜碱性粒细胞绝对值', unit: '×10⁹/L', min: 0, max: 0.1 },
  RDW_CV: { name: '红细胞分布宽度CV', unit: '%', min: 11.5, max: 14.5 },
  RDW_SD: { name: '红细胞分布宽度SD', unit: 'fL', min: 35, max: 56 },
  PDW: { name: '血小板分布宽度', unit: 'fL', min: 15, max: 17 },
  MPV: { name: '平均血小板体积', unit: 'fL', min: 7, max: 11 }
};

// 检查项目定义（含可查出疾病关联字段 searchableDiseases）
const EXAMINATION_TYPES = {
  // ========== 实验室检查 ==========
  bloodRoutine: {
    id: 'blood_routine',
    name: '血常规',
    category: '实验室检查',
    price: 25,
    description: '全血细胞计数及分类',
    referenceValues: BLOOD_TEST_REFERENCE,
    searchableDiseases: ['贫血', '白血病', '感染', '败血症', '血小板减少', '过敏', '寄生虫']
  },
  urineRoutine: {
    id: 'urine_routine',
    name: '尿常规',
    category: '实验室检查',
    price: 15,
    description: '尿液常规检查',
    searchableDiseases: ['尿路感染', '肾炎', '肾结石', '糖尿病', '膀胱炎', '蛋白尿']
  },
  stoolRoutine: {
    id: 'stool_routine',
    name: '大便常规',
    category: '实验室检查',
    price: 15,
    description: '粪便常规检查',
    searchableDiseases: ['肠炎', '痢疾', '消化道出血', '寄生虫', '腹泻', '消化不良']
  },
  liverFunction: {
    id: 'liver_function',
    name: '肝功能',
    category: '实验室检查',
    price: 80,
    description: '肝脏功能检测',
    searchableDiseases: ['肝炎', '肝硬化', '脂肪肝', '肝癌', '胆囊炎', '黄疸', '酒精肝']
  },
  kidneyFunction: {
    id: 'kidney_function',
    name: '肾功能',
    category: '实验室检查',
    price: 60,
    description: '肾脏功能检测',
    searchableDiseases: ['肾炎', '肾衰竭', '尿毒症', '肾结石', '高血压肾病', '糖尿病肾病']
  },
  bloodSugar: {
    id: 'blood_sugar',
    name: '血糖',
    category: '实验室检查',
    price: 20,
    description: '血糖检测',
    searchableDiseases: ['糖尿病', '低血糖', '糖尿病酮症', '胰腺炎', '甲状腺功能亢进']
  },
  lipidProfile: {
    id: 'lipid_profile',
    name: '血脂',
    category: '实验室检查',
    price: 70,
    description: '血脂全套检测',
    searchableDiseases: ['高血脂', '动脉粥样硬化', '冠心病', '脂肪肝', '胰腺炎', '肥胖']
  },
  electrolytes: {
    id: 'electrolytes',
    name: '电解质',
    category: '实验室检查',
    price: 45,
    description: '电解质检测（钾钠氯钙等）',
    searchableDiseases: ['电解质紊乱', '脱水', '心律失常', '肾衰竭', '呕吐', '腹泻', '低钾血症']
  },
  coagulation: {
    id: 'coagulation',
    name: '凝血功能',
    category: '实验室检查',
    price: 55,
    description: '凝血功能检测',
    searchableDiseases: ['出血', '血栓', '肝病', '弥散性血管内凝血', 'DIC', '深静脉血栓']
  },
  thyroidFunction: {
    id: 'thyroid_function',
    name: '甲状腺功能',
    category: '实验室检查',
    price: 120,
    description: '甲状腺激素检测',
    searchableDiseases: ['甲亢', '甲减', '甲状腺结节', '甲状腺炎', '甲状腺癌', 'Graves病']
  },
  tumorMarkers: {
    id: 'tumor_markers',
    name: '肿瘤标志物',
    category: '实验室检查',
    price: 200,
    description: '肿瘤标志物检测（AFP/CEA/CA199等）',
    searchableDiseases: ['肝癌', '胃癌', '结直肠癌', '肺癌', '胰腺癌', '乳腺癌', '肿瘤']
  },
  cardiacEnzymes: {
    id: 'cardiac_enzymes',
    name: '心肌酶谱',
    category: '实验室检查',
    price: 90,
    description: '心肌酶谱检测（CK/CK-MB/LDH等）',
    searchableDiseases: ['心肌梗死', '心肌炎', '心绞痛', '冠心病', '心力衰竭']
  },
  crp: {
    id: 'crp',
    name: 'C反应蛋白',
    category: '实验室检查',
    price: 35,
    description: 'C反应蛋白检测',
    searchableDiseases: ['感染', '炎症', '肺炎', '风湿', '自身免疫病', '术后感染']
  },
  pct: {
    id: 'pct',
    name: '降钙素原',
    category: '实验室检查',
    price: 80,
    description: '降钙素原检测（PCT）',
    searchableDiseases: ['败血症', '细菌感染', '脓毒症', '肺炎', '腹膜炎', '脑膜炎']
  },
  esr: {
    id: 'esr',
    name: '血沉',
    category: '实验室检查',
    price: 10,
    description: '红细胞沉降率',
    searchableDiseases: ['风湿', '类风湿', '结核', '炎症', '贫血', '多发性骨髓瘤']
  },
  fluA: {
    id: 'flu_a',
    name: '甲流检测',
    category: '实验室检查',
    price: 80,
    description: '甲型流感病毒核酸检测',
    searchableDiseases: ['流感', '甲流', '感冒', '发热', '上呼吸道感染']
  },
  fluB: {
    id: 'flu_b',
    name: '乙流检测',
    category: '实验室检查',
    price: 80,
    description: '乙型流感病毒核酸检测',
    searchableDiseases: ['流感', '乙流', '感冒', '发热', '上呼吸道感染']
  },
  covid19: {
    id: 'covid_19',
    name: '新冠检测',
    category: '实验室检查',
    price: 60,
    description: '新型冠状病毒核酸检测',
    searchableDiseases: ['新冠', '新冠肺炎', '发热', '咳嗽', '上呼吸道感染']
  },
  mycoplasma: {
    id: 'mycoplasma',
    name: '支原体检测',
    category: '实验室检查',
    price: 100,
    description: '肺炎支原体核酸检测',
    searchableDiseases: ['支原体肺炎', '肺炎', '咳嗽', '支气管炎', '上呼吸道感染']
  },

  // ========== 影像学检查 ==========
  xRay: {
    id: 'x_ray',
    name: 'X光检查',
    category: '影像学检查',
    price: 60,
    description: 'X射线摄影',
    bodyParts: ['胸片', '腹平片', '骨关节'],
    searchableDiseases: ['肺炎', '骨折', '气胸', '肺结核', '胸腔积液', '肠梗阻', '关节炎']
  },
  ctScan: {
    id: 'ct_scan',
    name: 'CT检查',
    category: '影像学检查',
    price: 280,
    description: '计算机断层扫描',
    bodyParts: ['头部', '胸部', '腹部', '盆腔', '脊柱', '四肢'],
    searchableDiseases: ['脑出血', '脑梗死', '肺炎', '肺癌', '肝癌', '骨折', '颅脑外伤', '肺栓塞']
  },
  mri: {
    id: 'mri',
    name: 'MRI检查',
    category: '影像学检查',
    price: 600,
    description: '磁共振成像',
    bodyParts: ['头部', '脊柱', '关节', '腹部'],
    searchableDiseases: ['脑梗死', '脑肿瘤', '椎间盘突出', '半月板损伤', '脊髓损伤', '韧带损伤']
  },
  ultrasound: {
    id: 'ultrasound',
    name: 'B超检查',
    category: '影像学检查',
    price: 120,
    description: '超声检查',
    bodyParts: ['腹部', '心脏', '甲状腺', '乳腺', '泌尿系'],
    searchableDiseases: ['胆结石', '肾结石', '肝硬化', '甲状腺结节', '乳腺增生', '胆囊炎', '子宫肌瘤']
  },
  ecg: {
    id: 'ecg',
    name: '心电图',
    category: '影像学检查',
    price: 30,
    description: '十二导联心电图',
    searchableDiseases: ['心律失常', '心肌梗死', '心绞痛', '冠心病', '房颤', '心肌炎', '心力衰竭']
  },

  // ========== 特殊检查 ==========
  gastroscopy: {
    id: 'gastroscopy',
    name: '胃镜',
    category: '特殊检查',
    price: 350,
    description: '电子胃镜检查',
    searchableDiseases: ['胃炎', '胃溃疡', '胃癌', '食管炎', '食管癌', '幽门螺杆菌', '消化道出血']
  },
  colonoscopy: {
    id: 'colonoscopy',
    name: '肠镜',
    category: '特殊检查',
    price: 400,
    description: '电子结肠镜检查',
    searchableDiseases: ['结直肠癌', '肠息肉', '溃疡性结肠炎', '克罗恩病', '肠炎', '便血']
  },
  pulmonaryFunction: {
    id: 'pulmonary_function',
    name: '肺功能',
    category: '特殊检查',
    price: 150,
    description: '肺功能检测',
    searchableDiseases: ['哮喘', '慢阻肺', 'COPD', '肺纤维化', '呼吸衰竭', '支气管炎']
  },
  fundoscopy: {
    id: 'fundoscopy',
    name: '眼底检查',
    category: '特殊检查',
    price: 50,
    description: '眼底镜检查',
    searchableDiseases: ['糖尿病视网膜病变', '高血压眼底病变', '青光眼', '视网膜脱落', '黄斑变性']
  },

  // ========== 内分泌检查 ==========
  hba1c: {
    id: 'hba1c',
    name: '糖化血红蛋白',
    category: '实验室检查',
    price: 60,
    description: '糖化血红蛋白检测（HbA1c）',
    searchableDiseases: ['糖尿病', '糖尿病酮症', '低血糖', '胰腺炎', '妊娠糖尿病']
  },
  sexHormones: {
    id: 'sex_hormones',
    name: '性激素六项',
    category: '实验室检查',
    price: 180,
    description: '性激素六项检测（FSH/LH/E2/P/T/PRL）',
    searchableDiseases: ['不孕不育', '月经不调', '多囊卵巢综合征', '更年期', '闭经', '性功能障碍']
  },
  insulinCPeptide: {
    id: 'insulin_c_peptide',
    name: '胰岛素/C肽',
    category: '实验室检查',
    price: 120,
    description: '胰岛素和C肽释放试验',
    searchableDiseases: ['糖尿病', '胰岛素瘤', '低血糖', '胰腺炎', '糖尿病肾病']
  },

  // ========== 感染性疾病检查 ==========
  hiv: {
    id: 'hiv',
    name: 'HIV检测',
    category: '实验室检查',
    price: 50,
    description: '人类免疫缺陷病毒抗体检测',
    searchableDiseases: ['HIV', '艾滋病', '免疫缺陷', '发热', '淋巴结肿大']
  },
  syphilis: {
    id: 'syphilis',
    name: '梅毒检测',
    category: '实验室检查',
    price: 40,
    description: '梅毒螺旋体抗体检测',
    searchableDiseases: ['梅毒', '皮疹', '溃疡', '淋巴结肿大']
  },
  hepatitisB: {
    id: 'hepatitis_b',
    name: '乙肝五项',
    category: '实验室检查',
    price: 50,
    description: '乙型肝炎五项标志物检测',
    searchableDiseases: ['乙肝', '肝炎', '肝硬化', '肝癌', '黄疸']
  },
  tbTest: {
    id: 'tb_test',
    name: '结核检测',
    category: '实验室检查',
    price: 80,
    description: '结核分枝杆菌检测（T-SPOT/PPD）',
    searchableDiseases: ['肺结核', '结核', '咳嗽', '咯血', '盗汗', '消瘦']
  },
  bloodCulture: {
    id: 'blood_culture',
    name: '血培养',
    category: '实验室检查',
    price: 120,
    description: '血液细菌培养及药敏试验',
    searchableDiseases: ['败血症', '脓毒症', '感染性心内膜炎', '菌血症', '发热']
  },
  sputumCulture: {
    id: 'sputum_culture',
    name: '痰培养',
    category: '实验室检查',
    price: 60,
    description: '痰液细菌培养及药敏试验',
    searchableDiseases: ['肺炎', '支气管炎', '肺脓肿', '肺结核', '咳嗽']
  },
  hpTest: {
    id: 'hp_test',
    name: '幽门螺杆菌检测',
    category: '实验室检查',
    price: 100,
    description: 'C13/C14呼气试验',
    searchableDiseases: ['幽门螺杆菌', '胃炎', '胃溃疡', '胃癌', '消化不良', '口臭']
  },
  urineCulture: {
    id: 'urine_culture',
    name: '尿培养',
    category: '实验室检查',
    price: 60,
    description: '尿液细菌培养及药敏试验',
    searchableDiseases: ['尿路感染', '肾盂肾炎', '膀胱炎', '尿道炎', '前列腺炎']
  },

  // ========== 心血管检查 ==========
  echocardiogram: {
    id: 'echocardiogram',
    name: '心脏彩超',
    category: '影像学检查',
    price: 200,
    description: '超声心动图检查',
    searchableDiseases: ['心力衰竭', '心肌病', '瓣膜病', '先心病', '心包积液', '房颤']
  },
  holter: {
    id: 'holter',
    name: '24小时动态心电图',
    category: '特殊检查',
    price: 180,
    description: '24小时动态心电图监测（Holter）',
    searchableDiseases: ['心律失常', '房颤', '早搏', '心动过速', '心动过缓', '晕厥']
  },
  abpm: {
    id: 'abpm',
    name: '24小时动态血压',
    category: '特殊检查',
    price: 120,
    description: '24小时动态血压监测',
    searchableDiseases: ['高血压', '低血压', '白大衣高血压', '隐匿性高血压', '血压波动']
  },
  cardiacCT: {
    id: 'cardiac_ct',
    name: '冠脉CT造影',
    category: '影像学检查',
    price: 800,
    description: '冠状动脉CT血管造影（CTA）',
    searchableDiseases: ['冠心病', '心绞痛', '心肌梗死', '动脉粥样硬化', '胸痛']
  },

  // ========== 神经系统检查 ==========
  eeg: {
    id: 'eeg',
    name: '脑电图',
    category: '特殊检查',
    price: 150,
    description: '脑电图检查',
    searchableDiseases: ['癫痫', '脑炎', '脑死亡', '头痛', '晕厥', '意识障碍']
  },
  emg: {
    id: 'emg',
    name: '肌电图',
    category: '特殊检查',
    price: 200,
    description: '肌电图及神经传导速度检查',
    searchableDiseases: ['周围神经病', '肌无力', '肌肉萎缩', '腕管综合征', '格林巴利']
  },
  lumbarPuncture: {
    id: 'lumbar_puncture',
    name: '腰椎穿刺',
    category: '特殊检查',
    price: 300,
    description: '腰椎穿刺脑脊液检查',
    searchableDiseases: ['脑膜炎', '脑炎', '蛛网膜下腔出血', '多发性硬化', '格林巴利']
  },

  // ========== 呼吸系统检查 ==========
  bloodGas: {
    id: 'blood_gas',
    name: '血气分析',
    category: '实验室检查',
    price: 60,
    description: '动脉血气分析',
    searchableDiseases: ['呼吸衰竭', '酸碱平衡紊乱', 'COPD', '肺炎', '哮喘', '肺栓塞']
  },
  fev1: {
    id: 'fev1',
    name: '支气管激发试验',
    category: '特殊检查',
    price: 200,
    description: '支气管激发/舒张试验',
    searchableDiseases: ['哮喘', '支气管炎', 'COPD', '呼吸困难']
  },

  // ========== 消化系统检查 ==========
  capsuleEndoscopy: {
    id: 'capsule_endoscopy',
    name: '胶囊内镜',
    category: '特殊检查',
    price: 3000,
    description: '无线胶囊内镜检查',
    searchableDiseases: ['小肠出血', '小肠肿瘤', '克罗恩病', '消化道出血', '不明原因贫血']
  },
  ercp: {
    id: 'ercp',
    name: 'ERCP',
    category: '特殊检查',
    price: 2000,
    description: '内镜逆行胰胆管造影',
    searchableDiseases: ['胆管结石', '胆管癌', '胰腺炎', '胆道梗阻', '黄疸']
  },

  // ========== 泌尿系统检查 ==========
  renalUltrasound: {
    id: 'renal_ultrasound',
    name: '泌尿系彩超',
    category: '影像学检查',
    price: 120,
    description: '泌尿系统超声检查',
    searchableDiseases: ['肾结石', '肾积水', '肾囊肿', '肾肿瘤', '膀胱肿瘤', '前列腺增生']
  },
  urodynamics: {
    id: 'urodynamics',
    name: '尿动力学检查',
    category: '特殊检查',
    price: 350,
    description: '尿动力学检查',
    searchableDiseases: ['尿失禁', '神经源性膀胱', '前列腺增生', '膀胱过度活动', '排尿困难']
  },

  // ========== 骨科检查 ==========
  boneMineralDensity: {
    id: 'bone_mineral_density',
    name: '骨密度检测',
    category: '影像学检查',
    price: 120,
    description: '双能X线骨密度检测',
    searchableDiseases: ['骨质疏松', '骨折', '缺钙', '更年期', '甲旁亢']
  },
  arthroscopy: {
    id: 'arthroscopy',
    name: '关节镜检查',
    category: '特殊检查',
    price: 1500,
    description: '关节镜检查及治疗',
    searchableDiseases: ['半月板损伤', '韧带损伤', '关节炎', '滑膜炎', '关节游离体']
  },

  // ========== 眼科检查 ==========
  oct: {
    id: 'oct',
    name: 'OCT检查',
    category: '特殊检查',
    price: 200,
    description: '光学相干断层扫描',
    searchableDiseases: ['黄斑变性', '糖尿病视网膜病变', '青光眼', '视网膜脱离', '视神经病变']
  },
  visualField: {
    id: 'visual_field',
    name: '视野检查',
    category: '特殊检查',
    price: 80,
    description: '自动视野计检查',
    searchableDiseases: ['青光眼', '视神经病变', '脑肿瘤', '垂体瘤', '视野缺损']
  },

  // ========== 耳鼻喉检查 ==========
  audiometry: {
    id: 'audiometry',
    name: '听力检查',
    category: '特殊检查',
    price: 80,
    description: '纯音听阈测定',
    searchableDiseases: ['耳聋', '听力下降', '中耳炎', '突发性耳聋', '噪声性耳聋', '耳鸣']
  },
  nasalEndoscopy: {
    id: 'nasal_endoscopy',
    name: '鼻内镜检查',
    category: '特殊检查',
    price: 150,
    description: '鼻内镜检查',
    searchableDiseases: ['鼻炎', '鼻窦炎', '鼻息肉', '鼻出血', '鼻中隔偏曲']
  },

  // ========== 皮肤科检查 ==========
  skinBiopsy: {
    id: 'skin_biopsy',
    name: '皮肤活检',
    category: '特殊检查',
    price: 200,
    description: '皮肤组织病理检查',
    searchableDiseases: ['皮肤癌', '湿疹', '银屑病', '红斑狼疮', '皮炎', '黑色素瘤']
  },
  allergyTest: {
    id: 'allergy_test',
    name: '过敏原检测',
    category: '实验室检查',
    price: 300,
    description: '血清特异性IgE过敏原检测',
    searchableDiseases: ['过敏', '荨麻疹', '哮喘', '鼻炎', '湿疹', '食物过敏', '药物过敏']
  },

  // ========== 妇产科检查 ==========
  cervicalSmear: {
    id: 'cervical_smear',
    name: '宫颈涂片',
    category: '实验室检查',
    price: 120,
    description: 'TCT宫颈液基细胞学检查',
    searchableDiseases: ['宫颈癌', '宫颈炎', 'HPV感染', '宫颈糜烂', '白带异常']
  },
  hpvTest: {
    id: 'hpv_test',
    name: 'HPV检测',
    category: '实验室检查',
    price: 280,
    description: '人乳头瘤病毒分型检测',
    searchableDiseases: ['HPV感染', '宫颈癌', '尖锐湿疣', '宫颈炎']
  },

  // ========== 补充实验室检查 ==========
  dDimer: {
    id: 'd_dimer',
    name: 'D-二聚体',
    category: '实验室检查',
    price: 80,
    description: 'D-二聚体检测',
    searchableDiseases: ['肺栓塞', '深静脉血栓', 'DIC', '血栓', '弥散性血管内凝血']
  },
  proBNP: {
    id: 'pro_bnp',
    name: 'BNP/NT-proBNP',
    category: '实验室检查',
    price: 150,
    description: '脑钠肽检测',
    searchableDiseases: ['心力衰竭', '心功能不全', '心肌病', '房颤', '呼吸困难']
  },
  ferritin: {
    id: 'ferritin',
    name: '铁蛋白',
    category: '实验室检查',
    price: 40,
    description: '血清铁蛋白检测',
    searchableDiseases: ['贫血', '缺铁性贫血', '铁过载', '血色病', '炎症']
  },
  vitaminD: {
    id: 'vitamin_d',
    name: '维生素D检测',
    category: '实验室检查',
    price: 100,
    description: '25-羟基维生素D检测',
    searchableDiseases: ['骨质疏松', '佝偻病', '缺钙', '维生素D缺乏', '免疫力低下']
  },
  autoimmune: {
    id: 'autoimmune',
    name: '自身抗体检测',
    category: '实验室检查',
    price: 200,
    description: '自身免疫性疾病抗体谱（ANA/ENA/dsDNA等）',
    searchableDiseases: ['红斑狼疮', '类风湿', '干燥综合征', '硬皮病', '自身免疫病', '风湿']
  }
};

class ExaminationOrder {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId;
    this.examinationType = data.examinationType;
    this.examinationName = data.examinationName;
    this.bodyPart = data.bodyPart || null;
    this.price = data.price || 0;
    this.status = data.status || 'pending'; // pending, completed
    this.result = data.result || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.completedAt = data.completedAt || null;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      examinationType: this.examinationType,
      examinationName: this.examinationName,
      bodyPart: this.bodyPart,
      price: this.price,
      status: this.status,
      result: this.result,
      createdAt: this.createdAt,
      completedAt: this.completedAt
    };
  }
}

module.exports = {
  ExaminationOrder,
  EXAMINATION_TYPES,
  BLOOD_TEST_REFERENCE
};
