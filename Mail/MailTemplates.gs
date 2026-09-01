/**
 * StackDrove HRMS — MailTemplates.gs
 * 20+ Responsive HTML email templates with StackDrove Indigo/Teal theme.
 */

var MailTemplates = (function() {

  function wrapTemplate_(title, contentHtml) {
    const orgName = Config.get('ORG_NAME') || 'StackDrove Technologies';
    const appUrl = MailDispatcher.buildAppUrl_();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 20px; color: #1E293B; line-height: 1.6; }
          .wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); padding: 28px 24px; text-align: center; color: #FFFFFF; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 4px 0 0 0; font-size: 13px; color: #C7D2FE; }
          .body { padding: 32px 28px; }
          .card-box { background: #F1F5F9; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13.5px; }
          .btn-primary { display: inline-block; background: #4F46E5; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; }
          .footer { background: #F8FAFC; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
          .footer a { color: #4F46E5; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>Stack<span style="color:#818CF8;">Drove</span> HRMS</h1>
            <p>${orgName}</p>
          </div>
          <div class="body">
            <h2 style="font-size: 17px; margin-top: 0; color: #0F172A;">${title}</h2>
            ${contentHtml}
            <div style="text-align: center; margin-top: 24px;">
              <a href="${appUrl}" class="btn-primary">Open StackDrove HRMS Portal →</a>
            </div>
          </div>
          <div class="footer">
            Sent automatically by StackDrove HRMS • <a href="${appUrl}">Access Your Account</a><br>
            © ${new Date().getFullYear()} ${orgName}. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  const TEMPLATES = {
    // 1. Leave Templates
    LEAVE_SUBMITTED_TO_APPROVER: {
      subject: 'Action Required: Leave Application from {{employeeName}}',
      body: wrapTemplate_('New Leave Application Submitted', `
        <p>Hello,</p>
        <p><strong>{{employeeName}}</strong> has submitted a leave request that requires your review and approval.</p>
        <div class="card-box">
          <strong>Leave Type:</strong> {{leaveType}}<br>
          <strong>Dates:</strong> {{fromDate}} to {{toDate}} (<strong>{{dayCount}} day(s)</strong>)<br>
          <strong>Reason:</strong> {{reason}}
        </div>
        <p>Please log in to StackDrove HRMS to action this request.</p>
      `)
    },
    LEAVE_APPROVED: {
      subject: 'Approved: Your {{leaveType}} Leave Request ({{fromDate}} to {{toDate}})',
      body: wrapTemplate_('Leave Request Approved ✓', `
        <p>Hello,</p>
        <p>Great news! Your <strong>{{leaveType}} Leave</strong> request for <strong>{{fromDate}} to {{toDate}}</strong> has been approved by <strong>{{approverName}}</strong>.</p>
        <div class="card-box">
          <strong>Approver Remarks:</strong> {{remarks}}
        </div>
        <p>Your remaining leave balances have been updated automatically in your dashboard.</p>
      `)
    },
    LEAVE_REJECTED: {
      subject: 'Update: Your {{leaveType}} Leave Request ({{fromDate}} to {{toDate}})',
      body: wrapTemplate_('Leave Request Declined', `
        <p>Hello,</p>
        <p>Your <strong>{{leaveType}} Leave</strong> request for <strong>{{fromDate}} to {{toDate}}</strong> could not be approved at this time.</p>
        <div class="card-box">
          <strong>Actioned by:</strong> {{approverName}}<br>
          <strong>Reason / Remarks:</strong> {{remarks}}
        </div>
        <p>Please connect with your reporting manager for further alignment.</p>
      `)
    },

    // 2. Attendance & Regularization
    REGULARIZATION_REQUESTED: {
      subject: 'Attendance Regularization Request: {{employeeName}} ({{date}})',
      body: wrapTemplate_('Attendance Regularization Submitted', `
        <p>Hello,</p>
        <p><strong>{{employeeName}}</strong> has requested attendance regularization for <strong>{{date}}</strong>.</p>
        <div class="card-box">
          <strong>Reason:</strong> {{reason}}
        </div>
      `)
    },

    // 3. Welcome Onboarding
    WELCOME_ONBOARD: {
      subject: 'Welcome to the Team, {{employeeName}}! 🎉',
      body: wrapTemplate_('Welcome to StackDrove!', `
        <p>Dear <strong>{{employeeName}}</strong>,</p>
        <p>A very warm welcome to <strong>StackDrove Technologies</strong>! We are thrilled to have you with us.</p>
        <div class="card-box">
          <strong>Your Employee ID:</strong> {{empId}}<br>
          <strong>Joining Date:</strong> {{startDate}}<br>
          <strong>Reporting Manager:</strong> {{managerName}}
        </div>
        <p>Please log in to your employee portal to review company policies, submit initial information, and explore the team directory.</p>
      `)
    },

    // 4. Celebrations
    CELEBRATION_DIGEST: {
      subject: "Today's Celebrations at StackDrove! 🎂🎉",
      body: wrapTemplate_("Today's Company Celebrations", `
        <p>Here are today's birthdays and work anniversaries across our team:</p>
        <div class="card-box">
          {{celebrationsListHtml}}
        </div>
        <p>Don't forget to wish your colleagues a wonderful day!</p>
      `)
    },

    // 5. Policy Broadcast
    POLICY_PUBLISHED: {
      subject: 'Company Policy Update: {{policyTitle}}',
      body: wrapTemplate_('New Company Policy Released', `
        <p>Hello Team,</p>
        <p>A new or updated company policy <strong>"{{policyTitle}}"</strong> has been published in StackDrove HRMS.</p>
        <div class="card-box">
          <strong>Category:</strong> {{category}}<br>
          <strong>Effective Date:</strong> {{effectiveDate}}
        </div>
        <p>Please review the policy document and submit your mandatory digital acknowledgement.</p>
      `)
    },

    // 6. Resignation / Separation
    RESIGNATION_SUBMITTED: {
      subject: 'Urgent: Resignation Submitted by {{employeeName}}',
      body: wrapTemplate_('Resignation Notice Submitted', `
        <p>Hello,</p>
        <p><strong>{{employeeName}}</strong> has submitted a formal resignation request.</p>
        <div class="card-box">
          <strong>Proposed Last Working Day:</strong> {{proposedLWD}}<br>
          <strong>Reason:</strong> {{reason}}
        </div>
      `)
    },
    RESIGNATION_COMPLETED: {
      subject: 'Offboarding & Clearance Completed',
      body: wrapTemplate_('Exit Formalities Finalized', `
        <p>Hello,</p>
        <p>All exit clearance checklists and final dues have been processed for your separation. Your relieving letter is now available in your portal.</p>
        <div class="card-box">
          <strong>Final Last Working Day:</strong> {{lastWorkingDay}}
        </div>
      `)
    },

    // 7. Payslip Notification
    PAYSLIP_PUBLISHED: {
      subject: 'Your Payslip for {{month}} {{year}} is Ready',
      body: wrapTemplate_('Monthly Payslip Available', `
        <p>Hello,</p>
        <p>Your official salary slip for <strong>{{month}} {{year}}</strong> has been generated and is attached to this email. You can also view and download it at any time in your StackDrove HRMS portal.</p>
      `)
    },

    // 8. Official Letters
    LETTER_READY: {
      subject: 'Your Official Document: {{letterType}} (Ref: {{letterNumber}})',
      body: wrapTemplate_('Official Letter Generated', `
        <p>Hello,</p>
        <p>Your requested <strong>{{letterType}}</strong> (Ref No: <code>{{letterNumber}}</code>) has been generated and verified by the HR Department.</p>
        <p>A copy is attached to this email and archived in your employee records.</p>
      `)
    },
    LETTER_REQUESTED: {
      subject: 'Document Request: {{letterType}} by {{employeeName}}',
      body: wrapTemplate_('New Letter Request', `
        <p>Hello HR Team,</p>
        <p><strong>{{employeeName}}</strong> has requested an official <strong>{{letterType}}</strong>.</p>
      `)
    },

    // 9. Assets & Rewards
    ASSET_ASSIGNED: {
      subject: 'Equipment Allocation: {{assetTag}}',
      body: wrapTemplate_('Hardware Asset Assigned', `
        <p>Hello,</p>
        <p>A company asset (<strong>{{assetTag}}</strong> - {{category}}) has been assigned to your profile on {{assignedDate}}.</p>
      `)
    },
    REWARD_RECEIVED: {
      subject: '🌟 You received a recognition award: {{rewardTitle}}!',
      body: wrapTemplate_('Congratulations on Your Recognition!', `
        <p>Hello,</p>
        <p><strong>{{givenBy}}</strong> has awarded you a recognition on the StackDrove Wall of Fame!</p>
        <div class="card-box">
          <strong>Award:</strong> {{rewardTitle}}<br>
          <strong>Citation:</strong> "{{message}}"
        </div>
      `)
    },
    EXPENSE_SUBMITTED: {
      subject: 'Expense Claim Submitted: {{employeeName}} ({{amount}})',
      body: wrapTemplate_('New Reimbursement Claim', `
        <p>Hello,</p>
        <p><strong>{{employeeName}}</strong> has submitted a {{type}} claim of <strong>{{amount}}</strong> for <em>{{purpose}}</em>.</p>
      `)
    },
    BANK_DETAILS_UPDATED: {
      subject: 'Alert: Bank Account Updated by {{employeeName}}',
      body: wrapTemplate_('Bank Account Update Alert', `
        <p>Hello HR / Finance Team,</p>
        <p>{{message}}</p>
      `)
    },
    LEAVE_ESCALATION: {
      subject: 'Escalation: Pending Leave Request > 48 Hours',
      body: wrapTemplate_('Leave Request Escalation Notice', `
        <p>Hello HR Team,</p>
        <p>A leave request from <strong>{{employeeName}}</strong> assigned to <strong>{{approverName}}</strong> has been pending for <strong>{{pendingHours}} hours</strong> without action.</p>
      `)
    }
  };

  function getTemplate(key) {
    if (TEMPLATES[key]) return TEMPLATES[key];
    return {
      subject: 'StackDrove HRMS Notification',
      body: wrapTemplate_('Notification', '<p>You have a new update in StackDrove HRMS.</p>')
    };
  }

  return {
    getTemplate: getTemplate
  };
})();
