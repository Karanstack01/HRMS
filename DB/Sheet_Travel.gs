/**
 * StackDrove HRMS — Sheet_Travel.gs
 * Data access layer for Travel Pre-approvals and Reimbursement Expense claims.
 */

var DB = DB || {};

DB.Travel = (function() {
  function _reqSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('TravelExpense');
    if (!s) {
      s = ss.insertSheet('TravelExpense');
      s.appendRow(['requestId', 'empId', 'type', 'purpose', 'fromDate', 'toDate', 'fromCity', 'toCity', 'estimatedCost', 'advanceRequested', 'status', 'approverEmpId', 'actionedOn']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _itemSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('ExpenseItems');
    if (!s) {
      s = ss.insertSheet('ExpenseItems');
      s.appendRow(['itemId', 'requestId', 'category', 'date', 'amount', 'billUrl', 'remarks']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 13).getValues();
    return values.map(r => ({
      requestId: String(r[0]),
      empId: String(r[1]),
      type: String(r[2]),
      purpose: String(r[3]),
      fromDate: r[4] ? formatDate_(r[4], 'yyyy-MM-dd') : '',
      toDate: r[5] ? formatDate_(r[5], 'yyyy-MM-dd') : '',
      fromCity: String(r[6] || ''),
      toCity: String(r[7] || ''),
      estimatedCost: Number(r[8]) || 0,
      advanceRequested: Number(r[9]) || 0,
      status: String(r[10] || 'Pending'),
      approverEmpId: String(r[11] || ''),
      actionedOn: r[12] ? formatDate_(r[12], 'yyyy-MM-dd') : ''
    })).reverse();
  }

  function getByEmp_(empId) {
    return getAll_().filter(t => t.empId.toLowerCase() === empId.toLowerCase());
  }

  function getById_(requestId) {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const values = s.getRange(2, 1, lastRow - 1, 13).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(requestId)) {
        return {
          rowIdx: i + 2,
          requestId: String(values[i][0]),
          empId: String(values[i][1]),
          type: String(values[i][2]),
          purpose: String(values[i][3]),
          fromDate: values[i][4] ? formatDate_(values[i][4], 'yyyy-MM-dd') : '',
          toDate: values[i][5] ? formatDate_(values[i][5], 'yyyy-MM-dd') : '',
          estimatedCost: Number(values[i][8]) || 0,
          status: String(values[i][10])
        };
      }
    }
    return null;
  }

  function create_(payload, items) {
    return withLock_(() => {
      const s = _reqSheet();
      const id = generateUuid_();

      s.appendRow([
        id,
        payload.empId,
        payload.type || 'Expense',
        payload.purpose || '',
        payload.fromDate || todayStr_(),
        payload.toDate || todayStr_(),
        payload.fromCity || '',
        payload.toCity || '',
        Number(payload.estimatedCost) || 0,
        Number(payload.advanceRequested) || 0,
        'Pending',
        payload.approverEmpId || '',
        ''
      ]);

      // Add line items
      if (items && items.length) {
        const itemS = _itemSheet();
        items.forEach(it => {
          itemS.appendRow([
            generateUuid_(),
            id,
            it.category || 'Misc',
            it.date || todayStr_(),
            Number(it.amount) || 0,
            it.billUrl || '',
            it.remarks || ''
          ]);
        });
      }

      return getAll_().find(r => r.requestId === id);
    });
  }

  function updateStatus_(requestId, newStatus) {
    return withLock_(() => {
      const s = _reqSheet();
      const item = getById_(requestId);
      if (!item) return null;
      s.getRange(item.rowIdx, 11).setValue(newStatus);
      s.getRange(item.rowIdx, 13).setValue(new Date());
      return getById_(requestId);
    });
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    getById_: getById_,
    create_: create_,
    updateStatus_: updateStatus_
  };
})();
