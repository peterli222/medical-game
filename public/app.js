// 医疗问诊模拟系统 - 完全重写
const API_BASE_URL = '/api';

// 禁止手动缩放 - 增强兼容性
(function preventZoom() {
    // 阻止双指缩放
    document.addEventListener('touchmove', function(e) {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // 阻止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    // 阻止 Ctrl/Cmd + +/- 缩放
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
            e.preventDefault();
        }
    });

    // 阻止 Ctrl/Cmd + 鼠标滚轮缩放
    document.addEventListener('wheel', function(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    }, { passive: false });
})();

// 全局状态
let currentPatient = null;
let currentPrescription = [];
let currentExaminations = []; // 保存已开检查单
let examinationTypes = {};
let medicineDatabase = {};
let medicalRecords = [];
let currentRecordId = null;

// 语音服务
const speechService = {
    isSupported: 'speechSynthesis' in window,
    
    playNotificationSound() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    },
    
    speak(text) {
        if (!this.isSupported) {
            console.log('浏览器不支持语音合成功能');
            return;
        }
        
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        const voices = window.speechSynthesis.getVoices();
        const chineseVoice = voices.find(v => v.lang.startsWith('zh') && v.name.includes('Female')) || 
                            voices.find(v => v.lang.startsWith('zh'));
        if (chineseVoice) {
            utterance.voice = chineseVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    },
    
    callPatient(patientName) {
        this.playNotificationSound();
        
        setTimeout(() => {
            const message = `请${patientName}到诊室就诊`;
            this.speak(message);
        }, 350);
    }
};

// 初始化语音服务
document.addEventListener('DOMContentLoaded', () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            console.log('语音引擎已就绪');
        };
    }
});

// 工具函数：防抖
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// DOM 元素
const elements = {
    // 导航
    navTabs: document.querySelectorAll('.nav-tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // 患者信息
    patientInfo: document.getElementById('patientInfo'),
    newPatientBtn: document.getElementById('newPatientBtn'),
    resetBtn: document.getElementById('resetBtn'),
    endConsultationBtn: document.getElementById('endConsultationBtn'),
    
    // 聊天
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    
    // 检查
    examTypeSelect: document.getElementById('examTypeSelect'),
    bodyPartGroup: document.getElementById('bodyPartGroup'),
    bodyPartSelect: document.getElementById('bodyPartSelect'),
    addExamBtn: document.getElementById('addExamBtn'),
    examListContent: document.getElementById('examListContent'),
    
    // 药品
    medicineSearch: document.getElementById('medicineSearch'),
    searchMedicineBtn: document.getElementById('searchMedicineBtn'),
    medicineCategories: document.getElementById('medicineCategories'),
    medicineList: document.getElementById('medicineList'),
    prescriptionItems: document.getElementById('prescriptionItems'),
    diagnosisInput: document.getElementById('diagnosisInput'),
    prescriptionNotes: document.getElementById('prescriptionNotes'),
    savePrescriptionBtn: document.getElementById('savePrescriptionBtn'),
    totalMedicines: document.getElementById('totalMedicines'),
    totalPrice: document.getElementById('totalPrice'),
    dosageFrequency: document.getElementById('dosageFrequency'),
    dosageAmount: document.getElementById('dosageAmount'),
    dosageUnit: document.getElementById('dosageUnit'),
    dosageTime: document.getElementById('dosageTime'),
    dosageDuration: document.getElementById('dosageDuration'),
    
    // 病历 - 新的
    recordList: document.getElementById('recordList'),
    recordCount: document.getElementById('recordCount'),
    saveRecordBtn: document.getElementById('saveRecordBtn'),
    newRecordBtn: document.getElementById('newRecordBtn'),
    exportRecordsBtn: document.getElementById('exportRecordsBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    recordStatus: document.getElementById('recordStatus'),
    
    // 病历表单字段
    mrName: document.getElementById('mrName'),
    mrGender: document.getElementById('mrGender'),
    mrAge: document.getElementById('mrAge'),
    mrDate: document.getElementById('mrDate'),
    mrMarital: document.getElementById('mrMarital'),
    mrOccupation: document.getElementById('mrOccupation'),
    mrEthnicity: document.getElementById('mrEthnicity'),
    mrRecordNo: document.getElementById('mrRecordNo'),
    mrDepartment: document.getElementById('mrDepartment'),
    mrPhone: document.getElementById('mrPhone'),
    mrAddress: document.getElementById('mrAddress'),
    mrChiefComplaint: document.getElementById('mrChiefComplaint'),
    mrPresentIllness: document.getElementById('mrPresentIllness'),
    mrPastHistory: document.getElementById('mrPastHistory'),
    mrSmoking: document.getElementById('mrSmoking'),
    mrSmokingDetail: document.getElementById('mrSmokingDetail'),
    mrDrinking: document.getElementById('mrDrinking'),
    mrDrinkingDetail: document.getElementById('mrDrinkingDetail'),
    mrAllergy: document.getElementById('mrAllergy'),
    mrAllergyDetail: document.getElementById('mrAllergyDetail'),
    mrExposure: document.getElementById('mrExposure'),
    mrFamilyHistory: document.getElementById('mrFamilyHistory'),
    mrMenses: document.getElementById('mrMenses'),
    mrMensesSection: document.getElementById('mrMensesSection'),
    mrTemperature: document.getElementById('mrTemperature'),
    mrPulse: document.getElementById('mrPulse'),
    mrRespiration: document.getElementById('mrRespiration'),
    mrBloodPressure: document.getElementById('mrBloodPressure'),
    mrOxygen: document.getElementById('mrOxygen'),
    mrGeneralExam: document.getElementById('mrGeneralExam'),
    mrSkinExam: document.getElementById('mrSkinExam'),
    mrHeadNeck: document.getElementById('mrHeadNeck'),
    mrChestExam: document.getElementById('mrChestExam'),
    mrAbdomenExam: document.getElementById('mrAbdomenExam'),
    mrLimbExam: document.getElementById('mrLimbExam'),
    mrNeuroExam: document.getElementById('mrNeuroExam'),
    mrPhysicalExam: document.getElementById('mrPhysicalExam'),
    mrAuxiliary: document.getElementById('mrAuxiliary'),
    mrDiagnosis: document.getElementById('mrDiagnosis'),
    mrTCMDiagnosis: document.getElementById('mrTCMDiagnosis'),
    mrTreatment: document.getElementById('mrTreatment'),
    mrPrescription: document.getElementById('mrPrescription'),
    mrDoctorOrders: document.getElementById('mrDoctorOrders'),
    mrDoctorSignature: document.getElementById('mrDoctorSignature'),
    mrSignatureDate: document.getElementById('mrSignatureDate'),
    
    // 疾病搜索
    diseaseSearchInput: document.getElementById('diseaseSearchInput'),
    diseaseSearchDropdown: document.getElementById('diseaseSearchDropdown'),
    
    // 弹窗
    examResultModal: document.getElementById('examResultModal'),
    examResultContent: document.getElementById('examResultContent'),
    prescriptionModal: document.getElementById('prescriptionModal'),
    prescriptionDetailContent: document.getElementById('prescriptionDetailContent'),
};

// 初始化
async function init() {
    loadLocalRecords();
    setupEventListeners();
    await loadExaminationTypes();
    await loadMedicineDatabase();
    renderMedicineCategories();
    renderRecordList();
    updateRecordCount();
}

// 设置事件监听
function setupEventListeners() {
    // 导航标签
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // 新患者
    elements.newPatientBtn.addEventListener('click', createNewPatient);
    elements.resetBtn.addEventListener('click', resetGame);
    elements.endConsultationBtn.addEventListener('click', endConsultation);
    
    // 聊天
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // 检查
    elements.addExamBtn.addEventListener('click', addExamination);
    elements.examTypeSelect.addEventListener('change', handleExamTypeChange);
    
    // 检查项目搜索
    const examSearchInput = document.getElementById('examSearchInput');
    const examSearchDropdown = document.getElementById('examSearchDropdown');
    if (examSearchInput) {
        examSearchInput.addEventListener('input', debounce(function() {
            searchExaminations(this.value);
        }, 300));
        examSearchInput.addEventListener('focus', function() {
            if (this.value.length > 0) searchExaminations(this.value);
        });
        document.addEventListener('click', function(e) {
            if (!examSearchInput.contains(e.target) && !examSearchDropdown.contains(e.target)) {
                examSearchDropdown.classList.add('hidden');
            }
        });
    }
    
    // 疾病/症状搜索
    const diseaseSearchInput = document.getElementById('diseaseSearchInput');
    const diseaseSearchDropdown = document.getElementById('diseaseSearchDropdown');
    if (diseaseSearchInput) {
        diseaseSearchInput.addEventListener('input', debounce(function() {
            searchDiseases(this.value);
        }, 300));
        diseaseSearchInput.addEventListener('focus', function() {
            if (this.value.length > 0) searchDiseases(this.value);
        });
        document.addEventListener('click', function(e) {
            if (!diseaseSearchInput.contains(e.target) && !diseaseSearchDropdown.contains(e.target)) {
                diseaseSearchDropdown.classList.add('hidden');
            }
        });
    }
    
    // 性别改变时显示/隐藏月经史
    if (elements.mrGender) {
        elements.mrGender.addEventListener('change', function() {
            if (elements.mrMensesSection) {
                elements.mrMensesSection.style.display = this.value === '女' ? 'block' : 'none';
            }
        });
    }
    
    // 药品 - 按钮搜索 + 实时输入搜索
    elements.searchMedicineBtn.addEventListener('click', searchMedicine);
    elements.medicineSearch.addEventListener('input', debounce(searchMedicine, 300));
    elements.savePrescriptionBtn.addEventListener('click', savePrescription);
    
    // 病历
    elements.saveRecordBtn.addEventListener('click', saveCurrentRecord);
    elements.newRecordBtn.addEventListener('click', createNewRecord);
    elements.exportRecordsBtn.addEventListener('click', exportRecords);
    elements.clearAllBtn.addEventListener('click', clearAllRecords);
    
    // 弹窗关闭
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.add('hidden');
        });
    });
}

// 切换标签
function switchTab(tabName) {
    elements.navTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    
    const tabMap = {
        'consultation': 'consultationTab',
        'examination': 'examinationTab',
        'prescription': 'prescriptionTab',
        'medical-record': 'medicalRecordTab'
    };
    
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabMap[tabName]);
    });
}

// 创建新患者
function saveRecentCase(caseName) {
    try {
        let cases = [];
        const saved = localStorage.getItem('medical_recent_cases');
        if (saved) cases = JSON.parse(saved);
        cases.unshift(caseName);
        if (cases.length > 10) cases = cases.slice(0, 10);
        localStorage.setItem('medical_recent_cases', JSON.stringify(cases));
    } catch (e) {}
}

