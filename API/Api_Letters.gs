/**
 * StackDrove HRMS — Api_Letters.gs
 * Client-callable endpoints for Letter Requests and Native PDF Generation.
 */

function Api_Letters_getMy() {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    const isPrivileged = (user.role === 'admin' || user.role === 'hr');

    const myList = DB.Letters.getByEmp_(user.empId);
    const allList = isPrivileged ? DB.Letters.getAll_().map(l => {
      const emp = DB.Directory.getById_(l.empId);
      return {
        ...l,
        employeeName: emp ? emp.fullName : l.empId,
        department: emp ? emp.department : ''
      };
    }) : [];

    return ok_({
      myList: myList,
      allList: allList
    });
  } catch (e) {
    logError_(e, 'Api_Letters_getMy');
    return fail_('ERROR', e.message);
  }
}

function Api_Letters_request(type) {
  try {
    const user = Auth.requireRole_(['employee', 'manager', 'hr', 'admin']);
    if (!type) return fail_('VALIDATION_ERROR', 'Letter type is required.');

    const reqId = DB.Letters.requestLetter_(user.empId, type);
    logAudit_(user.empId, 'LETTER_REQUEST', 'Letters', reqId, '', {}, { type });

    // Notify HR
    const hrUsers = DB.Directory.getAllHrAndAdmins_();
    hrUsers.forEach(hr => {
      MailQueue.enqueue(2, hr.email, 'LETTER_REQUESTED', {
        employeeName: user.fullName,
        letterType: type
      });
    });

    return ok_({ letterId: reqId });
  } catch (e) {
    logError_(e, 'Api_Letters_request');
    return fail_('ERROR', e.message);
  }
}

function Api_Letters_generate(letterId) {
  try {
    const user = Auth.requireRole_(['admin', 'hr']);
    const letter = DB.Letters.getById_(letterId);
    if (!letter) return fail_('NOT_FOUND', 'Letter request not found.');

    const emp = DB.Directory.getById_(letter.empId);
    if (!emp) return fail_('NOT_FOUND', 'Employee record not found.');

    const yr = new Date().getFullYear();
    const letterNumber = generateSequentialId_(`SD/HR/${yr}/`, 'COUNTER_LETTER_' + yr, 4);
    const orgName = Config.get('ORG_NAME') || 'StackDrove Technologies';

    // 1. Generate Native Letter HTML
    const letterHtml = generateLetterDocumentHtml_(emp, letter.type, letterNumber, orgName);

    // 2. Convert to PDF Blob and save to Drive
    const blob = Utilities.newBlob(letterHtml, 'text/html', `${letter.type}_${emp.empId}.html`)
      .getAs('application/pdf')
      .setName(`${letter.type}_${emp.fullName.replace(/\s+/g, '_')}_${letterNumber.replace(/\//g, '-')}.pdf`);

    let folder;
    const folderId = typeof Config.getFolderId === 'function' ? Config.getFolderId('LETTERS') : Config.get('DRIVE_FOLDER_LETTERS');
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch (_) {}
    }
    if (!folder) {
      folder = DriveApp.getRootFolder();
    }

    const driveFile = folder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = driveFile.getUrl();

    // 3. Update database
    DB.Letters.recordGeneratedLetter_(letterId, letterNumber, fileUrl, user.empId);
    logAudit_(user.empId, 'LETTER_GENERATE', 'Letters', letterId, '', {}, { letterNumber, fileUrl });

    // 4. Send email with PDF attachment
    if (emp.email) {
      MailDispatcher.dispatchMailDirect_(emp.email, 'LETTER_READY', {
        letterType: letter.type,
        letterNumber: letterNumber
      }, [blob]);
    }

    return ok_({
      letterNumber: letterNumber,
      fileUrl: fileUrl
    });
  } catch (e) {
    logError_(e, 'Api_Letters_generate');
    return fail_('ERROR', e.message);
  }
}

