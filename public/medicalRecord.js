// 医疗问诊模拟系统 - 病历管理模块（纯前端版本）
// 使用 localStorage 实现本地存储，支持离线使用和后续同步

class MedicalRecordManager {
    constructor() {
        this.STORAGE_KEY = 'medical_records';
        this.SYNC_QUEUE_KEY = 'medical_records_sync_queue';
        this.OFFLINE_MODE = true; // 纯前端模式，不依赖后端
        this.records = this.loadFromLocalStorage();
        this.syncQueue = this.loadSyncQueue();
        this.currentRecord = null;
        this.currentPatient = null;
        
        // 网络状态监听
        this.setupNetworkListener();
    }

    // 设置网络状态监听
    setupNetworkListener() {
        window.addEventListener('online', () => {
            console.log('网络已恢复，尝试同步数据...');
            this.showSyncStatus('网络已恢复，正在同步数据...', 'syncing');
            this.syncToBackend();
        });
        
        window.addEventListener('offline', () => {
            console.log('网络已断开，切换到离线模式');
            this.showSyncStatus('网络已断开，数据将保存在本地', 'offline');
        });
    }

    // 从 localStorage 加载病历数据
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('加载本地病历数据失败:', error);
            return [];
        }
    }

    // 保存病历数据到 localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.records));
            return true;
        } catch (error) {
            console.error('保存病历数据到本地失败:', error);
            this.showSyncStatus('本地存储失败，请检查浏览器存储空间', 'error');
            return false;
        }
    }

    // 加载同步队列
    loadSyncQueue() {
        try {
            const data = localStorage.getItem(this.SYNC_QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('加载同步队列失败:', error);
            return [];
        }
    }

    // 保存同步队列
    saveSyncQueue() {
        try {
            localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
            return true;
        } catch (error) {
            console.error('保存同步队列失败:', error);
            return false;
        }
    }

    // 创建新病历
    createNewRecord(patientInfo) {
        const now = new Date();
        const recordId = 'MR' + now.getTime();
        
        this.currentRecord = {
            id: recordId,
            patientId: patientInfo.id || recordId,
            patientName: patientInfo.name || '',
            patientGender: patientInfo.gender || '',
            patientAge: patientInfo.age || '',
            recordDate: now.toLocaleString('zh-CN'),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            
            // 病历内容
            chiefComplaint: '',
            presentIllness: '',
            pastHistory: '',
            epidemicHistory: '',
            
            // 体格检查
            temperature: '36.7',
            pulse: '88',
            respiration: '20',
            bloodPressure: '112/68',
            oxygen: '97',
            physicalExam: '',
            
            // 中医四诊
            tcmExam: '',
            
            // 辅助检查
            auxiliaryExams: '',
            
            // 诊断
            tcmDiagnosis: '',
            diagnosis: '',
            
            // 治疗
            treatment: '',
            prescription: '',
            doctorOrders: '',
            
            // 同步状态
            syncStatus: 'local', // local, syncing, synced, error
            syncError: null
        };
        
        this.currentPatient = patientInfo;
        return this.currentRecord;
    }

    // 更新病历字段
    updateField(field, value) {
        if (!this.currentRecord) return false;
        
        this.currentRecord[field] = value;
        this.currentRecord.updatedAt = new Date().toISOString();
        this.currentRecord.syncStatus = 'local';
        
        // 自动保存到本地
        this.autoSave();
        return true;
    }

    // 自动保存（防抖）
    autoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveCurrentRecord();
        }, 1000);
    }

    // 保存当前病历
    saveCurrentRecord() {
        if (!this.currentRecord) return false;
        
        // 验证必填字段
        const validation = this.validateRecord(this.currentRecord);
        if (!validation.valid) {
            this.showSyncStatus('保存失败: ' + validation.errors.join(', '), 'error');
            return false;
        }
        
        // 检查是否已存在
        const existingIndex = this.records.findIndex(r => r.id === this.currentRecord.id);
        
        if (existingIndex >= 0) {
            this.records[existingIndex] = { ...this.currentRecord };
        } else {
            this.records.push({ ...this.currentRecord });
        }
        
        // 添加到同步队列
        this.addToSyncQueue(this.currentRecord);
        
        // 保存到本地存储
        if (this.saveToLocalStorage()) {
            this.showSyncStatus('病历已保存到本地', 'local');
            
            // 如果在线，尝试同步到后端
            if (navigator.onLine && !this.OFFLINE_MODE) {
                this.syncToBackend();
            }
            
            return true;
        }
        
        return false;
    }

    // 验证病历数据
    validateRecord(record) {
        const errors = [];
        
        if (!record.patientName || record.patientName.trim() === '') {
            errors.push('患者姓名不能为空');
        }
        
        if (!record.patientGender || record.patientGender.trim() === '') {
            errors.push('患者性别不能为空');
        }
        
        if (!record.patientAge || record.patientAge.toString().trim() === '') {
            errors.push('患者年龄不能为空');
        }
        
        if (!record.chiefComplaint || record.chiefComplaint.trim() === '') {
            errors.push('主诉不能为空');
        }
        
        if (!record.diagnosis || record.diagnosis.trim() === '') {
            errors.push('西医诊断不能为空');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // 添加到同步队列
    addToSyncQueue(record) {
        const existingIndex = this.syncQueue.findIndex(r => r.id === record.id);
        
        if (existingIndex >= 0) {
            this.syncQueue[existingIndex] = { ...record, syncStatus: 'pending' };
        } else {
            this.syncQueue.push({ ...record, syncStatus: 'pending' });
        }
        
        this.saveSyncQueue();
    }

    // 同步到后端
    async syncToBackend() {
        if (this.OFFLINE_MODE || this.syncQueue.length === 0) return;
        
        this.showSyncStatus('正在同步到服务器...', 'syncing');
        
        const pendingRecords = this.syncQueue.filter(r => r.syncStatus === 'pending');
        
        for (const record of pendingRecords) {
            try {
                const response = await fetch('http://localhost:3000/api/medical-records', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(record)
                });
                
                if (response.ok) {
                    record.syncStatus = 'synced';
                    
                    // 更新本地记录状态
                    const localRecord = this.records.find(r => r.id === record.id);
                    if (localRecord) {
                        localRecord.syncStatus = 'synced';
                    }
                } else {
                    record.syncStatus = 'error';
                    record.syncError = '服务器返回错误';
                }
            } catch (error) {
                console.error('同步失败:', error);
                record.syncStatus = 'error';
                record.syncError = error.message;
            }
        }
        
        // 清理已同步的记录
        this.syncQueue = this.syncQueue.filter(r => r.syncStatus !== 'synced');
        this.saveSyncQueue();
        this.saveToLocalStorage();
        
        const syncedCount = pendingRecords.filter(r => r.syncStatus === 'synced').length;
        const errorCount = pendingRecords.filter(r => r.syncStatus === 'error').length;
        
        if (errorCount > 0) {
            this.showSyncStatus(`同步完成: ${syncedCount}条成功, ${errorCount}条失败`, 'partial');
        } else if (syncedCount > 0) {
            this.showSyncStatus(`成功同步 ${syncedCount} 条病历到服务器`, 'synced');
        }
    }

    // 获取所有病历
    getAllRecords() {
        return this.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 获取单个病历
    getRecord(id) {
        return this.records.find(r => r.id === id);
    }

    // 加载病历到表单
    loadRecordToForm(recordId) {
        const record = this.getRecord(recordId);
        if (record) {
            this.currentRecord = { ...record };
            this.populateForm(this.currentRecord);
            return true;
        }
        return false;
    }

    // 填充表单
    populateForm(record) {
        const fields = [
            'recordDate', 'mrPatientName', 'mrPatientGender', 'mrPatientAge',
            'mrChiefComplaint', 'mrPresentIllness', 'mrPastHistory', 'mrEpidemicHistory',
            'mrPhysicalExam', 'mrTCMExam', 'mrAuxiliaryExams',
            'mrTCMDiagnosis', 'mrDiagnosis', 'mrTreatment', 'mrPrescription', 'mrDoctorOrders'
        ];
        
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                if (field === 'mrTemperature') element.textContent = record.temperature;
                else if (field === 'mrPulse') element.textContent = record.pulse;
                else if (field === 'mrRespiration') element.textContent = record.respiration;
                else if (field === 'mrBloodPressure') element.textContent = record.bloodPressure;
                else if (field === 'mrOxygen') element.textContent = record.oxygen;
                else element.textContent = record[field.replace('mr', '').toLowerCase()] || '';
            }
        });
        
        // 更新同步状态显示
        this.updateSyncStatusUI(record.syncStatus);
    }

    // 从表单收集数据
    collectFormData() {
        if (!this.currentRecord) return null;
        
        const data = { ...this.currentRecord };
        
        const fields = {
            'mrPatientName': 'patientName',
            'mrPatientGender': 'patientGender',
            'mrPatientAge': 'patientAge',
            'mrChiefComplaint': 'chiefComplaint',
            'mrPresentIllness': 'presentIllness',
            'mrPastHistory': 'pastHistory',
            'mrEpidemicHistory': 'epidemicHistory',
            'mrPhysicalExam': 'physicalExam',
            'mrTCMExam': 'tcmExam',
            'mrAuxiliaryExams': 'auxiliaryExams',
            'mrTCMDiagnosis': 'tcmDiagnosis',
            'mrDiagnosis': 'diagnosis',
            'mrTreatment': 'treatment',
            'mrPrescription': 'prescription',
            'mrDoctorOrders': 'doctorOrders'
        };
        
        for (const [elementId, fieldName] of Object.entries(fields)) {
            const element = document.getElementById(elementId);
            if (element) {
                data[fieldName] = element.textContent || element.value || '';
            }
        }
        
        // 体格检查数据
        const tempEl = document.getElementById('mrTemperature');
        const pulseEl = document.getElementById('mrPulse');
        const respEl = document.getElementById('mrRespiration');
        const bpEl = document.getElementById('mrBloodPressure');
        const oxyEl = document.getElementById('mrOxygen');
        
        if (tempEl) data.temperature = tempEl.textContent;
        if (pulseEl) data.pulse = pulseEl.textContent;
        if (respEl) data.respiration = respEl.textContent;
        if (bpEl) data.bloodPressure = bpEl.textContent;
        if (oxyEl) data.oxygen = oxyEl.textContent;
        
        return data;
    }

    // 显示同步状态
    showSyncStatus(message, status) {
        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'sync-status ' + status;
            statusEl.style.display = 'block';
            
            // 3秒后隐藏成功消息
            if (status === 'synced' || status === 'local') {
                setTimeout(() => {
                    statusEl.style.display = 'none';
                }, 3000);
            }
        }
        
        console.log(`[同步状态] ${status}: ${message}`);
    }

    // 更新同步状态UI
    updateSyncStatusUI(status) {
        const indicators = {
            'local': { text: '仅本地保存', color: '#f59e0b' },
            'syncing': { text: '同步中...', color: '#3b82f6' },
            'synced': { text: '已同步', color: '#10b981' },
            'error': { text: '同步失败', color: '#ef4444' },
            'offline': { text: '离线模式', color: '#6b7280' }
        };
        
        const indicator = indicators[status] || indicators['local'];
        
        const statusEl = document.getElementById('syncStatusIndicator');
        if (statusEl) {
            statusEl.textContent = indicator.text;
            statusEl.style.color = indicator.color;
        }
    }

    // 生成病历列表HTML
    generateRecordListHTML() {
        if (this.records.length === 0) {
            return `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>暂无病历记录</p>
                    <p class="empty-hint">点击"新患者"开始创建病历</p>
                </div>
            `;
        }
        
        return this.records.map(record => {
            const statusIcons = {
                'local': '💾',
                'synced': '☁️',
                'error': '⚠️',
                'syncing': '🔄'
            };
            
            return `
                <div class="record-list-item" data-record-id="${record.id}">
                    <div class="record-info">
                        <div class="record-patient">${record.patientName} ${record.patientGender} ${record.patientAge}岁</div>
                        <div class="record-date">${record.recordDate}</div>
                        <div class="record-diagnosis">${record.diagnosis || '暂无诊断'}</div>
                    </div>
                    <div class="record-status">
                        <span class="status-icon" title="${record.syncStatus}">${statusIcons[record.syncStatus] || '💾'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 删除病历
    deleteRecord(recordId) {
        const index = this.records.findIndex(r => r.id === recordId);
        if (index >= 0) {
            this.records.splice(index, 1);
            this.saveToLocalStorage();
            
            // 从同步队列中移除
            this.syncQueue = this.syncQueue.filter(r => r.id !== recordId);
            this.saveSyncQueue();
            
            return true;
        }
        return false;
    }

    // 清空所有数据（谨慎使用）
    clearAllData() {
        if (confirm('确定要清空所有本地病历数据吗？此操作不可恢复！')) {
            this.records = [];
            this.syncQueue = [];
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.SYNC_QUEUE_KEY);
            this.currentRecord = null;
            return true;
        }
        return false;
    }

    // 导出病历数据
    exportData() {
        const dataStr = JSON.stringify(this.records, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `medical_records_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // 导入病历数据
    importData(jsonData) {
        try {
            const importedRecords = JSON.parse(jsonData);
            if (Array.isArray(importedRecords)) {
                this.records = [...this.records, ...importedRecords];
                this.saveToLocalStorage();
                return { success: true, count: importedRecords.length };
            }
            return { success: false, error: '数据格式不正确' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// 创建全局实例
const medicalRecordManager = new MedicalRecordManager();

// 初始化病历界面
function initMedicalRecordUI() {
    // 添加同步状态指示器到工具栏
    const toolbar = document.querySelector('.record-toolbar');
    if (toolbar) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'sync-status-container';
        statusDiv.innerHTML = `
            <span id="syncStatusIndicator" class="sync-indicator">💾 仅本地保存</span>
            <span id="syncStatus" class="sync-message" style="display: none;"></span>
        `;
        toolbar.appendChild(statusDiv);
    }

    // 添加病历列表侧边栏
    const container = document.querySelector('.medical-record-container');
    if (container) {
        const sidebar = document.createElement('div');
        sidebar.className = 'record-sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <h3>病历列表</h3>
                <span class="record-count">${medicalRecordManager.records.length}条</span>
            </div>
            <div id="recordList" class="record-list">
                ${medicalRecordManager.generateRecordListHTML()}
            </div>
            <div class="sidebar-actions">
                <button id="exportRecordsBtn" class="btn btn-secondary btn-sm">📥 导出</button>
                <button id="importRecordsBtn" class="btn btn-secondary btn-sm">📤 导入</button>
                <button id="clearAllBtn" class="btn btn-danger btn-sm">🗑️ 清空</button>
            </div>
        `;
        container.insertBefore(sidebar, container.firstChild);

        // 绑定病历列表点击事件
        document.getElementById('recordList').addEventListener('click', (e) => {
            const item = e.target.closest('.record-list-item');
            if (item) {
                const recordId = item.dataset.recordId;
                if (medicalRecordManager.loadRecordToForm(recordId)) {
                    // 高亮选中的病历
                    document.querySelectorAll('.record-list-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            }
        });

        // 绑定导出按钮
        document.getElementById('exportRecordsBtn').addEventListener('click', () => {
            medicalRecordManager.exportData();
        });

        // 绑定导入按钮
        document.getElementById('importRecordsBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const result = medicalRecordManager.importData(event.target.result);
                        if (result.success) {
                            alert(`成功导入 ${result.count} 条病历`);
                            updateRecordList();
                        } else {
                            alert('导入失败: ' + result.error);
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        });

        // 绑定清空按钮
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            if (medicalRecordManager.clearAllData()) {
                updateRecordList();
                alert('所有病历数据已清空');
            }
        });
    }

    // 监听表单字段变化，自动保存
    const editableFields = document.querySelectorAll('.record-content[contenteditable="true"]');
    editableFields.forEach(field => {
        field.addEventListener('blur', () => {
            const fieldName = field.id.replace('mr', '').toLowerCase();
            medicalRecordManager.updateField(fieldName, field.textContent);
        });
    });

    // 监听生命体征字段
    const vitalFields = ['mrTemperature', 'mrPulse', 'mrRespiration', 'mrBloodPressure', 'mrOxygen'];
    vitalFields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('blur', () => {
                const fieldName = id.replace('mr', '').toLowerCase();
                medicalRecordManager.updateField(fieldName, field.textContent);
            });
        }
    });
}

// 更新病历列表显示
function updateRecordList() {
    const listEl = document.getElementById('recordList');
    if (listEl) {
        listEl.innerHTML = medicalRecordManager.generateRecordListHTML();
    }
    
    const countEl = document.querySelector('.record-count');
    if (countEl) {
        countEl.textContent = medicalRecordManager.records.length + '条';
    }
}

// 重写创建新患者函数，集成病历管理
function createNewPatientWithRecord() {
    // 生成随机患者信息
    const names = ['张伟', '李娜', '王芳', '刘洋', '陈静', '杨帆', '赵敏', '黄磊'];
    const genders = ['男', '女'];
    
    const patientInfo = {
        id: 'P' + Date.now(),
        name: names[Math.floor(Math.random() * names.length)],
        gender: genders[Math.floor(Math.random() * genders.length)],
        age: Math.floor(Math.random() * 50) + 20
    };
    
    // 创建新病历
    medicalRecordManager.createNewRecord(patientInfo);
    medicalRecordManager.populateForm(medicalRecordManager.currentRecord);
    
    // 更新病历列表
    updateRecordList();
    
    return patientInfo;
}

// 重写保存病历函数
function saveMedicalRecordWithValidation() {
    const formData = medicalRecordManager.collectFormData();
    if (!formData) {
        alert('请先创建患者');
        return;
    }
    
    // 更新当前病历数据
    Object.assign(medicalRecordManager.currentRecord, formData);
    
    // 保存
    if (medicalRecordManager.saveCurrentRecord()) {
        updateRecordList();
        
        // 高亮新保存的病历
        setTimeout(() => {
            const items = document.querySelectorAll('.record-list-item');
            items.forEach(item => {
                if (item.dataset.recordId === medicalRecordManager.currentRecord.id) {
                    item.classList.add('active');
                }
            });
        }, 100);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保主应用已加载
    setTimeout(() => {
        initMedicalRecordUI();
        
        // 如果有当前患者，自动创建病历
        if (typeof currentPatient !== 'undefined' && currentPatient) {
            medicalRecordManager.createNewRecord(currentPatient);
            medicalRecordManager.populateForm(medicalRecordManager.currentRecord);
        }
    }, 500);
});

// 暴露全局函数供主应用调用
window.medicalRecordManager = medicalRecordManager;
window.createNewPatientWithRecord = createNewPatientWithRecord;
window.saveMedicalRecordWithValidation = saveMedicalRecordWithValidation;
window.updateRecordList = updateRecordList;