async function createNewPatient() {
    // 显示加载状态
    elements.chatMessages.innerHTML = `
        <div class="chat-message system">
            <div class="message-content" style="text-align: center; color: var(--primary-color); padding: 40px;">
                <div class="ai-generating">
                    <div class="spinner"></div>
                    <span>AI 正在生成病例，请稍候...</span>
                </div>
                <p style="margin-top: 12px; color: var(--text-secondary); font-size: 13px;">
                    首次生成可能需要 30-60 秒
                </p>
            </div>
        </div>
    `;
    
    // 禁用按钮防止重复点击
    elements.newPatientBtn.disabled = true;
    elements.newPatientBtn.textContent = '生成中...';
    
    try {
        // Build recentCases from localStorage
        let recentCases = [];
        try {
            const saved = localStorage.getItem('medical_recent_cases');
            if (saved) recentCases = JSON.parse(saved);
        } catch (e) {}

        const response = await fetchWithTimeout(`${API_BASE_URL}/patients/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recentCases })
        }, 180000); // 3分钟超时
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentPatient = data.data.patient;
                renderPatientInfo();
                speechService.callPatient(currentPatient.name);
                renderInitialMessage(data.data.initialDescription);
                enableControls();
                saveRecentCase(currentPatient.symptoms || currentPatient.name);
                
                currentPrescription = [];
                currentExaminations = []; // 重置检查单
                renderPrescriptionItems();
                renderExaminationList();
                
                createNewRecordFromPatient();
                
                // 恢复按钮
                elements.newPatientBtn.disabled = false;
                elements.newPatientBtn.innerHTML = '<span>👤</span> 新患者';
                return;
            }
        }
    } catch (error) {
        console.log('后端不可用，使用本地模式', error);
        // 显示错误提示
        elements.chatMessages.innerHTML = `
            <div class="chat-message system">
                <div class="message-content" style="text-align: center; color: var(--danger-color); padding: 20px;">
                    <p>⚠️ AI生成失败：${error.message || '请求超时'}</p>
                    <p style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        将使用本地模式
                    </p>
                </div>
            </div>
        `;
    }
    
    // 恢复按钮
    elements.newPatientBtn.disabled = false;
    elements.newPatientBtn.innerHTML = '<span>👤</span> 新患者';
    
    // 延迟一下再切换到本地模式
    setTimeout(() => createNewPatientLocal(), 1500);
}

function createNewPatientLocal() {
    const names = ['张伟', '李娜', '王芳', '刘洋', '陈静'];
    const symptomsList = ['发热咳嗽', '腹痛腹泻', '头痛头晕', '胸闷气短'];
    
    currentPatient = {
        id: 'patient_' + Date.now(),
        name: names[Math.floor(Math.random() * names.length)],
        gender: Math.random() > 0.5 ? '男' : '女',
        age: Math.floor(Math.random() * 40) + 20,
        symptoms: symptomsList[Math.floor(Math.random() * symptomsList.length)],
        medicalHistory: []
    };
    
    renderPatientInfo();
    speechService.callPatient(currentPatient.name);
    
    const initialMessage = `医生您好，我${currentPatient.symptoms}已经好几天了，请帮我看看。`;
    renderInitialMessage(initialMessage);
    enableControls();
    saveRecentCase(currentPatient.symptoms);
    
    currentPrescription = [];
    currentExaminations = []; // 重置检查单
    renderPrescriptionItems();
    renderExaminationList();
    
    createNewRecordFromPatient();
}

// 从患者创建病历
function createNewRecordFromPatient() {
    if (!currentPatient) return;
    
    const record = {
        id: 'record_' + Date.now(),
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        patientGender: currentPatient.gender,
        patientAge: currentPatient.age,
        date: new Date().toLocaleString('zh-CN'),
        recordNo: 'MR' + Date.now().toString().slice(-8),
        marital: '',
        occupation: '',
        ethnicity: '',
        department: '内科',
        phone: '',
        address: '',
        chiefComplaint: currentPatient.symptoms || '',
        presentIllness: '',
        pastHistory: '',
        smoking: '无',
        smokingDetail: '',
        drinking: '无',
        drinkingDetail: '',
        allergy: '无',
        allergyDetail: '',
        exposure: '无',
        familyHistory: '',
        menses: '',
        temperature: '36.5',
        pulse: '80',
        respiration: '20',
        bloodPressure: '120/80',
        oxygen: '98',
        generalExam: '',
        skinExam: '',
        headNeck: '',
        chestExam: '',
        abdomenExam: '',
        limbExam: '',
        neuroExam: '',
        physicalExam: '',
        auxiliary: '',
        diagnosis: '',
        tcmDiagnosis: '',
        treatment: '',
        prescription: '',
        doctorOrders: '',
        doctorSignature: '',
        signatureDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now()
    };
    
    medicalRecords.push(record);
    currentRecordId = record.id;
    loadRecordToForm(record);
    saveLocalRecords();
    renderRecordList();
    updateRecordCount();
}

// 创建空病历
function createNewRecord() {
    const record = {
        id: 'record_' + Date.now(),
        patientId: '',
        patientName: '',
        patientGender: '',
        patientAge: '',
        date: new Date().toLocaleString('zh-CN'),
        recordNo: 'MR' + Date.now().toString().slice(-8),
        marital: '',
        occupation: '',
        ethnicity: '',
        department: '内科',
        phone: '',
        address: '',
        chiefComplaint: '',
        presentIllness: '',
        pastHistory: '',
        smoking: '无',
        smokingDetail: '',
        drinking: '无',
        drinkingDetail: '',
        allergy: '无',
        allergyDetail: '',
        exposure: '无',
        familyHistory: '',
        menses: '',
        temperature: '36.5',
        pulse: '80',
        respiration: '20',
        bloodPressure: '120/80',
        oxygen: '98',
        generalExam: '',
        skinExam: '',
        headNeck: '',
        chestExam: '',
        abdomenExam: '',
        limbExam: '',
        neuroExam: '',
        physicalExam: '',
        auxiliary: '',
        diagnosis: '',
        tcmDiagnosis: '',
        treatment: '',
        prescription: '',
        doctorOrders: '',
        doctorSignature: '',
        signatureDate: new Date().toISOString().split('T')[0],
        createdAt: Date.now()
    };
    
    medicalRecords.push(record);
    currentRecordId = record.id;
    loadRecordToForm(record);
    saveLocalRecords();
    renderRecordList();
    updateRecordCount();
}

// 加载病历到表单
function loadRecordToForm(record) {
    if (elements.mrName) elements.mrName.value = record.patientName || '';
    if (elements.mrGender) elements.mrGender.value = record.patientGender || '';
    if (elements.mrAge) elements.mrAge.value = record.patientAge || '';
    if (elements.mrDate) elements.mrDate.textContent = record.date;
    if (elements.mrRecordNo) elements.mrRecordNo.textContent = record.recordNo || '-';
    if (elements.mrMarital) elements.mrMarital.value = record.marital || '';
    if (elements.mrOccupation) elements.mrOccupation.value = record.occupation || '';
    if (elements.mrEthnicity) elements.mrEthnicity.value = record.ethnicity || '';
    if (elements.mrDepartment) elements.mrDepartment.value = record.department || '内科';
    if (elements.mrPhone) elements.mrPhone.value = record.phone || '';
    if (elements.mrAddress) elements.mrAddress.value = record.address || '';
    if (elements.mrChiefComplaint) elements.mrChiefComplaint.value = record.chiefComplaint || '';
    if (elements.mrPresentIllness) elements.mrPresentIllness.value = record.presentIllness || '';
    if (elements.mrPastHistory) elements.mrPastHistory.value = record.pastHistory || '';
    if (elements.mrSmoking) elements.mrSmoking.value = record.smoking || '无';
    if (elements.mrSmokingDetail) elements.mrSmokingDetail.value = record.smokingDetail || '';
    if (elements.mrDrinking) elements.mrDrinking.value = record.drinking || '无';
    if (elements.mrDrinkingDetail) elements.mrDrinkingDetail.value = record.drinkingDetail || '';
    if (elements.mrAllergy) elements.mrAllergy.value = record.allergy || '无';
    if (elements.mrAllergyDetail) elements.mrAllergyDetail.value = record.allergyDetail || '';
    if (elements.mrExposure) elements.mrExposure.value = record.exposure || '无';
    if (elements.mrFamilyHistory) elements.mrFamilyHistory.value = record.familyHistory || '';
    if (elements.mrMenses) elements.mrMenses.value = record.menses || '';
    if (elements.mrTemperature) elements.mrTemperature.value = record.temperature || '36.5';
    if (elements.mrPulse) elements.mrPulse.value = record.pulse || '80';
    if (elements.mrRespiration) elements.mrRespiration.value = record.respiration || '20';
    if (elements.mrBloodPressure) elements.mrBloodPressure.value = record.bloodPressure || '120/80';
    if (elements.mrOxygen) elements.mrOxygen.value = record.oxygen || '98';
    if (elements.mrGeneralExam) elements.mrGeneralExam.value = record.generalExam || '';
    if (elements.mrSkinExam) elements.mrSkinExam.value = record.skinExam || '';
    if (elements.mrHeadNeck) elements.mrHeadNeck.value = record.headNeck || '';
    if (elements.mrChestExam) elements.mrChestExam.value = record.chestExam || '';
    if (elements.mrAbdomenExam) elements.mrAbdomenExam.value = record.abdomenExam || '';
    if (elements.mrLimbExam) elements.mrLimbExam.value = record.limbExam || '';
    if (elements.mrNeuroExam) elements.mrNeuroExam.value = record.neuroExam || '';
    if (elements.mrPhysicalExam) elements.mrPhysicalExam.value = record.physicalExam || '';
    if (elements.mrAuxiliary) elements.mrAuxiliary.value = record.auxiliary || '';
    if (elements.mrDiagnosis) elements.mrDiagnosis.value = record.diagnosis || '';
    if (elements.mrTCMDiagnosis) elements.mrTCMDiagnosis.value = record.tcmDiagnosis || '';
    if (elements.mrTreatment) elements.mrTreatment.value = record.treatment || '';
    if (elements.mrPrescription) elements.mrPrescription.value = record.prescription || '';
    if (elements.mrDoctorOrders) elements.mrDoctorOrders.value = record.doctorOrders || '';
    if (elements.mrDoctorSignature) elements.mrDoctorSignature.value = record.doctorSignature || '';
    if (elements.mrSignatureDate) elements.mrSignatureDate.value = record.signatureDate || new Date().toISOString().split('T')[0];
    
    // 显示/隐藏月经史（女性）
    if (elements.mrMensesSection) {
        elements.mrMensesSection.style.display = record.patientGender === '女' ? 'block' : 'none';
    }
    
    elements.recordStatus.textContent = '💾 已加载';

    // Show/hide score display in editor
    const scoreDisplay = document.getElementById('recordScoreDisplay');
    if (scoreDisplay) {
        if (record.score != null) {
            const gradeEmoji = { 'S': '🏆', 'A': '⭐', 'B': '👍', 'C': '📝', 'D': '📚' };
            const emoji = gradeEmoji[record.grade] || '📋';
            const aiTag = record.aiScored ? ' <span style="font-size:11px;opacity:0.7;">🤖AI</span>' : '';
            scoreDisplay.innerHTML = `${emoji} <strong>${record.grade}</strong> 级 · ${record.score}分${aiTag}`;
            scoreDisplay.style.color = record.gradeColor || '#333';
            scoreDisplay.style.display = 'inline-flex';
        } else {
            scoreDisplay.style.display = 'none';
        }
    }

    // Show/hide detailed score panel
    const scorePanel = document.getElementById('recordScorePanel');
    if (scorePanel) {
        if (record.score != null) {
            const gradeEmoji = { 'S': '🏆', 'A': '⭐', 'B': '👍', 'C': '📝', 'D': '📚' };
            const emoji = gradeEmoji[record.grade] || '📋';

            // 总分概览
            document.getElementById('scorePanelGrade').innerHTML = `<span>${emoji}</span><span>${record.grade || '?'}</span>`;
            document.getElementById('scorePanelGrade').style.color = record.gradeColor || '#333';
            document.getElementById('scorePanelScore').textContent = `${record.score} 分`;

            // AI标签
            const aiTagEl = document.getElementById('scorePanelAiTag');
            if (aiTagEl) aiTagEl.style.display = record.aiScored ? 'inline-flex' : 'none';

            // 分项评分
            const breakdownEl = document.getElementById('scorePanelBreakdown');
            if (breakdownEl && record.scoreBreakdown) {
                const bd = record.scoreBreakdown;
                let bdHtml = '';
                if (bd.diagnosis) {
                    bdHtml += `<div class="breakdown-row"><span class="bd-label">诊断正确性</span><div class="bd-bar-wrap"><div class="bd-bar" style="width:${(bd.diagnosis.score/45*100).toFixed(0)}%;background:${record.gradeColor || '#4CAF50'}"></div></div><span class="bd-score">${bd.diagnosis.score || 0}/45</span></div>`;
                    if (bd.diagnosis.comment) bdHtml += `<div class="bd-comment">${bd.diagnosis.comment}</div>`;
                }
                if (bd.examination) {
                    bdHtml += `<div class="breakdown-row"><span class="bd-label">检查合理性</span><div class="bd-bar-wrap"><div class="bd-bar" style="width:${(bd.examination.score/20*100).toFixed(0)}%;background:${record.gradeColor || '#4CAF50'}"></div></div><span class="bd-score">${bd.examination.score || 0}/20</span></div>`;
                    if (bd.examination.comment) bdHtml += `<div class="bd-comment">${bd.examination.comment}</div>`;
                }
                if (bd.medicine) {
                    bdHtml += `<div class="breakdown-row"><span class="bd-label">用药合理性</span><div class="bd-bar-wrap"><div class="bd-bar" style="width:${(bd.medicine.score/20*100).toFixed(0)}%;background:${record.gradeColor || '#4CAF50'}"></div></div><span class="bd-score">${bd.medicine.score || 0}/20</span></div>`;
                    if (bd.medicine.comment) bdHtml += `<div class="bd-comment">${bd.medicine.comment}</div>`;
                }
                if (bd.consultation) {
                    bdHtml += `<div class="breakdown-row"><span class="bd-label">问诊技巧</span><div class="bd-bar-wrap"><div class="bd-bar" style="width:${(bd.consultation.score/15*100).toFixed(0)}%;background:${record.gradeColor || '#4CAF50'}"></div></div><span class="bd-score">${bd.consultation.score || 0}/15</span></div>`;
                    if (bd.consultation.comment) bdHtml += `<div class="bd-comment">${bd.consultation.comment}</div>`;
                }
                breakdownEl.innerHTML = bdHtml;
            }

            // 费用统计
            const costsEl = document.getElementById('scorePanelCosts');
            if (costsEl && record.costs) {
                document.getElementById('costExamValue').textContent = `¥${(record.costs.examination || 0).toFixed(2)}`;
                document.getElementById('costMedValue').textContent = `¥${(record.costs.medicine || 0).toFixed(2)}`;
                document.getElementById('costTotalValue').textContent = `¥${(record.costs.total || 0).toFixed(2)}`;
                costsEl.style.display = 'block';
            } else if (costsEl) {
                costsEl.style.display = 'none';
            }

            // 正确诊断
            const diagEl = document.getElementById('scorePanelDiagnosis');
            if (diagEl && record.correctDiagnosis) {
                document.getElementById('correctDiagValue').textContent = record.correctDiagnosis;
                const matchTypes = { exact: '✅ 完全匹配', partial: '🔶 部分匹配', keyword: '🔸 关键词匹配', wrong: '❌ 不匹配' };
                document.getElementById('matchTypeValue').textContent = matchTypes[record.matchType] || (record.diagnosisMatch ? '✅ 匹配' : '❌ 不匹配');
                diagEl.style.display = 'block';
            } else if (diagEl) {
                diagEl.style.display = 'none';
            }

            // 总体评价
            const commentEl = document.getElementById('scorePanelComment');
            if (commentEl && record.overallComment) {
                document.getElementById('overallCommentText').textContent = record.overallComment;
                commentEl.style.display = 'block';
            } else if (commentEl) {
                commentEl.style.display = 'none';
            }

            scorePanel.style.display = 'block';
        } else {
            scorePanel.style.display = 'none';
        }
    }
}

// 保存当前病历
function saveCurrentRecord() {
    if (!currentRecordId) {
        createNewRecord();
        return;
    }
    
    const recordIndex = medicalRecords.findIndex(r => r.id === currentRecordId);
    if (recordIndex === -1) return;
    
    const record = medicalRecords[recordIndex];
    record.patientName = elements.mrName ? elements.mrName.value : record.patientName;
    record.patientGender = elements.mrGender ? elements.mrGender.value : record.patientGender;
    record.patientAge = elements.mrAge ? elements.mrAge.value : record.patientAge;
    record.marital = elements.mrMarital ? elements.mrMarital.value : record.marital;
    record.occupation = elements.mrOccupation ? elements.mrOccupation.value : record.occupation;
    record.ethnicity = elements.mrEthnicity ? elements.mrEthnicity.value : record.ethnicity;
    record.department = elements.mrDepartment ? elements.mrDepartment.value : record.department;
    record.phone = elements.mrPhone ? elements.mrPhone.value : record.phone;
    record.address = elements.mrAddress ? elements.mrAddress.value : record.address;
    record.chiefComplaint = elements.mrChiefComplaint ? elements.mrChiefComplaint.value : record.chiefComplaint;
    record.presentIllness = elements.mrPresentIllness ? elements.mrPresentIllness.value : record.presentIllness;
    record.pastHistory = elements.mrPastHistory ? elements.mrPastHistory.value : record.pastHistory;
    record.smoking = elements.mrSmoking ? elements.mrSmoking.value : record.smoking;
    record.smokingDetail = elements.mrSmokingDetail ? elements.mrSmokingDetail.value : record.smokingDetail;
    record.drinking = elements.mrDrinking ? elements.mrDrinking.value : record.drinking;
    record.drinkingDetail = elements.mrDrinkingDetail ? elements.mrDrinkingDetail.value : record.drinkingDetail;
    record.allergy = elements.mrAllergy ? elements.mrAllergy.value : record.allergy;
    record.allergyDetail = elements.mrAllergyDetail ? elements.mrAllergyDetail.value : record.allergyDetail;
    record.exposure = elements.mrExposure ? elements.mrExposure.value : record.exposure;
    record.familyHistory = elements.mrFamilyHistory ? elements.mrFamilyHistory.value : record.familyHistory;
    record.menses = elements.mrMenses ? elements.mrMenses.value : record.menses;
    record.temperature = elements.mrTemperature ? elements.mrTemperature.value : record.temperature;
    record.pulse = elements.mrPulse ? elements.mrPulse.value : record.pulse;
    record.respiration = elements.mrRespiration ? elements.mrRespiration.value : record.respiration;
    record.bloodPressure = elements.mrBloodPressure ? elements.mrBloodPressure.value : record.bloodPressure;
    record.oxygen = elements.mrOxygen ? elements.mrOxygen.value : record.oxygen;
    record.generalExam = elements.mrGeneralExam ? elements.mrGeneralExam.value : record.generalExam;
    record.skinExam = elements.mrSkinExam ? elements.mrSkinExam.value : record.skinExam;
    record.headNeck = elements.mrHeadNeck ? elements.mrHeadNeck.value : record.headNeck;
    record.chestExam = elements.mrChestExam ? elements.mrChestExam.value : record.chestExam;
    record.abdomenExam = elements.mrAbdomenExam ? elements.mrAbdomenExam.value : record.abdomenExam;
    record.limbExam = elements.mrLimbExam ? elements.mrLimbExam.value : record.limbExam;
    record.neuroExam = elements.mrNeuroExam ? elements.mrNeuroExam.value : record.neuroExam;
    record.physicalExam = elements.mrPhysicalExam ? elements.mrPhysicalExam.value : record.physicalExam;
    record.auxiliary = elements.mrAuxiliary ? elements.mrAuxiliary.value : record.auxiliary;
    record.diagnosis = elements.mrDiagnosis ? elements.mrDiagnosis.value : record.diagnosis;
    record.tcmDiagnosis = elements.mrTCMDiagnosis ? elements.mrTCMDiagnosis.value : record.tcmDiagnosis;
    record.treatment = elements.mrTreatment ? elements.mrTreatment.value : record.treatment;
    record.prescription = elements.mrPrescription ? elements.mrPrescription.value : record.prescription;
    record.doctorOrders = elements.mrDoctorOrders ? elements.mrDoctorOrders.value : record.doctorOrders;
    record.doctorSignature = elements.mrDoctorSignature ? elements.mrDoctorSignature.value : record.doctorSignature;
    record.signatureDate = elements.mrSignatureDate ? elements.mrSignatureDate.value : record.signatureDate;
    record.updatedAt = Date.now();
    
    saveLocalRecords();
    renderRecordList();
    elements.recordStatus.textContent = '✅ 已保存';
    
    setTimeout(() => {
        elements.recordStatus.textContent = '💾 本地';
    }, 2000);
}

// 渲染病历列表
function renderRecordList() {
    if (medicalRecords.length === 0) {
        elements.recordList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📝</span>
                <p>暂无病历</p>
            </div>
        `;
        return;
    }
    
    elements.recordList.innerHTML = medicalRecords.map(record => {
        const gradeEmoji = { 'S': '🏆', 'A': '⭐', 'B': '👍', 'C': '📝', 'D': '📚' };
        const scoreBadge = record.score != null
            ? `<div class="record-item-score" style="color: ${record.gradeColor || '#333'}; background: ${record.gradeColor || '#333'}22;">${gradeEmoji[record.grade] || '📋'} ${record.grade} ${record.score}分</div>`
            : '';
        return `
        <div class="record-item ${record.id === currentRecordId ? 'active' : ''}" data-id="${record.id}">
            <div class="record-item-main">
                <div class="record-item-name">${record.patientName || '未命名'}</div>
                <div class="record-item-date">${record.date}</div>
                <div class="record-item-preview">${record.chiefComplaint || '无主诉'}</div>
            </div>
            ${scoreBadge}
        </div>
    `}).join('');
    
    elements.recordList.querySelectorAll('.record-item').forEach(item => {
        item.addEventListener('click', () => {
            const recordId = item.dataset.id;
            const record = medicalRecords.find(r => r.id === recordId);
            if (record) {
                currentRecordId = recordId;
                loadRecordToForm(record);
                renderRecordList();
            }
        });
    });
}

// 更新病历计数
function updateRecordCount() {
    elements.recordCount.textContent = `${medicalRecords.length}条`;
}

// 本地存储
const STORAGE_KEY = 'medical_records_v2';

function saveLocalRecords() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(medicalRecords));
    } catch (e) {
        console.error('保存失败:', e);
    }
}

