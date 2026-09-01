/**
 * StackDrove HRMS — Api_Payroll.gs
 * Client-callable endpoints for Payroll Processing, LOP deductions, and Payslip Generation.
 */

function Api_Payroll_getMy() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr');

    const myList = DB.Payroll.getByEmp_(user.empId);
    return ok_({
      myList: myList,
      canProcess: isPrivileged
    });
  } catch (e) {
    logError_(e, 'Api_Payroll_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Payroll_generateDraft(month, year) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const targetMonth = Number(month) || (new Date().getMonth() + 1);
    const targetYear = Number(year) || new Date().getFullYear();

    const employees = DB.Directory.getAll_().filter(e => e.status === 'active');
    const drafts = [];

    employees.forEach(emp => {
      const annualCtc = emp.ctcAnnual || 1200000;
      const monthlyGross = Math.round(annualCtc / 12);
      
      const basic = Math.round(monthlyGross * 0.50);
      const hra = Math.round(monthlyGross * 0.25);
      const specialAllowance = monthlyGross - basic - hra;

      // Check Attendance for unpaid absences (LOP)
      const attRecords = DB.Attendance.getByEmpAndMonth_(emp.empId, targetYear, targetMonth);
      const absentDays = attRecords.filter(r => r.status === 'Absent').length;
      
      const perDaySalary = Math.round(monthlyGross / 30);
      const lopDeduction = absentDays * perDaySalary;

      const pf = Math.min(1800, Math.round(basic * 0.12));
      const pt = 200;
      const tds = Math.round(monthlyGross * 0.05);
      const totalDeductions = pf + pt + tds + lopDeduction;
      const netPay = Math.max(0, monthlyGross - totalDeductions);

      drafts.push({
        payrollId: generateUuid_(),
        empId: emp.empId,
        employeeName: emp.fullName,
        department: emp.department,
        designation: emp.designation,
        month: targetMonth,
        year: targetYear,
        basic: basic,
        hra: hra,
        allowances: { special: specialAllowance },
        grossPay: monthlyGross,
        deductions: { pf: pf, pt: pt, tds: tds, lop: lopDeduction, absentDays: absentDays },
        netPay: netPay,
        status: 'Draft',
        processedBy: user.empId
      });
    });

    return ok_(drafts);
  } catch (e) {
    logError_(e, 'Api_Payroll_generateDraft');
    return fail_('ERROR', e.message);
  }
}

function Api_Payroll_publish(drafts) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    if (!drafts || !drafts.length) return fail_('VALIDATION_ERROR', 'No draft payroll records to publish.');

    const orgName = Config.get('ORG_NAME') || 'StackDrove Technologies';
    let folder;
    const folderId = Config.getFolderId('PAYSLIPS');
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch (_) {}
    }
    if (!folder) {
      folder = DriveApp.getRootFolder();
    }

    const savedRecords = [];

    drafts.forEach(d => {
      const emp = DB.Directory.getById_(d.empId);
      const payslipHtml = generatePayslipDocumentHtml_(emp || { fullName: d.employeeName, empId: d.empId, designation: d.designation, department: d.department }, d, orgName);
      
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[d.month] || String(d.month);

      const blob = Utilities.newBlob(payslipHtml, 'text/html', `Payslip_${d.empId}_${d.month}_${d.year}.html`)
        .getAs('application/pdf')
        .setName(`Payslip_${d.empId}_${monthName}_${d.year}.pdf`);

      const driveFile = folder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const payslipUrl = driveFile.getUrl();

      d.payslipUrl = payslipUrl;
      d.status = 'Paid';
      d.processedBy = user.empId;

      savedRecords.push(d);

      // Email payslip to employee via Priority 1 email with PDF attachment
      if (emp && emp.email) {
        MailDispatcher.dispatchMailDirect_(emp.email, 'PAYSLIP_PUBLISHED', {
          month: monthName,
          year: d.year
        }, [blob]);
      }
    });

    DB.Payroll.saveBatch_(savedRecords);
    logAudit_(user.empId, 'PAYROLL_PUBLISH', 'Payroll', `${drafts[0].month}-${drafts[0].year}`, '', {}, { totalCount: drafts.length });

    return ok_({ publishedCount: drafts.length });
  } catch (e) {
    logError_(e, 'Api_Payroll_publish');
    return fail_('ERROR', e.message);
  }
}

