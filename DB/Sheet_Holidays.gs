/**
 * StackDrove HRMS — Sheet_Holidays.gs
 * Data access layer for Company Holidays and location filtering.
 */

var DB = DB || {};

DB.Holidays = (function() {
  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Holidays');
    if (!s) {
      s = ss.insertSheet('Holidays');
      s.appendRow(['holidayId', 'date', 'name', 'type', 'applicableLocations', 'description']);
      s.setFrozenRows(1);
    }
    return s;
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) return [];
    const values = s.getRange(2, 1, lastRow - 1, 6).getValues();
    return values.map(r => ({
      holidayId: String(r[0]),
      date: formatDate_(r[1], 'yyyy-MM-dd'),
      name: String(r[2]),
      type: String(r[3] || 'National'),
      applicableLocations: String(r[4] || 'ALL'),
      description: String(r[5] || '')
    })).sort((a,b) => a.date.localeCompare(b.date));
  }

  function isHoliday_(dateStr, location) {
    const all = getAll_();
    return all.some(h => {
      if (h.date !== dateStr) return false;
      if (!h.applicableLocations || h.applicableLocations === 'ALL') return true;
      if (!location) return true;
      return h.applicableLocations.toLowerCase().includes(location.toLowerCase());
    });
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const id = payload.holidayId || generateSequentialId_('HOL-', 'COUNTER_HOLIDAY', 3);
      s.appendRow([
        id,
        payload.date,
        payload.name,
        payload.type || 'National',
        payload.applicableLocations || 'ALL',
        payload.description || ''
      ]);
      return getAll_().find(h => h.holidayId === id);
    });
  }

  function delete_(holidayId) {
    return withLock_(() => {
      const s = _sheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;
      const ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(holidayId)) {
          s.deleteRow(i + 2);
          return true;
        }
      }
      return false;
    });
  }

  return {
    getAll_: getAll_,
    isHoliday_: isHoliday_,
    create_: create_,
    delete_: delete_
  };
})();