function loadLocalRecords() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            medicalRecords = JSON.parse(saved);
        }
    } catch (e) {
        console.error('加载失败:', e);
        medicalRecords = [];
    }
}

function exportRecords() {
    const dataStr = JSON.stringify(medicalRecords, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `病历_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearAllRecords() {
    medicalRecords = [];
    currentRecordId = null;
    saveLocalRecords();
    renderRecordList();
    updateRecordCount();
    
    // 清空表单
    const fieldsToClear = ['mrName','mrGender','mrAge','mrMarital','mrOccupation','mrEthnicity','mrDepartment','mrPhone','mrAddress','mrChiefComplaint','mrPresentIllness','mrPastHistory','mrSmoking','mrSmokingDetail','mrDrinking','mrDrinkingDetail','mrAllergy','mrAllergyDetail','mrExposure','mrFamilyHistory','mrMenses','mrTemperature','mrPulse','mrRespiration','mrBloodPressure','mrOxygen','mrGeneralExam','mrSkinExam','mrHeadNeck','mrChestExam','mrAbdomenExam','mrLimbExam','mrNeuroExam','mrPhysicalExam','mrAuxiliary','mrDiagnosis','mrTCMDiagnosis','mrTreatment','mrPrescription','mrDoctorOrders','mrDoctorSignature'];
    fieldsToClear.forEach(f => { if (elements[f] && elements[f].value !== undefined) elements[f].value = ''; });
    
    elements.recordStatus.textContent = '💾 本地';
}

// 渲染患者信息
function renderPatientInfo() {
    if (!currentPatient) {
        elements.patientInfo.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">👤</span>
                <p>暂无患者</p>
                <p class="empty-hint">点击"新患者"开始问诊</p>
            </div>
        `;
        return;
    }

    const returnVisitBadge = currentPatient.isReturnVisit
        ? `<div class="return-visit-badge">🔄 复诊</div>`
        : '';

    // 查找历史病历（同名患者）
    const historyRecords = medicalRecords.filter(r =>
        r.patientName === currentPatient.name && r.id !== currentRecordId
    ).slice(0, 5);
    
    let historyHtml = '';
    if (historyRecords.length > 0) {
        const historyItems = historyRecords.map(r => {
            const gradeEmoji = { 'S': '🏆', 'A': '⭐', 'B': '👍', 'C': '📝', 'D': '📚' };
            const scoreBadge = r.grade ? `<span style="color:${r.gradeColor || '#333'};font-size:11px;margin-left:4px;">${gradeEmoji[r.grade] || ''}${r.grade} ${r.score}分</span>` : '';
            return `<div class="history-record-item" data-id="${r.id}" style="cursor:pointer;padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#666;">${r.date || '-'}</span>
                    ${scoreBadge}
                </div>
                <div style="color:#333;margin-top:2px;">${r.chiefComplaint || r.diagnosis || '无记录'}</div>
                ${r.diagnosis ? `<div style="color:#0066cc;font-size:11px;margin-top:1px;">诊断：${r.diagnosis}</div>` : ''}
            </div>`;
        }).join('');
        historyHtml = `
            <div class="patient-history-section" style="margin-top:12px;border-top:1px solid #e0e0e0;padding-top:8px;">
                <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:6px;">📋 历史病历 (${historyRecords.length})</div>
                <div class="history-list" style="max-height:200px;overflow-y:auto;">${historyItems}</div>
            </div>
        `;
    }

    elements.patientInfo.innerHTML = `
        <div class="patient-avatar">${currentPatient.gender === '女' ? '👩' : '👨'}</div>
        <div class="patient-name">${currentPatient.name}${returnVisitBadge}</div>
        <div class="patient-details">
            <div>${currentPatient.gender} · ${currentPatient.age}岁</div>
        </div>
        <div class="patient-symptoms">
            <div class="symptom-tag">${currentPatient.symptoms || '未知症状'}</div>
        </div>
        ${historyHtml}
    `;
    
    // 绑定历史病历点击事件
    elements.patientInfo.querySelectorAll('.history-record-item').forEach(item => {
        item.addEventListener('click', () => {
            const recordId = item.dataset.id;
            const record = medicalRecords.find(r => r.id === recordId);
            if (record) {
                currentRecordId = recordId;
                loadRecordToForm(record);
                renderRecordList();
                switchTab('medical-record');
            }
        });
    });
}

