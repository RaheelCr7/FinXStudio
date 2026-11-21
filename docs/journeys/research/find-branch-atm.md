# Find a branch or ATM (`find-branch-atm`)

## Sources
- No pages fetched; common locator patterns (UNVERIFIED).

## Patterns by market
| Market | Pattern |
|---|---|
| All | Search by area, filter branches or cash machines, list by distance with open or closed, map, details with hours and directions. |
UNVERIFIED.

## Rules in plain English
Show distance and open state first. Location permission is optional; search always works.

## Decisions for BankWorkx®
Synthetic places, miles in the US and UK markets and km elsewhere, fixed clock for stable chips, map placeholder, details with weekly hours and services, directions hands off to the maps app.

## Fields
| Field | Rule | Message |
|---|---|---|
| Search | up to 60 characters | none |
| Filter | All, Branches, Cash machines | none |

## Edge cases
No results ("No places match"); closed now shows next opening; location denied.

## Open questions
Holiday hours, queue times, accessibility detail.

