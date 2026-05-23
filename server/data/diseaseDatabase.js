// 疾病数据库 - 用于症状/疾病模糊搜索
const DISEASE_DATABASE = [
  // ========== 呼吸系统 ==========
  { name: '上呼吸道感染', aliases: ['感冒', '上感', '伤风'], symptoms: ['发热', '咳嗽', '流涕', '咽痛', '鼻塞', '打喷嚏', '头痛'], exams: ['blood_routine', 'crp', 'flu_a', 'flu_b'] },
  { name: '流行性感冒', aliases: ['流感', '甲流', '乙流'], symptoms: ['高热', '全身酸痛', '乏力', '咳嗽', '头痛', '畏寒'], exams: ['flu_a', 'flu_b', 'blood_routine', 'crp'] },
  { name: '肺炎', aliases: ['肺部感染', '大叶性肺炎', '支气管肺炎'], symptoms: ['发热', '咳嗽', '咳痰', '胸痛', '呼吸困难', '咯血'], exams: ['x_ray', 'ct_scan', 'blood_routine', 'crp', 'pct', 'sputum_culture'] },
  { name: '支气管炎', aliases: ['急性支气管炎', '慢性支气管炎', '慢支'], symptoms: ['咳嗽', '咳痰', '胸闷', '气喘', '发热'], exams: ['x_ray', 'blood_routine', 'crp', 'sputum_culture'] },
  { name: '支气管哮喘', aliases: ['哮喘', '过敏性哮喘'], symptoms: ['喘息', '呼吸困难', '胸闷', '咳嗽', '气促'], exams: ['pulmonary_function', 'blood_gas', 'x_ray', 'allergy_test'] },
  { name: '慢性阻塞性肺疾病', aliases: ['慢阻肺', 'COPD', '肺气肿'], symptoms: ['呼吸困难', '慢性咳嗽', '咳痰', '喘息', '活动后气促'], exams: ['pulmonary_function', 'blood_gas', 'x_ray', 'ct_scan'] },
  { name: '肺结核', aliases: ['结核', 'TB', '肺痨'], symptoms: ['咳嗽', '咯血', '盗汗', '低热', '消瘦', '乏力'], exams: ['tb_test', 'x_ray', 'ct_scan', 'blood_routine', 'esr'] },
  { name: '肺癌', aliases: ['肺部肿瘤', '支气管肺癌'], symptoms: ['咳嗽', '咯血', '胸痛', '消瘦', '呼吸困难', '声音嘶哑'], exams: ['ct_scan', 'tumor_markers', 'x_ray', 'pulmonary_function'] },
  { name: '肺栓塞', aliases: ['肺梗死'], symptoms: ['呼吸困难', '胸痛', '咯血', '心悸', '晕厥'], exams: ['d_dimer', 'ct_scan', 'blood_gas', 'ecg'] },
  { name: '胸腔积液', aliases: ['胸水', '胸膜炎'], symptoms: ['呼吸困难', '胸痛', '咳嗽', '发热'], exams: ['x_ray', 'ultrasound', 'ct_scan', 'blood_routine'] },
  { name: '气胸', aliases: ['肺破裂'], symptoms: ['突发胸痛', '呼吸困难', '咳嗽'], exams: ['x_ray', 'ct_scan', 'blood_gas'] },

  // ========== 心血管系统 ==========
  { name: '高血压', aliases: ['血压高', '原发性高血压', '高血压病'], symptoms: ['头痛', '头晕', '耳鸣', '心悸', '视物模糊', '恶心'], exams: ['ecg', 'kidney_function', 'lipid_profile', 'fundoscopy', 'echocardiogram'] },
  { name: '冠心病', aliases: ['冠状动脉粥样硬化性心脏病', '冠脉病'], symptoms: ['胸痛', '胸闷', '心悸', '气短', '活动后加重'], exams: ['ecg', 'cardiac_enzymes', 'lipid_profile', 'echocardiogram', 'cardiac_ct'] },
  { name: '心肌梗死', aliases: ['心梗', '急性心梗', 'AMI'], symptoms: ['剧烈胸痛', '大汗淋漓', '濒死感', '恶心呕吐', '呼吸困难'], exams: ['ecg', 'cardiac_enzymes', 'blood_routine', 'echocardiogram', 'd_dimer'] },
  { name: '心力衰竭', aliases: ['心衰', '心功能不全'], symptoms: ['呼吸困难', '水肿', '乏力', '端坐呼吸', '夜间阵发性呼吸困难'], exams: ['ecg', 'echocardiogram', 'pro_bnp', 'kidney_function', 'x_ray'] },
  { name: '心律失常', aliases: ['房颤', '早搏', '心动过速', '心动过缓', '心慌'], symptoms: ['心悸', '胸闷', '头晕', '晕厥', '乏力'], exams: ['ecg', 'holter', 'thyroid_function', 'electrolytes', 'echocardiogram'] },
  { name: '心肌炎', aliases: ['病毒性心肌炎'], symptoms: ['胸痛', '心悸', '乏力', '发热', '呼吸困难'], exams: ['ecg', 'cardiac_enzymes', 'echocardiogram', 'crp', 'esr'] },
  { name: '感染性心内膜炎', aliases: ['心内膜炎'], symptoms: ['发热', '心脏杂音', '贫血', '脾大', '皮肤出血点'], exams: ['blood_culture', 'ecg', 'echocardiogram', 'blood_routine', 'esr'] },

  // ========== 消化系统 ==========
  { name: '急性胃炎', aliases: ['胃炎', '糜烂性胃炎', '浅表性胃炎'], symptoms: ['上腹痛', '恶心', '呕吐', '食欲不振', '嗳气'], exams: ['gastroscopy', 'hp_test', 'blood_routine'] },
  { name: '慢性胃炎', aliases: ['慢性浅表性胃炎', '萎缩性胃炎'], symptoms: ['上腹隐痛', '嗳气', '反酸', '腹胀', '食欲不振'], exams: ['gastroscopy', 'hp_test', 'tumor_markers'] },
  { name: '胃溃疡', aliases: ['胃十二指肠溃疡', '消化性溃疡'], symptoms: ['上腹痛', '餐后痛', '反酸', '嗳气', '黑便'], exams: ['gastroscopy', 'hp_test', 'blood_routine', 'stool_routine'] },
  { name: '十二指肠溃疡', aliases: ['十二指肠球部溃疡'], symptoms: ['空腹痛', '夜间痛', '上腹痛', '反酸', '嗳气'], exams: ['gastroscopy', 'hp_test', 'blood_routine'] },
  { name: '胃癌', aliases: ['胃部肿瘤', '胃腺癌'], symptoms: ['上腹痛', '消瘦', '食欲减退', '黑便', '呕吐', '吞咽困难'], exams: ['gastroscopy', 'tumor_markers', 'ct_scan', 'blood_routine'] },
  { name: '急性胃肠炎', aliases: ['胃肠炎', '食物中毒', '拉肚子', '腹泻'], symptoms: ['腹泻', '腹痛', '恶心', '呕吐', '发热', '脱水'], exams: ['stool_routine', 'blood_routine', 'electrolytes', 'crp'] },
  { name: '肝炎', aliases: ['急性肝炎', '慢性肝炎', '病毒性肝炎', '乙肝', '丙肝'], symptoms: ['乏力', '食欲不振', '恶心', '黄疸', '肝区疼痛', '尿黄'], exams: ['liver_function', 'hepatitis_b', 'blood_routine', 'ultrasound'] },
  { name: '肝硬化', aliases: ['肝纤维化', '失代偿期肝硬化'], symptoms: ['腹胀', '腹水', '黄疸', '蜘蛛痣', '脾大', '呕血'], exams: ['liver_function', 'ultrasound', 'ct_scan', 'blood_routine', 'coagulation'] },
  { name: '胆囊炎', aliases: ['急性胆囊炎', '慢性胆囊炎'], symptoms: ['右上腹痛', '发热', '恶心呕吐', '厌油腻', '黄疸'], exams: ['ultrasound', 'blood_routine', 'crp', 'liver_function'] },
  { name: '胆结石', aliases: ['胆石症', '胆囊结石', '胆管结石'], symptoms: ['右上腹痛', '胆绞痛', '恶心呕吐', '黄疸', '发热'], exams: ['ultrasound', 'ct_scan', 'liver_function', 'blood_routine'] },
  { name: '急性胰腺炎', aliases: ['胰腺炎', '重症胰腺炎'], symptoms: ['上腹剧痛', '恶心呕吐', '腹胀', '发热', '腰背放射痛'], exams: ['blood_sugar', 'liver_function', 'blood_routine', 'ct_scan', 'electrolytes'] },
  { name: '结直肠癌', aliases: ['肠癌', '大肠癌', '结肠癌', '直肠癌'], symptoms: ['便血', '大便习惯改变', '腹痛', '消瘦', '贫血', '肠梗阻'], exams: ['colonoscopy', 'tumor_markers', 'ct_scan', 'blood_routine'] },
  { name: '溃疡性结肠炎', aliases: ['溃结', 'UC'], symptoms: ['腹泻', '黏液脓血便', '腹痛', '里急后重', '发热'], exams: ['colonoscopy', 'stool_routine', 'blood_routine', 'esr', 'crp'] },
  { name: '克罗恩病', aliases: ['CD', '节段性肠炎'], symptoms: ['腹痛', '腹泻', '消瘦', '发热', '腹部包块', '肛周病变'], exams: ['colonoscopy', 'ct_scan', 'blood_routine', 'crp', 'esr'] },
  { name: '肠梗阻', aliases: ['肠堵塞', '机械性肠梗阻'], symptoms: ['腹痛', '腹胀', '呕吐', '停止排气排便'], exams: ['x_ray', 'ct_scan', 'electrolytes', 'blood_routine'] },
  { name: '阑尾炎', aliases: ['急性阑尾炎', '阑尾穿孔'], symptoms: ['转移性右下腹痛', '发热', '恶心呕吐', '麦氏点压痛'], exams: ['blood_routine', 'crp', 'ultrasound', 'ct_scan'] },
  { name: '消化道出血', aliases: ['上消化道出血', '下消化道出血', '便血', '呕血'], symptoms: ['呕血', '黑便', '便血', '头晕', '心悸', '面色苍白'], exams: ['blood_routine', 'coagulation', 'stool_routine', 'gastroscopy', 'liver_function'] },

  // ========== 泌尿系统 ==========
  { name: '尿路感染', aliases: ['泌尿系感染', '尿道炎', '膀胱炎', '肾盂肾炎'], symptoms: ['尿频', '尿急', '尿痛', '血尿', '发热', '腰痛'], exams: ['urine_routine', 'urine_culture', 'blood_routine', 'crp'] },
  { name: '肾结石', aliases: ['输尿管结石', '肾石症'], symptoms: ['腰痛', '血尿', '肾绞痛', '恶心呕吐', '排尿困难'], exams: ['renal_ultrasound', 'urine_routine', 'kidney_function', 'ct_scan'] },
  { name: '急性肾炎', aliases: ['肾小球肾炎', '肾炎'], symptoms: ['血尿', '蛋白尿', '水肿', '高血压', '少尿'], exams: ['urine_routine', 'kidney_function', 'blood_routine', 'renal_ultrasound'] },
  { name: '慢性肾衰竭', aliases: ['尿毒症', '肾衰', '慢性肾脏病'], symptoms: ['水肿', '乏力', '食欲不振', '恶心', '少尿', '皮肤瘙痒'], exams: ['kidney_function', 'urine_routine', 'electrolytes', 'blood_routine', 'renal_ultrasound'] },
  { name: '肾病综合征', aliases: ['肾综'], symptoms: ['大量蛋白尿', '水肿', '低蛋白血症', '高脂血症'], exams: ['urine_routine', 'kidney_function', 'lipid_profile', 'blood_routine'] },
  { name: '前列腺增生', aliases: ['前列腺肥大', 'BPH'], symptoms: ['尿频', '排尿困难', '尿不尽', '夜尿增多', '尿流细弱'], exams: ['renal_ultrasound', 'urine_routine', 'tumor_markers'] },

  // ========== 内分泌系统 ==========
  { name: '2型糖尿病', aliases: ['糖尿病', 'II型糖尿病', '血糖高', '消渴'], symptoms: ['多饮', '多尿', '多食', '消瘦', '乏力', '视物模糊'], exams: ['blood_sugar', 'hba1c', 'urine_routine', 'lipid_profile', 'kidney_function', 'fundoscopy'] },
  { name: '1型糖尿病', aliases: ['I型糖尿病', '青少年糖尿病'], symptoms: ['多饮', '多尿', '消瘦', '乏力', '酮症酸中毒'], exams: ['blood_sugar', 'hba1c', 'insulin_c_peptide', 'urine_routine'] },
  { name: '甲状腺功能亢进', aliases: ['甲亢', 'Graves病', '甲状腺毒症'], symptoms: ['心悸', '手抖', '消瘦', '多汗', '烦躁', '眼突', '食欲亢进'], exams: ['thyroid_function', 'ecg', 'ultrasound', 'blood_routine'] },
  { name: '甲状腺功能减退', aliases: ['甲减', '桥本甲状腺炎'], symptoms: ['乏力', '怕冷', '便秘', '水肿', '记忆力减退', '皮肤干燥'], exams: ['thyroid_function', 'blood_routine', 'lipid_profile', 'ecg'] },
  { name: '甲状腺结节', aliases: ['甲状腺肿物', '甲状腺肿瘤'], symptoms: ['颈部肿块', '吞咽不适', '声音嘶哑', '呼吸困难'], exams: ['ultrasound', 'thyroid_function', 'tumor_markers'] },
  { name: '痛风', aliases: ['高尿酸血症', '痛风性关节炎'], symptoms: ['关节红肿', '关节剧痛', '足趾疼痛', '发热', '关节活动受限'], exams: ['kidney_function', 'blood_routine', 'crp', 'esr', 'renal_ultrasound'] },
  { name: '库欣综合征', aliases: ['皮质醇增多症', '柯兴综合征'], symptoms: ['满月脸', '水牛背', '向心性肥胖', '紫纹', '高血压', '血糖升高'], exams: ['blood_sugar', 'kidney_function', 'ct_scan', 'sex_hormones'] },

  // ========== 神经系统 ==========
  { name: '脑梗死', aliases: ['脑梗', '缺血性脑卒中', '中风', '脑血栓'], symptoms: ['偏瘫', '言语不清', '口角歪斜', '肢体麻木', '头晕', '意识障碍'], exams: ['ct_scan', 'mri', 'blood_routine', 'blood_sugar', 'coagulation', 'lipid_profile'] },
  { name: '脑出血', aliases: ['出血性脑卒中', '脑溢血'], symptoms: ['突发头痛', '偏瘫', '意识障碍', '呕吐', '血压升高'], exams: ['ct_scan', 'blood_routine', 'coagulation', 'kidney_function'] },
  { name: '癫痫', aliases: ['羊癫疯', '抽搐', '惊厥'], symptoms: ['抽搐', '意识丧失', '口吐白沫', '双眼上翻', '肢体强直'], exams: ['eeg', 'mri', 'ct_scan', 'blood_routine', 'electrolytes'] },
  { name: '偏头痛', aliases: ['血管性头痛', '头痛'], symptoms: ['头痛', '恶心', '畏光', '畏声', '视觉先兆'], exams: ['mri', 'ct_scan', 'eeg', 'blood_routine'] },
  { name: '帕金森病', aliases: ['帕金森', '震颤麻痹'], symptoms: ['手抖', '动作迟缓', '肌肉僵硬', '步态异常', '面具脸'], exams: ['mri', 'eeg', 'blood_routine'] },
  { name: '阿尔茨海默病', aliases: ['老年痴呆', '痴呆', '认知障碍'], symptoms: ['记忆力减退', '认知障碍', '行为异常', '语言障碍', '定向力障碍'], exams: ['mri', 'eeg', 'blood_routine', 'thyroid_function'] },
  { name: '格林-巴利综合征', aliases: ['吉兰-巴雷', 'GBS', '急性炎性脱髓鞘性多发神经根病'], symptoms: ['四肢无力', '感觉异常', '腱反射消失', '呼吸困难'], exams: ['emg', 'lumbar_puncture', 'blood_routine'] },
  { name: '重症肌无力', aliases: ['MG'], symptoms: ['眼睑下垂', '复视', '吞咽困难', '四肢无力', '晨轻暮重'], exams: ['emg', 'ct_scan', 'blood_routine'] },
  { name: '蛛网膜下腔出血', aliases: ['SAH'], symptoms: ['剧烈头痛', '恶心呕吐', '颈项强直', '意识障碍'], exams: ['ct_scan', 'lumbar_puncture', 'mri'] },

  // ========== 血液系统 ==========
  { name: '缺铁性贫血', aliases: ['贫血', 'IDA'], symptoms: ['面色苍白', '乏力', '头晕', '心悸', '食欲不振', '异食癖'], exams: ['blood_routine', 'ferritin', 'stool_routine'] },
  { name: '白血病', aliases: ['血癌', '急性白血病', '慢性白血病'], symptoms: ['发热', '贫血', '出血', '淋巴结肿大', '骨痛', '肝脾大'], exams: ['blood_routine', 'coagulation', 'bone_mineral_density'] },
  { name: '再生障碍性贫血', aliases: ['再障', 'AA'], symptoms: ['贫血', '出血', '感染', '发热'], exams: ['blood_routine', 'coagulation'] },
  { name: '血小板减少性紫癜', aliases: ['ITP', '免疫性血小板减少症'], symptoms: ['皮肤出血点', '瘀斑', '鼻出血', '牙龈出血'], exams: ['blood_routine', 'coagulation'] },
  { name: '淋巴瘤', aliases: ['霍奇金淋巴瘤', '非霍奇金淋巴瘤'], symptoms: ['淋巴结肿大', '发热', '盗汗', '消瘦', '瘙痒'], exams: ['blood_routine', 'ct_scan', 'tumor_markers', 'esr'] },

  // ========== 风湿免疫系统 ==========
  { name: '类风湿关节炎', aliases: ['类风湿', 'RA'], symptoms: ['关节疼痛', '关节肿胀', '晨僵', '关节畸形', '乏力'], exams: ['autoimmune', 'blood_routine', 'crp', 'esr', 'x_ray'] },
  { name: '系统性红斑狼疮', aliases: ['红斑狼疮', 'SLE', '狼疮'], symptoms: ['面部红斑', '关节痛', '发热', '光敏感', '口腔溃疡', '脱发'], exams: ['autoimmune', 'blood_routine', 'kidney_function', 'urine_routine', 'crp'] },
  { name: '强直性脊柱炎', aliases: ['强直', 'AS'], symptoms: ['腰背痛', '晨僵', '关节痛', '活动后减轻', '眼部炎症'], exams: ['autoimmune', 'esr', 'crp', 'x_ray', 'mri'] },
  { name: '干燥综合征', aliases: ['SS'], symptoms: ['口干', '眼干', '关节痛', '龋齿', '腮腺肿大'], exams: ['autoimmune', 'blood_routine', 'kidney_function'] },
  { name: '痛风性关节炎', aliases: ['痛风发作'], symptoms: ['第一跖趾关节红肿', '关节剧痛', '发热', '活动受限'], exams: ['kidney_function', 'crp', 'blood_routine', 'x_ray'] },

  // ========== 感染性疾病 ==========
  { name: '艾滋病', aliases: ['AIDS', 'HIV感染'], symptoms: ['发热', '消瘦', '腹泻', '淋巴结肿大', '机会性感染'], exams: ['hiv', 'blood_routine', 'cd4_count'] },
  { name: '梅毒', aliases: ['一期梅毒', '二期梅毒', '三期梅毒'], symptoms: ['硬下疳', '皮疹', '淋巴结肿大', '梅毒疹'], exams: ['syphilis', 'blood_routine'] },
  { name: '新型冠状病毒感染', aliases: ['新冠', '新冠肺炎', 'COVID-19'], symptoms: ['发热', '咳嗽', '乏力', '嗅觉丧失', '味觉丧失', '呼吸困难'], exams: ['covid_19', 'blood_routine', 'crp', 'ct_scan', 'blood_gas'] },
  { name: '支原体肺炎', aliases: ['支原体感染', '非典型肺炎'], symptoms: ['干咳', '发热', '头痛', '咽痛', '乏力'], exams: ['mycoplasma', 'x_ray', 'blood_routine', 'crp'] },
  { name: '幽门螺杆菌感染', aliases: ['HP感染', '幽门螺旋杆菌'], symptoms: ['上腹痛', '嗳气', '腹胀', '口臭', '恶心'], exams: ['hp_test', 'gastroscopy'] },

  // ========== 外科常见 ==========
  { name: '骨折', aliases: ['骨裂', '骨断裂'], symptoms: ['局部疼痛', '肿胀', '畸形', '活动受限', '骨擦音'], exams: ['x_ray', 'ct_scan', 'mri'] },
  { name: '腰椎间盘突出', aliases: ['腰突', '腰椎间盘突出症', '椎间盘突出'], symptoms: ['腰痛', '下肢放射痛', '麻木', '活动受限'], exams: ['mri', 'ct_scan', 'x_ray', 'emg'] },
  { name: '半月板损伤', aliases: ['半月板撕裂'], symptoms: ['膝关节疼痛', '肿胀', '弹响', '交锁', '活动受限'], exams: ['mri', 'x_ray'] },
  { name: '阑尾炎', aliases: ['急性阑尾炎', '阑尾穿孔'], symptoms: ['转移性右下腹痛', '恶心呕吐', '发热', '反跳痛'], exams: ['blood_routine', 'crp', 'ultrasound', 'ct_scan'] },

  // ========== 妇产科 ==========
  { name: '子宫肌瘤', aliases: ['肌瘤', '子宫平滑肌瘤'], symptoms: ['月经量多', '经期延长', '下腹坠胀', '压迫症状'], exams: ['ultrasound', 'blood_routine'] },
  { name: '异位妊娠', aliases: ['宫外孕'], symptoms: ['停经', '腹痛', '阴道流血', '晕厥', '休克'], exams: ['ultrasound', 'blood_routine', 'coagulation'] },
  { name: '多囊卵巢综合征', aliases: ['PCOS', '多囊'], symptoms: ['月经不调', '不孕', '多毛', '痤疮', '肥胖'], exams: ['sex_hormones', 'ultrasound', 'blood_sugar', 'lipid_profile'] },

  // ========== 精神科 ==========
  { name: '抑郁症', aliases: ['抑郁', '重度抑郁'], symptoms: ['情绪低落', '兴趣减退', '失眠', '食欲下降', '自杀念头', '乏力'], exams: ['thyroid_function', 'blood_routine'] },
  { name: '焦虑症', aliases: ['焦虑', '广泛性焦虑'], symptoms: ['紧张不安', '心悸', '出汗', '手抖', '失眠', '坐立不安'], exams: ['ecg', 'thyroid_function', 'blood_routine'] },
  { name: '精神分裂症', aliases: ['精神分裂'], symptoms: ['幻觉', '妄想', '思维紊乱', '行为异常', '情感淡漠'], exams: ['mri', 'eeg', 'blood_routine'] },

  // ========== 五官科 ==========
  { name: '急性中耳炎', aliases: ['中耳炎'], symptoms: ['耳痛', '听力下降', '耳流脓', '发热', '耳鸣'], exams: ['audiometry', 'blood_routine'] },
  { name: '突发性耳聋', aliases: ['突发性听力下降', '突聋'], symptoms: ['突然听力下降', '耳鸣', '眩晕', '耳闷'], exams: ['audiometry', 'mri'] },
  { name: '急性鼻窦炎', aliases: ['鼻窦炎'], symptoms: ['鼻塞', '脓涕', '头痛', '面部压痛', '嗅觉减退'], exams: ['nasal_endoscopy', 'ct_scan', 'blood_routine'] },
  { name: '青光眼', aliases: ['急性闭角型青光眼', '慢性青光眼'], symptoms: ['眼痛', '视力下降', '头痛', '恶心呕吐', '虹视'], exams: ['oct', 'visual_field', 'fundoscopy'] },

  // ========== 皮肤科 ==========
  { name: '荨麻疹', aliases: ['风疹块', '风团'], symptoms: ['皮肤风团', '瘙痒', '红肿', '灼热'], exams: ['allergy_test', 'blood_routine'] },
  { name: '湿疹', aliases: ['特应性皮炎', '皮炎'], symptoms: ['皮肤瘙痒', '红斑', '渗出', '皮肤干燥', '丘疹'], exams: ['allergy_test', 'blood_routine', 'skin_biopsy'] },
  { name: '带状疱疹', aliases: ['蛇缠腰', '缠腰龙'], symptoms: ['沿神经分布的水疱', '疼痛', '灼热', '发热'], exams: ['blood_routine'] },

  // ========== 其他 ==========
  { name: '中暑', aliases: ['热射病', '热衰竭'], symptoms: ['高热', '头晕', '乏力', '恶心', '意识障碍', '皮肤干热'], exams: ['blood_routine', 'electrolytes', 'kidney_function', 'liver_function'] },
  { name: '过敏性休克', aliases: ['过敏反应', '过敏性反应'], symptoms: ['呼吸困难', '血压下降', '皮疹', '意识障碍', '喉头水肿'], exams: ['blood_routine', 'blood_gas', 'ecg'] },
  { name: '糖尿病酮症酸中毒', aliases: ['DKA', '酮症酸中毒'], symptoms: ['恶心呕吐', '腹痛', '呼吸深快', '意识障碍', '多尿', '脱水'], exams: ['blood_sugar', 'blood_gas', 'electrolytes', 'kidney_function', 'urine_routine'] },
];