// 渲染初始消息
function renderInitialMessage(message) {
    elements.chatMessages.innerHTML = `
        <div class="chat-message patient">
            <div class="message-avatar">👤</div>
            <div class="message-content">${message}</div>
        </div>
    `;
}

// 发送消息
async function sendMessage() {
    const message = elements.chatInput.value.trim();
    if (!message || !currentPatient) return;
    
    elements.chatMessages.innerHTML += `
        <div class="chat-message doctor">
            <div class="message-avatar">👨‍⚕️</div>
            <div class="message-content">${message}</div>
        </div>
    `;
    
    elements.chatInput.value = '';
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    try {
        const response = await fetch(`${API_BASE_URL}/patients/${currentPatient.id}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: message })
        });
        
        if (response.ok) {
            const data = await response.json();
            // 支持多种返回格式
            let reply = null;
            
            // 最新格式：{ success: true, data: { answer: "...", history: [...] } }
            if (data.success && data.data && data.data.answer) {
                reply = data.data.answer;
            } 
            // 其他可能的格式
            else if (data.answer) {
                reply = data.answer;
            } 
            else if (data.data) {
                if (typeof data.data === 'object') {
                    reply = data.data.answer || data.data;
                } else {
                    reply = data.data;
                }
            }
            
            if (reply) {
                if (typeof reply === 'object') {
                    reply = JSON.stringify(reply);
                }
                renderPatientReply(String(reply));
                return;
            }
        }
    } catch (e) {
        console.log('使用本地回复');
    }
    
    renderPatientReply('好的医生，我明白了。还有其他问题吗？');
}

function renderPatientReply(reply) {
    let safeReply = String(reply || '');
    if (safeReply === '[object Object]') {
        safeReply = '好的，我明白了';
    }
    // 清理多余的换行和空白
    safeReply = safeReply.trim().replace(/\n\s*\n/g, '\n').replace(/\n/g, '<br>');
    elements.chatMessages.innerHTML += `
        <div class="chat-message patient">
            <div class="message-avatar">👤</div>
            <div class="message-content">${safeReply}</div>
        </div>
    `;
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// 启用控件
function enableControls() {
    if (elements.chatInput) elements.chatInput.disabled = false;
    if (elements.sendBtn) elements.sendBtn.disabled = false;
    if (elements.addExamBtn) elements.addExamBtn.disabled = false;
    if (elements.savePrescriptionBtn) elements.savePrescriptionBtn.disabled = false;
    if (elements.endConsultationBtn) elements.endConsultationBtn.disabled = false;
}

// 加载检查类型
async function loadExaminationTypes() {
    try {
        const response = await fetch(`${API_BASE_URL}/examinations/types`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                examinationTypes = data.data;
                renderExamTypes();
            }
        }
    } catch (e) {
        console.log('使用本地检查类型');
    }
    
    // 无论后端是否可用，都设置基础检查类型
    if (!examinationTypes || Object.keys(examinationTypes).length === 0) {
        examinationTypes = {
            'bloodRoutine': { id: 'blood_routine', name: '血常规', category: '实验室检查', price: 25 },
            'ctScan': { id: 'ct_scan', name: 'CT检查', category: '影像学检查', price: 280, bodyParts: ['头部', '胸部', '腹部', '盆腔', '脊柱', '四肢'] },
            'xRay': { id: 'x_ray', name: 'X光检查', category: '影像学检查', price: 60, bodyParts: ['胸部', '腹部', '骨骼', '关节'] },
            'ultrasound': { id: 'ultrasound', name: 'B超检查', category: '影像学检查', price: 120, bodyParts: ['腹部', '心脏', '甲状腺', '乳腺', '泌尿系'] },
            'urineRoutine': { id: 'urine_routine', name: '尿常规', category: '实验室检查', price: 15 },
            'stoolRoutine': { id: 'stool_routine', name: '大便常规', category: '实验室检查', price: 15 },
            'liverFunction': { id: 'liver_function', name: '肝功能', category: '实验室检查', price: 80 },
            'kidneyFunction': { id: 'kidney_function', name: '肾功能', category: '实验室检查', price: 60 },
            'bloodSugar': { id: 'blood_sugar', name: '血糖', category: '实验室检查', price: 20 },
            'lipidProfile': { id: 'lipid_profile', name: '血脂', category: '实验室检查', price: 70 },
            'crp': { id: 'crp', name: 'C反应蛋白', category: '实验室检查', price: 35 },
            'fluA': { id: 'flu_a', name: '甲流检测', category: '实验室检查', price: 80 },
            'fluB': { id: 'flu_b', name: '乙流检测', category: '实验室检查', price: 80 },
            'covid19': { id: 'covid_19', name: '新冠检测', category: '实验室检查', price: 60 },
            'mycoplasma': { id: 'mycoplasma', name: '支原体检测', category: '实验室检查', price: 100 }
        };
    }
    renderExamTypes();
}

function renderExamTypes() {
    let optionsHtml = '<option value="">请选择检查项目</option>';
    
    // 处理两种数据格式：对象数组或键值对
    if (Array.isArray(examinationTypes)) {
        optionsHtml += examinationTypes.map(type => {
            const name = type.name || type.id || type;
            const id = type.id || name;
            return `<option value="${id}">${name}</option>`;
        }).join('');
    } else if (typeof examinationTypes === 'object') {
        optionsHtml += Object.entries(examinationTypes).map(([key, value]) => {
            const name = value.name || key;
            const id = value.id || key;
            return `<option value="${id}">${name}</option>`;
        }).join('');
    }
    
    elements.examTypeSelect.innerHTML = optionsHtml;
}

// 检查项目搜索功能
async function searchExaminations(query) {
    const dropdown = document.getElementById('examSearchDropdown');
    if (!dropdown) return;
    
    if (!query || query.trim().length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/examinations/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
                renderExamSearchResults(data.data);
                return;
            }
        }
    } catch (e) {
        console.log('搜索检查项目失败，使用本地过滤');
    }
    
    // 本地过滤
    const localResults = Object.values(examinationTypes).filter(type => {
        const name = (type.name || '').toLowerCase();
        const desc = (type.description || '').toLowerCase();
        const category = (type.category || '').toLowerCase();
        const q = query.toLowerCase();
        return name.includes(q) || desc.includes(q) || category.includes(q);
    });
    
    renderExamSearchResults(localResults);
}

function renderExamSearchResults(results) {
    const dropdown = document.getElementById('examSearchDropdown');
    if (!dropdown) return;
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="exam-search-item no-result">未找到匹配的检查项目</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    
    dropdown.innerHTML = results.slice(0, 10).map(type => `
        <div class="exam-search-item" data-id="${type.id}" data-name="${type.name}">
            <div class="exam-search-name">${type.name}</div>
            <div class="exam-search-info">${type.category || ''} ${type.price ? '¥' + type.price : ''}</div>
            ${type.description ? `<div class="exam-search-desc">${type.description}</div>` : ''}
        </div>
    `).join('');
    
    dropdown.querySelectorAll('.exam-search-item:not(.no-result)').forEach(item => {
        item.addEventListener('click', function() {
            const typeId = this.dataset.id;
            const typeName = this.dataset.name;
            
            // 选中检查项目
            const select = document.getElementById('examTypeSelect');
            if (select) {
                // 查找并选中对应的option
                for (let option of select.options) {
                    if (option.value === typeId || option.textContent === typeName) {
                        select.value = option.value;
                        break;
                    }
                }
                handleExamTypeChange();
            }
            
            // 清空搜索框并隐藏下拉
            const input = document.getElementById('examSearchInput');
            if (input) input.value = '';
            dropdown.classList.add('hidden');
        });
    });
    
    dropdown.classList.remove('hidden');
}

// 疾病/症状模糊搜索
async function searchDiseases(query) {
    const dropdown = document.getElementById('diseaseSearchDropdown');
    if (!dropdown) return;
    
    if (!query || query.trim().length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/examinations/disease-search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
                renderDiseaseSearchResults(data.data);
                return;
            }
        }
    } catch (e) {
        console.log('疾病搜索失败:', e);
    }
    
    dropdown.innerHTML = '<div class="exam-search-item no-result">未找到匹配的疾病</div>';
    dropdown.classList.remove('hidden');
}

function renderDiseaseSearchResults(results) {
    const dropdown = document.getElementById('diseaseSearchDropdown');
    if (!dropdown) return;
    
    if (results.length === 0) {
        dropdown.innerHTML = '<div class="exam-search-item no-result">未找到匹配的疾病</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    
    dropdown.innerHTML = results.slice(0, 8).map(disease => {
        const matchBadges = disease.matchedFields.map(f => {
            const labels = { name: '疾病名', alias: '别名', symptom: '症状', exam: '检查' };
            return `<span class="tag tag-blue" style="font-size:10px;padding:1px 4px;margin-left:4px;">${labels[f] || f}</span>`;
        }).join('');
        const symptomTags = disease.symptoms.slice(0, 5).map(s => `<span class="tag" style="font-size:10px;padding:1px 4px;margin:1px;background:#f0f0f0;">${s}</span>`).join('');
        const examNames = disease.exams.slice(0, 4).map(eid => {
            // 查找检查名称
            const found = Object.values(examinationTypes || {}).find(t => t.id === eid);
            return found ? found.name : eid;
        }).join('、');
        return `
            <div class="exam-search-item disease-item" data-disease="${disease.name}" data-exams='${JSON.stringify(disease.exams)}' data-symptoms='${JSON.stringify(disease.symptoms)}'>
                <div class="exam-search-name">${disease.name}${matchBadges}</div>
                <div style="margin:4px 0;">${symptomTags}</div>
                <div class="exam-search-info">推荐检查：${examNames}</div>
            </div>
        `;
    }).join('');
    
    dropdown.querySelectorAll('.disease-item').forEach(item => {
        item.addEventListener('click', function() {
            const diseaseName = this.dataset.disease;
            const examIds = JSON.parse(this.dataset.exams || '[]');
            
            // 自动填充诊断
            const diagInput = document.getElementById('diagnosisInput');
            if (diagInput) diagInput.value = diseaseName;
            const mrDiag = document.getElementById('mrDiagnosis');
            if (mrDiag && !mrDiag.value) mrDiag.value = diseaseName;
            
            // 批量添加推荐检查
            let addedCount = 0;
            for (const examId of examIds) {
                // 查找检查类型
                let examType = null;
                if (Array.isArray(examinationTypes)) {
                    examType = examinationTypes.find(t => t.id === examId);
                } else if (typeof examinationTypes === 'object') {
                    examType = Object.values(examinationTypes).find(t => t.id === examId);
                }
                if (examType && !currentExaminations.find(e => e.type === examId)) {
                    currentExaminations.push({
                        id: 'exam_' + Date.now() + '_' + addedCount,
                        type: examId,
                        typeName: examType.name,
                        bodyPart: '',
                        date: new Date().toLocaleString('zh-CN'),
                        result: null
                    });
                    addedCount++;
                }
            }
            
            if (addedCount > 0) renderExaminationList();
            
            // 提示
            const input = document.getElementById('diseaseSearchInput');
            if (input) input.value = '';
            dropdown.classList.add('hidden');
            
            // 显示提示
            if (addedCount > 0) {
                const toast = document.createElement('div');
                toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:10px 20px;border-radius:8px;z-index:10000;font-size:14px;';
                toast.textContent = `✅ 已添加 ${addedCount} 项推荐检查（${diseaseName}）`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
        });
    });
    
    dropdown.classList.remove('hidden');
}

function handleExamTypeChange() {
    const examTypeId = elements.examTypeSelect.value;
    if (!examTypeId) {
        elements.bodyPartGroup.classList.add('hidden');
        return;
    }
    
    // 找到对应的检查类型配置
    let examType = null;
    if (Array.isArray(examinationTypes)) {
        examType = examinationTypes.find(t => t.id === examTypeId);
    } else if (typeof examinationTypes === 'object') {
        examType = Object.values(examinationTypes).find(t => t.id === examTypeId);
        if (!examType) {
            examType = examinationTypes[examTypeId];
        }
    }
    
    if (examType && examType.bodyParts && examType.bodyParts.length > 0) {
        elements.bodyPartGroup.classList.remove('hidden');
        elements.bodyPartSelect.innerHTML = `
            <option value="">请选择部位</option>
            ${examType.bodyParts.map(part => `<option value="${part}">${part}</option>`).join('')}
        `;
    } else {
        elements.bodyPartGroup.classList.add('hidden');
    }
}

function addExamination() {
    const examTypeId = elements.examTypeSelect.value;
    if (!examTypeId) return;
    
    let examTypeName = examTypeId;
    let examType = null;
    
    if (Array.isArray(examinationTypes)) {
        examType = examinationTypes.find(t => t.id === examTypeId);
        if (examType) examTypeName = examType.name || examTypeId;
    } else if (typeof examinationTypes === 'object') {
        examType = Object.values(examinationTypes).find(t => t.id === examTypeId);
        if (!examType) {
            examType = examinationTypes[examTypeId];
        }
        if (examType) examTypeName = examType.name || examTypeId;
    }
    
    const bodyPart = elements.bodyPartSelect.value;
    const examItem = {
        id: 'exam_' + Date.now(),
        type: examTypeId,
        typeName: examTypeName,
        bodyPart: bodyPart,
        date: new Date().toLocaleString('zh-CN'),
        result: null
    };
    
    currentExaminations.push(examItem);
    renderExaminationList();
}

async function showExamResult(id) {
    const examItem = currentExaminations.find(exam => exam.id === id);
    if (!examItem || !currentPatient) return;
    
    elements.examResultModal.classList.remove('hidden');
    
    if (examItem.result) {
        renderExamResult(examItem);
        return;
    }
    
    // 显示加载状态
    elements.examResultContent.innerHTML = `
        <div class="exam-result">
            <h4>${examItem.typeName || examItem.type}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</h4>
            <div class="exam-stream-container">
                <div class="ai-generating">
                    <div class="spinner"></div>
                    <span>正在生成检查报告...</span>
                </div>
                <div id="examStreamContent" class="exam-stream-content"></div>
            </div>
        </div>
    `;
    
    try {
        // 创建检查单
        const createResponse = await fetchWithTimeout(`${API_BASE_URL}/examinations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                patientId: currentPatient.id,
                examinationType: examItem.type, 
                bodyPart: examItem.bodyPart 
            })
        }, 30000);
        
        if (!createResponse.ok) {
            throw new Error('创建检查单失败');
        }
        
        const createData = await createResponse.json();
        if (!createData.success || !createData.data) {
            throw new Error('创建检查单失败');
        }
        
        const examOrderId = createData.data.id;
        
        // 使用流式API获取检查结果
        const streamResponse = await fetchWithTimeout(`${API_BASE_URL}/examinations/${examOrderId}/execute-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, 180000);
        
        if (!streamResponse.ok) {
            throw new Error('执行检查失败');
        }
        
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiDescription = '';
        let resultData = null;
        
        const streamContentEl = document.getElementById('examStreamContent');
        const generatingEl = elements.examResultContent.querySelector('.ai-generating');
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (!data) continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (parsed.type === 'status') {
                            if (generatingEl) {
                                generatingEl.querySelector('span').textContent = parsed.message || '正在生成...';
                            }
                        } 
                        else if (parsed.type === 'token') {
                            // 隐藏加载动画，显示流式内容
                            if (generatingEl) {
                                generatingEl.style.display = 'none';
                            }
                            if (streamContentEl) {
                                aiDescription = parsed.full || '';
                                streamContentEl.innerHTML = formatExamResult(aiDescription);
                                streamContentEl.scrollTop = streamContentEl.scrollHeight;
                            }
                        }
                        else if (parsed.type === 'result') {
                            resultData = parsed.result;
                            aiDescription = parsed.aiDescription || aiDescription;
                        }
                        else if (parsed.type === 'done') {
                            // 流式完成
                        }
                        else if (parsed.type === 'error') {
                            throw new Error(parsed.message);
                        }
                    } catch (e) {
                        console.error('解析流数据失败:', e);
                    }
                }
            }
        }
        
        // 保存结果
        examItem.result = resultData || { description: aiDescription, aiGenerated: true };
        if (aiDescription) {
            examItem.result.aiDescription = aiDescription;
            examItem.result.aiGenerated = true;
        }
        
        // 如果没有流式内容，使用非流式渲染
        if (!aiDescription && resultData) {
            renderExamResult(examItem);
        }
        
    } catch (e) {
        console.log('获取检查结果失败:', e);
        // 回退到非流式方式
        try {
            const createResponse = await fetch(`${API_BASE_URL}/examinations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    patientId: currentPatient.id,
                    examinationType: examItem.type, 
                    bodyPart: examItem.bodyPart 
                })
            });
            
            if (createResponse.ok) {
                const createData = await createResponse.json();
                if (createData.success && createData.data) {
                    const executeResponse = await fetch(`${API_BASE_URL}/examinations/${createData.data.id}/execute`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (executeResponse.ok) {
                        const executeData = await executeResponse.json();
                        if (executeData.success && executeData.data) {
                            examItem.result = executeData.data.result;
                            renderExamResult(examItem);
                            return;
                        }
                    }
                }
            }
        } catch (fallbackError) {
            console.log('回退方式也失败:', fallbackError);
        }
        
        renderExamResultPlaceholder(examItem);
    }
}

