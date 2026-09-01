/**
 * StackDrove HRMS — Sheet_Letters.gs
 * Data access layer for Official Document Letters and Certificates.
 */

var DB = DB || {};

DB.Letters = (function() {
  const COL = {
    ID: 1,
    EMP_ID: 2,
    TYPE: 3,
    REQUESTED_ON: 4,
    STATUS: 5,
    FILE_URL: 6,
    GENERATED_ON: 7,
    GENERATED_BY: 8,
    LETTER_NUMBER: 9
  };

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Letters');
    if (!s) {
      s = ss.insertSheet('Letters');
      s.appendRow(['letterId', 'empId', 'type', 'requestedOn', 'status', 'generatedFileUrl', 'generatedOn', 'generatedBy', 'letterNumber']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 9).getValues();
    return values.map(r => ({
      letterId: String(r[0]),
      empId: String(r[1]),
      type: String(r[2]),
      requestedOn: r[3] ? formatDate_(r[3], 'yyyy-MM-dd') : '',
      status: String(r[4] || 'Requested'),
      generatedFileUrl: String(r[5] || ''),
      generatedOn: r[6] ? formatDate_(r[6], 'yyyy-MM-dd') : '',
      generatedBy: String(r[7] || ''),
      letterNumber: String(r[8] || '')
    })).reverse();
  }

  function getByEmp_(empId) {
    return getAll_().filter(l => l.empId.toLowerCase() === empId.toLowerCase());
  }

  function getById_(letterId) {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return null;
    const values = s.getRange(2, 1, lastRow - 1, 9).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(letterId)) {
        return {
          rowIdx: i + 2,
          letterId: String(values[i][0]),
          empId: String(values[i][1]),
          type: String(values[i][2]),
          status: String(values[i][4])
        };
      }
    }
    return null;
  }

  function requestLetter_(empId, type) {
    return withLock_(() => {
      const s = _sheet();
      const id = generateUuid_();
      s.appendRow([
        id,
        empId,
        type,
        new Date(),
        'Requested',
        '',
        '',
        '',
        ''
      ]);
      return id;
    });
  }

  function recordGeneratedLetter_(letterId, letterNumber, fileUrl, generatedBy) {
    return withLock_(() => {
      const s = _sheet();
      const item = getById_(letterId);
      if (!item) return false;

      s.getRange(item.rowIdx, COL.STATUS).setValue('Generated');
      s.getRange(item.rowIdx, COL.FILE_URL).setValue(fileUrl);
      s.getRange(item.rowIdx, COL.GENERATED_ON).setValue(new Date());
      s.getRange(item.rowIdx, COL.GENERATED_BY).setValue(generatedBy);
      s.getRange(item.rowIdx, COL.LETTER_NUMBER).setValue(letterNumber);
      return true;
    });
  }

  return {
    getAll_: getAll_,
    getByEmp_: getByEmp_,
    getById_: getById_,
    requestLetter_: requestLetter_,
    recordGeneratedLetter_: recordGeneratedLetter_
  };
})();
