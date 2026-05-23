const { v4: uuidv4 } = require('uuid');

class MedicalRecord {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId;
    this.patientName = data.patientName;
    this.patientAge = data.patientAge;
    this.patientGender = data.patientGender;
    
    // 主诉
    this.chiefComplaint = data.chiefComplaint || '';
    
    // 现病史
    this.presentIllness = data.presentIllness || '';
    
    // 既往史
    this.pastHistory = data.pastHistory || '';
    
    // 个人史
    this.personalHistory = data.personalHistory || '';
    
    // 家族史
    this.familyHistory = data.familyHistory || '';
    
    // 体格检查
    this.physicalExamination = data.physicalExamination || {
      temperature: '',
      pulse: '',
      respiration: '',
      bloodPressure: '',
      generalAppearance: '',
      skin: '',
      lymphNodes: '',
      headAndNeck: '',
      chest: '',
      heart: '',
      lungs: '',
      abdomen: '',
      extremities: '',
      nervousSystem: ''
    };
    
    // 辅助检查
    this.auxiliaryExaminations = data.auxiliaryExaminations || [];
    
    // 诊断
    this.diagnosis = data.diagnosis || '';
    this.differentialDiagnosis = data.differentialDiagnosis || '';
    
    // 治疗计划
    this.treatmentPlan = data.treatmentPlan || '';
    
    // 医嘱
    this.doctorOrders = data.doctorOrders || '';
    
    // 医生信息
    this.doctorName = data.doctorName || '值班医生';
    this.department = data.department || '内科';
    
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      patientAge: this.patientAge,
      patientGender: this.patientGender,
      chiefComplaint: this.chiefComplaint,
      presentIllness: this.presentIllness,
      pastHistory: this.pastHistory,
      personalHistory: this.personalHistory,
      familyHistory: this.familyHistory,
      physicalExamination: this.physicalExamination,
      auxiliaryExaminations: this.auxiliaryExaminations,
      diagnosis: this.diagnosis,
      differentialDiagnosis: this.differentialDiagnosis,
      treatmentPlan: this.treatmentPlan,
      doctorOrders: this.doctorOrders,
      doctorName: this.doctorName,
      department: this.department,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = MedicalRecord;
