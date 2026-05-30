const { v4: uuidv4 } = require('uuid');

// 手术数据库 - 40种常见手术
const SURGERY_DATABASE = [
  // 普通外科
  { id: 'appendectomy', name: '阑尾切除术', department: '普通外科', duration: 60, riskLevel: 'low' },
  { id: 'cholecystectomy', name: '胆囊切除术', department: '普通外科', duration: 90, riskLevel: 'medium' },
  { id: 'hernia_repair', name: '疝修补术', department: '普通外科', duration: 75, riskLevel: 'low' },
  { id: 'gastrectomy_subtotal', name: '胃大部切除术', department: '普通外科', duration: 180, riskLevel: 'high' },
  { id: 'thyroidectomy', name: '甲状腺切除术', department: '普通外科', duration: 120, riskLevel: 'medium' },
  { id: 'mastectomy', name: '乳腺切除术', department: '普通外科', duration: 120, riskLevel: 'medium' },
  { id: 'colectomy', name: '结肠切除术', department: '普通外科', duration: 180, riskLevel: 'high' },
  { id: 'hemorrhoidectomy', name: '痔切除术', department: '普通外科', duration: 45, riskLevel: 'low' },
  { id: 'splenectomy', name: '脾切除术', department: '普通外科', duration: 120, riskLevel: 'medium' },
  { id: 'liver_resection', name: '肝部分切除术', department: '普通外科', duration: 240, riskLevel: 'high' },
  // 骨科
  { id: 'internal_fixation', name: '骨折内固定术', department: '骨科', duration: 120, riskLevel: 'medium' },
  { id: 'joint_replacement', name: '关节置换术', department: '骨科', duration: 150, riskLevel: 'medium' },
  { id: 'spinal_fusion', name: '脊柱融合术', department: '骨科', duration: 240, riskLevel: 'high' },
  { id: 'arthroscopy_knee', name: '膝关节镜手术', department: '骨科', duration: 90, riskLevel: 'low' },
  { id: 'amputation', name: '截肢术', department: '骨科', duration: 180, riskLevel: 'high' },
  // 心胸外科
  { id: 'thoracotomy', name: '开胸探查术', department: '心胸外科', duration: 180, riskLevel: 'high' },
  { id: 'cabg', name: '心脏搭桥术', department: '心胸外科', duration: 300, riskLevel: 'high' },
  { id: 'valve_replacement', name: '瓣膜置换术', department: '心胸外科', duration: 240, riskLevel: 'high' },
  { id: 'lobectomy', name: '肺叶切除术', department: '心胸外科', duration: 180, riskLevel: 'high' },
  { id: 'pericardiocentesis', name: '心包穿刺术', department: '心胸外科', duration: 30, riskLevel: 'medium' },
  // 神经外科
  { id: 'craniotomy_hematoma', name: '开颅血肿清除术', department: '神经外科', duration: 240, riskLevel: 'high' },
  { id: 'brain_tumor_resection', name: '脑肿瘤切除术', department: '神经外科', duration: 360, riskLevel: 'high' },
  { id: 'ventriculostomy', name: '脑室引流术', department: '神经外科', duration: 90, riskLevel: 'high' },
  { id: 'cranioplasty', name: '颅骨修补术', department: '神经外科', duration: 150, riskLevel: 'medium' },
  // 泌尿外科
  { id: 'nephrectomy', name: '肾切除术', department: '泌尿外科', duration: 180, riskLevel: 'high' },
  { id: 'prostatectomy', name: '前列腺切除术', department: '泌尿外科', duration: 150, riskLevel: 'medium' },
  { id: 'ureterolithotomy', name: '输尿管切开取石术', department: '泌尿外科', duration: 120, riskLevel: 'medium' },
  { id: 'cystoscopy', name: '膀胱镜检查术', department: '泌尿外科', duration: 30, riskLevel: 'low' },
  // 妇产科
  { id: 'cesarean_section', name: '剖宫产术', department: '妇产科', duration: 60, riskLevel: 'medium' },
  { id: 'hysterectomy', name: '子宫切除术', department: '妇产科', duration: 120, riskLevel: 'medium' },
  { id: 'ovarian_cystectomy', name: '卵巢囊肿切除术', department: '妇产科', duration: 90, riskLevel: 'medium' },
  { id: 'tubal_ligation', name: '输卵管结扎术', department: '妇产科', duration: 30, riskLevel: 'low' },
  // 眼科
  { id: 'cataract_surgery', name: '白内障手术', department: '眼科', duration: 45, riskLevel: 'low' },
  { id: 'glaucoma_surgery', name: '青光眼手术', department: '眼科', duration: 60, riskLevel: 'medium' },
  { id: 'retinal_detachment', name: '视网膜脱离修复术', department: '眼科', duration: 120, riskLevel: 'medium' },
  // 耳鼻喉科
  { id: 'tonsillectomy', name: '扁桃体切除术', department: '耳鼻喉科', duration: 45, riskLevel: 'low' },
  { id: 'sinus_surgery', name: '鼻窦手术', department: '耳鼻喉科', duration: 90, riskLevel: 'medium' },
  { id: 'tympanoplasty', name: '鼓室成形术', department: '耳鼻喉科', duration: 120, riskLevel: 'medium' },
  // 口腔科
  { id: 'wisdom_tooth_extraction', name: '智齿拔除术', department: '口腔科', duration: 30, riskLevel: 'low' },
  { id: 'jaw_fracture_fixation', name: '颌骨骨折固定术', department: '口腔科', duration: 120, riskLevel: 'medium' },
];