function generateLetterDocumentHtml_(emp, type, letterNumber, orgName) {
  const dateStr = formatDate_(new Date(), 'dd MMMM yyyy');
  const dojStr = emp.dateOfJoining ? formatDate_(emp.dateOfJoining, 'dd MMMM yyyy') : 'N/A';
  const ctcWords = emp.ctcAnnual ? numberToWordsINR_(emp.ctcAnnual) : '';

  let bodyContent = '';

  if (type === 'Experience Certificate') {
    bodyContent = `
      <p>This is to certify that <strong>${emp.fullName}</strong> (Employee ID: <strong>${emp.empId}</strong>) has been employed with <strong>${orgName}</strong> since <strong>${dojStr}</strong>.</p>
      <p>During their tenure, they have served as <strong>${emp.designation}</strong> in the <strong>${emp.department}</strong> department. Their conduct and performance have been consistently professional, diligent, and commendable.</p>
      <p>We wish them all the best in their future professional endeavors.</p>
    `;
  } else if (type === 'Relieving Letter') {
    const exitStr = emp.dateOfExit ? formatDate_(emp.dateOfExit, 'dd MMMM yyyy') : dateStr;
    bodyContent = `
      <p>With reference to your resignation, we hereby confirm that you have been relieved from your duties as <strong>${emp.designation}</strong> at <strong>${orgName}</strong> effective from the close of business hours on <strong>${exitStr}</strong>.</p>
      <p>All company assets and dues have been satisfactorily settled. We appreciate your valuable contributions during your service with us.</p>
    `;
  } else if (type === 'Salary Certificate') {
    bodyContent = `
      <p>This is to certify that <strong>${emp.fullName}</strong> is a full-time employee of <strong>${orgName}</strong> holding the designation of <strong>${emp.designation}</strong>.</p>
      <p>Their current annual gross remuneration is <strong>${formatCurrency(emp.ctcAnnual)}</strong> (Rupees ${ctcWords}).</p>
      <p>This certificate is issued upon the employee's request for official record purposes.</p>
    `;
  } else {
    bodyContent = `
      <p>This is to certify that <strong>${emp.fullName}</strong> is actively employed with <strong>${orgName}</strong> as <strong>${emp.designation}</strong> in the <strong>${emp.department}</strong> department since <strong>${dojStr}</strong>.</p>
      <p>This official document is issued upon specific request of the employee.</p>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #111827; line-height: 1.6; }
        .header { border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 30px; display: flex; justify-content: space-between; }
        .company-name { font-size: 22px; font-weight: bold; color: #111827; }
        .doc-title { font-size: 18px; font-weight: bold; text-align: center; margin: 30px 0 20px 0; text-transform: uppercase; text-decoration: underline; color: #1F2937; }
        .meta-table { width: 100%; margin-bottom: 24px; font-size: 13px; }
        .content { font-size: 14px; text-align: justify; margin-bottom: 40px; }
        .content p { margin-bottom: 16px; }
        .signature-block { margin-top: 60px; font-size: 14px; }
        .footer { margin-top: 80px; border-top: 1px solid #E5E7EB; padding-top: 10px; font-size: 10px; color: #9CA3AF; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${orgName}</div>
      </div>
      <table class="meta-table">
        <tr>
          <td><strong>Ref No:</strong> ${letterNumber}</td>
          <td style="text-align:right;"><strong>Date:</strong> ${dateStr}</td>
        </tr>
      </table>

      <div class="doc-title">${type}</div>

      <div class="content">
        <p><strong>TO WHOMSOEVER IT MAY CONCERN</strong></p>
        ${bodyContent}
      </div>

      <div class="signature-block">
        <p>Sincerely,</p>
        <br><br>
        <p><strong>Authorized Signatory</strong><br>Human Resources Department<br>${orgName}</p>
      </div>

      <div class="footer">
        This is an official computer-generated document issued by StackDrove HRMS. Document Verification Ref: ${letterNumber}
      </div>
    </body>
    </html>
  `;
}
