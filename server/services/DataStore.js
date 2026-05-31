const Patient = require('../models/Patient');
const { ExaminationOrder } = require('../models/Examination');
const { Prescription } = require('../models/Medicine');
const MedicalRecord = require('../models/MedicalRecord');
const { Surgery } = require('../models/Surgery');
const { Admission } = require('../models/Admission');
const { Consultation } = require('../models/Consultation');

class DataStore {
  constructor() {
    this.patients = new Map();
    this.examinationOrders = new Map();
    this.prescriptions = new Map();
    this.medicalRecords = new Map();
    this.surgeries = new Map();
    this.admissions = new Map();
    this.consultations = new Map();
    this.currentPatientId = null;
    this.patientAgents = new Map(); // 存储每个患者的智能体
    this.occupiedBeds = new Map(); // 科室 -> Set(床位号)
  }

  // 清理过期数据（默认保留最近2小时的数据）
  cleanup(maxAgeMs = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    // 清理过期患者及相关数据
    for (const [id, patient] of this.patients) {
      const createdAt = new Date(patient.createdAt).getTime();
      if (now - createdAt > maxAgeMs) {
        this.patients.delete(id);
        this.patientAgents.delete(id);
        // 清理关联的检查单、处方、病历等
        this._cleanupPatientRelatedData(id);
        cleaned++;
      }
    }

    // 清理孤立的检查单（患者已不存在）
    for (const [id, order] of this.examinationOrders) {
      if (!this.patients.has(order.patientId)) {
        this.examinationOrders.delete(id);
        cleaned++;
      }
    }

    // 清理孤立的处方
    for (const [id, prescription] of this.prescriptions) {
      if (!this.patients.has(prescription.patientId)) {
        this.prescriptions.delete(id);
        cleaned++;
      }
    }

    // 清理孤立的病历
    for (const [id, record] of this.medicalRecords) {
      if (!this.patients.has(record.patientId)) {
        this.medicalRecords.delete(id);
        cleaned++;
      }
    }

    // 清理孤立的手术记录
    for (const [id, surgery] of this.surgeries) {
      if (!this.patients.has(surgery.patientId)) {
        this.surgeries.delete(id);
        cleaned++;
      }
    }

    // 清理孤立的住院记录
    for (const [id, admission] of this.admissions) {
      if (!this.patients.has(admission.patientId)) {
        this.admissions.delete(id);
        // 释放床位
        const dept = admission.department;
        const bed = admission.bedNumber;
        if (dept && bed && this.occupiedBeds.has(dept)) {
          this.occupiedBeds.get(dept).delete(bed);
        }
        cleaned++;
      }
    }

    // 清理孤立的会诊记录
    for (const [id, consultation] of this.consultations) {
      if (!this.patients.has(consultation.patientId)) {
        this.consultations.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`DataStore cleanup: 清理了 ${cleaned} 条过期数据`);
    }
    return cleaned;
  }

  // 清理患者相关的所有数据
  _cleanupPatientRelatedData(patientId) {
    // 清理检查单
    for (const [id, order] of this.examinationOrders) {
      if (order.patientId === patientId) {
        this.examinationOrders.delete(id);
      }
    }
    // 清理处方
    for (const [id, prescription] of this.prescriptions) {
      if (prescription.patientId === patientId) {
        this.prescriptions.delete(id);
      }
    }
    // 清理病历
    for (const [id, record] of this.medicalRecords) {
      if (record.patientId === patientId) {
        this.medicalRecords.delete(id);
      }
    }
    // 清理手术
    for (const [id, surgery] of this.surgeries) {
      if (surgery.patientId === patientId) {
        this.surgeries.delete(id);
      }
    }
    // 清理住院
    for (const [id, admission] of this.admissions) {
      if (admission.patientId === patientId) {
        this.admissions.delete(id);
        // 释放床位
        const dept = admission.department;
        const bed = admission.bedNumber;
        if (dept && bed && this.occupiedBeds.has(dept)) {
          this.occupiedBeds.get(dept).delete(bed);
        }
      }
    }
    // 清理会诊
    for (const [id, consultation] of this.consultations) {
      if (consultation.patientId === patientId) {
        this.consultations.delete(id);
      }
    }
  }