// 手术类型
const SURGERY_TYPES = {
  emergency: '急诊手术',
  outpatient: '门诊手术',
  elective: '择期手术',
};

// 麻醉类型
const ANESTHESIA_TYPES = {
  general: '全身麻醉',
  local: '局部麻醉',
  spinal: '脊髓麻醉',
  epidural: '硬膜外麻醉',
  nerve_block: '神经阻滞',
  sedation: '镇静麻醉',
};

// 手术状态
const SURGERY_STATUS = {
  pending: '待审批',
  approved: '已审批',
  preparing: '术前准备',
  in_progress: '手术中',
  completed: '已完成',
  cancelled: '已取消',
};

class Surgery {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId || '';
    this.surgeryType = data.surgeryType || SURGERY_DATABASE[0];
    this.type = data.type || 'elective';
    this.anesthesiaType = data.anesthesiaType || 'general';
    this.surgeon = data.surgeon || '';
    this.assistant = data.assistant || '';
    this.anesthesiologist = data.anesthesiologist || '';
    this.nurse = data.nurse || '';
    this.diagnosis = data.diagnosis || '';
    this.indication = data.indication || '';
    this.plan = data.plan || '';
    this.risks = data.risks || '';
    this.status = data.status || 'pending';
    this.scheduledDate = data.scheduledDate || null;
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      surgeryType: this.surgeryType,
      type: this.type,
      typeLabel: SURGERY_TYPES[this.type] || this.type,
      anesthesiaType: this.anesthesiaType,
      anesthesiaLabel: ANESTHESIA_TYPES[this.anesthesiaType] || this.anesthesiaType,
      surgeon: this.surgeon,
      assistant: this.assistant,
      anesthesiologist: this.anesthesiologist,
      nurse: this.nurse,
      diagnosis: this.diagnosis,
      indication: this.indication,
      plan: this.plan,
      risks: this.risks,
      status: this.status,
      statusLabel: SURGERY_STATUS[this.status] || this.status,
      scheduledDate: this.scheduledDate,
      startTime: this.startTime,
      endTime: this.endTime,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

module.exports = {
  Surgery,
  SURGERY_DATABASE,
  SURGERY_TYPES,
  ANESTHESIA_TYPES,
  SURGERY_STATUS,
};
