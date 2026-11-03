import type { HeroProps } from "../props";

/** The bank's banner: its logo (or its name) on the bank's colour. */
export function Hero({ name, logo }: HeroProps) {
  return <div className="fxc-hero">{logo ? <img className="fxc-hero-logo" src={logo} alt={name} /> : <span className="fxc-hero-name">{name}</span>}</div>;
}
