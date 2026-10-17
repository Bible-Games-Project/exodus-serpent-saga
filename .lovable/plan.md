# Exodus Survivors — Complete Shop

Build the full permanent shop per the uploaded spec, in phases so each phase is verifiable.

## Phase 1 — Data, persistence, shop UI

- `src/game/shopCatalog.ts`: full catalogue data — 9 weapons × 3 evolutions, 10 staffs × 3, 10 foods, 10 shields × 3, 10 footwear, 14 champions × 3 — with exact names, prices, damage/stat values and ability descriptions from the spec.
- `src/lib/shopSave.ts`: single source of truth persisted in localStorage (coins, owned evolutions, equipped slots, per-champion owned/selected evolution, last category/item). Defaults: 0 coins, free starter items owned+equipped (Branch of the Tree of Life E1, Staff of Moses E1, Miriam's Sandwich, Shield of Abel E1, Barefoot). No existing save data is touched or reset.
- New route `/shop` + "Shop" button on the main menu, styled like the cover (same pixel panels, palette, fonts as Leaderboard/More Games).
- Header: SHOP title, coin counter with pixel coin icon (thousands separators), Back, Play.
- Left panel: 5 category tabs (sword/staff/heart/shield/lightning icons) + item list. Right panel: scrollable champion cards with reserved portrait placeholders (no invented faces).
- Detail panel: large icon, stats, ability text, 3 evolution selectors (weapons/staffs/shields), price, purchase/equip, state labels (LOCKED / NOT ENOUGH COINS / AVAILABLE / OWNED / EQUIPPED — text labels, not color-only).
- Purchase flow: verify not owned + sufficient coins, deduct once (guard against double-clicks), persist immediately, auto-equip on first family purchase, confirmation toast, insufficient-funds message with exact shortage.
- First icon per equipment family only, reused within the family (art direction pending approval).

## Phase 2 — Stat integration into gameplay

- Loadout applied at run start: weapon damage multiplier, staff magic-damage % (applies to plague damage, not physical), food max-HP % + regen + one resurrection (Fruit of the Tree of Life), shield capacity formula `maxShield = base × (1 + bonus)` with clamp on equip, footwear speed %.
- Champion summon opportunities at levels 15, 30, 45… (replaces current 10/30/60 rule): manual selection panel of owned champions; closing without choosing preserves the opportunity; no auto-summon.

## Phase 3 — Weapon combat behaviors

Implement each weapon's real attack behavior in the engine (cone slash, poison, piercing spear projectiles, crit-every-N sword, harpoon + whirlpool, axe ground line, multi-boomerangs, mace impact circle, rebounding ring), evolution-dependent. Weapon visuals stay temporary (no new sprites in Moses' hands until final PNGs).

## Phase 4 — Staff, shield, footwear, food abilities

- Staff specials: plague slow (Iron), blind (Crystal/Diamond), fire ring (Bronze), burn spread (Fire), flame volleys (Burning Bush), slowing wave (Primordial Waters), lightning strikes (Divine Light / God's Power — never one-shots Ramses).
- Shield specials: projectile reduction, absorb sphere, cloud blockers, speed-on-hit, fire aura, periodic block, low-HP repel, lethal-hit survival. Family color for shield visuals.
- Footwear specials: glows/trails per item, timed boosts, coin magnet, slowing footprints, repel, teleport, Exodus conditional +20%.
- Food regen + resurrection.

## Phase 5 — Champion catalogue and evolutions

- Extend the champion registry to all 14 champions (Miriam, Zipporah, Puah, Shiphrah, Gershom, Eliezer, Jochebed, Amram, Jethro, Ithamar, Nadab, Abihu, Eleazar, Aaron) with the 3-evolution stat scaling (Miriam = 100%/100% reference) and abilities: healing vials (Puah), explosive vials (Shiphrah), archery (Gershom), chain spears (Eliezer), water/waves (Jochebed), pyramid stones (Amram), convert/confuse (Jethro), protective shield (Ithamar), fireballs (Nadab), fire ring/trail (Abihu), light beams (Eleazar), horn + birds (Aaron).
- Summon uses purchased evolution stats.

## Phase 6 — Verification

Playwright against the live preview covering the spec's 21-point checklist: purchases deduct once, unaffordable blocked, owned not recharged, free switching, one item per slot, default highest evolution, reload persistence, weapon/staff separate slots, shield formula, food max-HP, champion summon at 15/30/45, panel-close preserves opportunity, mobile layout, no regressions.

## Notes / constraints

- Coins: no coin-earning source is specified; the spec says balance must persist. I'll keep whatever earning exists and not invent monetization (ads/SDKs explicitly out of scope).
- Final weapon/staff/champion PNGs come later; placeholders and temporary sprites only.
- Anything that can't be integrated safely will be reported as a concrete blocker, not silently faked.
