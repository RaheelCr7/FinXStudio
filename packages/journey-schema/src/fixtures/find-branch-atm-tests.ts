import type { Journey } from "../schema";
import { bank, error, forced, home, inspect, noText, press, screen, set, SLOW, text, visitor, type Step } from "./public-test-kit";

/** What must be true for "Find a branch or ATM" to be right. Each is proved by at least one scenario below. */
export const findBranchAtmAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list is sorted nearest first and shows the distance in miles for Markets A and B and in kilometres for Markets C and D, with one decimal." },
  { id: "AC-2", text: "The search matches the name, the address or the area, ignoring capitals; the kind and Open now narrow the list." },
  { id: "AC-3", text: "Each place shows Open or Closed and the status text (Closes, Opens, Opens tomorrow, Opens Mon) worked out by the bank from its hours and the clock." },
  { id: "AC-4", text: "With no match the empty state shows and Show details is blocked with the bank's words." },
  { id: "AC-5", text: "Tapping a row, or Show details, opens the details with seven opening-hours rows and the services." },
  { id: "AC-6", text: "Cash machines and the Cash machines chip appear only with showAtms; the Open now filter only with openNow; the bank holds to both." },
  { id: "AC-7", text: "The result names the place, the address and the distance, says the maps app opens, and offers Search again." },
  { id: "AC-8", text: "Launching with kind branch shows branches only; kind atm shows cash machines when the bank shows them, else everything." },
  { id: "AC-9", text: "When places cannot load, or the bank does not answer in time, the person sees the plain message, nothing is changed and Try again works." },
  { id: "AC-10", text: "It works before anyone signs in, asks for no location and no personal data, and a place that does not exist is refused." },
];

/** What the bank would list for the words, the kind and the switch the journey holds now. */
const listed = (path: string, equals: unknown): Step => bank("bank.locations.search", path, equals, { query: "{{lb.query}}", kind: "{{lb.kind}}", openNow: "{{lb.openNow}}" });
const search = (query: string, extra: Record<string, unknown> = {}): Step[] => [set({ "lb.query": query, ...extra }), press("Search")];
const NO_ATMS = { options: { "find-branch-atm": { showAtms: false } } };

