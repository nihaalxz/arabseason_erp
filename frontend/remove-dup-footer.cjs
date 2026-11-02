const fs = require('fs');
const filePath = 'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\pages\\Cashbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Remove the duplicate inline footer block inside the entry form body
// It starts at the div with className="col-span-2 modal-form-footer" and ends before </form>
// Strategy: remove the block between the marker comment and </form> close

// Find and remove from the opening of "col-span-2 modal-form-footer" div to just before </form>
const startMarker = `\r\n            <div className="col-span-2 modal-form-footer"`;
const endMarker = `\r\n          </div>\r\n        </form>\r\n      </Modal>`;

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('Start marker not found! Trying LF variant...');
  const startMarkerLF = `\n            <div className="col-span-2 modal-form-footer"`;
  const sidxLF = content.indexOf(startMarkerLF);
  console.log('LF variant index:', sidxLF);
  process.exit(1);
}

const endIdx = content.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  console.log('End marker not found!');
  process.exit(1);
}

console.log(`Found block: startIdx=${startIdx}, endIdx=${endIdx}`);
console.log('Block to remove:');
console.log(JSON.stringify(content.substring(startIdx, endIdx + endMarker.length).substring(0, 200)));

// Remove the block and replace with just the closing tags
const before = content.substring(0, startIdx);
const after = content.substring(endIdx + endMarker.length);

const replacement = `\r\n          </div>\r\n        </form>\r\n      </Modal>`;
const newContent = before + replacement + after;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Done! Duplicate footer block removed.');

