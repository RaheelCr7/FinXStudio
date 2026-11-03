/** What a sandbox bank answers when it refuses: a code a journey can route on, and words a person can read. */
export class BankError extends Error {
  constructor(public code: string, message: string, public attempt?: number) {
    super(message);
    this.name = "BankError";
  }
}
