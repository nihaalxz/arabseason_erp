
with open('frontend/src/components/common/Modal.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = """<<<<<<< HEAD
      className={`modal-overlay ${overlayClassName}`.trim()} 
=======
      className="modal-overlay" 
      data-theme-scope="soft-fintech"
>>>>>>> origin/frontend-cashbook"""

replacement = """      className={`modal-overlay ${overlayClassName}`.trim()} 
      data-theme-scope="soft-fintech\""""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('frontend/src/components/common/Modal.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Resolved Modal.jsx conflict successfully!")
else:
    print("Conflict target not matched.")
