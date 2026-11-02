const fs = require('fs');
const filePath = 'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\pages\\Cashbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

function replace(from, to) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
    changes++;
    console.log(`✅ Replaced: ${from.substring(0,60).trim()}...`);
  } else {
    console.log(`❌ Not found: ${from.substring(0,60).trim()}...`);
  }
}

// 1. Title icon box: blue bg → neutral
replace(
  `background: isDarkMode ? '#1e293b' : '#eff6ff',\r\n              display: 'flex',\r\n              alignItems: 'center',\r\n              justifyContent: 'center',\r\n              color: '#2563eb'`,
  `background: isDarkMode ? '#1e2025' : '#f1f5f9',\r\n              display: 'flex',\r\n              alignItems: 'center',\r\n              justifyContent: 'center',\r\n              color: isDarkMode ? '#a1a7b2' : '#475569'`
);

// 2. FROM ACCOUNT label: blue → muted
replace(
  `color: isDarkMode ? '#93c5fd' : '#2563eb',\r\n                        margin: 0,\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        gap: '0.35rem',\r\n                        textTransform: 'uppercase',\r\n                        letterSpacing: '0.04em'`,
  `color: isDarkMode ? '#a1a7b2' : '#64748b',\r\n                        margin: 0,\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        gap: '0.35rem',\r\n                        textTransform: 'uppercase',\r\n                        letterSpacing: '0.04em'`
);

// 3. Available badge: blue pill → neutral pill
replace(
  `background: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',\r\n                        color: isDarkMode ? '#93c5fd' : '#1d4ed8',\r\n                        border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #bfdbfe',`,
  `background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',\r\n                        color: isDarkMode ? '#a1a7b2' : '#475569',\r\n                        border: isDarkMode ? '1px solid #2e3138' : '1px solid #e2e8f0',`
);

// 4. TO ACCOUNT label: green → muted
replace(
  `color: isDarkMode ? '#86efac' : '#16a34a',\r\n                        margin: 0,\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        gap: '0.35rem',\r\n                        textTransform: 'uppercase',\r\n                        letterSpacing: '0.04em'`,
  `color: isDarkMode ? '#a1a7b2' : '#64748b',\r\n                        margin: 0,\r\n                        display: 'flex',\r\n                        alignItems: 'center',\r\n                        gap: '0.35rem',\r\n                        textTransform: 'uppercase',\r\n                        letterSpacing: '0.04em'`
);

// 5. Balance badge: green pill → neutral pill
replace(
  `background: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',\r\n                        color: isDarkMode ? '#86efac' : '#15803d',\r\n                        border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0',`,
  `background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9',\r\n                        color: isDarkMode ? '#a1a7b2' : '#475569',\r\n                        border: isDarkMode ? '1px solid #2e3138' : '1px solid #e2e8f0',`
);

// 6. Swap button hover: blue → neutral
replace(
  `e.currentTarget.style.color = '#2563eb'`,
  `e.currentTarget.style.color = isDarkMode ? '#ffffff' : '#111111'`
);

// 7. Transfer Amount input: blue text → default
replace(
  `style={{ width: '100%', fontWeight: '800', fontSize: '1rem', color: '#2563eb' }}`,
  `style={{ width: '100%', fontWeight: '800', fontSize: '1rem' }}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! ${changes} replacements made.`);

