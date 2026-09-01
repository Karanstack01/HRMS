/**
 * StackDrove HRMS — Sheet_Payroll.gs
 * Data access layer for Monthly Payroll, LOP Deductions, and Payslip Generation.
 */

var DB = DB || {};

DB.Payroll = (function() {
  const COL = {
    ID: 1,
    EMP_ID: 2,
    MONTH: 3,
    YEAR: 4,
    BASIC: 5,
    HRA: 6,
    ALLOWANCES: 7,
    GROSS_PAY: 8,
    DEDUCTIONS: 9,
    NET_PAY: 10,
    PAYSLIP_URL: 11,
    STATUS: 12,
    PROCESSED_ON: 13,
    PROCESSED_BY: 14
  };

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Payroll');
    if (!s) {
      s = ss.insertSheet('Payroll');
      s.appendRow([
        'payrollId', 'empId', 'month', 'year', 'basic', 'hra', 'allowances', 'grossPay',
        'deductions', 'netPay', 'payslipUrl', 'status', 'processedOn', 'processedBy'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _rowToObj(r) {
    if (!r || !r[0]) return null;
    return {
      payrollId: String(r[0]),
      empId: String(r[1]),
      month: Number(r[2]),
      year: Number(r[3]),
      basic: Number(r[4]) || 0,
      hra: Number(r[5]) || 0,
      allowances: String(r[6] || '{}'),
      grossPay: Number(r[7]) || 0,
      deductions: String(r[8] || '{}'),
      netPay: Number(r[9]) || 0,
      payslipUrl: String(r[10] || ''),
      status: String(r[11] || 'Draft'),
      processedOn: r[12] ? formatDate_(r[12], 'yyyy-MM-dd') : '',
      processedBy: String(r[13] || '')
    };
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 14).getValues();
    return values.map(_rowToObj).filter(Boolean);
  }

  function getByEmp_(empId) {
    return getAll_().filter(p => p.empId.toLowerCase() === empId.toLowerCase() && p.status !== 'Draft');
  }

  function getByMonthAndYear_(month, year) {
    return getAll_().filter(p => p.month === Number(month) && p.year === Number(year));
  }

  function saveBatch_(records) {
    return withLock_(() => {
      const s = _sheet();
      records.forEach(r => {
        const id = r.payrollId || generateUuid_();
        s.appendRow([
          id,
          r.empId,
          r.month,
          r.year,
          r.basic,
          r.hra,
          JSON.stringify(r.allowances || {}),
          r.grossPay,
          JSON.stringify(r.deductions || {}),
          r.netPay,
          r.payslipUrl || '',
          r.status || 'Draft',
          new Date(),
          r.processedBy || ''
        ]);
      });
      return true;
    });
  }

  function updatePayslipUrl_(payrollId, url, status) {
    return withLock_(() => {
      const s = _sheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;
      const ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(payrollId)) {
          s.getRange(i + 2, COL.PAYSLIP_URL).setValue(url);
          s.getRange(i + 2, COL.STATUS).setValue(status || 'Paid');
          return true;
        }
      }
      return false;
    });
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    getByMonthAndYear_: getByMonthAndYear_,
    saveBatch_: saveBatch_,
    updatePayslipUrl_: updatePayslipUrl_
  };
})();
