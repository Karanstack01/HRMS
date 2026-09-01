/**
 * StackDrove HRMS — Sheet_Policies.gs
 * Data access layer for Company Policies, PDF links, and mandatory digital acknowledgements.
 */

var DB = DB || {};

DB.Policies = (function() {
  function _policySheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Policies');
    if (!s) {
      s = ss.insertSheet('Policies');
      s.appendRow(['policyId', 'title', 'category', 'description', 'documentUrl', 'version', 'effectiveDate', 'mandatoryAck', 'status']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function _ackSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('PolicyAcks');
    if (!s) {
      s = ss.insertSheet('PolicyAcks');
      s.appendRow(['ackId', 'policyId', 'empId', 'acknowledgedOn', 'ipAddress', 'version']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _policySheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 9).getValues();
    return values.map(r => ({
      policyId: String(r[0]),
      title: String(r[1]),
      category: String(r[2]),
      description: String(r[3] || ''),
      documentUrl: String(r[4] || ''),
      version: String(r[5] || '1.0'),
      effectiveDate: r[6] ? formatDate_(r[6], 'yyyy-MM-dd') : '',
      mandatoryAck: Boolean(r[7]),
      status: String(r[8] || 'Published')
    })).filter(p => p.status === 'Published');
  }

  function getAcksForEmp_(empId) {
    const s = _ackSheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 6).getValues();
    return values
      .filter(r => String(r[2]).toLowerCase() === empId.toLowerCase())
      .map(r => ({
        ackId: String(r[0]),
        policyId: String(r[1]),
        empId: String(r[2]),
        acknowledgedOn: r[3] ? formatDate_(r[3], "yyyy-MM-dd'T'HH:mm:ss") : '',
        ipAddress: String(r[4] || ''),
        version: String(r[5] || '')
      }));
  }

  function acknowledge_(policyId, empId, ipAddress) {
    return withLock_(() => {
      const s = _ackSheet();
      const existing = getAcksForEmp_(empId);
      if (existing.some(a => a.policyId === policyId)) return true;

      const policy = getAll_().find(p => p.policyId === policyId);
      const version = policy ? policy.version : '1.0';

      s.appendRow([
        generateUuid_(),
        policyId,
        empId,
        new Date(),
        ipAddress || 'Client Web App',
        version
      ]);
      return true;
    });
  }

  return {
    getAll_: getAll_,
    getAcksForEmp_: getAcksForEmp_,
    acknowledge_: acknowledge_
  };
})();
