import type { Block, Journey, Screen } from "../schema";
import { transferTypesAcceptance, transferTypesScenarios } from "./transfer-types-tests";
import { button, denied, go, lacks, route, set, text } from "./accounts-kit";

/** One way to send money, shown when the bank has it on; it opens the journey that sends that way. */
const card = (id: string, label: string, line: string, when: string, open: { journey: string; type?: string }): Block => ({
  type: "menu", visibleWhen: when,
  items: [{ id, label, text: line, actions: [{ type: "navigate", toJourney: open.journey, ...(open.type ? { with: { "launch.type": open.type } } : {}) }] }],
});
const columns = [{ key: "speed", label: "Speed" }, { key: "arrives", label: "Arrives" }, { key: "fee", label: "Fee" }, { key: "limit", label: "Limit" }];
const NONE = "opt.typeOwn == false && opt.typeInternal == false && opt.typeDomestic == false && opt.typeIntl == false";

/**
 * Ways to send money (BankWorkx, Personal: Payments). One screen that lists the ways to send money the bank has on (between my accounts, to a BankWorkx
 * customer, to another bank, to another country), says how fast each is, and shows the speeds the bank offers for another bank and another country: when
 * it arrives, the fee and the limit. A row opens the journey that sends that way (Send money with the type already chosen). It moves no money and asks for no code.
 *
 * Built from the spec of the prototype with the blocks FinX has: "Between my accounts" opens its own journey (own-transfer) because Send money has no such
 * type here, and the speeds come from the bank (bank.payments.speeds) for the bank's home market. The type options are those of Send money (opt.typeInternal,
 * opt.typeDomestic, opt.typeIntl) and the speeds opt.speedStandard, opt.speedSameDay, opt.speedInstant and opt.speedPriority; opt.typeOwn is this journey's.
 */
export const transferTypes: Journey = {
  id: "jrn_bankworkx_transfer_types",
  slug: "transfer-types",
  name: "Ways to send money",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: transferTypesAcceptance,
  scenarios: transferTypesScenarios,
  dataModel: {
    "opt.typeOwn": { type: "boolean" },
    "opt.typeInternal": { type: "boolean" },
    "opt.typeDomestic": { type: "boolean" },
    "opt.typeIntl": { type: "boolean" },
    "opt.speedStandard": { type: "boolean" },
    "opt.speedSameDay": { type: "boolean" },
    "opt.speedInstant": { type: "boolean" },
    "opt.speedPriority": { type: "boolean" },
  },
  integrations: [{ id: "speeds", adapter: "bank.payments.speeds", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Ways to send money", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        {
          type: "callApi", integration: "speeds", saveAs: "ctx.speeds", onError: { navigate: "loadFail" },
          input: { standard: "{{opt.speedStandard != false}}", sameDay: "{{opt.speedSameDay != false}}", instant: "{{opt.speedInstant != false}}", priority: "{{opt.speedPriority == true}}" },
        },
        go("ways"),
      ],
      navigation: route([lacks("payments.create"), "denied"], [NONE, "empty"]),
      blocks: [],
    },
    {
      id: "ways", title: "Ways to send money",
      blocks: [
        text("Ways to send money", "title"),
        card("own", "Between my accounts", "Instant", "opt.typeOwn != false", { journey: "own-transfer" }),
        card("internal", "To a BankWorkx® customer", "Instant, free", "opt.typeInternal != false", { journey: "personal-transfer", type: "internal" }),
        card("domestic", "To another bank", "{{ctx.speeds.domesticLine}}", "opt.typeDomestic != false", { journey: "personal-transfer", type: "domestic" }),
        card("international", "To another country", "{{ctx.speeds.internationalLine}}", "opt.typeIntl != false", { journey: "personal-transfer", type: "international" }),
        { type: "sectionHeader", title: "Speeds, to another bank", visibleWhen: "opt.typeDomestic != false && len(ctx.speeds.domestic) > 0" },
        { type: "dataTable", source: "ctx.speeds.domestic", label: "Speeds, to another bank", columns, rowKey: "id", visibleWhen: "opt.typeDomestic != false && len(ctx.speeds.domestic) > 0" },
        { type: "sectionHeader", title: "Speeds, to another country", visibleWhen: "opt.typeIntl != false && len(ctx.speeds.international) > 0" },
        { type: "dataTable", source: "ctx.speeds.international", label: "Speeds, to another country", columns, rowKey: "id", visibleWhen: "opt.typeIntl != false && len(ctx.speeds.international) > 0" },
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "empty", title: "Ways to send money",
      blocks: [
        text("Nothing is switched on", "title"),
        text("Sending money isn’t available right now.", "body"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Ways to send money",
      blocks: [
        text("We couldn’t load the ways to send money. Nothing was changed.", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("This service is not available right now. Nothing was changed. Please try again in a few minutes.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Ways to send money"),
  ] as Screen[],
};