export const findBranchAtmScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The list is nearest first: the Central Plaza cash machine (0.2 mi, Open, Closes 24:00) and Central Branch (0.5 mi, Closed, Opens tomorrow 09:00)", covers: ["AC-1", "AC-3"], ...visitor,
    steps: [
      screen("search"), text("Find a branch or ATM"), listed("firstId", "a1"), listed("count", 8), text("Central Plaza cash machine"), text("0.2 mi · Central Plaza, ground floor · Open, Closes 24:00"),
      text("Central Branch"), text("0.5 mi · 1 Example Square · Closed, Opens tomorrow 09:00"), text("Market Street Branch"), text("1.3 mi · 48 Market Street · Open, Closes 20:00"), text("Map"),
    ],
  },
  {
    id: "T-2", name: "In Market C the distances read in kilometres: 0.4 km, 0.8 km and so on", covers: ["AC-1"], ...visitor, config: home("eu"),
    steps: [text("0.4 km"), text("0.8 km"), text("1.2 km"), text("12.4 km"), noText(" mi ·")],
  },
  {
    id: "T-3", name: "In Market B the distances read in miles, in Market D in kilometres", covers: ["AC-1"], ...visitor, config: home("uk"),
    steps: [text("7.7 mi · Terminal 1, arrivals"), text("0.2 mi"), noText(" km ·")],
  },
  {
    id: "T-4", name: "Market D reads kilometres too", covers: ["AC-1"], ...visitor, config: home("ae"),
    steps: [text("12.4 km · Terminal 1, arrivals"), noText(" mi ·")],
  },
  {
    id: "T-5", name: "Typing riverside leaves the mall cash machine and Riverside Branch; the Branches chip leaves four branches; Open now removes Central Branch and Riverside Branch", covers: ["AC-2", "AC-3"], ...visitor,
    steps: [
      ...search("riverside"), text("Mall cash machine"), text("Riverside Branch"), noText("Central Branch"), listed("count", 2),
      ...search("", { "lb.kind": "branch" }), text("Central Branch"), text("Market Street Branch"), text("Riverside Branch"), text("Airport Branch"), noText("Mall cash machine"), listed("count", 4),
      ...search("", { "lb.kind": "all", "lb.openNow": true }), noText("Central Branch"), noText("Riverside Branch"), text("Market Street Branch"), text("Mall cash machine"), listed("count", 6),
    ],
  },
  {
    id: "T-6", name: "The search ignores capitals and matches an address or an area", covers: ["AC-2"], ...visitor,
    steps: [...search("RIVERSIDE"), listed("count", 2), ...search("1 example"), text("Central Branch"), listed("count", 1), ...search("Station"), text("Station cash machine"), listed("count", 1), ...search("market"), text("Market Street Branch"), listed("count", 1)],
  },
  {
    id: "T-7", name: "A search of cash machines only", covers: ["AC-2", "AC-6"], ...visitor,
    steps: [...search("", { "lb.kind": "atm" }), text("Harbour cash machine"), noText("Central Branch"), listed("count", 4), text("Cash machines")],
  },
  {
    id: "T-8", name: "With no match the empty state shows, and Show details is blocked with the bank's words", covers: ["AC-4"], ...visitor,
    steps: [
      ...search("zzz"), text("No places found"), text("Try another search or show everything."), noText("Central Branch"),
      press("Show details"), screen("search"), text("No places match. Try another search."), noText("Get directions"),
    ],
  },
  {
    id: "T-9", name: "Tapping Market Street Branch opens its details: seven hours rows and the services; Get directions gives the result with MAP-B2", covers: ["AC-5", "AC-7"], ...visitor,
    steps: [
      press("Market Street Branch"), screen("details"), text("48 Market Street"), text("Closes 20:00"), text("1.3 mi away"), text("Opening hours"),
      text("Sunday"), text("10:00 to 16:00"), text("Monday"), text("08:00 to 20:00"), text("Tuesday"), text("Wednesday"), text("Thursday"), text("Friday"), text("Saturday"),
      text("Services"), text("Cash deposits · Safe deposit boxes · Step-free access"),
      press("Get directions"), screen("directions"), text("Opening directions"), text("Your maps app will open with the route to Market Street Branch."), text("Reference MAP-B2"),
      text("Place"), text("Address"), text("Distance"), text("1.3 mi"), text("Search again"), text("Done"),
    ],
  },
  {
    id: "T-10", name: "Show details with no row tapped opens the nearest place of what is listed", covers: ["AC-5"], ...visitor,
    steps: [press("Show details"), screen("details"), text("Central Plaza cash machine"), text("Central Plaza, ground floor"), text("Open 24 hours"), text("Cash withdrawal · Cash deposit")],
  },
  {
    id: "T-11", name: "Show details uses the words typed in the box even when Search was not pressed", covers: ["AC-2", "AC-5"], ...visitor,
    steps: [set({ "lb.query": "market" }), press("Show details"), screen("details"), text("Market Street Branch")],
  },
  {
    id: "T-12", name: "A place open all day has Open 24 hours on every row", covers: ["AC-3", "AC-5"], ...visitor,
    steps: [press("Station cash machine"), text("Open 24 hours"), text("Cash withdrawal"), noText("Closed")],
  },
  {
    id: "T-13", name: "The status follows the clock: on a Saturday afternoon the branches say when they open next", covers: ["AC-3"], persona: "signed-out", now: "2026-11-07T14:00:00Z",
    steps: [text("1 Example Square · Closed, Opens Mon 09:00"), text("48 Market Street · Open, Closes 20:00"), text("Riverside Mall, level 1 · Open, Closes 22:00")],
  },
  {
    id: "T-14", name: "On a Sunday the branch is closed all day, a later opening is tomorrow, and before opening it says when", covers: ["AC-3"], persona: "signed-out", now: "2026-11-08T12:00:00Z",
    steps: [text("1 Example Square · Closed, Opens tomorrow 09:00"), text("48 Market Street · Open, Closes 16:00"), text("Terminal 1, arrivals · Open, Closes 16:00")],
  },
  {
    id: "T-15", name: "Early in the morning a branch that has not opened says when it does", covers: ["AC-3"], persona: "signed-out", now: "2026-11-03T07:00:00Z",
    steps: [text("1 Example Square · Closed, Opens 09:00"), text("48 Market Street · Closed, Opens 08:00"), text("Central Plaza, ground floor · Open, Closes 24:00")],
  },
  {
    id: "T-16", name: "With showAtms off there is no Cash machines chip and no cash machine rows", covers: ["AC-6"], ...visitor, launch: { "opt.showAtms": false }, config: NO_ATMS,
    steps: [noText("Cash machines"), noText("Mall cash machine"), noText("Station cash machine"), text("Central Branch"), text("Branches"), listed("count", 4)],
  },
  {
    id: "T-17", name: "A launch with kind atm while showAtms is off shows everything the bank shows, branches only", covers: ["AC-6", "AC-8"], ...visitor, launch: { "launch.kind": "atm", "opt.showAtms": false }, config: NO_ATMS,
    steps: [listed("kind", "all"), text("Central Branch"), noText("cash machine")],
  },
  {
    id: "T-18", name: "The bank keeps cash machines out of the list when it shows none, whatever the journey sends", covers: ["AC-6"], ...visitor, config: NO_ATMS,
    steps: [bank("bank.locations.search", "count", 4, { showAtms: true }), bank("bank.locations.search", "count", 4, { kind: "atm", showAtms: true })],
  },
  {
    id: "T-19", name: "With openNow off there is no Open now switch, and the bank ignores the filter", covers: ["AC-6"], ...visitor, launch: { "opt.openNow": false }, config: { options: { "find-branch-atm": { openNow: false } } },
    steps: [noText("Open now"), bank("bank.locations.search", "count", 8, { openNow: true }), text("Central Branch")],
  },
  {
    id: "T-20", name: "The Open now switch is offered when the bank offers it", covers: ["AC-6"], ...visitor,
    steps: [text("Open now"), bank("bank.locations.search", "openNowOffered", true)],
  },
  {
    id: "T-21", name: "A launch with kind branch opens with Branches chosen and shows branches only", covers: ["AC-8"], ...visitor, launch: { "launch.kind": "branch" },
    steps: [listed("kind", "branch"), listed("count", 4), text("Central Branch"), noText("Mall cash machine"), noText("Station cash machine")],
  },
  {
    id: "T-22", name: "A launch with kind atm opens with Cash machines chosen", covers: ["AC-8"], ...visitor, launch: { "launch.kind": "atm" },
    steps: [listed("kind", "atm"), listed("count", 4), text("Harbour cash machine"), noText("Airport Branch")],
  },
  {
    id: "T-23", name: "A launch with another kind shows everything", covers: ["AC-8"], ...visitor, launch: { "launch.kind": "bank" },
    steps: [listed("kind", "all"), listed("count", 8)],
  },
  {
    id: "T-24", name: "Search again from the result starts the journey fresh: the words are gone and every place is listed", covers: ["AC-7"], ...visitor,
    steps: [...search("market"), press("Market Street Branch"), press("Get directions"), press("Search again"), screen("search"), listed("count", 8), listed("kind", "all")],
  },
  {
    id: "T-25", name: "Back on the details returns to the list, which is still the search that was made", covers: ["AC-5"], ...visitor,
    steps: [...search("riverside"), press("Riverside Branch"), screen("details"), press("Back"), screen("search"), listed("count", 2), text("Mall cash machine")],
  },
  {
    id: "T-26", name: "When places cannot load the person sees the plain message, and Try again asks again", covers: ["AC-9"], ...visitor, conditions: { unavailable: ["bank.locations.search"] },
    steps: [screen("unavailable"), text("We couldn’t load places right now. Try again in a few minutes."), press("Try again"), screen("unavailable"), noText("Show details")],
  },
  {
    id: "T-27", name: "When the bank does not answer in 10 seconds nothing is changed, and Try again asks again", covers: ["AC-9"], ...visitor, conditions: { timeout: ["bank.locations.search"], latencyMs: 10_000 },
    steps: [screen("timeout"), text(SLOW), press("Try again"), screen("timeout")],
  },
  {
    id: "T-28", name: "A place that cannot be opened is a message on the list, not a dead end", covers: ["AC-9", "AC-10"], ...visitor, conditions: { unavailable: ["bank.locations.details"] },
    steps: [press("Central Branch"), screen("unavailable"), text("We couldn’t load places right now. Try again in a few minutes."), press("Try again"), screen("search")],
  },
  {
    id: "T-29", name: "A place the bank does not have is refused, by a forged call and by the bank's own words", covers: ["AC-10"], ...visitor,
    steps: [forced("bank.locations.details", { placeId: "zz" }, "NOT_FOUND"), forced("bank.locations.details", {}, "NOT_FOUND"), bank("bank.locations.details", "reference", "MAP-A1", { placeId: "a1" })],
  },
  {
    id: "T-30", name: "Before sign-in it asks for no location or personal data and keeps nothing", covers: ["AC-10"], ...visitor,
    steps: [press("Central Branch"), press("Get directions"), screen("directions"), inspect("drafts", 0), inspect("submitted", 3), inspect("outbox", []), press("Done")],
  },
  {
    id: "T-31", name: "A signed-in customer sees the same places and nothing of theirs", covers: ["AC-1", "AC-10"], persona: "alex", now: "2026-11-03T18:45:00Z",
    steps: [text("0.2 mi"), noText("Alex"), noText("balance")],
  },
  {
    id: "T-32", name: "Show details when the place cannot be loaded says so and nothing is lost", covers: ["AC-9"], ...visitor, conditions: { unavailable: ["bank.locations.details"] },
    steps: [press("Show details"), screen("unavailable"), text("We couldn’t load places right now. Try again in a few minutes."), press("Try again"), screen("search")],
  },
  {
    id: "T-33", name: "Words of more than 60 characters are refused on the screen by Search", covers: ["AC-2"], ...visitor,
    steps: [set({ "lb.query": "x".repeat(61) }), press("Search"), screen("search"), error("Use up to 60 characters."), set({ "lb.query": "x".repeat(60) }), press("Search"), text("No places found")],
  },
  {
    id: "T-34", name: "Words of more than 60 characters are refused on the screen by Show details", covers: ["AC-2"], ...visitor,
    steps: [set({ "lb.query": "x".repeat(61) }), press("Show details"), screen("search"), error("Use up to 60 characters."), noText("No places match. Try another search.")],
  },
];
