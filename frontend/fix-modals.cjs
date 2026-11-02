const fs = require('fs');
const path = require('path');

// Add className="cred-modal-shell" to all <Modal instances in Cashbook.jsx and CashbookLabour.jsx
// that don't already have it

function addCredModalShell(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Match <Modal followed by attributes but NOT already containing cred-modal-shell
  // Strategy: find <Modal blocks and add className="cred-modal-shell" if not present
  // We look for <Modal\n (or <Modal ) that does NOT already have className="cred-modal-shell"
  
  let changeCount = 0;
  
  // Replace <Modal\r\n or <Modal\n followed by props, adding className before the first prop
  // The pattern: <Modal followed by optional whitespace then newline then whitespace then a prop
  // We want to inject className="cred-modal-shell" as the first prop after <Modal
  
  // Approach: find all <Modal occurrences and check if they have cred-modal-shell nearby
  const modalRegex = /<Modal(\r?\n\s+|\s+)(?!className="cred-modal-shell")/g;
  
  content = content.replace(modalRegex, (match, ws) => {
    // Check if cred-modal-shell already appears in this match
    changeCount++;
    return `<Modal${ws}className="cred-modal-shell"\n        `;
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}: ${changeCount} Modal(s) updated`);
  } else {
    console.log(`No changes needed in ${path.basename(filePath)}`);
  }
}

const files = [
  'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\pages\\Cashbook.jsx',
  'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\components\\cashbook\\CashbookLabour.jsx',
  'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\components\\cashbook\\CashbookJobOrders.jsx',
];

files.forEach(addCredModalShell);
console.log('Done!');
