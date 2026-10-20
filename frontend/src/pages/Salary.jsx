import React from 'react'
import SalaryReports from '../components/reports/SalaryReports'

const Salary = () => {
  return (
    <div className="salary-page academy-style erp-page-container" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <SalaryReports />
    </div>
  )
}

export default Salary
