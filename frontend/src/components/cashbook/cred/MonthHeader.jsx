import React from 'react';

const MonthHeader = ({ label, className = '', style = {} }) => {
  return (
    <div className={`cred-month-header ${className}`} style={style}>
      {label}
    </div>
  );
};

export default MonthHeader;