// 格式化检查结果（支持简单Markdown）
function formatExamResult(text) {
    if (!text) return '';
    
    // 清理可能的<think>标签
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    // 转换换行
    text = text.replace(/\n/g, '<br>');
    
    // 加粗 **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 异常标记（↑ ↓）
    text = text.replace(/(↑|↓)/g, '<span class="abnormal-flag">$1</span>');
    
    // 高亮【检查数据】标题
    text = text.replace(/【检查数据】/g, '<div class="exam-data-title" style="margin:12px 0 8px;padding:6px 10px;background:#f0f7ff;border-left:3px solid #2196F3;font-weight:600;color:#1565C0;">📋 检查数据</div>');
    
    // 高亮【专科医生意见】标题，加分隔线
    text = text.replace(/【专科医生意见】/g, '<div style="border-top:2px dashed #e0e0e0;margin:16px 0 8px;"></div><div class="specialist-header" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #4CAF50;font-weight:600;color:#2e7d32;margin-bottom:8px;"><span>👨‍⚕️</span><span>专科医生意见</span></div>');
    
    // 兼容旧格式
    text = text.replace(/【检查所见】/g, '<div class="exam-data-title" style="margin:12px 0 8px;padding:6px 10px;background:#f0f7ff;border-left:3px solid #2196F3;font-weight:600;color:#1565C0;">📋 检查数据</div>');
    text = text.replace(/【疑似[^】]*】/g, '<div style="border-top:2px dashed #e0e0e0;margin:16px 0 8px;"></div><div style="font-weight:600;color:#e65100;margin-bottom:6px;">⚠️ 疑似症状提示</div>');
    text = text.replace(/【建议】/g, '<div style="font-weight:600;color:#1565C0;margin:10px 0 6px;">💡 建议</div>');
    
    return text;
}