// 模糊搜索函数
function searchDiseases(query) {
  if (!query || query.trim().length === 0) return [];
  
  const keywords = query.trim().toLowerCase().split(/[,，\s]+/).filter(k => k.length > 0);
  if (keywords.length === 0) return [];
  
  const results = DISEASE_DATABASE.map(disease => {
    let score = 0;
    const matchedFields = [];
    
    for (const keyword of keywords) {
      // 疾病名称匹配（最高权重）
      if (disease.name.toLowerCase().includes(keyword)) {
        score += 10;
        matchedFields.push('name');
      }
      
      // 别名匹配
      const aliasMatch = disease.aliases.some(alias => alias.toLowerCase().includes(keyword));
      if (aliasMatch) {
        score += 8;
        matchedFields.push('alias');
      }
      
      // 症状匹配
      const symptomMatch = disease.symptoms.some(s => s.toLowerCase().includes(keyword));
      if (symptomMatch) {
        score += 5;
        matchedFields.push('symptom');
      }
      
      // 检查项目ID匹配
      const examMatch = disease.exams.some(e => e.toLowerCase().includes(keyword));
      if (examMatch) {
        score += 3;
        matchedFields.push('exam');
      }
    }
    
    return { ...disease, score, matchedFields: [...new Set(matchedFields)] };
  })
  .filter(d => d.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 20);
  
  return results;
}

// 根据症状推荐检查
function recommendExamsBySymptoms(symptoms) {
  if (!symptoms || symptoms.trim().length === 0) return [];
  
  const keywords = symptoms.trim().toLowerCase().split(/[,，\s]+/).filter(k => k.length > 0);
  if (keywords.length === 0) return [];
  
  const matchedDiseases = DISEASE_DATABASE.map(disease => {
    let score = 0;
    for (const keyword of keywords) {
      const symptomMatch = disease.symptoms.some(s => s.toLowerCase().includes(keyword));
      if (symptomMatch) score += 5;
      if (disease.name.toLowerCase().includes(keyword)) score += 3;
      if (disease.aliases.some(a => a.toLowerCase().includes(keyword))) score += 2;
    }
    return { disease, score };
  })
  .filter(d => d.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
  
  // 收集推荐检查（去重，按频率排序）
  const examCounts = {};
  for (const { disease } of matchedDiseases) {
    for (const exam of disease.exams) {
      examCounts[exam] = (examCounts[exam] || 0) + 1;
    }
  }
  
  return Object.entries(examCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([examId, count]) => ({ examId, relevance: count }));
}

module.exports = { DISEASE_DATABASE, searchDiseases, recommendExamsBySymptoms };
