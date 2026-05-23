const { v4: uuidv4 } = require('uuid');

class Patient {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || this.generateRandomName();
    this.age = data.age || this.generateRandomAge();
    this.gender = data.gender || this.generateRandomGender();
    this.symptoms = data.symptoms || [];
    this.medicalHistory = data.medicalHistory || [];
    this.allergies = data.allergies || [];
    this.currentDiagnosis = data.currentDiagnosis || null;
    this.status = data.status || 'waiting'; // waiting, examining, completed
    this.createdAt = data.createdAt || new Date().toISOString();
    this.examinationOrders = data.examinationOrders || [];
    this.prescriptions = data.prescriptions || [];
    this.medicalRecord = data.medicalRecord || null;
  }

  generateRandomName() {
    const surnames = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'];
    const names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀', '霞', '平'];
    const name2 = ['', '华', '志', '建', '文', '辉', '玲', '婷', '宇', '欣', '雨', '晨', '轩', '昊', '瑞', '嘉', '怡', '彤', '曦', '涵'];
    
    const surname = surnames[Math.floor(Math.random() * surnames.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const name2nd = name2[Math.floor(Math.random() * name2.length)];
    
    return surname + name + name2nd;
  }

  generateRandomAge() {
    return Math.floor(Math.random() * 60) + 18;
  }

  generateRandomGender() {
    return Math.random() > 0.5 ? '男' : '女';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      age: this.age,
      gender: this.gender,
      symptoms: this.symptoms,
      medicalHistory: this.medicalHistory,
      allergies: this.allergies,
      currentDiagnosis: this.currentDiagnosis,
      status: this.status,
      createdAt: this.createdAt,
      examinationOrders: this.examinationOrders,
      prescriptions: this.prescriptions,
      medicalRecord: this.medicalRecord
    };
  }
}

module.exports = Patient;