function renderExamResult(examItem) {
    const result = examItem.result;
    let resultHtml = '';
    const examName = examItem.typeName || examItem.type;
    let auxiliaryText = '';
    
    // 优先显示AI生成的内容（医院风格）
    if (result && result.aiDescription) {
        const parsed = parseHospitalReport(result.aiDescription);
        resultHtml = `
            <div class="exam-result-hospital">
                <div class="exam-header">
                    <h4>${examName}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</h4>
                    <div class="exam-date">${examItem.date}</div>
                </div>
                ${parsed.findings ? `
                <div class="exam-data-section">
                    <div class="exam-data-title">📋 检查数据</div>
                    <div class="exam-data-body">${parsed.findings}</div>
                </div>
                ` : ''}
                ${parsed.specialist ? `
                <div class="exam-specialist-section">
                    <div class="specialist-header">
                        <span class="specialist-icon">👨‍⚕️</span>
                        <span class="specialist-title">专科医生意见</span>
                    </div>
                    <div class="specialist-body">${parsed.specialist}</div>
                </div>
                ` : ''}
                ${!parsed.specialist && parsed.suspected && parsed.suspected.length > 0 ? `
                <div class="exam-specialist-section">
                    <div class="specialist-header">
                        <span class="specialist-icon">👨‍⚕️</span>
                        <span class="specialist-title">专科医生意见</span>
                    </div>
                    <div class="specialist-body">
                        <ul>${parsed.suspected.map(s => `<li>${s}</li>`).join('')}</ul>
                        ${parsed.suggestions ? `<p style="margin-top:8px;">${parsed.suggestions}</p>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        auxiliaryText = `【${examName}检查结果】\n${parsed.findings || result.aiDescription}`;
        updateAuxiliaryExam(auxiliaryText);
    } else if (result && result.type === 'blood_routine') {
        const abnormalItems = Object.values(result.items || {}).filter(item => item.isAbnormal);
        
        if (abnormalItems.length > 0) {
            auxiliaryText = `${examName}异常指标：\n`;
            abnormalItems.forEach(item => {
                auxiliaryText += `• ${item.name} ${item.value}${item.unit || ''}（${item.abnormalDirection}，参考值${item.reference}）\n`;
            });
            updateAuxiliaryExam(auxiliaryText);
        }
        
        resultHtml = `
            <div class="exam-result-hospital">
                <div class="exam-header">
                    <h4>${examName}</h4>
                    <div class="exam-date">${examItem.date}</div>
                </div>
                <div class="exam-body">
                    <div class="blood-test-result">
                        <h5>${result.description || '血常规检查结果'}</h5>
                        <div class="blood-test-items">
                            ${Object.values(result.items || {}).map(item => `
                                <div class="blood-test-item ${item.isAbnormal ? 'abnormal' : ''}">
                                    <span class="item-name">${item.name}</span>
                                    <span class="item-value">${item.value}</span>
                                    <span class="item-unit">${item.unit || ''}</span>
                                    <span class="item-reference">(${item.reference || '正常'})</span>
                                    ${item.isAbnormal ? `<span class="abnormal-flag">${item.abnormalDirection}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        <p class="result-summary">${result.summary || ''}</p>
                    </div>
                </div>
                ${abnormalItems.length > 0 ? `
                    <div class="suspected-section">
                        <h5>⚠️ 异常指标提示</h5>
                        <ul>
                            ${abnormalItems.map(item => `<li>${item.name} ${item.abnormalDirection}，建议关注相关症状</li>`).join('')}
                        </ul>
                    </div>
                    <div class="suggestion-section">
                        <h5>💡 建议</h5>
                        <p>建议结合临床症状综合判断，必要时进一步检查。</p>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (result && result.description) {
        if (result.type === 'crp' && result.isAbnormal) {
            auxiliaryText = `${examName}：${result.value}${result.unit}（↑，参考值${result.reference}${result.unit}）`;
            updateAuxiliaryExam(auxiliaryText);
        } else if (result.type !== 'crp') {
            auxiliaryText = `${examName}${examItem.bodyPart ? '（' + examItem.bodyPart + '）' : ''}：\n${result.description}`;
            updateAuxiliaryExam(auxiliaryText);
        }
        
        resultHtml = `
            <div class="exam-result-hospital">
                <div class="exam-header">
                    <h4>${examName}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</h4>
                    <div class="exam-date">${examItem.date}</div>
                </div>
                <div class="exam-body">
                    <p>${result.description}</p>
                </div>
                <div class="suggestion-section">
                    <h5>💡 建议</h5>
                    <p>请结合临床症状综合判断，如有疑问请及时复诊。</p>
                </div>
            </div>
        `;
    } else if (result) {
        const findings = result.findings || result.ctFindings || result.description || '';
        if (findings) {
            auxiliaryText = `${examName}${examItem.bodyPart ? '（' + examItem.bodyPart + '）' : ''}：\n${findings}`;
            updateAuxiliaryExam(auxiliaryText);
        }
        
        resultHtml = `
            <div class="exam-result-hospital">
                <div class="exam-header">
                    <h4>${examName}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</h4>
                    <div class="exam-date">${examItem.date}</div>
                </div>
                <div class="exam-body">
                    <p>${findings || '检查完成'}</p>
                </div>
                <div class="suggestion-section">
                    <h5>💡 建议</h5>
                    <p>请结合临床症状综合判断。</p>
                </div>
            </div>
        `;
    } else {
        resultHtml = `
            <div class="exam-result-hospital">
                <div class="exam-header">
                    <h4>${examName}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</h4>
                    <div class="exam-date">${examItem.date}</div>
                </div>
                <div class="exam-body">
                    <p>检查结果正常。</p>
                </div>
            </div>
        `;
    }
    
    elements.examResultContent.innerHTML = `<div class="exam-result">${resultHtml}</div>`;
}

// 解析医院风格的检查报告
function parseHospitalReport(text) {
    if (!text) return { findings: '', specialist: '', suspected: [], suggestions: '' };
    
    // 清理可能的<think>标签
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    const result = {
        findings: '',     // 检查数据（上面的客观数据）
        specialist: '',   // 专科医生意见（下面的诊断报告）
        suspected: [],
        suggestions: ''
    };
    
    // 新格式：提取【检查数据】部分
    const dataMatch = text.match(/【检查数据】\s*([\s\S]*?)(?=【专科|$)/);
    if (dataMatch) {
        result.findings = dataMatch[1].trim().replace(/\n/g, '<br>');
    }
    
    // 新格式：提取【专科医生意见】部分
    const specialistMatch = text.match(/【专科医生意见】\s*([\s\S]*?)$/);
    if (specialistMatch) {
        result.specialist = specialistMatch[1].trim().replace(/\n/g, '<br>');
    }
    
    // 兼容旧格式：提取【检查所见】部分
    if (!result.findings) {
        const oldFindingsMatch = text.match(/【检查所见】\s*([\s\S]*?)(?=【疑似|$)/);
        if (oldFindingsMatch) {
            result.findings = oldFindingsMatch[1].trim().replace(/\n/g, '<br>');
        }
    }
    
    // 兼容旧格式：提取【疑似症状提示】部分
    const suspectedMatch = text.match(/【疑似[^】]*】\s*([\s\S]*?)(?=【建议|$)/);
    if (suspectedMatch) {
        const lines = suspectedMatch[1].split('\n').filter(line => line.trim());
        result.suspected = lines.map(line => {
            return line.replace(/^[•\-\*]\s*/, '').trim();
        }).filter(line => line.length > 0);
    }
    
    // 兼容旧格式：提取【建议】部分
    const suggestionsMatch = text.match(/【建议】\s*([\s\S]*?)$/);
    if (suggestionsMatch && !result.specialist) {
        result.suggestions = suggestionsMatch[1].trim().replace(/\n/g, '<br>');
    }
    
    // 如果没有解析到结构化内容，使用原始文本作为findings
    if (!result.findings && !result.specialist && !result.suspected.length && !result.suggestions) {
        result.findings = text.replace(/\n/g, '<br>');
    }
    
    return result;
}

function updateAuxiliaryExam(text) {
    const currentValue = elements.mrAuxiliary.value || '';
    if (currentValue && !currentValue.includes(text.split('\n')[0])) {
        elements.mrAuxiliary.value = currentValue + '\n\n' + text;
    } else if (!currentValue) {
        elements.mrAuxiliary.value = text;
    }
}

function renderExamResultPlaceholder(examItem) {
    const examName = examItem.typeName || examItem.type;
    elements.examResultContent.innerHTML = `
        <div class="exam-result">
            <h4>${examName}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''} - ${examItem.date}</h4>
            <p>检查结果正常。</p>
        </div>
    `;
}

function renderExaminationList() {
    if (currentExaminations.length === 0) {
        elements.examListContent.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🔬</span>
                <p>暂无检查单</p>
            </div>
        `;
        return;
    }
    
    elements.examListContent.innerHTML = currentExaminations.map(examItem => `
        <div class="exam-item">
            <div>
                <div class="exam-type">${examItem.typeName || examItem.type}${examItem.bodyPart ? ' - ' + examItem.bodyPart : ''}</div>
                <div class="exam-date">${examItem.date}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="showExamResult('${examItem.id}')">查看报告</button>
        </div>
    `).join('');
}

// 加载药品数据库（扁平数组格式）
async function loadMedicineDatabase() {
    try {
        const response = await fetch(`${API_BASE_URL}/medicines`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                medicineDatabase = data.data;
                return;
            }
        }
    } catch (e) {
        console.log('使用本地药品数据');
    }
    // 本地备用数据
    medicineDatabase = [
        { name: '布洛芬', price: 15.5, specification: '0.4g×20片', dosage: '口服', indications: ['发热','头痛','关节痛'], adverseReactions: ['恶心','腹痛'] },
        { name: '对乙酰氨基酚', price: 12.0, specification: '0.5g×10片', dosage: '口服', indications: ['发热','头痛'], adverseReactions: ['恶心','肝损害'] },
        { name: '阿莫西林', price: 25.0, specification: '0.5g×20粒', dosage: '口服', indications: ['上呼吸道感染','泌尿道感染'], adverseReactions: ['腹泻','皮疹'] }
    ];
}

// 渲染药品列表（扁平展示，无分类）
function renderMedicineCategories() {
    if (!Array.isArray(medicineDatabase)) {
        medicineDatabase = [];
    }
    renderMedicineList(medicineDatabase);
}

function renderMedicineList(medicines) {
    if (!Array.isArray(medicines) || medicines.length === 0) {
        elements.medicineList.innerHTML = '<div class="empty-state">暂无药品数据</div>';
        return;
    }
    elements.medicineCategories.innerHTML = ''; // 隐藏分类标签
    // 保存当前展示的列表到临时变量，供 inline onclick 引用
    window._currentMedicineList = medicines;
    elements.medicineList.innerHTML = medicines.map((med, index) => {
        if (!med || typeof med !== 'object') return '';
        const price = med.price || 0;
        const name = med.name || '未知药品';
        const spec = med.specification ? `<div class="med-spec">${med.specification}</div>` : '';
        const inds = (med.indications || []).slice(0, 3).join('、');
        const medId = med.id || '';
        return `
            <div class="medicine-item" data-id="${medId}" data-list-index="${index}">
                <div class="med-info" onclick="showMedicineDetailById('${medId}')" style="cursor:pointer;flex:1">
                    <div class="med-name">${name}</div>
                    ${spec}
                    <div class="med-indications">${inds}</div>
                    <div class="med-price">¥${price.toFixed(2)}</div>
                </div>
                <button class="btn btn-sm btn-primary add-med-btn" onclick="addMedicine(window._currentMedicineList[${index}])" data-list-index="${index}">➕</button>
            </div>
        `;
    }).join('');
}

// 显示药品详情弹窗（通过 ID 查找，避免索引错位）
function showMedicineDetailById(medId) {
    const med = Array.isArray(medicineDatabase) ? medicineDatabase.find(m => m.id === medId) : null;
    if (!med) return;
    
    const title = document.getElementById('medDetailTitle');
    const body = document.getElementById('medicineDetailContent');
    title.textContent = med.name || '药品详情';
    
    const indications = (med.indications || []).map(i => `<span class="tag tag-blue">${i}</span>`).join('');
    const adverse = (med.adverseReactions || []).map(a => `<span class="tag tag-red">${a}</span>`).join('');
    
    body.innerHTML = `
        <div class="med-detail-grid">
            <div class="detail-row"><label>规格</label><span>${med.specification || '-'}</span></div>
            <div class="detail-row"><label>价格</label><span>¥${(med.price || 0).toFixed(2)}</span></div>
            <div class="detail-row"><label>厂商</label><span>${med.manufacturer || '-'}</span></div>
            <div class="detail-row"><label>用法</label><span>${med.dosage || '-'}</span></div>
            <div class="detail-row"><label>频率</label><span>${med.frequency || '-'}</span></div>
        </div>
        <div class="detail-section">
            <h4>🩺 适应症</h4>
            <div class="tags-wrap">${indications || '<span class="text-muted">暂无数据</span>'}</div>
        </div>
        <div class="detail-section">
            <h4>⚠️ 不良反应</h4>
            <div class="tags-wrap">${adverse || '<span class="text-muted">暂无数据</span>'}</div>
        </div>
        <div style="margin-top:16px;text-align:center">
            <button class="btn btn-primary" onclick="addMedicineById('${medId}');closeMedDetail()">➕ 添加到处方</button>
        </div>
    `;
    
    document.getElementById('medicineDetailModal').classList.remove('hidden');
}

function addMedicineById(medId) {
    const med = Array.isArray(medicineDatabase) ? medicineDatabase.find(m => m.id === medId) : null;
    if (med) addMedicine(med);
}

function closeMedDetail() {
    document.getElementById('medicineDetailModal').classList.add('hidden');
}

// 初始化弹窗关闭
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('medicineDetailModal');
    if (modal) {
        modal.querySelector('.modal-close')?.addEventListener('click', closeMedDetail);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeMedDetail(); });
    }
});

