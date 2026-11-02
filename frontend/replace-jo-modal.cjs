const fs = require('fs');
const filePath = 'd:\\freelanceprojects\\ERP-Arab-Season-main\\ERP-Arab-Season-main\\frontend\\src\\components\\cashbook\\CashbookJobOrders.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// ── 1. Add import for JobOrderModal after the existing Modal import ──
const modalImportLine = "import Modal from '../common/Modal'";
if (!content.includes("import JobOrderModal from '../jobs/JobOrderModal'")) {
  content = content.replace(
    modalImportLine,
    modalImportLine + "\nimport JobOrderModal from '../jobs/JobOrderModal'"
  );
  console.log('✅ Added JobOrderModal import');
} else {
  console.log('ℹ️  JobOrderModal import already present');
}

// ── 2. Simplify handleOpenAddModal ──
// Replace the whole handleOpenAddModal body to just open the modal
const oldAddModal = `  const handleOpenAddModal = () => {
    let maxNum = 0
    ;(jobOrders || []).forEach(j => {
      const m = (j.order_id || '').match(/\\d+/)
      if (m) {
        const val = parseInt(m[0], 10)
        if (!isNaN(val) && val > maxNum) maxNum = val
      }
    })
    const nextSeq = maxNum + 1
    const defaultOrderId = \`JOB\${nextSeq.toString().padStart(4, '0')}\`

    let defaultStaff = ''
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      defaultStaff = \`\${u.first_name || ''} \${u.last_name || ''}\`.trim() || u.username || ''
    } catch {}

    setEditingJob(null)
    setFormData({
      order_id: defaultOrderId,
      title: '',
      customer: customers[0]?.id || '',
      vendor: '',
      status: 'Pending',
      total_amount: '',
      advance_amount: '',
      account_type: 'pca',
      selected_account_id: pettyCashAccounts[0]?.id || '',
      cashbook: cashbooks[0]?.id || '',
      project_name: '',
      created_by_staff: defaultStaff,
      assigned_to: '',
      description: '',
      attachment: '',
      attachment_name: '',
      attachment_type: ''
    })
    setModalError('')
    setIsModalOpen(true)
  }`;

const newAddModal = `  const handleOpenAddModal = () => {
    setEditingJob(null)
    setIsModalOpen(true)
  }`;

if (content.includes(oldAddModal.substring(0, 50))) {
  content = content.replace(oldAddModal, newAddModal);
  console.log('✅ Simplified handleOpenAddModal');
} else {
  console.log('⚠️  handleOpenAddModal pattern not found — trying CRLF');
  const crlf = oldAddModal.replace(/\n/g, '\r\n');
  if (content.includes(crlf.substring(0, 50))) {
    content = content.replace(crlf, newAddModal.replace(/\n/g, '\r\n'));
    console.log('✅ Simplified handleOpenAddModal (CRLF)');
  } else {
    console.log('❌ handleOpenAddModal not found');
  }
}

// ── 3. Simplify handleOpenEditModal ──
const oldEditModal = `  const handleOpenEditModal = (job) => {
    setEditingJob(job)
    setFormData({
      order_id: job.order_id || '',
      title: job.title || '',
      customer: job.customer || (job.customer_id) || '',
      vendor: job.vendor || job.vendor_id || '',
      status: job.status || 'In Progress',
      total_amount: job.total_amount != null ? String(job.total_amount) : '',
      advance_amount: job.advance_amount != null ? String(job.advance_amount) : (job.paid_amount != null ? String(job.paid_amount) : ''),
      account_type: 'pca',
      selected_account_id: pettyCashAccounts[0]?.id || '',
      cashbook: cashbooks[0]?.id || '',
      project_name: job.project_name || '',
      created_by_staff: job.created_by_staff || '',
      assigned_to: job.assigned_to || '',
      description: job.description || '',
      attachment: job.attachment || '',
      attachment_name: job.attachment_name || '',
      attachment_type: job.attachment_type || ''
    })
    setModalError('')
    setIsModalOpen(true)
  }`;

const newEditModal = `  const handleOpenEditModal = (job) => {
    setEditingJob(job)
    setIsModalOpen(true)
  }`;

if (content.includes(oldEditModal.substring(0, 50))) {
  content = content.replace(oldEditModal, newEditModal);
  console.log('✅ Simplified handleOpenEditModal');
} else {
  console.log('⚠️  handleOpenEditModal - trying CRLF');
  const crlf = oldEditModal.replace(/\n/g, '\r\n');
  if (content.includes(crlf.substring(0, 60))) {
    content = content.replace(crlf, newEditModal.replace(/\n/g, '\r\n'));
    console.log('✅ Simplified handleOpenEditModal (CRLF)');
  } else {
    console.log('❌ handleOpenEditModal not found, will leave as-is');
  }
}

// ── 4. Replace the portal-based job order modal with <JobOrderModal> ──
const portalStart = `      {/* ADD / EDIT JOB ORDER MODAL                                */}`;
const portalEnd = `      {/* RECEIVE CUSTOMER PAYMENT MODAL                            */}`;

const startIdx = content.indexOf(portalStart);
const endIdx = content.indexOf(portalEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx);

  const newModalJsx = `      {/* ADD / EDIT JOB ORDER MODAL — uses shared JobOrderModal component */}
      {/* ========================================================= */}
      <JobOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingJob={editingJob}
        existingJobs={jobOrders || []}
        onSuccess={(savedJob, isNew) => {
          if (isNew) {
            setJobOrders(prev => [savedJob, ...prev])
          } else {
            setJobOrders(prev => prev.map(j => j.id === savedJob.id ? { ...j, ...savedJob } : j))
          }
          fetchJobOrders()
          fetchJobSummary()
        }}
      />

      {/* ========================================================= */}
      {/* RECEIVE CUSTOMER PAYMENT MODAL                            */}`;

  content = before + newModalJsx + after.substring(portalEnd.length);
  console.log('✅ Replaced portal modal with <JobOrderModal>');
} else {
  console.log(`❌ Portal block not found. startIdx=${startIdx}, endIdx=${endIdx}`);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');

