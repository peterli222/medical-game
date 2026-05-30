const { v4: uuidv4 } = require('uuid');

const CONSULTATION_TYPES = {
  regular: '普通会诊',
  emergency: '急会诊',
  multi: '多学科会诊'
};

const CONSULTATION_STATUS = {
  pending: '待会诊',
  in_progress: '会诊中',
  completed: '已完成',
  cancelled: '已取消'
};

class Consultation {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId || '';
    this.patientName = data.patientName || '';
    this.type = data.type || 'regular';
    this.requestingDepartment = data.requestingDepartment || '';
    this.consultingDepartment = data.consultingDepartment || '';
    this.requestingDoctor = data.requestingDoctor || '';
    this.consultingDoctor = data.consultingDoctor || '';
    this.reason = data.reason || '';
    this.diagnosis = data.diagnosis || '';
    this.aiOpinion = data.aiOpinion || '';
    this.status = data.status || 'pending';
    this.scheduledDate = data.scheduledDate || null;
    this.completedDate = data.completedDate || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      type: this.type,
      requestingDepartment: this.requestingDepartment,
      consultingDepartment: this.consultingDepartment,
      requestingDoctor: this.requestingDoctor,
      consultingDoctor: this.consultingDoctor,
      reason: this.reason,
      diagnosis: this.diagnosis,
      aiOpinion: this.aiOpinion,
      status: this.status,
      scheduledDate: this.scheduledDate,
      completedDate: this.completedDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Consultation, CONSULTATION_TYPES, CONSULTATION_STATUS };
