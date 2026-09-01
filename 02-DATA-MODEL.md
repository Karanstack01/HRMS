# 02 — Data Model (Google Sheets as DB)

Spreadsheet file: **StackDrove-DB**. One tab per entity below. Row 1 = headers (frozen). Column A always the primary key unless noted.

## Sheet: `Directory` (Employee Master)
| Col | Field | Type | Notes |
|---|---|---|---|
| A | empId | text | e.g. `SD-0001`, auto-generated |
| B | fullName | text | |
| C | email | text | matches Workspace login |
| D | phone | text | |
| E | photoUrl | text | Drive file URL |
| F | department | text | |
| G | designation | text | |
| H | role | enum | admin / hr / manager / employee |
| I | managerId | text | FK → Directory.empId |
| J | dateOfJoining | date | |
| K | dateOfBirth | date | |
| L | employmentType | enum | full-time / contract / intern |
| M | status | enum | active / resigned / terminated / on-notice |
| N | location | text | office/branch |
| O | reportingLocation | text | remote/hybrid/onsite |
| P | ctcAnnual | number | masked field |
| Q | emergencyContact | text | |
| R | address | text | |
| S | bloodGroup | text | |
| T | dateOfExit | date | nullable |
| U | createdAt / updatedAt | datetime | |

## Sheet: `Attendance_<YEAR>` (one per year)
| Col | Field | Notes |
|---|---|---|
| A | recordId | uuid |
| B | empId | FK |
| C | date | yyyy-mm-dd |
| D | punchInTime | datetime, nullable |
| E | punchOutTime | datetime, nullable |
| F | punchInLoc | lat,long or "Office WiFi" tag |
| G | punchOutLoc | |
| H | workedHours | computed |
| I | status | Present / Absent / Half-Day / On-Leave / Holiday / Weekend / WFH |
| J | lateBy | minutes |
| K | earlyLeaveBy | minutes |
| L | regularizationRequested | bool |
| M | regularizationReason | text |
| N | approvedBy | empId, nullable |
| O | source | Web / Mobile / Kiosk / Admin-Manual |
| P | remarks | text |

## Sheet: `LeaveRequests`
| Col | Field | Notes |
|---|---|---|
| A | leaveId | uuid |
| B | empId | FK |
| C | leaveType | Casual / Sick / Earned / Maternity / Paternity / Unpaid / Compensatory |
| D | fromDate | date |
| E | toDate | date |
| F | dayCount | computed (accounts for sandwich rule + holidays) |
| G | isHalfDay | bool |
| H | halfSession | AM/PM/null |
| I | reason | text |
| J | status | Pending / Approved / Rejected / Cancelled / Withdrawn |
| K | appliedOn | datetime |
| L | approverEmpId | FK (resolved manager at time of apply) |
| M | actionedOn | datetime |
| N | actionRemarks | text |
| O | attachmentUrl | Drive link (medical cert etc.) |
| P | rowVersion | timestamp for optimistic locking |

## Sheet: `LeaveBalances`
| empId | leaveType | opening | accrued | used | adjusted | balance | year |

Balances are **derived + cached**: recomputed by trigger nightly and on every approve/reject/cancel action (not on every page load).

## Sheet: `Holidays`
| holidayId | date | name | type (National/Restricted/Regional) | applicableLocations | isOptional |

## Sheet: `Policies`
| policyId | title | category | fileUrl (PDF in Drive) | version | effectiveFrom | acknowledgementRequired (bool) | createdBy |

## Sheet: `PolicyAcknowledgements`
| empId | policyId | acknowledgedOn |

## Sheet: `Assets`
| assetId | assetTag | category | brand/model | serialNumber | purchaseDate | warrantyExpiry | condition | status (In Stock/Assigned/Under Repair/Retired) | assignedTo (empId) | assignedOn | returnedOn | value | remarks |

## Sheet: `AssetRequests`
| requestId | empId | assetCategory | reason | status (Pending/Approved/Rejected/Fulfilled) | requestedOn | actionedBy | actionedOn |

## Sheet: `Rewards`
| rewardId | empId | category (Employee of the Month/Spot Award/Milestone/Peer Nomination) | title | description | points | givenBy | givenOn | badgeIcon | isPublic (bool, shows on wall of fame) |

## Sheet: `Appraisals`
| appraisalId | empId | cycle (e.g. H1-2026) | selfRating | managerRating | finalRating | goals (JSON) | competencyScores (JSON) | managerComments | hrComments | status (Self-Pending/Manager-Pending/HR-Review/Completed) | createdOn | completedOn |

## Sheet: `TravelExpense`
| requestId | empId | type (Travel/Expense) | purpose | fromDate | toDate | fromCity | toCity | estimatedCost | advanceRequested | status (Pending/Approved/Rejected/Reimbursed) | approverEmpId | actionedOn |

## Sheet: `ExpenseItems` (line items per request)
| itemId | requestId | category (Travel/Lodging/Food/Misc) | date | amount | billUrl | remarks |

## Sheet: `Letters`
| letterId | empId | type (Offer/Appointment/Confirmation/Experience/Relieving/Salary Certificate/NOC/Custom) | requestedOn | status (Requested/Generated/Delivered) | generatedFileUrl | generatedOn | generatedBy | letterNumber |

## Sheet: `Payroll`
| payrollId | empId | month | year | basic | hra | allowances (JSON) | grossPay | deductions (JSON: PF/PT/TDS/Loan) | netPay | payslipUrl | status (Draft/Processed/Paid) | processedOn | processedBy |
| Bank fields (accountNo masked, ifsc) pulled from Directory at generation time, snapshotted (so historic payslips don't change if employee updates bank later)

## Sheet: `Resignations`
| resignationId | empId | submittedOn | lastWorkingDay (proposed) | reason | noticePeriodDays | status (Submitted/Manager-Review/HR-Review/Approved/Withdrawn/Completed) | lwdFinal | clearanceChecklist (JSON: assets returned, knowledge transfer, dues cleared, exit interview) | approvedBy | fnfSettled (bool) |

## Sheet: `EmailQueue`
| queueId | priority (1-Urgent, 2-Digest, 3-Bulk) | toEmail | templateKey | payloadJson | status (Pending/Sent/Failed) | queuedAt | sentAt | retryCount | errorMsg |

## Sheet: `AuditLog`
| logId | timestamp | actorEmpId | action | module | recordId | requestId(idempotency) | oldValue(JSON) | newValue(JSON) |

## Sheet: `Config` (key-value, read via PropertiesService fallback or directly)
| key | value(JSON) | e.g. `WORKING_DAYS`, `SANDWICH_LEAVE_RULE`, `LEAVE_POLICY`, `ORG_NAME`, `WEEKENDS` |

## Relationships Diagram (textual)
```
Directory (1) ──< Attendance (many)
Directory (1) ──< LeaveRequests (many) ──> LeaveBalances (1 per empId+type+year)
Directory (1) ──< Assets (assignedTo)
Directory (1) ──< Rewards
Directory (1) ──< Appraisals
Directory (1) ──< TravelExpense ──< ExpenseItems
Directory (1) ──< Letters
Directory (1) ──< Payroll
Directory (1) ──< Resignations
Directory.managerId ──self-reference for approval routing
```