  // 患者管理
  createPatient(patientData) {
    // 创建新患者前清理过期数据
    this.cleanup();
    
    const patient = new Patient(patientData);
    this.patients.set(patient.id, patient);
    this.currentPatientId = patient.id;
    return patient;
  }

  getPatient(id) {
    return this.patients.get(id);
  }

  getCurrentPatient() {
    return this.currentPatientId ? this.patients.get(this.currentPatientId) : null;
  }

  getAllPatients() {
    return Array.from(this.patients.values()).map(p => p.toJSON());
  }

  updatePatient(id, updates) {
    const patient = this.patients.get(id);
    if (patient) {
      Object.assign(patient, updates);
      patient.updatedAt = new Date().toISOString();
      return patient;
    }
    return null;
  }

  // 检查单管理
  createExaminationOrder(orderData) {
    const order = new ExaminationOrder(orderData);
    this.examinationOrders.set(order.id, order);
    
    // 关联到患者
    const patient = this.patients.get(order.patientId);
    if (patient) {
      patient.examinationOrders.push(order.id);
    }
    
    return order;
  }

  getExaminationOrder(id) {
    return this.examinationOrders.get(id);
  }

  getPatientExaminationOrders(patientId) {
    return Array.from(this.examinationOrders.values())
      .filter(order => order.patientId === patientId)
      .map(order => order.toJSON());
  }

  completeExaminationOrder(id, result) {
    const order = this.examinationOrders.get(id);
    if (order) {
      order.status = 'completed';
      order.result = result;
      order.completedAt = new Date().toISOString();
      return order;
    }
    return null;
  }

  // 处方管理
  createPrescription(prescriptionData) {
    const prescription = new Prescription(prescriptionData);
    prescription.calculateTotalPrice();
    this.prescriptions.set(prescription.id, prescription);
    
    // 关联到患者
    const patient = this.patients.get(prescription.patientId);
    if (patient) {
      patient.prescriptions.push(prescription.id);
    }
    
    return prescription;
  }

  getPrescription(id) {
    return this.prescriptions.get(id);
  }

  getPatientPrescriptions(patientId) {
    return Array.from(this.prescriptions.values())
      .filter(p => p.patientId === patientId)
      .map(p => p.toJSON());
  }

  // 病历管理
  createMedicalRecord(recordData) {
    const record = new MedicalRecord(recordData);
    this.medicalRecords.set(record.id, record);
    
    // 关联到患者
    const patient = this.patients.get(record.patientId);
    if (patient) {
      patient.medicalRecord = record.id;
    }
    
    return record;
  }

  getMedicalRecord(id) {
    return this.medicalRecords.get(id);
  }

  getPatientMedicalRecord(patientId) {
    const patient = this.patients.get(patientId);
    if (patient && patient.medicalRecord) {
      return this.medicalRecords.get(patient.medicalRecord);
    }
    return null;
  }

  updateMedicalRecord(id, updates) {
    const record = this.medicalRecords.get(id);
    if (record) {
      Object.assign(record, updates);
      record.updatedAt = new Date().toISOString();
      return record;
    }
    return null;
  }

  // 患者智能体管理
  setPatientAgent(patientId, agent) {
    this.patientAgents.set(patientId, agent);
  }

  getPatientAgent(patientId) {
    return this.patientAgents.get(patientId);
  }

  removePatientAgent(patientId) {
    this.patientAgents.delete(patientId);
  }

  // ==================== 手术管理 ====================
  createSurgery(surgeryData) {
    const surgery = new Surgery(surgeryData);
    this.surgeries.set(surgery.id, surgery);
    return surgery;
  }

  getSurgery(id) {
    return this.surgeries.get(id);
  }

  getAllSurgeries() {
    return Array.from(this.surgeries.values()).map(s => s.toJSON());
  }

  getPatientSurgeries(patientId) {
    return Array.from(this.surgeries.values())
      .filter(s => s.patientId === patientId)
      .map(s => s.toJSON());
  }

  updateSurgery(id, updates) {
    const surgery = this.surgeries.get(id);
    if (surgery) {
      Object.assign(surgery, updates);
      surgery.updatedAt = new Date().toISOString();
      return surgery;
    }
    return null;
  }

