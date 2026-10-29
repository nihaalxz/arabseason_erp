import React from 'react';

/**
 * CRED Money component:
 * Displays currency + integer part (weight 700) + decimal part (weight 400 & lighter color).
 * Formats integer with thousands separators, keeps exact 2 decimals.
 * Never uses parseFloat for mathematical mutations.
 * Formats negative values as "-SAR 275,484.80" (never "SAR-275,484.80").
 */
export const formatMoneyParts = (value, currency = 'SAR') => {
  if (value === null || value === undefined || value === '' || value === '—') {
    return { currency, sign: '', intPart: '0', decPart: '00', isMissing: value === '—' };
  }

  const str = String(value).trim().replace(/^[^\d.-]+/, '').replace(/,/g, '');
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const [rawInt = '0', rawDec = '00'] = cleanStr.split('.');
  
  // Format integer part with thousands separators
  const formattedInt = (rawInt || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Ensure 2 decimals
  const formattedDec = (rawDec + '00').slice(0, 2);

  return {
    currency,
    sign: isNegative ? '-' : '',
    intPart: formattedInt,
    decPart: formattedDec,
    isMissing: false
  };
};

const Money = ({ value, amount, currency = 'SAR', className = '', style = {} }) => {
  const effectiveValue = value !== undefined ? value : amount;
  if (effectiveValue === '—' || effectiveValue === '-' || effectiveValue === 'N/A') {
    return <span className={`cred-money-wrap cred-tnum ${className}`} style={{ color: 'var(--text-muted, #8C8C8C)', ...style }}>—</span>;
  }

  const { sign, intPart, decPart } = formatMoneyParts(effectiveValue, currency);

  return (
    <span className={`cred-money-wrap cred-tnum ${className}`} style={style}>
      {sign && <span className="cred-money-sign">{sign}</span>}
      <span className="cred-money-curr">{currency}&nbsp;</span>
      <span className="cred-money-int">{intPart}</span>
      <span className="cred-money-dec">.{decPart}</span>
    </span>
  );
};

export default Money;
