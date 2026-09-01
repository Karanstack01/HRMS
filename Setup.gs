/**
 * StackDrove HRMS — Setup.gs
 * Self-contained bootstrap installer for sheets, headers, folders, seed data, and initial triggers.
 */

function initializeSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Config.initDefaults();

  // 1. Define Master Sheets Schema
  const SHEETS_SCHEMA = {
    Directory: [
      'empId', 'fullName', 'email', 'phone', 'photoUrl', 'department', 'designation',
      'role', 'managerId', 'dateOfJoining', 'dateOfBirth', 'employmentType', 'status',
      'location', 'reportingLocation', 'ctcAnnual', 'emergencyContact', 'address',
      'bloodGroup', 'dateOfExit', 'createdAt', 'updatedAt'
    ],
    LeaveRequests: [
      'leaveId', 'empId', 'leaveType', 'fromDate', 'toDate', 'dayCount', 'isHalfDay',
      'halfSession', 'reason', 'status', 'appliedOn', 'approverEmpId', 'actionedOn',
      'actionRemarks', 'attachmentUrl', 'rowVersion'
    ],
    LeaveBalances: [
      'empId', 'leaveType', 'opening', 'accrued', 'used', 'adjusted', 'balance', 'year'
    ],
    Holidays: [
      'holidayId', 'date', 'name', 'type', 'applicableLocations', 'description'
    ],
    Policies: [
      'policyId', 'title', 'category', 'description', 'documentUrl', 'version',
      'effectiveDate', 'mandatoryAck', 'status'
    ],
    PolicyAcks: [
      'ackId', 'policyId', 'empId', 'acknowledgedOn', 'ipAddress', 'version'
    ],
    Assets: [
      'assetId', 'assetTag', 'category', 'brandModel', 'serialNumber', 'purchaseDate',
      'warrantyExpiry', 'condition', 'status', 'assignedTo', 'assignedOn', 'returnedOn',
      'value', 'remarks'
    ],
    AssetRequests: [
      'requestId', 'empId', 'assetCategory', 'reason', 'status', 'requestedOn', 'actionedBy', 'actionedOn'
    ],
    Rewards: [
      'rewardId', 'empId', 'category', 'title', 'description', 'points', 'givenBy', 'givenOn', 'badgeIcon', 'isPublic'
    ],
    Appraisals: [
      'appraisalId', 'empId', 'cycle', 'selfRating', 'managerRating', 'finalRating',
      'goals', 'competencyScores', 'managerComments', 'hrComments', 'status',
      'createdOn', 'completedOn'
    ],
    TravelExpense: [
      'requestId', 'empId', 'type', 'purpose', 'fromDate', 'toDate', 'fromCity', 'toCity',
      'estimatedCost', 'advanceRequested', 'status', 'approverEmpId', 'actionedOn'
    ],
    ExpenseItems: [
      'itemId', 'requestId', 'category', 'date', 'amount', 'billUrl', 'remarks'
    ],
    Letters: [
      'letterId', 'empId', 'type', 'requestedOn', 'status', 'generatedFileUrl', 'generatedOn', 'generatedBy', 'letterNumber'
    ],
    Payroll: [
      'payrollId', 'empId', 'month', 'year', 'basic', 'hra', 'allowances', 'grossPay',
      'deductions', 'netPay', 'payslipUrl', 'status', 'processedOn', 'processedBy'
    ],
    Resignations: [
      'resignationId', 'empId', 'submittedOn', 'lastWorkingDay', 'reason', 'noticePeriodDays',
      'status', 'lwdFinal', 'clearanceChecklist', 'approvedBy', 'fnfSettled'
    ],
    AuditLog: [
      'logId', 'timestamp', 'actorEmpId', 'action', 'module', 'recordId', 'requestId', 'oldValue', 'newValue'
    ],
    EmailQueue: [
      'queueId', 'priority', 'toEmail', 'templateKey', 'payloadJson', 'status', 'attempts', 'createdAt', 'dispatchedAt', 'errorMessage'
    ]
  };

  // Create current year Attendance sheet (e.g. Attendance_2026)
  const currentYear = new Date().getFullYear();
  SHEETS_SCHEMA['Attendance_' + currentYear] = [
    'recordId', 'empId', 'date', 'punchInTime', 'punchOutTime', 'punchInLoc',
    'punchOutLoc', 'workedHours', 'status', 'lateBy', 'earlyLeaveBy',
    'regularizationRequested', 'regularizationReason', 'approvedBy', 'source', 'remarks'
  ];

  // 2. Build or Update Sheets with Format Styling
  for (const sheetName in SHEETS_SCHEMA) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = SHEETS_SCHEMA[sheetName];
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1E1B4B');
    headerRange.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }

  // Remove default 'Sheet1' if present and other sheets exist
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (_) {}
  }

  // 3. Create Google Drive Folder Hierarchy
  const rootFolderName = 'StackDrove_Files';
  let rootFolder;
  const existingFolders = DriveApp.getFoldersByName(rootFolderName);
  if (existingFolders.hasNext()) {
    rootFolder = existingFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(rootFolderName);
  }

  const subFolders = ['Policies', 'Letters', 'Payslips', 'LeaveAttachments', 'ExpenseBills', 'Profiles'];
  subFolders.forEach(sub => {
    let sf;
    const existing = rootFolder.getFoldersByName(sub);
    if (existing.hasNext()) {
      sf = existing.next();
    } else {
      sf = rootFolder.createFolder(sub);
    }
    Config.setFolderId(sub.toUpperCase(), sf.getId());
  });

  // 4. Seed Initial Admin & Directory Records if empty
  const dirSheet = ss.getSheetByName('Directory');
  if (dirSheet.getLastRow() <= 1) {
    const adminEmail = Session.getActiveUser().getEmail() || 'admin@stackdrove.com';
    const initialEmployees = [
      [
        'SD-0001', 'System Administrator', adminEmail, '9876543210', '',
        'Executive', 'Managing Director', 'admin', '', '2023-01-01', '1990-01-01',
        'full-time', 'active', 'Headquarters (Bangalore)', 'onsite', 3600000,
        '9876543211', 'StackDrove Towers, MG Road, Bangalore', 'O+', '', new Date(), new Date()
      ],
      [
        'SD-0002', 'Sarah Jenkins', 'sarah.hr@stackdrove.com', '9876543220', '',
        'Human Resources', 'HR Lead', 'hr', 'SD-0001', '2023-03-15', '1992-05-12',
        'full-time', 'active', 'Headquarters (Bangalore)', 'onsite', 1800000,
        '9876543221', 'Koramangala, Bangalore', 'A+', '', new Date(), new Date()
      ],
      [
        'SD-0003', 'Alex Rivera', 'alex.eng@stackdrove.com', '9876543230', '',
        'Engineering', 'Engineering Manager', 'manager', 'SD-0001', '2023-04-01', '1991-08-22',
        'full-time', 'active', 'Headquarters (Bangalore)', 'hybrid', 2400000,
        '9876543231', 'Indiranagar, Bangalore', 'B+', '', new Date(), new Date()
      ],
      [
        'SD-0004', 'David Chen', 'david.dev@stackdrove.com', '9876543240', '',
        'Engineering', 'Senior Full Stack Developer', 'employee', 'SD-0003', '2024-01-10', '1995-11-04',
        'full-time', 'active', 'Headquarters (Bangalore)', 'remote', 1600000,
        '9876543241', 'HSR Layout, Bangalore', 'AB+', '', new Date(), new Date()
      ]
    ];

    initialEmployees.forEach(row => dirSheet.appendRow(row));

    // Seed default Leave Balances for initial employees
    const balSheet = ss.getSheetByName('LeaveBalances');
    ['SD-0001', 'SD-0002', 'SD-0003', 'SD-0004'].forEach(id => {
      balSheet.appendRow([id, 'Casual', 15, 0, 0, 0, 15, currentYear]);
      balSheet.appendRow([id, 'Sick', 12, 0, 0, 0, 12, currentYear]);
      balSheet.appendRow([id, 'Earned', 21, 0, 0, 0, 21, currentYear]);
    });
  }

  // 5. Seed Holidays if empty
  const holSheet = ss.getSheetByName('Holidays');
  if (holSheet.getLastRow() <= 1) {
    const seedHolidays = [
      ['HOL-001', `${currentYear}-01-01`, "New Year's Day", 'National', 'ALL', 'Celebration of New Year'],
      ['HOL-002', `${currentYear}-01-26`, 'Republic Day', 'National', 'ALL', 'National holiday of India'],
      ['HOL-003', `${currentYear}-05-01`, 'May Day / Labour Day', 'National', 'ALL', 'International Workers Day'],
      ['HOL-004', `${currentYear}-08-15`, 'Independence Day', 'National', 'ALL', 'Indian Independence Day'],
      ['HOL-005', `${currentYear}-10-02`, 'Gandhi Jayanti', 'National', 'ALL', 'Mahatma Gandhi Birthday'],
      ['HOL-006', `${currentYear}-12-25`, 'Christmas Day', 'Festival', 'ALL', 'Christmas holiday']
    ];
    seedHolidays.forEach(h => holSheet.appendRow(h));
  }

  // 6. Install Automated Background Cron Triggers
  Triggers.installAll();

  Logger.log('[StackDrove HRMS] System initialization complete. All sheets, Drive folders, and triggers created.');
  return { success: true, message: 'StackDrove HRMS successfully initialized.' };
}
