const fs = require('fs');
let code = fs.readFileSync('front-end/src/components/SettingsPage.tsx', 'utf8');

// 1. Remove state
code = code.replace(/  \/\/ MinIO \/ S3 Settings[\s\S]*?const \[minioStatus, setMinioStatus\] = useState[^;]+;/g, '');

// 2. Remove minio from activeTab
code = code.replace(/\| 'minio'/g, '');

// 3. Remove handleTestMinio
code = code.replace(/  const handleTestMinio = async \(\) => {[\s\S]*?  };\n/g, '');

// 4. Remove handleSaveMinioSettings
code = code.replace(/  const handleSaveMinioSettings = \(e: React.FormEvent\) => {[\s\S]*?  };\n/g, '');

// 5. Remove minio tab button
code = code.replace(/          <button\s+onClick=\{\(\) => \{ setActiveTab\('minio'\); setSuccessMsg\(null\); setErrorMsg\(null\); \}\}[\s\S]*?          <\/button>/g, '');

// 6. Remove minio form
code = code.replace(/        \{\/\* TAB: MINIO STORAGE \*\/\}\s*\{activeTab === 'minio' && \([\s\S]*?        \)\}/g, '');

fs.writeFileSync('front-end/src/components/SettingsPage.tsx', code);
