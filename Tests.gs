/**
 * StackDrove HRMS — Tests.gs
 * Automated Unit Test Suite and Master Validation Runner.
 * Execute RUN_ALL_TESTS() from Apps Script editor to self-validate the deployment.
 */

function RUN_ALL_TESTS() {
  const suites = [
    { name: 'Utils & Sandwich Leave Engine', fn: test_Utils },
    { name: 'RBAC & Authentication Matrix', fn: test_Auth },
    { name: 'Email Priority Queue & Templates', fn: test_EmailQueue },
    { name: 'Attendance & Punch Engine', fn: test_Attendance },
    { name: 'Leave & Balance Deductions', fn: test_Leave }
  ];

  let passed = 0;
  let failed = 0;
  const results = [];

  Logger.log('====================================================');
  Logger.log('  STARTING STACKDROVE HRMS TEST HARNESS VALIDATION  ');
  Logger.log('====================================================');

  suites.forEach(suite => {
    try {
      suite.fn();
      passed++;
      results.push({ suite: suite.name, status: 'PASSED' });
      Logger.log(`[PASS] ${suite.name}`);
    } catch (e) {
      failed++;
      results.push({ suite: suite.name, status: 'FAILED', error: e.message });
      Logger.log(`[FAIL] ${suite.name}: ${e.message}`);
    }
  });

  Logger.log('====================================================');
  Logger.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${suites.length})`);
  Logger.log('====================================================');

  return {
    total: suites.length,
    passed: passed,
    failed: failed,
    results: results
  };
}

function test_Utils() {
  // Test 1: ok_ and fail_ response wrappers
  const resOk = ok_({ id: 123 });
  if (!resOk.success || resOk.data.id !== 123) throw new Error('ok_ wrapper failed');

  const resFail = fail_('ERR_CODE', 'Custom message');
  if (resFail.success || resFail.error.code !== 'ERR_CODE') throw new Error('fail_ wrapper failed');

  // Test 2: Idempotency duplicate check
  const reqId = 'test_req_' + Date.now();
  if (isDuplicateRequest_(reqId)) throw new Error('First call should not be duplicate');
  if (!isDuplicateRequest_(reqId)) throw new Error('Second immediate call must be detected as duplicate');

  // Test 3: Date formatting
  const today = todayStr_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('todayStr_ format mismatch: ' + today);

  // Test 4: Sequential ID generation
  const id1 = generateSequentialId_('SD-', 'TEST_COUNTER', 4);
  const id2 = generateSequentialId_('SD-', 'TEST_COUNTER', 4);
  if (!id1.startsWith('SD-') || !id2.startsWith('SD-') || id1 === id2) {
    throw new Error(`Sequential ID collision: ${id1} vs ${id2}`);
  }

  // Test 5: Sandwich Leave Calculation Cases
  // Case A: Casual leave Friday (2026-03-06) to Monday (2026-03-09) -> 4 days (Fri, Sat, Sun, Mon)
  const daysSandwich = calcLeaveDaysWithSandwich_('2026-03-06', '2026-03-09', 'SD-TEST', 'Casual', false);
  if (daysSandwich !== 4) {
    throw new Error(`Sandwich leave calculation expected 4 days for Fri-Mon Casual leave, got ${daysSandwich}`);
  }

  // Case B: Sick leave Friday to Monday (exempt from sandwich) -> 2 working days
  const daysSick = calcLeaveDaysWithSandwich_('2026-03-06', '2026-03-09', 'SD-TEST', 'Sick', false);
  if (daysSick !== 2) {
    throw new Error(`Sick leave expected 2 days (sandwich exempt), got ${daysSick}`);
  }

  // Case C: Friday single day leave -> 1 day
  const daysSingle = calcLeaveDaysWithSandwich_('2026-03-06', '2026-03-06', 'SD-TEST', 'Casual', false);
  if (daysSingle !== 1) {
    throw new Error(`Single day Friday expected 1 day, got ${daysSingle}`);
  }
}

function test_Auth() {
  // Test Nav generation for roles
  const empNav = Auth.getNavForRole_('employee');
  const adminNav = Auth.getNavForRole_('admin');

  if (!empNav.find(n => n.id === 'directory')) throw new Error('Employee should have Directory nav');
  if (empNav.find(n => n.id === 'admin')) throw new Error('Employee should NOT have Admin nav');
  if (!adminNav.find(n => n.id === 'admin')) throw new Error('Admin MUST have Admin nav');
}

function test_EmailQueue() {
  // Test Template variable interpolation
  const tpl = MailTemplates.getTemplate('LEAVE_APPROVED');
  const mergedSubject = MailDispatcher.renderTemplateString_(tpl.subject, {
    leaveType: 'Casual',
    fromDate: '2026-03-01',
    toDate: '2026-03-02'
  });

  if (!mergedSubject.includes('Casual') || !mergedSubject.includes('2026-03-01')) {
    throw new Error('Template merge string failed: ' + mergedSubject);
  }
}

function test_Attendance() {
  const today = todayStr_();
  const testEmpId = 'SD-9999';

  // Test Punch In
  const punchInRes = DB.Attendance.upsertPunch_(testEmpId, today, {
    punchInTime: new Date(),
    punchInLoc: 'Office Test',
    source: 'Unit Test'
  });

  if (!punchInRes || punchInRes.empId !== testEmpId || !punchInRes.punchInTime) {
    throw new Error('Punch in record creation failed');
  }

  // Test Punch Out
  const later = new Date(new Date().getTime() + 4 * 3600000); // 4 hours later
  const punchOutRes = DB.Attendance.upsertPunch_(testEmpId, today, {
    punchOutTime: later,
    punchOutLoc: 'Office Test'
  });

  if (!punchOutRes || !punchOutRes.punchOutTime || punchOutRes.workedHours < 3.9) {
    throw new Error('Punch out calculation failed');
  }
}

function test_Leave() {
  const testEmpId = 'SD-TEST-BAL';
  const yr = new Date().getFullYear();

  // Set initial balance
  DB.LeaveBalances.setInitial_(testEmpId, 'Casual', 15, yr);
  const bal = DB.LeaveBalances.getByEmp_(testEmpId, yr).find(b => b.leaveType === 'Casual');
  if (!bal || bal.balance !== 15) throw new Error('Initial balance setup failed');

  // Deduct 3 days
  DB.LeaveBalances.deduct_(testEmpId, 'Casual', 3);
  const balAfter = DB.LeaveBalances.getByEmp_(testEmpId, yr).find(b => b.leaveType === 'Casual');
  if (!balAfter || balAfter.balance !== 12 || balAfter.used !== 3) {
    throw new Error('Balance deduction failed: expected 12 remaining, got ' + balAfter?.balance);
  }

  // Restore 3 days
  DB.LeaveBalances.restore_(testEmpId, 'Casual', 3);
  const balRestored = DB.LeaveBalances.getByEmp_(testEmpId, yr).find(b => b.leaveType === 'Casual');
  if (!balRestored || balRestored.balance !== 15) {
    throw new Error('Balance restoration failed: expected 15, got ' + balRestored?.balance);
  }
}
