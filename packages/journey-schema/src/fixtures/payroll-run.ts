import type { Journey } from "../schema";

/**
 * Payroll run, made by the generator (/finx-generate) from a brief and acceptance criteria: an initiator pays the company's
 * employees for one pay period from a pasted file, checked row by row (on the register, once, within 1.5 x salary), sent for
 * approval as ONE run that always needs two approvers. A period can be run once until it is withdrawn or rejected. Its
 * acceptance criteria and scenarios travel with it; they pass on both corporate bank APIs.
 */
export const payrollRun = {
  "id": "jrn_payroll_run",
  "slug": "payroll-run",
  "name": "Payroll run",
  "version": 0,
  "status": "draft",
  "channels": [
    "web",
    "mobile"
  ],
  "apps": [
    "meezan"
  ],
  "locale": {
    "default": "en",
    "supported": [
      "en"
    ]
  },
  "entryScreen": "who",
  "acceptance": [
    {
      "id": "AC-1",
      "text": "When someone who is not an initiator (an approver, or someone the company does not know) tries to continue, then they see that only an initiator can send a payroll run; someone who has not said who they are is asked to; a person with both roles can continue"
    },
    {
      "id": "AC-2",
      "text": "When a customer who is not a company opens it, then they are told it is not available"
    },
    {
      "id": "AC-3",
      "text": "When the pay period is not written as YYYY-MM, then the journey asks for YYYY-MM; when it is not a real month or is later than this month, then the bank's reason is shown and the person stays on the first screen; this month or an earlier month is accepted"
    },
    {
      "id": "AC-4",
      "text": "When a payroll run for the period has already been started, then a new one for that period is refused with the bank's reason; when that run is withdrawn by the initiator or rejected by an approver, then the period is free again"
    },
    {
      "id": "AC-5",
      "text": "When the file is checked, then the person sees which rows will be paid and which are left out and why (not on the payroll register, paid twice, above 1.5 x monthly salary, invalid amount), and the total of only the rows that will be paid; only those rows are sent"
    },
    {
      "id": "AC-6",
      "text": "When an amount is exactly 1.5 x the employee's monthly salary, then it is paid; one rupee above, it is left out"
    },
    {
      "id": "AC-7",
      "text": "When no row can be paid, then the person is told so and cannot continue, and nothing is sent"
    },
    {
      "id": "AC-8",
      "text": "When a payroll run is checked or sent, then it says it needs 2 different approvers, even for a small total, and the bank records 2 as required"
    },
    {
      "id": "AC-9",
      "text": "When a payroll run is sent, then no money moves; after one approval it is still pending and no money moves; the second, different approver releases it and the money moves"
    },
    {
      "id": "AC-10",
      "text": "When a payroll run is sent, then its total counts once against the initiator's daily limit: rows each under the limit but together above it are refused with the reason and nothing is sent; a total exactly at the limit is sent"
    },
    {
      "id": "AC-11",
      "text": "When sending, then a correct six-digit one-time code is needed: a wrong or short code sends nothing, and three wrong codes end the journey with nothing sent"
    },
    {
      "id": "AC-12",
      "text": "When a payroll run waits for approval, then the approval list shows it as 'Payroll 2026-10 · N employees'"
    },
    {
      "id": "AC-13",
      "text": "(added) When the person has not ticked the confirmation, then the payroll run cannot be sent"
    }
  ],
  "scenarios": [
    {
      "id": "T-1",
      "name": "An approver is refused",
      "covers": [
        "AC-1"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "hassan"
          }
        },
        {
          "press": "Continue"
        },
        {
          "expectScreen": "denied"
        },
        {
          "expectText": "Only an initiator can send a payroll run"
        }
      ]
    },
    {
      "id": "T-2",
      "name": "Someone the company does not know is refused",
      "covers": [
        "AC-1"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "ghost"
          }
        },
        {
          "press": "Continue"
        },
        {
          "expectScreen": "denied"
        }
      ]
    },
    {
      "id": "T-3",
      "name": "Continuing without saying who you are is refused",
      "covers": [
        "AC-1"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "press": "Continue"
        },
        {
          "expectScreen": "who"
        },
        {
          "expectError": "session.userId"
        }
      ]
    },
    {
      "id": "T-4",
      "name": "A person with both roles can start a payroll run",
      "covers": [
        "AC-1"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "nadia"
          }
        },
        {
          "press": "Continue"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-5",
      "name": "A customer who is not a company is told it is not available",
      "covers": [
        "AC-2"
      ],
      "persona": "ayesha",
      "steps": [
        {
          "expectScreen": "unavailable"
        },
        {
          "expectText": "Not available for this customer"
        }
      ]
    },
    {
      "id": "T-6",
      "name": "A period not written as YYYY-MM is refused by the journey",
      "covers": [
        "AC-3"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "Oct 2026",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectError": "YYYY-MM"
        }
      ]
    },
    {
      "id": "T-7",
      "name": "A month that does not exist shows the bank's reason",
      "covers": [
        "AC-3"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-13",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectText": "Choose a pay period as YYYY-MM, not later than this month"
        }
      ]
    },
    {
      "id": "T-8",
      "name": "Next month shows the bank's reason",
      "covers": [
        "AC-3"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-12",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectText": "not later than this month"
        }
      ]
    },
    {
      "id": "T-9",
      "name": "This month is accepted",
      "covers": [
        "AC-3"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-11",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Nov"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "2026-11"
        }
      ]
    },
    {
      "id": "T-10",
      "name": "A period already started is refused with the bank's reason",
      "covers": [
        "AC-4"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "setup": [
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payroll.submit",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "period": "2026-10",
            "file": "emp_ali,180000,Oct"
          },
          "saveAs": "p"
        }
      ],
      "steps": [
        {
          "set": {
            "session.userId": "omar"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_sana,240000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectToast": "The payroll was not accepted"
        },
        {
          "expectText": "Payroll for 2026-10 has already been started"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-11",
      "name": "A withdrawn run frees the period",
      "covers": [
        "AC-4"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "setup": [
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payroll.submit",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "period": "2026-10",
            "file": "emp_ali,180000,Oct"
          },
          "saveAs": "p"
        },
        {
          "adapter": "corp.payments.withdraw",
          "input": {
            "userId": "sara",
            "paymentId": "{{setup.p.id}}"
          }
        }
      ],
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectText": "Payroll 2026-10 · 1 employee"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.p.id}}"
            },
            "path": "status",
            "equals": "rejected"
          }
        }
      ]
    },
    {
      "id": "T-12",
      "name": "A run rejected by an approver frees the period",
      "covers": [
        "AC-4"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "setup": [
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payroll.submit",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "period": "2026-10",
            "file": "emp_ali,180000,Oct"
          },
          "saveAs": "p"
        },
        {
          "adapter": "corp.payments.reject",
          "input": {
            "userId": "hassan",
            "paymentId": "{{setup.p.id}}",
            "reason": "Wrong amounts"
          }
        }
      ],
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "1 of 1 rows"
        }
      ]
    },
    {
      "id": "T-13",
      "name": "Each row left out is listed with why",
      "covers": [
        "AC-5"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "employee,amount,reference\nemp_ali,180000,Oct\nemp_sana,360001,Oct\nemp_zzz,1000,Oct\nemp_bilal,abc,Oct\nemp_ali,1000,Bonus\nemp_hina,320000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "2 of 6 rows"
        },
        {
          "expectText": "PKR 500,000"
        },
        {
          "expectText": "4 row(s) cannot be paid"
        },
        {
          "press": "Row 1: Ali Hamdan · will be paid"
        },
        {
          "expectScreen": "start"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 6: Hina Rauf · will be paid"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 2: Sana Malik · More than 1.5 times this employee's monthly salary"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 3: emp_zzz · Not on the company's payroll register"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 4: Bilal Ahmed · The amount is not valid for this account's currency"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 5: Ali Hamdan · This employee is already on the file"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-14",
      "name": "A zero and a negative amount are each invalid",
      "covers": [
        "AC-5"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,0,Oct\nemp_sana,-100,Oct\nemp_bilal,150000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "1 of 3 rows"
        },
        {
          "expectText": "PKR 150,000"
        },
        {
          "press": "Row 1: Ali Hamdan · The amount is not valid for this account's currency"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 2: Sana Malik · The amount is not valid for this account's currency"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-15",
      "name": "Only the rows that pass are sent, and the total counts once",
      "covers": [
        "AC-5",
        "AC-10"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "employee,amount,reference\nemp_ali,180000,Oct\nemp_sana,360001,Oct\nemp_zzz,1000,Oct\nemp_bilal,abc,Oct\nemp_ali,1000,Bonus\nemp_hina,320000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "expectText": "4 row(s)"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectText": "Payroll 2026-10 · 2 employees totalling PKR 500,000"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{pay.result.id}}"
            },
            "path": "amount",
            "equals": 500000
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 500000
          }
        }
      ]
    },
    {
      "id": "T-16",
      "name": "Exactly 1.5 x salary is paid, one rupee above is left out",
      "covers": [
        "AC-6"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,270000,Oct\nemp_bilal,225001,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "1 of 2 rows"
        },
        {
          "expectText": "PKR 270,000"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectText": "Payroll 2026-10 · 1 employee totalling PKR 270,000"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{pay.result.id}}"
            },
            "path": "amount",
            "equals": 270000
          }
        }
      ]
    },
    {
      "id": "T-17",
      "name": "One rupee above 1.5 x salary is left out with the reason",
      "covers": [
        "AC-6"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_hina,480001,Oct\nemp_sana,360000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "1 of 2 rows"
        },
        {
          "expectText": "PKR 360,000"
        },
        {
          "press": "Row 1: Hina Rauf · More than 1.5 times this employee's monthly salary"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-18",
      "name": "When no row can be paid the person is told and cannot continue",
      "covers": [
        "AC-7"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_zzz,5000,Oct\nemp_ali,abc,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "0 of 2 rows"
        },
        {
          "expectText": "No row in this file can be paid"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "expectScreen": "nothing"
        },
        {
          "expectText": "nothing to send for approval"
        },
        {
          "press": "Fix the file"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-19",
      "name": "A small run still needs 2 different approvers and moves no money when sent",
      "covers": [
        "AC-8",
        "AC-9"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_bilal,1000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 1,000"
        },
        {
          "expectText": "2 different approvers"
        },
        {
          "expectText": "always needs 2 different approvers"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "expectText": "2 different approvers"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectText": "now waits for 2 different approvers"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{pay.result.id}}"
            },
            "path": "required",
            "equals": 2
          }
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{pay.result.id}}"
            },
            "path": "status",
            "equals": "pending_approval"
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "accounts.acme_ops.balance",
            "equals": 25000000
          }
        }
      ]
    },
    {
      "id": "T-20",
      "name": "After one approval a small run is still pending and no money moves",
      "covers": [
        "AC-8",
        "AC-9"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "setup": [
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payroll.submit",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "period": "2026-10",
            "file": "emp_bilal,1000,Oct"
          },
          "saveAs": "p"
        },
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payments.approve",
          "input": {
            "userId": "hassan",
            "paymentId": "{{setup.p.id}}"
          }
        }
      ],
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.p.id}}"
            },
            "path": "status",
            "equals": "pending_approval"
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "accounts.acme_ops.balance",
            "equals": 25000000
          }
        }
      ]
    },
    {
      "id": "T-21",
      "name": "The second, different approver releases it and the money moves",
      "covers": [
        "AC-9"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "setup": [
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payroll.submit",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "period": "2026-10",
            "file": "emp_ali,180000,Oct\nemp_sana,240000,Oct"
          },
          "saveAs": "p"
        },
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payments.approve",
          "input": {
            "userId": "hassan",
            "paymentId": "{{setup.p.id}}"
          }
        },
        {
          "adapter": "bank.otp.send"
        },
        {
          "adapter": "bank.otp.verify",
          "input": {
            "code": "482100"
          }
        },
        {
          "adapter": "corp.payments.approve",
          "input": {
            "userId": "layla",
            "paymentId": "{{setup.p.id}}"
          }
        }
      ],
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.p.id}}"
            },
            "path": "status",
            "equals": "released"
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "accounts.acme_ops.balance",
            "equals": 24580000
          }
        }
      ]
    },
    {
      "id": "T-22",
      "name": "Rows each under the daily limit but together above it are refused",
      "covers": [
        "AC-10"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "omar"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct\nemp_sana,240000,Oct\nemp_bilal,150000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 570,000"
        },
        {
          "expectText": "above what you can still send today"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "daily limit"
        },
        {
          "expectText": "No money has left the account"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "accounts.acme_ops.balance",
            "equals": 25000000
          }
        }
      ]
    },
    {
      "id": "T-23",
      "name": "A total exactly at the daily limit is sent",
      "covers": [
        "AC-10"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "omar"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,260000,Oct\nemp_sana,240000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 500,000"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "me.usedToday",
            "equals": 500000
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "me.remainingToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-24",
      "name": "A wrong code sends nothing",
      "covers": [
        "AC-11"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "999999"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "otp"
        },
        {
          "expectToast": "Incorrect code"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-25",
      "name": "Three wrong codes end it with nothing sent",
      "covers": [
        "AC-11"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "999999"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "Nothing was sent for approval"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "accounts.acme_ops.balance",
            "equals": 25000000
          }
        }
      ]
    },
    {
      "id": "T-26",
      "name": "A code that is not six digits is refused",
      "covers": [
        "AC-11"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "123"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "otp"
        },
        {
          "expectError": "otp.code"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-27",
      "name": "Approvers see the run as 'Payroll 2026-10 · 3 employees'",
      "covers": [
        "AC-12"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct\nemp_sana,240000,Oct\nemp_bilal,150000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "pay.consent": true
          }
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and send for approval"
        },
        {
          "expectScreen": "success"
        },
        {
          "expectText": "Payroll 2026-10 · 3 employees"
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{pay.result.id}}"
            },
            "path": "payee",
            "equals": "Payroll 2026-10 · 3 employees"
          }
        }
      ]
    },
    {
      "id": "T-28",
      "name": "It cannot be sent without the confirmation",
      "covers": [
        "AC-13"
      ],
      "persona": "acme",
      "now": "2026-11-03T10:00:00Z",
      "steps": [
        {
          "set": {
            "session.userId": "sara"
          }
        },
        {
          "press": "Continue"
        },
        {
          "set": {
            "pay.period": "2026-10",
            "pay.fromAccountId": "acme_ops",
            "pay.file": "emp_ali,180000,Oct"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "press": "Confirm and send OTP"
        },
        {
          "expectScreen": "review"
        },
        {
          "expectError": "confirmation"
        }
      ]
    }
  ],
  "authorisation": {
    "role": "initiator",
    "rolesFrom": "ctx.company.me.roles",
    "deniedScreen": "denied"
  },
  "dataModel": {
    "session.userId": {
      "type": "string",
      "required": true
    },
    "pay.period": {
      "type": "string",
      "required": true
    },
    "pay.fromAccountId": {
      "type": "string",
      "required": true
    },
    "pay.file": {
      "type": "string",
      "required": true
    },
    "pay.go": {
      "type": "boolean"
    },
    "pay.consent": {
      "type": "boolean",
      "required": true
    },
    "otp.code": {
      "type": "string",
      "required": true,
      "pattern": "^[0-9]{6}$"
    }
  },
  "integrations": [
    {
      "id": "people",
      "adapter": "corp.users.list",
      "mode": "sandbox"
    },
    {
      "id": "company",
      "adapter": "corp.company.get",
      "mode": "sandbox"
    },
    {
      "id": "checkPayroll",
      "adapter": "corp.payroll.check",
      "mode": "sandbox"
    },
    {
      "id": "otpSend",
      "adapter": "bank.otp.send",
      "mode": "sandbox"
    },
    {
      "id": "otpVerify",
      "adapter": "bank.otp.verify",
      "mode": "sandbox"
    },
    {
      "id": "submitPayroll",
      "adapter": "corp.payroll.submit",
      "mode": "sandbox"
    }
  ],
  "screens": [
    {
      "id": "who",
      "title": "Sign in",
      "onEnter": [
        {
          "type": "callApi",
          "integration": "people",
          "saveAs": "ctx.people",
          "onError": {
            "navigate": "unavailable"
          }
        }
      ],
      "blocks": [
        {
          "type": "text",
          "text": "Pay this month's salaries",
          "variant": "title"
        },
        {
          "type": "alert",
          "tone": "info",
          "text": "Sandbox: choose who you are. A real bank app already knows who signed in."
        },
        {
          "type": "select",
          "bind": "session.userId",
          "label": "I am",
          "source": "ctx.people",
          "variant": "rows"
        },
        {
          "type": "button",
          "label": "Continue",
          "variant": "primary",
          "actions": [
            {
              "type": "validate"
            },
            {
              "type": "callApi",
              "integration": "company",
              "input": {
                "userId": "{{session.userId}}"
              },
              "saveAs": "ctx.company",
              "onError": {
                "showToast": "We couldn't load your company. Try again.",
                "stay": true
              }
            },
            {
              "type": "navigate",
              "to": "start"
            }
          ]
        }
      ],
      "navigation": {
        "rules": [
          {
            "when": "isEmpty(ctx.company.me)",
            "to": "denied"
          }
        ]
      }
    },
    {
      "id": "start",
      "title": "Payroll file",
      "blocks": [
        {
          "type": "stepper",
          "steps": [
            "start",
            "check",
            "review",
            "otp"
          ]
        },
        {
          "type": "textInput",
          "bind": "pay.period",
          "label": "Pay period (YYYY-MM)",
          "placeholder": "2026-10",
          "pattern": "^[0-9]{4}-[0-9]{2}$",
          "patternMessage": "Enter the pay period as YYYY-MM, for example 2026-10"
        },
        {
          "type": "accountPicker",
          "bind": "pay.fromAccountId",
          "source": "ctx.company.accounts",
          "showBalance": true
        },
        {
          "type": "textInput",
          "bind": "pay.file",
          "label": "Payroll file",
          "placeholder": "emp_ali,180000,Salary October",
          "lines": 8,
          "pattern": "^[\\s\\S]*\\S[\\s\\S]*$",
          "patternMessage": "Paste the payroll file first: one row per employee"
        },
        {
          "type": "text",
          "text": "One row per employee: employee,amount,reference. Up to 50 rows. Only employees on the payroll register can be paid, once each, and at most 1.5 times their monthly salary.",
          "variant": "caption"
        },
        {
          "visibleWhen": "ctx.error.code == 'INVALID_PERIOD' || ctx.error.code == 'PAYROLL_ALREADY_RUN'",
          "type": "alert",
          "tone": "error",
          "text": "{{ctx.error.message}}"
        },
        {
          "visibleWhen": "ctx.error.code == 'EMPTY_BATCH'",
          "type": "alert",
          "tone": "error",
          "text": "The file has no employee rows. Add at least one row: employee,amount,reference."
        },
        {
          "visibleWhen": "ctx.error.code == 'BATCH_TOO_LARGE'",
          "type": "alert",
          "tone": "error",
          "text": "The file has more than 50 rows. Split it into files of 50 rows or fewer."
        },
        {
          "type": "button",
          "label": "Check",
          "variant": "primary",
          "actions": [
            {
              "type": "validate"
            },
            {
              "type": "setData",
              "path": "pay.go",
              "value": false
            },
            {
              "type": "setData",
              "path": "ctx.error",
              "value": null
            },
            {
              "type": "callApi",
              "integration": "checkPayroll",
              "input": {
                "userId": "{{session.userId}}",
                "fromAccountId": "{{pay.fromAccountId}}",
                "period": "{{pay.period}}",
                "file": "{{pay.file}}"
              },
              "saveAs": "ctx.check",
              "onError": {
                "showToast": "The payroll was not accepted",
                "stay": true
              }
            },
            {
              "type": "navigate",
              "to": "check"
            }
          ]
        },
        {
          "type": "button",
          "label": "Close",
          "variant": "secondary",
          "actions": [
            {
              "type": "exit"
            }
          ]
        }
      ]
    },
    {
      "id": "check",
      "title": "Check the payroll",
      "blocks": [
        {
          "type": "reviewSummary",
          "rows": [
            {
              "label": "Pay period",
              "value": "{{ctx.check.period}}"
            },
            {
              "label": "Will be paid",
              "value": "{{ctx.check.validCount}} of {{ctx.check.validCount + ctx.check.invalidCount}} rows"
            },
            {
              "label": "Total",
              "value": "{{ctx.check.total | money:ctx.check.currency}}"
            },
            {
              "label": "Approvers needed",
              "value": "{{ctx.check.requiredApprovers}} different approvers"
            }
          ]
        },
        {
          "type": "text",
          "text": "A payroll run always needs 2 different approvers, whatever its total.",
          "variant": "caption"
        },
        {
          "visibleWhen": "ctx.check.invalidCount > 0 && ctx.check.validCount > 0",
          "type": "alert",
          "tone": "warning",
          "text": "{{ctx.check.invalidCount}} row(s) cannot be paid and will be left out. Fix the file and check again, or continue with only the rows that pass."
        },
        {
          "visibleWhen": "ctx.check.validCount == 0",
          "type": "alert",
          "tone": "error",
          "text": "No row in this file can be paid. Fix the file and check again."
        },
        {
          "type": "sectionHeader",
          "title": "Rows in the file"
        },
        {
          "type": "menu",
          "source": "ctx.check.lines",
          "item": {
            "label": "Row {{item.n}}: {{item.payee}} · {{item.ok ? 'will be paid' : 'left out'}}",
            "text": "Amount {{item.amount}} · reference {{item.reference}}",
            "icon": "user",
            "actions": [
              {
                "type": "setData",
                "path": "pay.go",
                "value": false
              },
              {
                "type": "navigate",
                "to": "start"
              }
            ]
          }
        },
        {
          "visibleWhen": "ctx.check.invalidCount > 0",
          "type": "sectionHeader",
          "title": "Rows left out and why"
        },
        {
          "visibleWhen": "ctx.check.invalidCount > 0",
          "type": "menu",
          "source": "ctx.check.problems",
          "item": {
            "label": "Row {{item.n}}: {{item.payee}} · {{item.message}}",
            "text": "Amount {{item.amount}} · reference {{item.reference}}",
            "icon": "shield",
            "actions": [
              {
                "type": "setData",
                "path": "pay.go",
                "value": false
              },
              {
                "type": "navigate",
                "to": "start"
              }
            ]
          }
        },
        {
          "visibleWhen": "ctx.check.validCount > 0 && ctx.check.total > ctx.company.me.remainingToday",
          "type": "alert",
          "tone": "warning",
          "text": "The total is above what you can still send today ({{ctx.company.me.remainingToday | money:ctx.company.currency}}). The bank will refuse it: take some rows out first."
        },
        {
          "type": "button",
          "label": "Continue with the rows that pass",
          "variant": "primary",
          "actions": [
            {
              "type": "setData",
              "path": "pay.go",
              "value": true
            },
            {
              "type": "navigate",
              "to": "review"
            }
          ]
        },
        {
          "type": "button",
          "label": "Fix the file",
          "variant": "secondary",
          "actions": [
            {
              "type": "setData",
              "path": "pay.go",
              "value": false
            },
            {
              "type": "navigate",
              "to": "start"
            }
          ]
        }
      ],
      "navigation": {
        "rules": [
          {
            "when": "pay.go && ctx.check.validCount == 0",
            "to": "nothing"
          }
        ]
      }
    },
    {
      "id": "nothing",
      "title": "Nothing to pay",
      "kind": "branch",
      "blocks": [
        {
          "type": "alert",
          "tone": "error",
          "text": "No row in this file can be paid, so there is nothing to send for approval. Fix the file and check again."
        },
        {
          "type": "button",
          "label": "Fix the file",
          "variant": "primary",
          "actions": [
            {
              "type": "setData",
              "path": "pay.go",
              "value": false
            },
            {
              "type": "navigate",
              "to": "start"
            }
          ]
        }
      ]
    },
    {
      "id": "review",
      "title": "Review payroll run",
      "blocks": [
        {
          "type": "reviewSummary",
          "rows": [
            {
              "label": "Pay period",
              "value": "{{ctx.check.period}}"
            },
            {
              "label": "From",
              "value": "{{ctx.company.accounts[pay.fromAccountId].name}} {{ctx.company.accounts[pay.fromAccountId].maskedNumber}}"
            },
            {
              "label": "Employees paid",
              "value": "{{ctx.check.validCount}}"
            },
            {
              "label": "Total",
              "value": "{{ctx.check.total | money:ctx.check.currency}}"
            },
            {
              "label": "Left out",
              "value": "{{ctx.check.invalidCount}} row(s)"
            },
            {
              "label": "Approvers needed",
              "value": "{{ctx.check.requiredApprovers}} different approvers"
            }
          ]
        },
        {
          "type": "alert",
          "tone": "info",
          "text": "The whole payroll is sent for approval as one run and counts once against your and the company's daily limits. It needs 2 different approvers. No money moves until the second one approves."
        },
        {
          "type": "consent",
          "bind": "pay.consent",
          "termsVersion": "corporate-payroll-v1",
          "text": "I confirm the salaries in this payroll are correct",
          "validation": {
            "mustBeTrue": true,
            "messages": {
              "mustBeTrue": "Tick the confirmation first"
            }
          }
        },
        {
          "type": "button",
          "label": "Confirm and send OTP",
          "variant": "primary",
          "actions": [
            {
              "type": "validate"
            },
            {
              "type": "callApi",
              "integration": "otpSend",
              "input": {
                "channel": "sms"
              },
              "saveAs": "ctx.otp",
              "onError": {
                "showToast": "We couldn't send the code. Try again.",
                "stay": true
              }
            },
            {
              "type": "navigate",
              "to": "otp"
            }
          ]
        },
        {
          "type": "button",
          "label": "Back",
          "variant": "secondary",
          "actions": [
            {
              "type": "setData",
              "path": "pay.go",
              "value": false
            },
            {
              "type": "navigate",
              "to": "check"
            }
          ]
        }
      ]
    },
    {
      "id": "otp",
      "title": "Verify",
      "blocks": [
        {
          "type": "otp",
          "bind": "otp.code",
          "length": 6,
          "maxAttempts": 3,
          "resendAfterSeconds": 60,
          "hint": "Enter the code sent to {{ctx.otp.maskedPhone}}",
          "onResend": [
            {
              "type": "callApi",
              "integration": "otpSend",
              "input": {
                "channel": "sms"
              },
              "saveAs": "ctx.otp",
              "onError": {
                "showToast": "We couldn't send a new code. Try again.",
                "stay": true
              }
            }
          ]
        },
        {
          "type": "button",
          "label": "Verify and send for approval",
          "variant": "primary",
          "actions": [
            {
              "type": "validate"
            },
            {
              "type": "callApi",
              "integration": "otpVerify",
              "input": {
                "code": "{{otp.code}}"
              },
              "onError": {
                "showToast": "Incorrect code",
                "stay": true,
                "lockAfter": 3,
                "lockTo": "failed"
              }
            },
            {
              "type": "callApi",
              "integration": "submitPayroll",
              "input": {
                "userId": "{{session.userId}}",
                "fromAccountId": "{{pay.fromAccountId}}",
                "period": "{{pay.period}}",
                "file": "{{pay.file}}"
              },
              "saveAs": "pay.result",
              "onError": {
                "navigate": "failed"
              }
            },
            {
              "type": "navigate",
              "to": "success"
            }
          ]
        }
      ]
    },
    {
      "id": "success",
      "title": "Sent for approval",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "success",
          "title": "Sent for approval",
          "text": "{{pay.result.payee}} totalling {{pay.result.amount | money:pay.result.currency}} now waits for {{pay.result.required}} different approvers. Nothing has left the account yet.",
          "meta": "Payment {{pay.result.id}} · value date {{pay.result.valueDate}}"
        },
        {
          "type": "button",
          "label": "Done",
          "variant": "primary",
          "actions": [
            {
              "type": "exit"
            }
          ]
        }
      ]
    },
    {
      "id": "failed",
      "title": "Payroll not sent",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "error",
          "title": "Payroll not sent",
          "text": "{{ctx.error.message}}"
        },
        {
          "type": "text",
          "text": "Nothing was sent for approval. No money has left the account.",
          "variant": "caption"
        },
        {
          "type": "button",
          "label": "Try again",
          "variant": "primary",
          "actions": [
            {
              "type": "setData",
              "path": "pay.go",
              "value": false
            },
            {
              "type": "navigate",
              "to": "start"
            }
          ]
        },
        {
          "type": "button",
          "label": "Close",
          "variant": "secondary",
          "actions": [
            {
              "type": "exit"
            }
          ]
        }
      ]
    },
    {
      "id": "unavailable",
      "title": "Not available",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "error",
          "title": "Not available for this customer",
          "text": "Payroll runs are only for company customers. {{ctx.error.message}}"
        },
        {
          "type": "button",
          "label": "Try again",
          "variant": "primary",
          "actions": [
            {
              "type": "navigate",
              "to": "who"
            }
          ]
        },
        {
          "type": "button",
          "label": "Close",
          "variant": "secondary",
          "actions": [
            {
              "type": "exit"
            }
          ]
        }
      ]
    },
    {
      "id": "denied",
      "title": "Not allowed",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "error",
          "title": "You can't do this",
          "text": "Only an initiator can send a payroll run."
        },
        {
          "type": "button",
          "label": "Close",
          "variant": "primary",
          "actions": [
            {
              "type": "exit"
            }
          ]
        }
      ]
    }
  ]
} as unknown as Journey;
