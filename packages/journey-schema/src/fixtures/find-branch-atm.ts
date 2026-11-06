import type { Journey, Screen } from "../schema";
import { findBranchAtmAcceptance, findBranchAtmScenarios } from "./find-branch-atm-tests";
import { alert, answerRules, button, downScreens, go, note, route, set, text, weekRows } from "./public-kit";

const err = (e: string) => `lb.err == '${e}'`;
/** The kind the journey opens on: branches, cash machines (only when the bank shows them) or everything. */
const OPEN_ON = "{{launch.kind == 'branch' ? 'branch' : launch.kind == 'atm' && opt.showAtms != false ? 'atm' : 'all'}}";
/** What every search sends: the words, the kind, the Open now switch and whether the journey shows cash machines (the bank has the last word). */
const SEARCH_INPUT = { query: "{{lb.query}}", kind: "{{lb.kind}}", openNow: "{{lb.openNow}}", offerOpenNow: "{{opt.openNow != false}}", showAtms: "{{opt.showAtms != false}}" };
const SEARCH = { type: "callApi" as const, integration: "search", input: SEARCH_INPUT, saveAs: "lb.found", onError: { navigate: "fail" } };
/** A place picked from the list or the map: the bank gives its hours and services, then its details open. */
const pick = (id: string) => [set("lb.placeId", id), { type: "callApi" as const, integration: "place", input: { placeId: id }, saveAs: "lb.detail", onError: { navigate: "fail" } }, go("details")];

/**
 * Find a branch or ATM (BankWorkx, Public: before sign-in). Search places by area or street, narrow them by kind and by open now, see them on a simple map and in a list nearest
 * first, open one for its hours and services, and hand over to the phone's maps app for directions. Whether a place is open is worked out by the bank from its hours and its clock.
 * No location is asked for and nothing about the person is kept.
 *
 * Built from the spec of the prototype with the blocks FinX has: the list follows a *Search* button (the engine has no live redraw while typing); a row is one line with the distance, the
 * address, the chip and the status (the engine cannot put a chip inside a row); the maps app is not opened (there is no link action), the result says so and names the place.
 */
