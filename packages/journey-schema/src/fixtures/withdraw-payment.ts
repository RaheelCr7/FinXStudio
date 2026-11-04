import type { Journey } from "../schema";

/**
 * Withdraw a payment, made by the generator (/finx-generate): the person who started a corporate payment takes it back while it
 * waits for approval, with a one-time code. Its acceptance criteria and scenarios travel with it and pass on both bank APIs.
 */
export const withdrawPayment = {
  "id": "jrn_withdraw_a_payment",
  "slug": "withdraw-a-payment",
  "name": "Withdraw a payment",
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
      "text": "When someone who is not an initiator, or who has not said who they are, tries to continue, then they cannot: a non-initiator is told only the person who started a payment can withdraw it, and someone who has not chosen who they are is asked to"
    },
    {
      "id": "AC-2",
      "text": "When an initiator opens it, then only the payments they started that are still waiting for approval are listed (not others' payments, not released or closed ones), and the screen says so when there are none"
    },
    {
      "id": "AC-3",
      "text": "When the initiator withdraws a payment, then a correct six-digit one-time code is needed; with a wrong or short code the payment keeps waiting, and after three wrong codes the journey ends without withdrawing"
    },
    {
      "id": "AC-4",
      "text": "When a payment is withdrawn (even one that one of two approvers has already approved), then it is closed, no money moves, and its amount comes back to the initiator's daily limit"
    },
    {
      "id": "AC-5",
      "text": "When the payment is already closed (released, rejected or withdrawn), then it cannot be withdrawn: the person is told it was not withdrawn and nothing changes"
    },
    {
      "id": "AC-6",
      "text": "When a customer who is not a company opens it, then they are told it is not available"
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
            "amount": 250000,
            "reference": "INV-9"
          },
          "saveAs": "p"
        }
      ],
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
          "expectText": "Only the person who started a payment"
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
        },
        {
          "expectText": "Only the person who started a payment"
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
      "name": "A person with both roles sees their own waiting payment",
      "covers": [
        "AC-2"
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
            "userId": "nadia",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "MINE"
          },
          "saveAs": "p"
        }
      ],
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
        },
        {
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "expectText": "MINE"
        }
      ]
    },
    {
      "id": "T-5",
      "name": "Someone else's waiting payment is not listed",
      "covers": [
        "AC-2"
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
            "amount": 250000,
            "reference": "SARAS"
          },
          "saveAs": "p"
        }
      ],
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
        },
        {
          "expectText": "Nothing you started is waiting for approval"
        }
      ]
    },
    {
      "id": "T-6",
      "name": "A payment already released is not listed",
      "covers": [
        "AC-2"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "expectScreen": "start"
        },
        {
          "expectText": "Nothing you started is waiting for approval"
        }
      ]
    },
    {
      "id": "T-7",
      "name": "When nothing is waiting the screen says so",
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
          "expectScreen": "start"
        },
        {
          "expectText": "Nothing you started is waiting for approval"
        }
      ]
    },
    {
      "id": "T-8",
      "name": "Someone else's payment cannot be withdrawn even by its id",
      "covers": [
        "AC-2"
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
            "amount": 250000,
            "reference": "SARAS"
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "nadia",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "MINE"
          },
          "saveAs": "q"
        }
      ],
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
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "set": {
            "wd.paymentId": "{{setup.p.id}}"
          }
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "expectScreen": "otp"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "The payment was not withdrawn"
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
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.q.id}}"
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
            "path": "me.usedToday",
            "equals": 250000
          }
        }
      ]
    },
    {
      "id": "T-9",
      "name": "A wrong code does not withdraw it",
      "covers": [
        "AC-3"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "press": "PKR 250,000 to Nile Logistics"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "expectScreen": "otp"
        },
        {
          "set": {
            "otp.code": "999999"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "otp"
        },
        {
          "expectToast": "Incorrect code"
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
            "path": "me.usedToday",
            "equals": 250000
          }
        }
      ]
    },
    {
      "id": "T-10",
      "name": "Three wrong codes end it and the payment keeps waiting",
      "covers": [
        "AC-3"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "press": "PKR 250,000 to Nile Logistics"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "999999"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "The payment was not withdrawn"
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
            "path": "me.usedToday",
            "equals": 250000
          }
        }
      ]
    },
    {
      "id": "T-11",
      "name": "A code that is not six digits is refused",
      "covers": [
        "AC-3"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "press": "PKR 250,000 to Nile Logistics"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "12"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "otp"
        },
        {
          "expectError": "otp.code"
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
      "id": "T-12",
      "name": "Withdrawing closes the payment and gives the limit back",
      "covers": [
        "AC-4",
        "AC-3"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "press": "PKR 250,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "expectText": "INV-9"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "withdrawn"
        },
        {
          "expectText": "can no longer be approved"
        },
        {
          "expectText": "You can still start PKR 3,000,000 today"
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
        },
        {
          "press": "Back to the list"
        },
        {
          "expectText": "Nothing you started is waiting for approval"
        }
      ]
    },
    {
      "id": "T-13",
      "name": "A payment one approver has approved can still be withdrawn",
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 2000000,
            "reference": "BIG"
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
          "press": "PKR 2,000,000 to Nile Logistics"
        },
        {
          "expectText": "1 of 2"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "withdrawn"
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
      "id": "T-14",
      "name": "Only the withdrawn amount comes back; the other payment keeps waiting",
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 250000,
            "reference": "INV-9"
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "INV-10"
          },
          "saveAs": "q"
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
          "press": "PKR 250,000 to Nile Logistics"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "withdrawn"
        },
        {
          "expectText": "You can still start PKR 2,900,000 today"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "sara"
            },
            "path": "me.usedToday",
            "equals": 100000
          }
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
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.q.id}}"
            },
            "path": "status",
            "equals": "pending_approval"
          }
        },
        {
          "press": "Back to the list"
        },
        {
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "expectText": "INV-10"
        }
      ]
    },
    {
      "id": "T-15",
      "name": "Withdrawing a payment at the full daily limit gives the whole limit back",
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "omar",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 500000,
            "reference": "FULL"
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
          "press": "PKR 500,000 to Nile Logistics"
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "withdrawn"
        },
        {
          "expectText": "You can still start PKR 500,000 today"
        },
        {
          "expectBank": {
            "adapter": "corp.company.get",
            "input": {
              "userId": "omar"
            },
            "path": "me.remainingToday",
            "equals": 500000
          }
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
      "id": "T-16",
      "name": "A payment already released cannot be withdrawn",
      "covers": [
        "AC-5"
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
            "amount": 250000,
            "reference": "INV-9"
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "INV-10"
          },
          "saveAs": "q"
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
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "set": {
            "wd.paymentId": "{{setup.p.id}}"
          }
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "The payment was not withdrawn"
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
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.q.id}}"
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
            "path": "me.usedToday",
            "equals": 350000
          }
        }
      ]
    },
    {
      "id": "T-17",
      "name": "A payment an approver rejected cannot be withdrawn",
      "covers": [
        "AC-5"
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
            "amount": 250000,
            "reference": "INV-9"
          },
          "saveAs": "p"
        },
        {
          "adapter": "corp.payments.reject",
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "INV-10"
          },
          "saveAs": "q"
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
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "set": {
            "wd.paymentId": "{{setup.p.id}}"
          }
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "The payment was not withdrawn"
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
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.q.id}}"
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
            "path": "me.usedToday",
            "equals": 100000
          }
        }
      ]
    },
    {
      "id": "T-18",
      "name": "A payment already withdrawn cannot be withdrawn twice",
      "covers": [
        "AC-5"
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
            "amount": 250000,
            "reference": "INV-9"
          },
          "saveAs": "p"
        },
        {
          "adapter": "corp.payments.withdraw",
          "input": {
            "userId": "sara",
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
          "adapter": "corp.payments.initiate",
          "input": {
            "userId": "sara",
            "fromAccountId": "acme_ops",
            "beneficiaryId": "sup_logistics",
            "amount": 100000,
            "reference": "INV-10"
          },
          "saveAs": "q"
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
          "press": "PKR 100,000 to Nile Logistics"
        },
        {
          "expectScreen": "review"
        },
        {
          "set": {
            "wd.paymentId": "{{setup.p.id}}"
          }
        },
        {
          "press": "Withdraw and send code"
        },
        {
          "set": {
            "otp.code": "482100"
          }
        },
        {
          "press": "Verify and withdraw"
        },
        {
          "expectScreen": "failed"
        },
        {
          "expectText": "The payment was not withdrawn"
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
        },
        {
          "expectBank": {
            "adapter": "corp.payments.get",
            "input": {
              "paymentId": "{{setup.q.id}}"
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
            "path": "me.usedToday",
            "equals": 100000
          }
        }
      ]
    },
    {
      "id": "T-19",
      "name": "A customer who is not a company is told it is not available",
      "covers": [
        "AC-6"
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
    "wd.paymentId": {
      "type": "string",
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
      "id": "pending",
      "adapter": "corp.payments.pending",
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
      "id": "withdraw",
      "adapter": "corp.payments.withdraw",
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
          "text": "Withdraw a payment",
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
      "title": "Waiting for approval",
      "onEnter": [
        {
          "type": "callApi",
          "integration": "pending",
          "input": {
            "userId": "{{session.userId}}",
            "as": "initiator"
          },
          "saveAs": "ctx.pending",
          "onError": {
            "navigate": "unavailable"
          }
        }
      ],
      "blocks": [
        {
          "type": "text",
          "text": "Payments you started that are waiting for approval. You can withdraw one before it is approved.",
          "variant": "caption"
        },
        {
          "visibleWhen": "len(ctx.pending) == 0",
          "type": "text",
          "text": "Nothing you started is waiting for approval."
        },
        {
          "type": "menu",
          "source": "ctx.pending",
          "item": {
            "label": "{{item.amount | money:item.currency}} to {{ctx.company.beneficiaries[item.beneficiaryId].name}}",
            "text": "{{item.reference}} · {{len(item.approvals)}} of {{item.required}} approved",
            "icon": "send",
            "actions": [
              {
                "type": "setData",
                "path": "wd.paymentId",
                "value": "{{item.id}}"
              },
              {
                "type": "navigate",
                "to": "review"
              }
            ]
          }
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
      "id": "review",
      "title": "Withdraw payment",
      "blocks": [
        {
          "type": "reviewSummary",
          "rows": [
            {
              "label": "From",
              "value": "{{ctx.company.accounts[ctx.pending[wd.paymentId].fromAccountId].name}} {{ctx.company.accounts[ctx.pending[wd.paymentId].fromAccountId].maskedNumber}}"
            },
            {
              "label": "To",
              "value": "{{ctx.company.beneficiaries[ctx.pending[wd.paymentId].beneficiaryId].name}}"
            },
            {
              "label": "Amount",
              "value": "{{ctx.pending[wd.paymentId].amount | money:ctx.pending[wd.paymentId].currency}}"
            },
            {
              "label": "Reference",
              "value": "{{ctx.pending[wd.paymentId].reference}}"
            },
            {
              "label": "Approved so far",
              "value": "{{len(ctx.pending[wd.paymentId].approvals)}} of {{ctx.pending[wd.paymentId].required}}"
            },
            {
              "label": "Value date",
              "value": "{{ctx.pending[wd.paymentId].valueDate}}"
            }
          ]
        },
        {
          "type": "alert",
          "tone": "warning",
          "text": "Once withdrawn, the payment can no longer be approved, even if an approver has already approved it. To pay this supplier you would start a new payment."
        },
        {
          "type": "button",
          "label": "Withdraw and send code",
          "variant": "primary",
          "actions": [
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
          "label": "Keep it",
          "variant": "secondary",
          "actions": [
            {
              "type": "navigate",
              "to": "start"
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
          "label": "Verify and withdraw",
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
              "integration": "withdraw",
              "input": {
                "userId": "{{session.userId}}",
                "paymentId": "{{wd.paymentId}}"
              },
              "saveAs": "wd.result",
              "onError": {
                "navigate": "failed"
              }
            },
            {
              "type": "navigate",
              "to": "withdrawn"
            }
          ]
        }
      ]
    },
    {
      "id": "withdrawn",
      "title": "Withdrawn",
      "kind": "terminal",
      "onEnter": [
        {
          "type": "callApi",
          "integration": "company",
          "input": {
            "userId": "{{session.userId}}"
          },
          "saveAs": "ctx.company",
          "onError": {
            "showToast": "We couldn't refresh your daily limit.",
            "stay": true
          }
        }
      ],
      "blocks": [
        {
          "type": "result",
          "tone": "success",
          "title": "Payment withdrawn",
          "text": "{{wd.result.amount | money:wd.result.currency}} to {{ctx.company.beneficiaries[wd.result.beneficiaryId].name}} can no longer be approved. No money has left the account."
        },
        {
          "type": "text",
          "text": "The amount has been given back to your daily limit. You can still start {{ctx.company.me.remainingToday | money:ctx.company.currency}} today."
        },
        {
          "type": "button",
          "label": "Back to the list",
          "variant": "primary",
          "actions": [
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
      "id": "failed",
      "title": "Not withdrawn",
      "kind": "terminal",
      "blocks": [
        {
          "type": "result",
          "tone": "error",
          "title": "The payment was not withdrawn",
          "text": "{{ctx.error.message}}"
        },
        {
          "type": "text",
          "text": "Nothing has changed. If an approver has already released or rejected it, it can no longer be withdrawn.",
          "variant": "caption"
        },
        {
          "type": "button",
          "label": "Back to the list",
          "variant": "primary",
          "actions": [
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
          "text": "{{ctx.error.message}}"
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
          "text": "Only the person who started a payment can withdraw it."
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
