const Patient = require('../models/Patient');
const { ExaminationOrder } = require('../models/Examination');
const { Prescription } = require('../models/Medicine');
const MedicalRecord = require('../models/MedicalRecord');

class DataStore {
  constructor() {
    this.patients = new Map();
    this.examinationOrders = new Map();
    this.prescriptions = new Map();
    this.medicalRecords = new Map();
    this.currentPatientId = null;
    this.patientAgents = new Map(); // 存储每个患者的智能体
  }

  // 患者管理
  createPatient(patientData) {
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

  // 清理数据（用于新游戏）
  clearAll() {
    this.patients.clear();
    this.examinationOrders.clear();
    this.prescriptions.clear();
    this.medicalRecords.clear();
    this.patientAgents.clear();
    this.currentPatientId = null;
  }

  // 获取统计信息
  getStatistics() {
    return {
      totalPatients: this.patients.size,
      totalExaminations: this.examinationOrders.size,
      totalPrescriptions: this.prescriptions.size,
      totalMedicalRecords: this.medicalRecords.size,
      completedExaminations: Array.from(this.examinationOrders.values()).filter(o => o.status === 'completed').length,
      dispensedPrescriptions: Array.from(this.prescriptions.values()).filter(p => p.status === 'dispensed').length
    };
  }
}

// 单例模式
const dataStore = new DataStore();
module.exports = dataStore;
