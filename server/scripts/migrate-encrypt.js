#!/usr/bin/env node

// 迁移脚本：加密 ai-settings.json 中的 apiKey
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SETTINGS_FILE = path.join(__dirname, '../data/ai-settings.json');
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.MEDICAL_APP_SECRET || 'medical-game-2024-secure-key').digest();
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

try {
  if (!fs.existsSync(SETTINGS_FILE)) {
    console.log('设置文件不存在，无需迁移');
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  
  // 检查是否已经加密（包含冒号格式）
  if (data.apiKey && data.apiKey.includes(':')) {
    console.log('API key 已加密，无需迁移');
    process.exit(0);
  }
  
  // 加密 apiKey
  if (data.apiKey) {
    const originalKey = data.apiKey;
    data.apiKey = encrypt(data.apiKey);
    
    // 备份原文件
    const backupFile = SETTINGS_FILE + '.backup.' + Date.now();
    fs.copyFileSync(SETTINGS_FILE, backupFile);
    console.log(`已备份原文件到: ${backupFile}`);
    
    // 写入加密后的文件
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
    console.log('API key 已加密成功！');
    console.log(`原 key 长度: ${originalKey.length}, 加密后长度: ${data.apiKey.length}`);
  }
} catch (e) {
  console.error('迁移失败:', e.message);
  process.exit(1);
}
