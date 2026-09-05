/**
 * StackDrove HRMS — Sheet_Holidays.gs
 * Data access layer for Company Holidays, Location Filtering, and 2026 Schedule.
 */

var DB = DB || {};

DB.Holidays = (function() {
  const STANDARD_HEADERS = ['holidayId', 'date', 'name', 'type', 'applicableLocations', 'description'];

  const DEFAULT_2026_HOLIDAYS = [
    { id: 'HOL-001', date: '2026-01-26', name: 'Republic Day', type: 'National', loc: 'ALL', desc: 'National celebration of the Constitution of India' },
    { id: 'HOL-002', date: '2026-03-04', name: 'Holi', type: 'Festival', loc: 'ALL', desc: 'Festival of colors and spring' },
    { id: 'HOL-003', date: '2026-03-21', name: 'Eid-ul-Fitr', type: 'Festival', loc: 'ALL', desc: 'Celebration marking the conclusion of Ramadan' },
    { id: 'HOL-004', date: '2026-04-03', name: 'Good Friday', type: 'National', loc: 'ALL', desc: 'Christian holiday commemorating the passion and crucifixion' },
    { id: 'HOL-005', date: '2026-04-14', name: 'Dr. B.R. Ambedkar Jayanti', type: 'National', loc: 'ALL', desc: 'Commemorating the father of the Constitution' },
    { id: 'HOL-006', date: '2026-05-01', name: 'International Workers\' Day', type: 'National', loc: 'ALL', desc: 'May Day / Labor Day celebration' },
    { id: 'HOL-007', date: '2026-08-15', name: 'Independence Day', type: 'National', loc: 'ALL', desc: 'Celebration of Indian Independence' },
    { id: 'HOL-008', date: '2026-08-27', name: 'Raksha Bandhan', type: 'Restricted', loc: 'ALL', desc: 'Optional holiday celebrating bond of siblings' },
    { id: 'HOL-009', date: '2026-09-04', name: 'Janmashtami', type: 'Festival', loc: 'ALL', desc: 'Celebration of the birth of Lord Krishna' },
    { id: 'HOL-010', date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', type: 'National', loc: 'ALL', desc: 'National holiday marking the birth of Mahatma Gandhi' },
    { id: 'HOL-011', date: '2026-10-20', name: 'Dussehra (Vijayadashami)', type: 'Festival', loc: 'ALL', desc: 'Victory of good over evil' },
    { id: 'HOL-012', date: '2026-11-08', name: 'Diwali (Deepavali)', type: 'Festival', loc: 'ALL', desc: 'Grand Festival of Lights' },
    { id: 'HOL-013', date: '2026-11-09', name: 'Govardhan Puja / Bhai Dooj', type: 'Restricted', loc: 'ALL', desc: 'Post-Diwali festivities' },
    { id: 'HOL-014', date: '2026-11-24', name: 'Guru Nanak Jayanti', type: 'Festival', loc: 'ALL', desc: 'Prakash Utsav celebrating Guru Nanak Dev Ji' },
    { id: 'HOL-015', date: '2026-12-25', name: 'Christmas Day', type: 'National', loc: 'ALL', desc: 'Annual festival commemorating the birth of Jesus Christ' }
  ];

  function _sheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let s = ss.getSheetByName('Holidays');
    if (!s) {
      const all = ss.getSheets();
      for (let i = 0; i < all.length; i++) {
        const name = all[i].getName().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (name === 'holidays' || name === 'holiday' || name === 'holidaycalendar' || name === 'companyholidays') {
          s = all[i];
          break;
        }
      }
    }
    if (!s) {
      s = ss.insertSheet('Holidays');
      s.appendRow(STANDARD_HEADERS);
      s.setFrozenRows(1);

      // Pre-populate with official 2026 holidays
      DEFAULT_2026_HOLIDAYS.forEach(h => {
        s.appendRow([h.id, h.date, h.name, h.type, h.loc, h.desc]);
      });
    }
    return s;
  }

  function _getColumnMap(s) {
    const lastCol = Math.max(1, s.getLastColumn());
    const rawHeaders = s.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};
    rawHeaders.forEach((h, idx) => {
      const key = String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key) map[key] = idx;
    });

    function findCol(aliases, defaultIdx) {
      for (let i = 0; i < aliases.length; i++) {
        const key = aliases[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (map[key] !== undefined) return map[key];
      }
      return (defaultIdx !== undefined && defaultIdx < lastCol) ? defaultIdx : -1;
    }

    return {
      holidayId: findCol(['holidayId', 'id', 'holId'], 0),
      date: findCol(['date', 'holidayDate', 'day'], 1),
      name: findCol(['name', 'holidayName', 'title', 'event'], 2),
      type: findCol(['type', 'category', 'holidayType'], 3),
      applicableLocations: findCol(['applicableLocations', 'locations', 'location', 'branch'], 4),
      description: findCol(['description', 'desc', 'notes', 'remarks'], 5),
      lastCol: lastCol
    };
  }

  function _normalizeDate(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val.getTime())) {
      try {
        const tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone) ? Session.getScriptTimeZone() : 'Asia/Kolkata';
        return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
      } catch (_) {
        return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
      }
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.substring(0, 10);
    }
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return typeof formatDate_ === 'function' ? formatDate_(val, 'yyyy-MM-dd') : s.split('T')[0];
  }

  function getAll_() {
    const s = _sheet();
    const lastRow = s.getLastRow();
    if (lastRow <= 1) {
      // If sheet has only headers, populate default 2026 holidays
      DEFAULT_2026_HOLIDAYS.forEach(h => {
        s.appendRow([h.id, h.date, h.name, h.type, h.loc, h.desc]);
      });
    }

    const currentLastRow = s.getLastRow();
    if (currentLastRow <= 1) return [];

    const colMap = _getColumnMap(s);
    const values = s.getRange(2, 1, currentLastRow - 1, colMap.lastCol).getValues();
    const list = [];

    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const id = colMap.holidayId !== -1 ? String(r[colMap.holidayId] || '') : ('HOL-' + (i + 1));
      const rawDate = colMap.date !== -1 ? r[colMap.date] : '';
      const dateStr = _normalizeDate(rawDate);
      const name = colMap.name !== -1 ? String(r[colMap.name] || '') : '';
      if (!name && !dateStr) continue;

      list.push({
        holidayId: id,
        date: dateStr,
        name: name,
        type: colMap.type !== -1 ? String(r[colMap.type] || 'National') : 'National',
        applicableLocations: colMap.applicableLocations !== -1 ? String(r[colMap.applicableLocations] || 'ALL') : 'ALL',
        description: colMap.description !== -1 ? String(r[colMap.description] || '') : '',
        rowIdx: i + 2
      });
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  function isHoliday_(dateStr, location) {
    const all = getAll_();
    const targetDate = _normalizeDate(dateStr);
    return all.some(h => {
      if (h.date !== targetDate) return false;
      if (!h.applicableLocations || h.applicableLocations === 'ALL') return true;
      if (!location) return true;
      return h.applicableLocations.toLowerCase().includes(location.toLowerCase());
    });
  }

  function create_(payload) {
    return withLock_(() => {
      const s = _sheet();
      const colMap = _getColumnMap(s);
      const id = payload.holidayId || (typeof generateSequentialId_ === 'function' ? generateSequentialId_('HOL-', 'COUNTER_HOLIDAY', 3) : ('HOL-' + Date.now().toString(36).toUpperCase()));
      const normDate = _normalizeDate(payload.date);

      const row = new Array(Math.max(colMap.lastCol, 6)).fill('');
      if (colMap.holidayId !== -1) row[colMap.holidayId] = id;
      if (colMap.date !== -1) row[colMap.date] = normDate;
      if (colMap.name !== -1) row[colMap.name] = payload.name;
      if (colMap.type !== -1) row[colMap.type] = payload.type || 'National';
      if (colMap.applicableLocations !== -1) row[colMap.applicableLocations] = payload.applicableLocations || 'ALL';
      if (colMap.description !== -1) row[colMap.description] = payload.description || '';

      s.appendRow(row);
      return getAll_().find(h => h.holidayId === id) || {
        holidayId: id,
        date: normDate,
        name: payload.name,
        type: payload.type || 'National',
        applicableLocations: payload.applicableLocations || 'ALL',
        description: payload.description || ''
      };
    });
  }

  function delete_(holidayId) {
    return withLock_(() => {
      const s = _sheet();
      const lastRow = s.getLastRow();
      if (lastRow <= 1) return false;
      const colMap = _getColumnMap(s);
      const values = s.getRange(2, 1, lastRow - 1, colMap.lastCol).getValues();
      for (let i = 0; i < values.length; i++) {
        const r = values[i];
        const id = colMap.holidayId !== -1 ? String(r[colMap.holidayId] || '') : '';
        if (id.toLowerCase() === String(holidayId).toLowerCase()) {
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
