const { v4: uuidv4 } = require('uuid');

const DEPARTMENT_CONFIG = {
  '呼吸内科': { name: '呼吸内科', floor: 3, beds: 40 },
  '心内科': { name: '心内科', floor: 3, beds: 35 },
  '消化内科': { name: '消化内科', floor: 4, beds: 40 },
  '神经内科': { name: '神经内科', floor: 4, beds: 35 },
  '肾内科': { name: '肾内科', floor: 5, beds: 30 },
  '内分泌科': { name: '内分泌科', floor: 5, beds: 25 },
  '血液科': { name: '血液科', floor: 5, beds: 25 },
  '风湿免疫科': { name: '风湿免疫科', floor: 6, beds: 20 },
  '感染科': { name: '感染科', floor: 1, beds: 30 },
  '普通外科': { name: '普通外科', floor: 7, beds: 50 },
  '骨科': { name: '骨科', floor: 7, beds: 45 },
  '泌尿外科': { name: '泌尿外科', floor: 8, beds: 30 },
  '心胸外科': { name: '心胸外科', floor: 8, beds: 30 },
  '神经外科': { name: '神经外科', floor: 9, beds: 25 },
  '妇产科': { name: '妇产科', floor: 9, beds: 40 },
  '儿科': { name: '儿科', floor: 10, beds: 35 },
  '眼科': { name: '眼科', floor: 10, beds: 20 },
  '耳鼻喉科': { name: '耳鼻喉科', floor: 10, beds: 20 },
  'ICU': { name: 'ICU', floor: 2, beds: 10 }
};

const ADMISSION_STATUS = {
  admitted: '在院',
  transferred: '已转科',
  discharged: '已出院',
  absconded: '自动出院'
};

class Admission {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.patientId = data.patientId || '';
    this.patientName = data.patientName || '';
    this.department = data.department || '';
    this.bedNumber = data.bedNumber || '';
    this.admissionDate = data.admissionDate || new Date().toISOString();
    this.dischargeDate = data.dischargeDate || null;
    this.status = data.status || ADMISSION_STATUS.admitted;
    this.diagnosis = data.diagnosis || '';
    this.treatmentPlan = data.treatmentPlan || '';
    this.attendingDoctor = data.attendingDoctor || '';
    this.dailyRecords = data.dailyRecords || [];
    this.transferHistory = data.transferHistory || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addDailyRecord(record) {
    this.dailyRecords.push({
      date: record.date || new Date().toISOString(),
      content: record.content || '',
      doctor: record.doctor || ''
    });
    this.updatedAt = new Date().toISOString();
  }

  transfer(newDepartment, newBed, reason) {
    this.transferHistory.push({
      fromDepartment: this.department,
      fromBed: this.bedNumber,
      toDepartment: newDepartment,
      toBed: newBed,
      reason: reason || '',
      date: new Date().toISOString()
    });
    this.department = newDepartment;
    this.bedNumber = newBed;
    this.status = ADMISSION_STATUS.transferred;
    this.updatedAt = new Date().toISOString();
  }

  discharge(dischargeSummary) {
    this.dischargeDate = new Date().toISOString();
    this.status = ADMISSION_STATUS.discharged;
    this.dischargeSummary = dischargeSummary || '';
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      patientName: this.patientName,
      department: this.department,
      bedNumber: this.bedNumber,
      admissionDate: this.admissionDate,
      dischargeDate: this.dischargeDate,
      status: this.status,
      diagnosis: this.diagnosis,
      treatmentPlan: this.treatmentPlan,
      attendingDoctor: this.attendingDoctor,
      dailyRecords: this.dailyRecords,
      transferHistory: this.transferHistory,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Admission, DEPARTMENT_CONFIG, ADMISSION_STATUS };