function addMedicine(med) {
    if (!med) return;
    const name = med.name || '未知药品';
    const price = med.price || 0;
    const existing = currentPrescription.find(m => m.name === name);
    if (existing) {
        existing.quantity++;
    } else {
        const medicine = { 
            name, 
            price, 
            quantity: 1,
            ...med
        };
        currentPrescription.push(medicine);
    }
    renderPrescriptionItems();
}

function renderPrescriptionItems() {
    if (currentPrescription.length === 0) {
        elements.prescriptionItems.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">💊</span>
                <p>请从左侧选择药品</p>
            </div>
        `;
        updatePrescriptionSummary();
        return;
    }
    
    elements.prescriptionItems.innerHTML = currentPrescription.map((med, i) => `
        <div class="prescription-item">
            <span>${med.name}</span>
            <span>x${med.quantity}</span>
            <span>¥${(med.price * med.quantity).toFixed(2)}</span>
            <button class="btn btn-sm btn-danger" onclick="removeMedicine(${i})">✕</button>
        </div>
    `).join('');
    
    updatePrescriptionSummary();
}

function removeMedicine(index) {
    currentPrescription.splice(index, 1);
    renderPrescriptionItems();
}

function updatePrescriptionSummary() {
    const total = currentPrescription.reduce((sum, m) => sum + m.price * m.quantity, 0);
    const count = currentPrescription.reduce((sum, m) => sum + m.quantity, 0);
    elements.totalMedicines.textContent = count;
    elements.totalPrice.textContent = '¥' + total.toFixed(2);
}

// 医学同义词/别名映射（搜索词 → 匹配的关键词列表）
const MEDICAL_SYNONYMS = {
    '感冒': ['上呼吸道感染', '普通感冒', '病毒性感冒', '感冒', '急性鼻咽炎'],
    '发烧': ['发热', '高热', '低热', '体温升高'],
    '咳嗽': ['咳嗽', '干咳', '镇咳', '咳痰', '感冒咳嗽', '支气管炎咳嗽'],
    '胃疼': ['胃痛', '上腹痛', '胃脘痛', '腹痛'],
    '拉肚子': ['腹泻', '急性腹泻', '慢性腹泻', '小儿腹泻'],
    '嗓子疼': ['咽痛', '咽喉痛', '扁桃体炎', '咽炎'],
    '头疼': ['头痛', '偏头痛'],
    '流鼻涕': ['流涕', '鼻涕', '清水样鼻涕', '鼻塞'],
    '心慌': ['心悸', '心动过速', '心律失常'],
    '胸闷': ['胸闷', '呼吸困难', '气促'],
    '尿频': ['尿频', '尿急', '排尿困难', '尿频尿急'],
    '过敏': ['过敏性鼻炎', '过敏性结膜炎', '荨麻疹', '过敏性休克', '过敏性疾病', '过敏反应'],
    '失眠': ['失眠', '失眠症', '入睡困难', '睡眠维持障碍'],
    '便秘': ['便秘', '需要软化大便的情况'],
    '贫血': ['贫血', '缺铁性贫血', '巨幼细胞性贫血', '肾性贫血', '化疗后贫血'],
    '糖尿病': ['糖尿病', '2型糖尿病', '1型糖尿病', '妊娠糖尿病'],
    '高血压': ['高血压', '血压升高'],
    '胃炎': ['胃炎', '急性胃炎', '慢性胃炎', '胆汁反流性胃炎'],
    '肝炎': ['肝炎', '慢性肝炎', '病毒性肝炎', '乙型肝炎', '慢性乙型肝炎'],
    '肺炎': ['肺炎', '社区获得性肺炎'],
    '支气管炎': ['支气管炎', '急性支气管炎', '慢性支气管炎', '喘息性支气管炎'],
    '哮喘': ['哮喘', '支气管哮喘', '支气管哮喘急性发作', '哮喘预防和长期治疗'],
    '关节炎': ['关节炎', '骨关节炎', '类风湿关节炎', '退行性关节病', '退行性关节病'],
    '痛风': ['痛风', '痛风急性发作', '高尿酸血症'],
    '湿疹': ['湿疹', '皮炎', '特应性皮炎'],
    '鼻炎': ['鼻炎', '过敏性鼻炎', '血管运动性鼻炎', '急性鼻窦炎'],
    '胃溃疡': ['胃溃疡', '十二指肠溃疡'],
    '感染': ['感染', '皮肤软组织感染', '泌尿道感染', '呼吸道感染', '胃肠道感染'],
    '发烧': ['发热', '高热', '低热'],
    '呕吐': ['呕吐', '恶心', '术后恶心呕吐', '化疗呕吐'],
    '眩晕': ['眩晕', '头晕', '头痛'],
    '水肿': ['水肿', '脑水肿', '急性肺水肿'],
    '甲亢': ['甲亢', '甲状腺功能亢进', 'Graves病'],
    '甲减': ['甲状腺功能减退', '甲减'],
    '抑郁': ['抑郁症', '抑郁', '难治性抑郁症'],
    '焦虑': ['焦虑症', '广泛性焦虑障碍', '社交焦虑障碍'],
    '癫痫': ['癫痫', '癫痫辅助治疗'],
    '骨折': ['骨折', '骨质疏松'],
};

function searchMedicine() {
    const keyword = elements.medicineSearch.value.trim().toLowerCase();
    if (!keyword) {
        renderMedicineCategories();
        return;
    }

    // 支持多关键词模糊搜索（空格分词，AND 逻辑）
    const keywords = keyword.split(/\s+/).filter(k => k.length > 0);

    // 展开同义词：对每个搜索词，生成同义词列表
    const expandedKeywordGroups = keywords.map(kw => {
        // 先检查是否有同义词映射
        for (const [alias, synonyms] of Object.entries(MEDICAL_SYNONYMS)) {
            if (kw.includes(alias) || alias.includes(kw)) {
                return [kw, ...synonyms];
            }
        }
        return [kw];
    });

    const results = medicineDatabase.filter(med => {
        if (!med) return false;
        // 每个关键词组都必须匹配至少一个同义词
        return expandedKeywordGroups.some(group => {
            return group.some(kw => {
                // 搜索适应症
                if (med.indications && med.indications.some(ind => ind.toLowerCase().includes(kw))) return true;
                // 搜索药品名
                if (med.name && med.name.toLowerCase().includes(kw)) return true;
                // 搜索规格
                if (med.specification && med.specification.toLowerCase().includes(kw)) return true;
                // 搜索厂商
                if (med.manufacturer && med.manufacturer.toLowerCase().includes(kw)) return true;
                // 搜索不良反应
                if (med.adverseReactions && med.adverseReactions.some(ar => ar.toLowerCase().includes(kw))) return true;
                return false;
            });
        });
    });

    renderMedicineList(results);
}

function savePrescription() {
    if (currentPrescription.length === 0) {
        alert('请先添加药品！');
        return;
    }
    
    const diagnosis = elements.diagnosisInput.value || '未填写诊断';
    const notes = elements.prescriptionNotes.value || '';
    const frequency = elements.dosageFrequency.value;
    const amount = elements.dosageAmount.value;
    const unit = elements.dosageUnit.value;
    const time = elements.dosageTime.value;
    const duration = elements.dosageDuration.value;
    
    let treatmentText = `【诊断】${diagnosis}\n\n【处方】\n`;
    currentPrescription.forEach(med => {
        treatmentText += `• ${med.name}${med.spec ? `(${med.spec})` : ''} ×${med.quantity} (¥${(med.price * med.quantity).toFixed(2)})\n`;
    });
    treatmentText += `\n【用法用量】每日${frequency}次，每次${amount}${unit}，${time}服用，疗程${duration}天。`;
    if (notes) {
        treatmentText += `\n【医嘱备注】${notes}`;
    }
    
    elements.mrDiagnosis.value = diagnosis;
    elements.mrTreatment.value = treatmentText;
    
    saveCurrentRecord();
    
    alert('处方已保存到病历！');
}

async function endConsultation() {
    if (!currentPatient) {
        alert('没有正在进行的诊疗！');
        return;
    }
    
    // 保存当前病历
    saveCurrentRecord();
    
    // 确认是否结束并评分
    if (!confirm('确定要结束本次诊疗吗？系统将对您的诊疗进行评分。')) {
        return;
    }
    
    // 获取诊断和费用信息
    const userDiagnosis = elements.mrDiagnosis.value || '';
    const examCost = currentExaminations.reduce((sum, e) => sum + (e.price || 50), 0);
    const medCost = currentPrescription.reduce((sum, m) => sum + (m.price || 0) * (m.quantity || 1), 0);
    
    // 统计问诊问题数（从聊天记录中计算医生发言数）
    const chatMessages = elements.chatMessages.querySelectorAll('.chat-message.doctor');
    const questionCount = chatMessages.length;
    
    try {
        // 显示评分中提示
        elements.chatMessages.innerHTML += `
            <div class="chat-message system">
                <div class="message-content" style="text-align: center; color: var(--primary-color);">
                    <div class="ai-generating">
                        <div class="spinner"></div>
                        <span>AI正在评分中，请稍候...</span>
                    </div>
                </div>
            </div>
        `;
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        
        // 调用评分API - 发送完整检查数据（含结果描述）
        const examDetails = currentExaminations.map(e => ({
            type: e.type,
            typeName: e.typeName,
            bodyPart: e.bodyPart,
            price: e.price || 50,
            resultDescription: (e.result && e.result.aiDescription) || (e.result && e.result.description) || ''
        }));
        const response = await fetch(`${API_BASE_URL}/patients/${currentPatient.id}/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userDiagnosis,
                examinationCosts: examCost,
                prescriptionCosts: medCost,
                questionCount,
                userMedicines: currentPrescription.map(m => m.name),
                userExaminations: currentExaminations.map(e => e.typeName || e.type),
                examinationDetails: examDetails
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                showDiagnosisResult(data.data);
                return;
            }
        }
        
        alert('评分失败，请稍后重试。');
        
    } catch (error) {
        console.error('评分错误:', error);
        alert('评分请求失败：' + error.message);
    }
    
    // 重置界面
    resetConsultationUI();
}

