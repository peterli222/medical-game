require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const dataStore = require('./services/DataStore');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 路由
const patientRoutes = require('./routes/patients');
const examinationRoutes = require('./routes/examinations');
const medicineRoutes = require('./routes/medicines');
const medicalRecordRoutes = require('./routes/medicalRecords');
const surgeryRoutes = require('./routes/surgeries');
const admissionRoutes = require('./routes/admissions');
const consultationRoutes = require('./routes/consultations');
const settingsRoutes = require('./routes/settings');

app.use('/api/patients', patientRoutes);
app.use('/api/examinations', examinationRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/surgeries', surgeryRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/settings', settingsRoutes);

// 获取统计数据
app.get('/api/statistics', (req, res) => {
  res.json({ success: true, data: dataStore.getStatistics() });
});

// 重置游戏数据
app.post('/api/reset', (req, res) => {
  dataStore.clearAll();
  res.json({ success: true, message: '游戏数据已重置' });
});

// 根路由 - 返回前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║     🏥 医疗问诊模拟游戏服务器已启动                    ║
║                                                        ║
║     访问地址: http://localhost:${PORT}                    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
