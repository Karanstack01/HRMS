/**
 * StackDrove HRMS — Sheet_Assets.gs
 * Data access layer for Asset Inventory, Requests, and Offboarding Clearance.
 */

var DB = DB || {};

DB.Assets = (function() {
  const COL = {
    ID: 1,
    TAG: 2,
    CATEGORY: 3,
    BRAND_MODEL: 4,
    SERIAL: 5,
    PURCHASE_DATE: 6,
    WARRANTY_EXPIRY: 7,
    CONDITION: 8,
    STATUS: 9,
    ASSIGNED_TO: 10,
    ASSIGNED_ON: 11,
    RETURNED_ON: 12,
    VALUE: 13,
    REMARKS: 14
  };

  function _assetSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Assets');
    if (!s) {
      s = ss.insertSheet('Assets');
      s.appendRow([
        'assetId', 'assetTag', 'category', 'brandModel', 'serialNumber', 'purchaseDate',
        'warrantyExpiry', 'condition', 'status', 'assignedTo', 'assignedOn', 'returnedOn',
        'value', 'remarks'
      ]);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _reqSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('AssetRequests');
    if (!s) {
      s = ss.insertSheet('AssetRequests');
      s.appendRow(['requestId', 'empId', 'assetCategory', 'reason', 'status', 'requestedOn', 'actionedBy', 'actionedOn']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _assetSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 14).getValues();
    return values.map(r => ({
      assetId: String(r[0]),
      assetTag: String(r[1]),
      category: String(r[2]),
      brandModel: String(r[3]),
      serialNumber: String(r[4]),
      purchaseDate: r[5] ? formatDate_(r[5], 'yyyy-MM-dd') : '',
      warrantyExpiry: r[6] ? formatDate_(r[6], 'yyyy-MM-dd') : '',
      condition: String(r[7] || 'Good'),
      status: String(r[8] || 'In Stock'),
      assignedTo: String(r[9] || ''),
      assignedOn: r[10] ? formatDate_(r[10], 'yyyy-MM-dd') : '',
      returnedOn: r[11] ? formatDate_(r[11], 'yyyy-MM-dd') : '',
      value: Number(r[12]) || 0,
      remarks: String(r[13] || '')
    }));
  }

  function getByEmp_(empId) {
    return getAll_().filter(a => a.assignedTo.toLowerCase() === empId.toLowerCase() && a.status === 'Assigned');
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _assetSheet();
      const id = payload.assetId || generateSequentialId_('AST-', 'COUNTER_ASSET', 4);
      s.appendRow([
        id,
        payload.assetTag || id,
        payload.category || 'Laptop',
        payload.brandModel || '',
        payload.serialNumber || '',
        payload.purchaseDate || todayStr_(),
        payload.warrantyExpiry || '',
        payload.condition || 'New',
        'In Stock',
        '',
        '',
        '',
        Number(payload.value) || 0,
        payload.remarks || ''
      ]);
      return getAll_().find(a => a.assetId === id);
    });
  }

  function assign_(assetId, empId) {
    return withLock_(() => {
      const s = _assetSheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;
      const values = s.getRange(2, 1, lastRow - 1, 14).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(assetId)) {
          s.getRange(i + 2, COL.STATUS).setValue('Assigned');
          s.getRange(i + 2, COL.ASSIGNED_TO).setValue(empId);
          s.getRange(i + 2, COL.ASSIGNED_ON).setValue(new Date());
          return true;
        }
      }
      return false;
    });
  }

  function returnAsset_(assetId) {
    return withLock_(() => {
      const s = _assetSheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;
      const values = s.getRange(2, 1, lastRow - 1, 14).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(assetId)) {
          s.getRange(i + 2, COL.STATUS).setValue('In Stock');
          s.getRange(i + 2, COL.ASSIGNED_TO).setValue('');
          s.getRange(i + 2, COL.RETURNED_ON).setValue(new Date());
          return true;
        }
      }
      return false;
    });
  }

  function createRequest_(empId, category, reason) {
    return withLock_(() => {
      const s = _reqSheet();
      const id = generateUuid_();
      s.appendRow([id, empId, category, reason, 'Pending', new Date(), '', '']);
      return id;
    });
  }

  function getRequests_() {
    const s = _reqSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 8).getValues();
    return values.map(r => ({
      requestId: String(r[0]),
      empId: String(r[1]),
      assetCategory: String(r[2]),
      reason: String(r[3]),
      status: String(r[4]),
      requestedOn: r[5] ? formatDate_(r[5], 'yyyy-MM-dd') : '',
      actionedBy: String(r[6] || ''),
      actionedOn: r[7] ? formatDate_(r[7], 'yyyy-MM-dd') : ''
    }));
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    create_: create_,
    assign_: assign_,
    returnAsset_: returnAsset_,
    createRequest_: createRequest_,
    getRequests_: getRequests_
  };
})();
