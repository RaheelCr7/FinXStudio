import { cardPictureDigits } from "@finx/renderer-core";

/** The card picture that fills in as a card is typed. Decorative: the same details are in the form fields. */
export function CardVisual({ number, holder, expiry, network = "mastercard", balance }: { number: string; holder: string; expiry: string; network?: string; balance?: string }) {
  return (
    <div className="fx-card-visual" aria-hidden>
      <div className="fx-card-top">
        {network === "visa" ? <span className="fx-card-visa">VISA</span> : <span className="fx-card-mc"><i /><i /></span>}
        <span className="fx-card-kind">{network === "visa" ? "Credit" : "Mastercard"}</span>
      </div>
      {balance ? <div><div className="fx-card-small">Balance</div><div className="fx-card-balance">{balance}</div></div> : null}
      <div>
        <div className="fx-card-digits">{cardPictureDigits(number)}</div>
        <div className="fx-card-bottom"><span>{holder || "CARD HOLDER"}</span><span>{expiry || "MM/YY"}</span></div>
      </div>
    </div>
  );
}