function generatePayslipDocumentHtml_(emp, payroll, orgName) {
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[payroll.month] || payroll.month;
  const netWords = numberToWordsINR_(payroll.netPay);

  const deductions = (typeof payroll.deductions === 'string') ? JSON.parse(payroll.deductions) : (payroll.deductions || {});
  const allowances = (typeof payroll.allowances === 'string') ? JSON.parse(payroll.allowances) : (payroll.allowances || {});

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #111827; font-size: 13px; }
        .header { text-align: center; border-bottom: 2px solid #4F46E5; padding-bottom: 14px; margin-bottom: 20px; }
        .company-title { font-size: 20px; font-weight: bold; color: #111827; }
        .payslip-title { font-size: 15px; font-weight: 600; color: #4F46E5; margin-top: 4px; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        .info-table td { padding: 6px 10px; border: 1px solid #E5E7EB; }
        .breakdown-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        .breakdown-table th { background: #F3F4F6; padding: 8px 10px; border: 1px solid #E5E7EB; text-align: left; }
        .breakdown-table td { padding: 8px 10px; border: 1px solid #E5E7EB; }
        .total-row { font-weight: bold; background: #F9FAFB; }
        .net-pay-box { background: #EEF2FF; border: 1px solid #C7D2FE; padding: 14px; border-radius: 6px; margin-bottom: 20px; }
        .footer { font-size: 10px; color: #9CA3AF; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-title">${orgName}</div>
        <div class="payslip-title">Payslip for ${monthName} ${payroll.year}</div>
      </div>

      <table class="info-table">
        <tr>
          <td><strong>Employee Name:</strong> ${emp.fullName}</td>
          <td><strong>Employee ID:</strong> ${emp.empId}</td>
        </tr>
        <tr>
          <td><strong>Designation:</strong> ${emp.designation || 'Staff'}</td>
          <td><strong>Department:</strong> ${emp.department || 'General'}</td>
        </tr>
      </table>

      <table class="breakdown-table">
        <thead>
          <tr>
            <th>Earnings</th>
            <th style="text-align:right;">Amount (₹)</th>
            <th>Deductions</th>
            <th style="text-align:right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td style="text-align:right;">${formatCurrency(payroll.basic)}</td>
            <td>Provident Fund (PF)</td>
            <td style="text-align:right;">${formatCurrency(deductions.pf || 0)}</td>
          </tr>
          <tr>
            <td>House Rent Allowance (HRA)</td>
            <td style="text-align:right;">${formatCurrency(payroll.hra)}</td>
            <td>Professional Tax (PT)</td>
            <td style="text-align:right;">${formatCurrency(deductions.pt || 0)}</td>
          </tr>
          <tr>
            <td>Special Allowance</td>
            <td style="text-align:right;">${formatCurrency(allowances.special || 0)}</td>
            <td>Income Tax (TDS)</td>
            <td style="text-align:right;">${formatCurrency(deductions.tds || 0)}</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td>Loss of Pay (LOP: ${deductions.absentDays || 0} days)</td>
            <td style="text-align:right;">${formatCurrency(deductions.lop || 0)}</td>
          </tr>
          <tr class="total-row">
            <td>Gross Earnings</td>
            <td style="text-align:right;">${formatCurrency(payroll.grossPay)}</td>
            <td>Total Deductions</td>
            <td style="text-align:right;">${formatCurrency((deductions.pf || 0) + (deductions.pt || 0) + (deductions.tds || 0) + (deductions.lop || 0))}</td>
          </tr>
        </tbody>
      </table>

      <div class="net-pay-box">
        <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:bold; color:#1E1B4B;">
          <span>Net Take-Home Pay:</span>
          <span>${formatCurrency(payroll.netPay)}</span>
        </div>
        <div style="font-size:11px; color:#4338CA; margin-top:4px;">Amount in words: Rupees ${netWords}</div>
      </div>

      <div class="footer">
        Confidential Document • Generated by StackDrove HRMS System • System-verified electronic payroll receipt
      </div>
    </body>
    </html>
  `;
}
