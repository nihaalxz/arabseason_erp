/**
 * Number to Words converter for Currency (Saudi Riyal / Halalas default)
 * Converts numbers to formal English words:
 * e.g. 1500 -> "One Thousand Five Hundred Saudi Riyals Only"
 * e.g. 3500.50 -> "Three Thousand Five Hundred Saudi Riyals and Fifty Halalas Only"
 */

const UNITS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function convertGroup(val) {
  let str = '';
  if (val >= 100) {
    str += UNITS[Math.floor(val / 100)] + ' Hundred ';
    val %= 100;
  }
  if (val >= 20) {
    str += TENS[Math.floor(val / 10)] + ' ';
    val %= 10;
  }
  if (val > 0) {
    str += UNITS[val] + ' ';
  }
  return str.trim();
}

export function numberToWords(num, currency = 'Saudi Riyals', subCurrency = 'Halalas') {
  if (num === null || num === undefined || isNaN(num) || num === '') {
    return `Zero ${currency} Only`;
  }

  const n = Math.abs(Number(num));
  const integerPart = Math.floor(n);
  const decimalPart = Math.round((n - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return `Zero ${currency} Only`;
  }

  let words = '';
  let tempInt = integerPart;
  let scaleIdx = 0;

  if (tempInt === 0) {
    words = 'Zero';
  } else {
    while (tempInt > 0) {
      const group = tempInt % 1000;
      if (group !== 0) {
        const groupWords = convertGroup(group);
        const scaleWord = SCALES[scaleIdx] ? ' ' + SCALES[scaleIdx] : '';
        words = groupWords + scaleWord + (words ? ' ' + words : '');
      }
      tempInt = Math.floor(tempInt / 1000);
      scaleIdx++;
    }
  }

  let result = `${words.trim()} ${currency}`;
  if (decimalPart > 0) {
    const decWords = convertGroup(decimalPart);
    result += ` and ${decWords} ${subCurrency}`;
  }

  return `${result} Only`;
}

export default numberToWords;