function showDiagnosisResult(result) {
    const gradeEmoji = {
        'S': '🏆',
        'A': '⭐',
        'B': '👍',
        'C': '📝',
        'D': '📚'
    };
    
    const emoji = gradeEmoji[result.grade] || '📋';
    const aiTag = result.aiScored ? '<span class="ai-status" style="margin-left: 8px;"><span class="ai-status-dot"></span>AI评分</span>' : '';
    
    let breakdownHtml = '';
    if (result.scoreBreakdown) {
        breakdownHtml = `
            <div class="score-breakdown">
                <h4>📊 分项评分</h4>
                <div class="breakdown-grid">
                    ${result.scoreBreakdown.diagnosis ? `
                        <div class="breakdown-item">
                            <div class="breakdown-label">诊断正确性</div>
                            <div class="breakdown-score">${result.scoreBreakdown.diagnosis.score || 0}/45</div>
                            <div class="breakdown-comment">${result.scoreBreakdown.diagnosis.comment || ''}</div>
                        </div>
                    ` : ''}
                    ${result.scoreBreakdown.examination ? `
                        <div class="breakdown-item">
                            <div class="breakdown-label">检查合理性</div>
                            <div class="breakdown-score">${result.scoreBreakdown.examination.score || 0}/20</div>
                            <div class="breakdown-comment">${result.scoreBreakdown.examination.comment || ''}</div>
                        </div>
                    ` : ''}
                    ${result.scoreBreakdown.medicine ? `
                        <div class="breakdown-item">
                            <div class="breakdown-label">用药合理性</div>
                            <div class="breakdown-score">${result.scoreBreakdown.medicine.score || 0}/20</div>
                            <div class="breakdown-comment">${result.scoreBreakdown.medicine.comment || ''}</div>
                        </div>
                    ` : ''}
                    ${result.scoreBreakdown.consultation ? `
                        <div class="breakdown-item">
                            <div class="breakdown-label">问诊技巧</div>
                            <div class="breakdown-score">${result.scoreBreakdown.consultation.score || 0}/15</div>
                            <div class="breakdown-comment">${result.scoreBreakdown.consultation.comment || ''}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    elements.chatMessages.innerHTML += `
        <div class="chat-message system">
            <div class="message-content">
                <div class="diagnosis-result">
                    <div class="result-header">
                        <span class="result-emoji">${emoji}</span>
                        <div class="result-grade" style="color: ${result.gradeColor || '#333'}">
                            ${result.grade || '?'} 级
                        </div>
                        <div class="result-score">${result.score || 0} 分</div>
                        ${aiTag}
                    </div>
                    
                    <div class="result-detail">
                        <div class="detail-row">
                            <span class="detail-label">正确诊断：</span>
                            <span class="detail-value">${result.correctDiagnosis || '未知'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">您的诊断：</span>
                            <span class="detail-value ${result.diagnosisMatch ? 'match' : 'mismatch'}">${result.userDiagnosis || '未填写'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">诊断匹配：</span>
                            <span class="detail-value">${result.diagnosisMatch ? '✅ 匹配' : '❌ 不匹配'} (${result.matchType || 'unknown'})</span>
                        </div>
                    </div>
                    
                    ${breakdownHtml}
                    
                    ${result.costs ? `
                        <div class="cost-summary">
                            <h4>💰 费用统计</h4>
                            <div class="cost-row">
                                <span>检查费用：</span>
                                <span>¥${result.costs.examination.toFixed(2)}</span>
                            </div>
                            <div class="cost-row">
                                <span>药品费用：</span>
                                <span>¥${result.costs.medicine.toFixed(2)}</span>
                            </div>
                            <div class="cost-row total">
                                <span>总计：</span>
                                <span>¥${result.costs.total.toFixed(2)}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${result.overallComment ? `
                        <div class="overall-comment">
                            <h4>💬 总体评价</h4>
                            <p>${result.overallComment}</p>
                        </div>
                    ` : ''}
                    
                    <div class="result-actions">
                        <button class="btn btn-primary" onclick="resetConsultationUI()">开始新诊疗</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Save score to current medical record
    if (currentRecordId) {
        const recordIndex = medicalRecords.findIndex(r => r.id === currentRecordId);
        if (recordIndex !== -1) {
            const record = medicalRecords[recordIndex];
            record.score = result.score || 0;
            record.grade = result.grade || '?';
            record.gradeColor = result.gradeColor || '#333';
            record.scoreBreakdown = result.scoreBreakdown || null;
            record.correctDiagnosis = result.correctDiagnosis || '';
            record.aiScored = result.aiScored || false;
            record.overallComment = result.overallComment || '';
            record.costs = result.costs || null;
            record.matchType = result.matchType || '';
            record.diagnosisMatch = result.diagnosisMatch || false;
            saveLocalRecords();
            renderRecordList();
        }
    }
}

function resetConsultationUI() {
    elements.chatMessages.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon-wrapper">
                <span class="welcome-icon">🩺</span>
            </div>
            <h2>欢迎使用杏林问诊</h2>
            <p class="welcome-desc">沉浸式医疗问诊模拟平台</p>
            <p>点击右上角"新患者"按钮开始模拟问诊</p>
            <div class="welcome-features">
                <div class="feature-badge"><span>💬</span> 智能问诊</div>
                <div class="feature-badge"><span>🔬</span> 检查分析</div>
                <div class="feature-badge"><span>💊</span> 精准开药</div>
                <div class="feature-badge"><span>📊</span> AI评分</div>
            </div>
        </div>
    `;
    
    currentPatient = null;
    renderPatientInfo();
    
    currentPrescription = [];
    currentExaminations = [];
    renderPrescriptionItems();
    renderExaminationList();
    
    elements.diagnosisInput.value = '';
    elements.prescriptionNotes.value = '';
    elements.dosageFrequency.value = '3';
    elements.dosageAmount.value = '1';
    elements.dosageUnit.value = '片';
    elements.dosageTime.value = '饭前';
    elements.dosageDuration.value = '7';
    
    disableControls();
    
    elements.endConsultationBtn.disabled = true;
}

function disableControls() {
    if (elements.chatInput) elements.chatInput.disabled = true;
    if (elements.sendBtn) elements.sendBtn.disabled = true;
    if (elements.addExamBtn) elements.addExamBtn.disabled = true;
    if (elements.savePrescriptionBtn) elements.savePrescriptionBtn.disabled = true;
}

function resetGame() {
    if (confirm('确定要重置吗？')) {
        location.reload();
    }
}

// 初始化
init();

// 带超时的fetch函数
async function fetchWithTimeout(url, options = {}, timeout = 180000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        throw error;
    }
}
