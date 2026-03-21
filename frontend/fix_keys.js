const fs = require('fs');
const filePath = 'app/content-creation.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace any occurrence of key=`something` with key={`something`}
content = content.replace(/key=`([^`]+)`/g, 'key={`$1`}');

fs.writeFileSync(filePath, content);
console.log('Successfully wrapped naked keys with curly braces.');