export const findBranchAtm: Journey = {
  id: "jrn_bankworkx_find_branch_atm",
  slug: "find-branch-atm",
  name: "Find a branch or ATM",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: findBranchAtmAcceptance,
  scenarios: findBranchAtmScenarios,
  dataModel: {
    "launch.kind": { type: "string" },
    "opt.showAtms": { type: "boolean" },
    "opt.openNow": { type: "boolean" },
    "lb.query": { type: "string", pattern: "^.{0,60}$" },
    "lb.kind": { type: "string" },
    "lb.openNow": { type: "boolean" },
    "lb.placeId": { type: "string" },
    "lb.err": { type: "string" },
    "lb.msg": { type: "string" },
  },
  integrations: [
    { id: "search", adapter: "bank.locations.search", mode: "sandbox" },
    { id: "place", adapter: "bank.locations.details", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Find a branch or ATM", kind: "branch",
      onEnter: [
        set("lb.err", ""), set("lb.msg", ""), set("lb.query", ""), set("lb.openNow", false), set("lb.placeId", ""), set("ctx.error", null), set("lb.kind", OPEN_ON),
        SEARCH, set("lb.kind", "{{lb.found.kind}}"), go("search"),
      ],
      blocks: [],
    },
    {
      id: "search", title: "Find a branch or ATM",
      blocks: [
        text("Find a branch or ATM", "title"),
        alert("error", "No places match. Try another search.", err("none")),
        alert("error", "{{lb.msg}}", err("place")),
        { type: "textInput", bind: "lb.query", label: "Search", placeholder: "Search by area or street", pattern: "^.{0,60}$", patternMessage: "Use up to 60 characters." },
        { type: "select", bind: "lb.kind", label: "Show", variant: "chips", choices: [{ id: "all", label: "All" }, { id: "branch", label: "Branches" }, { id: "atm", label: "Cash machines" }], visibleWhen: "lb.found.showAtms" },
        { type: "select", bind: "lb.kind", label: "Show", variant: "chips", choices: [{ id: "all", label: "All" }, { id: "branch", label: "Branches" }], visibleWhen: "!lb.found.showAtms" },
        { type: "toggle", bind: "lb.openNow", label: "Open now", visibleWhen: "lb.found.openNowOffered" },
        button("Search", [{ type: "validate" }, set("lb.err", ""), SEARCH, set("lb.kind", "{{lb.found.kind}}")], "secondary"),
        { type: "map", source: "lb.found.places", label: "Map", onSelect: pick("{{item.id}}"), visibleWhen: "lb.found.count > 0" },
        {
          type: "menu", source: "lb.found.places", visibleWhen: "lb.found.count > 0",
          item: { label: "{{item.name}}", text: "{{item.distanceText}} · {{item.address}} · {{item.chip}}, {{item.status}}", icon: "mapPin", actions: pick("{{item.id}}") },
        },
        text("No places found", "title", "lb.found.count == 0"),
        note("Try another search or show everything.", "lb.found.count == 0"),
        button("Show details", [{ type: "validate" }, set("lb.err", ""), SEARCH, set("lb.kind", "{{lb.found.kind}}"), go("choose")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // Show details without a row: the nearest of what is listed; with nothing listed the button is blocked with the bank's words
      id: "choose", title: "Find a branch or ATM", kind: "branch",
      onEnter: [set("lb.err", "{{lb.found.count == 0 ? 'none' : ''}}"), { type: "navigate" }],
      navigation: route(["lb.found.count == 0", "search"], ["true", "nearest"]),
      blocks: [],
    },
    {
      id: "nearest", title: "Find a branch or ATM", kind: "branch",
      onEnter: pick("{{lb.found.firstId}}"),
      blocks: [],
    },
    {
      id: "details", title: "Details",
      blocks: [
        text("{{isEmpty(lb.detail.name) ? 'Details' : lb.detail.name}}", "title"),
        text("{{lb.detail.address}}", "body"),
        { type: "statusChip", status: "open", label: "Open", tone: "positive", visibleWhen: "lb.detail.open" },
        { type: "statusChip", status: "closed", label: "Closed", tone: "neutral", visibleWhen: "!lb.detail.open" },
        text("{{lb.detail.status}} · {{lb.detail.distanceText}} away", "body"),
        text("Opening hours", "title"),
        { type: "reviewSummary", rows: weekRows("lb.detail.hours") },
        text("Services", "title"),
        text("{{lb.detail.servicesText}}", "body"),
        button("Get directions", [go("directions")]),
        button("Back", [go("search")], "ghost"),
      ],
    },
    {
      id: "directions", title: "Opening directions", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Opening directions", text: "Your maps app will open with the route to {{lb.detail.name}}.", meta: "Reference {{lb.detail.reference}}" },
        { type: "reviewSummary", rows: [{ label: "Place", value: "{{lb.detail.name}}" }, { label: "Address", value: "{{lb.detail.address}}" }, { label: "Distance", value: "{{lb.detail.distanceText}}" }] },
        button("Search again", [go("start")]),
        button("Done", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // a place that is gone is a message on the search; the rest has its screens
      id: "fail", title: "Find a branch or ATM", kind: "branch",
      onEnter: [set("lb.msg", "{{ctx.error.message}}"), set("lb.err", "{{ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE' ? 'place' : ''}}"), go("search")],
      navigation: route(...answerRules),
      blocks: [],
    },
    ...downScreens({
      retry: "start",
      unavailable: { title: "We couldn’t load places", text: "We couldn’t load places right now. Try again in a few minutes." },
      timeout: { text: "This is taking longer than expected. Nothing was changed." },
    }),
  ] as Screen[],
};