  updateSurgeryStatus(id, status) {
    const surgery = this.surgeries.get(id);
    if (surgery) {
      surgery.status = status;
      surgery.updatedAt = new Date().toISOString();
      if (status === 'in_progress') {
        surgery.startTime = new Date().toISOString();
      } else if (status === 'completed') {
        surgery.endTime = new Date().toISOString();
      }
      return surgery;
    }
    return null;
  }

  deleteSurgery(id) {
    return this.surgeries.delete(id);
  }

  // ==================== 住院管理 ====================
  createAdmission(admissionData) {
    const admission = new Admission(admissionData);
    this.admissions.set(admission.id, admission);
    // 标记床位为已占用
    const dept = admission.department;
    const bed = admission.bedNumber;
    if (dept && bed) {
      if (!this.occupiedBeds.has(dept)) {
        this.occupiedBeds.set(dept, new Set());
      }
      this.occupiedBeds.get(dept).add(bed);
    }
    return admission;
  }

  getAdmission(id) {
    return this.admissions.get(id);
  }

  getAllAdmissions() {
    return Array.from(this.admissions.values()).map(a => a.toJSON());
  }

  getPatientAdmissions(patientId) {
    return Array.from(this.admissions.values())
      .filter(a => a.patientId === patientId)
      .map(a => a.toJSON());
  }

  updateAdmission(id, updates) {
    const admission = this.admissions.get(id);
    if (admission) {
      Object.assign(admission, updates);
      admission.updatedAt = new Date().toISOString();
      return admission;
    }
    return null;
  }

  deleteAdmission(id) {
    const admission = this.admissions.get(id);
    if (admission) {
      // 释放床位
      const dept = admission.department;
      const bed = admission.bedNumber;
      if (dept && bed && this.occupiedBeds.has(dept)) {
        this.occupiedBeds.get(dept).delete(bed);
      }
    }
    return this.admissions.delete(id);
  }

  getOccupiedBeds(department) {
    return this.occupiedBeds.get(department) || new Set();
  }

  // ==================== 会诊管理 ====================
  createConsultation(consultationData) {
    const consultation = new Consultation(consultationData);
    this.consultations.set(consultation.id, consultation);
    return consultation;
  }

  getConsultation(id) {
    return this.consultations.get(id);
  }

  getAllConsultations() {
    return Array.from(this.consultations.values()).map(c => c.toJSON());
  }

  getPatientConsultations(patientId) {
    return Array.from(this.consultations.values())
      .filter(c => c.patientId === patientId)
      .map(c => c.toJSON());
  }

  updateConsultation(id, updates) {
    const consultation = this.consultations.get(id);
    if (consultation) {
      Object.assign(consultation, updates);
      consultation.updatedAt = new Date().toISOString();
      return consultation;
    }
    return null;
  }

  updateConsultationStatus(id, status) {
    const consultation = this.consultations.get(id);
    if (consultation) {
      consultation.status = status;
      consultation.updatedAt = new Date().toISOString();
      if (status === 'completed') {
        consultation.completedDate = new Date().toISOString();
      }
      return consultation;
    }
    return null;
  }

  deleteConsultation(id) {
    return this.consultations.delete(id);
  }

  // 清理数据（用于新游戏）
  clearAll() {
    this.patients.clear();
    this.examinationOrders.clear();
    this.prescriptions.clear();
    this.medicalRecords.clear();
    this.surgeries.clear();
    this.admissions.clear();
    this.consultations.clear();
    this.patientAgents.clear();
    this.occupiedBeds.clear();
    this.currentPatientId = null;
  }

  // 获取统计信息
  getStatistics() {
    return {
      totalPatients: this.patients.size,
      totalExaminations: this.examinationOrders.size,
      totalPrescriptions: this.prescriptions.size,
      totalMedicalRecords: this.medicalRecords.size,
      totalSurgeries: this.surgeries.size,
      totalAdmissions: this.admissions.size,
      totalConsultations: this.consultations.size,
      completedExaminations: Array.from(this.examinationOrders.values()).filter(o => o.status === 'completed').length,
      dispensedPrescriptions: Array.from(this.prescriptions.values()).filter(p => p.status === 'dispensed').length,
      completedSurgeries: Array.from(this.surgeries.values()).filter(s => s.status === 'completed').length,
      activeAdmissions: Array.from(this.admissions.values()).filter(a => a.status === 'admitted').length
    };
  }
}

// 单例模式
const dataStore = new DataStore();
module.exports = dataStore;
