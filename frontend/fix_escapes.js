const fs = require('fs');
const filePath = 'app/content-creation.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync(filePath, content);
console.log('Fixed escape paths in content-creation.tsx');
