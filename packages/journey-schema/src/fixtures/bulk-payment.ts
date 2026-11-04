import type { Journey } from "../schema";

/**
 * Bulk payment, made by the generator (/finx-generate) from a brief and acceptance criteria: an initiator pays many approved
 * suppliers from a pasted file, checked row by row, sent for approval as ONE payment. Its acceptance criteria and scenarios
 * travel with it; they pass on both corporate bank APIs.
 */
export const bulkPayment = {
  "id": "jrn_bulk_payment",
  "slug": "bulk-payment",
  "name": "Bulk payment",
  "version": 1,
  "status": "published",
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
      "text": "When someone who is not an initiator, or who has not said who they are, tries to continue, then they cannot: a non-initiator is told only an initiator can send a bulk payment, and someone who has not chosen who they are is asked to"
    },
    {
      "id": "AC-2",
      "text": "When the file is empty (nothing pasted, only spaces, or only a header row) or has more than 50 rows, then Check refuses it with a clear message and the person stays on the file screen; exactly 50 rows is accepted"
    },
    {
      "id": "AC-3",
      "text": "When the file is checked, then every row is checked and each row that fails is listed with its row number and why: not on the approved list, invalid amount, or a duplicate of an earlier row"
    },
    {
      "id": "AC-4",
      "text": "When the file is checked, then the person sees how many rows will be paid, their total and how many approvers it needs: 1 up to 1,000,000 and 2 above it; they can fix the file and check again"
    },
    {
      "id": "AC-5",
      "text": "When no row can be paid, then the person cannot continue; when some rows fail, they can continue and only the rows that pass are sent"
    },
    {
      "id": "AC-6",
      "text": "When sending, then a correct six-digit one-time code is needed; a wrong or short code sends nothing, and three wrong codes end the journey with nothing sent"
    },
    {
      "id": "AC-7",
      "text": "When the bulk payment is sent, then the whole file counts as one payment against the person's daily limit (and the company's); when the bank refuses it (limit, funds, currency), the reason is shown and no money moves and nothing is sent for approval"
    },
    {
      "id": "AC-8",
      "text": "When a customer who is not a company opens it, then they are told it is not available"
    },
    {
      "id": "AC-9",
      "text": "(added) When the person has not ticked the confirmation, then the bulk payment cannot be sent"
    },
    {
      "id": "AC-10",
      "text": "(added) When a bulk payment is sent after the cut-off, then it goes out on the next working day and the person is told the date; before the cut-off it goes out the same day"
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
          "expectText": "Only an initiator"
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
      "name": "Nothing pasted is refused",
      "covers": [
        "AC-2"
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
            "bulk.fromAccountId": "acme_ops"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectError": "bulk.file"
        }
      ]
    },
    {
      "id": "T-5",
      "name": "A file of only spaces is refused",
      "covers": [
        "AC-2"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "   \n   "
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectError": "Paste the payment file first"
        }
      ]
    },
    {
      "id": "T-6",
      "name": "A file with only a header row is refused",
      "covers": [
        "AC-2"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "beneficiary,amount,reference"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectText": "The file has no payment rows"
        }
      ]
    },
    {
      "id": "T-7",
      "name": "A file of 51 rows is refused",
      "covers": [
        "AC-2"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,1000,R1\nsup_textile,1000,R2\nsup_textile,1000,R3\nsup_textile,1000,R4\nsup_textile,1000,R5\nsup_textile,1000,R6\nsup_textile,1000,R7\nsup_textile,1000,R8\nsup_textile,1000,R9\nsup_textile,1000,R10\nsup_textile,1000,R11\nsup_textile,1000,R12\nsup_textile,1000,R13\nsup_textile,1000,R14\nsup_textile,1000,R15\nsup_textile,1000,R16\nsup_textile,1000,R17\nsup_textile,1000,R18\nsup_textile,1000,R19\nsup_textile,1000,R20\nsup_textile,1000,R21\nsup_textile,1000,R22\nsup_textile,1000,R23\nsup_textile,1000,R24\nsup_textile,1000,R25\nsup_textile,1000,R26\nsup_textile,1000,R27\nsup_textile,1000,R28\nsup_textile,1000,R29\nsup_textile,1000,R30\nsup_textile,1000,R31\nsup_textile,1000,R32\nsup_textile,1000,R33\nsup_textile,1000,R34\nsup_textile,1000,R35\nsup_textile,1000,R36\nsup_textile,1000,R37\nsup_textile,1000,R38\nsup_textile,1000,R39\nsup_textile,1000,R40\nsup_textile,1000,R41\nsup_textile,1000,R42\nsup_textile,1000,R43\nsup_textile,1000,R44\nsup_textile,1000,R45\nsup_textile,1000,R46\nsup_textile,1000,R47\nsup_textile,1000,R48\nsup_textile,1000,R49\nsup_textile,1000,R50\nsup_textile,1000,R51"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "start"
        },
        {
          "expectText": "more than 50 rows"
        }
      ]
    },
    {
      "id": "T-8",
      "name": "A file of exactly 50 rows is accepted",
      "covers": [
        "AC-2",
        "AC-4"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,1000,R1\nsup_textile,1000,R2\nsup_textile,1000,R3\nsup_textile,1000,R4\nsup_textile,1000,R5\nsup_textile,1000,R6\nsup_textile,1000,R7\nsup_textile,1000,R8\nsup_textile,1000,R9\nsup_textile,1000,R10\nsup_textile,1000,R11\nsup_textile,1000,R12\nsup_textile,1000,R13\nsup_textile,1000,R14\nsup_textile,1000,R15\nsup_textile,1000,R16\nsup_textile,1000,R17\nsup_textile,1000,R18\nsup_textile,1000,R19\nsup_textile,1000,R20\nsup_textile,1000,R21\nsup_textile,1000,R22\nsup_textile,1000,R23\nsup_textile,1000,R24\nsup_textile,1000,R25\nsup_textile,1000,R26\nsup_textile,1000,R27\nsup_textile,1000,R28\nsup_textile,1000,R29\nsup_textile,1000,R30\nsup_textile,1000,R31\nsup_textile,1000,R32\nsup_textile,1000,R33\nsup_textile,1000,R34\nsup_textile,1000,R35\nsup_textile,1000,R36\nsup_textile,1000,R37\nsup_textile,1000,R38\nsup_textile,1000,R39\nsup_textile,1000,R40\nsup_textile,1000,R41\nsup_textile,1000,R42\nsup_textile,1000,R43\nsup_textile,1000,R44\nsup_textile,1000,R45\nsup_textile,1000,R46\nsup_textile,1000,R47\nsup_textile,1000,R48\nsup_textile,1000,R49\nsup_textile,1000,R50"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "50 of 50 rows"
        },
        {
          "expectText": "PKR 50,000"
        }
      ]
    },
    {
      "id": "T-9",
      "name": "Each failing row is listed with why",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "beneficiary,amount,reference\nsup_textile,100000,INV-1\nsup_unknown,5000,INV-2\nsup_logistics,abc,INV-3\nsup_textile,100000,INV-1\nsup_packaging,50000,INV-4"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "2 of 5 rows"
        },
        {
          "expectText": "3 row(s) cannot be paid"
        },
        {
          "press": "Row 2: sup_unknown · Not on the company's approved list"
        },
        {
          "expectScreen": "start"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 3: Nile Logistics · The amount is not valid for this account's currency"
        },
        {
          "expectScreen": "start"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 4: Atlas Textiles · Same payee, amount and reference as an earlier line"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-10",
      "name": "A zero, a negative and a too-precise amount are each invalid",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,0,A\nsup_logistics,-500,B\nsup_packaging,10.123,C\nsup_packaging,10.12,D"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "1 of 4 rows"
        },
        {
          "expectText": "PKR 10.12"
        },
        {
          "press": "Row 1: Atlas Textiles · The amount is not valid for this account's currency"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 2: Nile Logistics · The amount is not valid for this account's currency"
        },
        {
          "press": "Check"
        },
        {
          "press": "Row 3: Dubai Packaging · The amount is not valid for this account's currency"
        },
        {
          "expectScreen": "start"
        }
      ]
    },
    {
      "id": "T-11",
      "name": "The person fixes the file and checks again",
      "covers": [
        "AC-4"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1\nsup_unknown,5000,INV-2"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "1 of 2 rows"
        },
        {
          "press": "Fix the file"
        },
        {
          "expectScreen": "start"
        },
        {
          "set": {
            "bulk.file": "sup_textile,100000,INV-1\nsup_logistics,250000,INV-2\nsup_packaging,50000,INV-3"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectScreen": "check"
        },
        {
          "expectText": "3 of 3 rows"
        },
        {
          "expectText": "PKR 400,000"
        },
        {
          "expectText": "1 approver(s)"
        }
      ]
    },
    {
      "id": "T-12",
      "name": "A clean file is sent for approval as one payment that moves no money",
      "covers": [
        "AC-4",
        "AC-6",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1\nsup_logistics,250000,INV-2\nsup_packaging,50000,INV-3"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "3 of 3 rows"
        },
        {
          "expectText": "PKR 400,000"
        },
        {
          "expectText": "1 approver(s)"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "expectScreen": "review"
        },
        {
          "set": {
            "bulk.consent": true,
            "bulk.reference": "Suppliers November"
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
          "expectText": "3 payments totalling PKR 400,000"
        },
        {
          "expectText": "1 approver(s) as one bulk payment"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 400000
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
      "id": "T-13",
      "name": "Exactly 1,000,000 needs one approver",
      "covers": [
        "AC-4"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,600000,A\nsup_logistics,400000,B"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 1,000,000"
        },
        {
          "expectText": "1 approver(s)"
        }
      ]
    },
    {
      "id": "T-14",
      "name": "Above 1,000,000 needs two approvers, and the bank agrees",
      "covers": [
        "AC-4"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,600000,A\nsup_logistics,400001,B"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 1,000,001"
        },
        {
          "expectText": "2 approver(s)"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "bulk.consent": true
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
          "expectText": "2 approver(s) as one bulk payment"
        }
      ]
    },
    {
      "id": "T-15",
      "name": "When no row can be paid the person cannot continue",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_unknown,5000,INV-1\nsup_textile,abc,INV-2"
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
      "id": "T-16",
      "name": "Only the rows that pass are sent",
      "covers": [
        "AC-5",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "beneficiary,amount,reference\nsup_textile,100000,INV-1\nsup_unknown,5000,INV-2\nsup_logistics,abc,INV-3\nsup_textile,100000,INV-1\nsup_packaging,50000,INV-4"
          }
        },
        {
          "press": "Check"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "expectText": "3 row(s)"
        },
        {
          "set": {
            "bulk.consent": true
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
          "expectText": "2 payments totalling PKR 150,000"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 150000
          }
        }
      ]
    },
    {
      "id": "T-17",
      "name": "A wrong code sends nothing",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
            "bulk.consent": true
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
      "id": "T-18",
      "name": "Three wrong codes end it with nothing sent",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
            "bulk.consent": true
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
      "id": "T-19",
      "name": "A code that is not six digits is refused",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
            "bulk.consent": true
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
      "id": "T-20",
      "name": "The file counts as one payment against the daily limit: two rows each under it, together over it, are refused",
      "covers": [
        "AC-7"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,300000,A\nsup_logistics,300000,B"
          }
        },
        {
          "press": "Check"
        },
        {
          "expectText": "PKR 600,000"
        },
        {
          "expectText": "above what you can still send today"
        },
        {
          "press": "Continue with the rows that pass"
        },
        {
          "set": {
            "bulk.consent": true
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
      "id": "T-21",
      "name": "A file exactly at the daily limit is sent",
      "covers": [
        "AC-7"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,250000,A\nsup_logistics,250000,B"
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
            "bulk.consent": true
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
            "path": "me.remainingToday",
            "equals": 0
          }
        }
      ]
    },
    {
      "id": "T-22",
      "name": "Earlier payments today count: a file that takes the person over the limit is refused",
      "covers": [
        "AC-7"
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 2700000,
            "reference": "EARLIER"
          },
          "saveAs": "p"
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,A\nsup_packaging,250000,B"
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
            "bulk.consent": true
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
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 2700000
          }
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
        }
      ]
    },
    {
      "id": "T-23",
      "name": "A file paid from a dollar account is refused with the reason",
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
            "bulk.fromAccountId": "acme_usd",
            "bulk.file": "sup_textile,100,A"
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
            "bulk.consent": true
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
          "expectText": "choose a PKR account"
        },
        {
          "expectText": "No money has left the account"
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
            "path": "accounts.acme_usd.balance",
            "equals": 120000
          }
        }
      ]
    },
    {
      "id": "T-24",
      "name": "A customer who is not a company is told it is not available",
      "covers": [
        "AC-8"
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
      "id": "T-25",
      "name": "It cannot be sent without the confirmation",
      "covers": [
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
    },
    {
      "id": "T-26",
      "name": "After the cut-off it goes out the next working day",
      "covers": [
        "AC-10"
      ],
      "persona": "acme",
      "now": "2026-11-03T17:00:00Z",
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
            "bulk.consent": true
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
          "expectText": "value date 2026-11-04"
        },
        {
          "expectText": "after the cut-off, so it goes out on 2026-11-04"
        }
      ]
    },
    {
      "id": "T-27",
      "name": "Before the cut-off it goes out the same day",
      "covers": [
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
            "bulk.fromAccountId": "acme_ops",
            "bulk.file": "sup_textile,100000,INV-1"
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
            "bulk.consent": true
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
          "expectText": "value date 2026-11-03"
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
    "bulk.fromAccountId": {
      "type": "string",
      "required": true
    },
    "bulk.file": {
      "type": "string",
      "required": true
    },
    "bulk.go": {
      "type": "boolean"
    },
    "bulk.reference": {
      "type": "string"
    },
    "bulk.consent": {
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
      "id": "checkBulk",
      "adapter": "corp.bulk.check",
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
      "id": "submitBulk",
      "adapter": "corp.bulk.submit",
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
          "text": "Pay many suppliers at once",
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
      "title": "Payment file",
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
          "type": "accountPicker",
          "bind": "bulk.fromAccountId",
          "source": "ctx.company.accounts",
          "showBalance": true
        },
        {
          "type": "textInput",
          "bind": "bulk.file",
          "label": "Payment file",
          "placeholder": "sup_textile,250000,INV-1001",
          "lines": 8,
          "pattern": "^[\\s\\S]*\\S[\\s\\S]*$",
          "patternMessage": "Paste the payment file first: one row per payment"
        },
        {
          "type": "text",
          "text": "One row per payment: beneficiary,amount,reference. Up to 50 rows. Only suppliers on the company's approved list can be paid.",
          "variant": "caption"
        },
        {
          "visibleWhen": "ctx.error.code == 'EMPTY_BATCH'",
          "type": "alert",
          "tone": "error",
          "text": "The file has no payment rows. Add at least one row: beneficiary,amount,reference."
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
              "path": "bulk.go",
              "value": false
            },
            {
              "type": "setData",
              "path": "ctx.error",
              "value": null
            },
            {
              "type": "callApi",
              "integration": "checkBulk",
              "input": {
                "userId": "{{session.userId}}",
                "fromAccountId": "{{bulk.fromAccountId}}",
                "file": "{{bulk.file}}"
              },
              "saveAs": "ctx.check",
              "onError": {
                "showToast": "The file was not accepted",
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
      "title": "Check the file",
      "blocks": [
        {
          "type": "reviewSummary",
          "rows": [
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
              "value": "{{ctx.check.requiredApprovers}} approver(s)"
            }
          ]
        },
        {
          "visibleWhen": "ctx.check.requiredApprovers > 1",
          "type": "text",
          "text": "Above {{ctx.company.dualApprovalAbove | money:ctx.company.currency}} a bulk payment needs two approvers.",
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
          "visibleWhen": "ctx.check.invalidCount > 0",
          "type": "sectionHeader",
          "title": "Rows that cannot be paid"
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
                "path": "bulk.go",
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
              "path": "bulk.go",
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
              "path": "bulk.go",
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
            "when": "bulk.go && ctx.check.validCount == 0",
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
              "path": "bulk.go",
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
      "title": "Review bulk payment",
      "blocks": [
        {
          "type": "reviewSummary",
          "rows": [
            {
              "label": "From",
              "value": "{{ctx.company.accounts[bulk.fromAccountId].name}} {{ctx.company.accounts[bulk.fromAccountId].maskedNumber}}"
            },
            {
              "label": "Payments",
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
              "value": "{{ctx.check.requiredApprovers}} approver(s)"
            }
          ]
        },
        {
          "type": "textInput",
          "bind": "bulk.reference",
          "label": "Name for this batch (optional)",
          "placeholder": "Suppliers November"
        },
        {
          "type": "alert",
          "tone": "info",
          "text": "The whole file is sent for approval as one payment and counts as one payment against your and the company's daily limits. No money moves until it is approved."
        },
        {
          "type": "consent",
          "bind": "bulk.consent",
          "termsVersion": "corporate-bulk-v1",
          "text": "I confirm the payments in this file are correct",
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
              "path": "bulk.go",
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
              "integration": "submitBulk",
              "input": {
                "userId": "{{session.userId}}",
                "fromAccountId": "{{bulk.fromAccountId}}",
                "file": "{{bulk.file}}",
                "reference": "{{bulk.reference}}"
              },
              "saveAs": "bulk.result",
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
          "text": "{{bulk.result.payee}} totalling {{bulk.result.amount | money:bulk.result.currency}} now wait for {{bulk.result.required}} approver(s) as one bulk payment. Nothing has left the account yet.",
          "meta": "Payment {{bulk.result.id}} · value date {{bulk.result.valueDate}}"
        },
        {
          "visibleWhen": "bulk.result.afterCutoff",
          "type": "alert",
          "tone": "info",
          "text": "It was started after the cut-off, so it goes out on {{bulk.result.valueDate}}."
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
      "title": "Bulk payment not sent",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "error",
          "title": "Bulk payment not sent",
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
              "path": "bulk.go",
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
          "text": "Bulk payments are only for company customers. {{ctx.error.message}}"
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
          "text": "Only an initiator can send a bulk payment."
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
