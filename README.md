# Exodus Survivors

I want to build a complete browser game called:

EXODUS SURVIVORS

The gameplay is inspired by Vampire Survivors.

IMPORTANT

This game must be completely original.

Do not copy any graphics, code or assets.

Only use Vampire Survivors as inspiration for the gameplay loop.

==================================================

GENERAL

==================================================

Create a polished browser game using modern web technologies.

The project must be clean, modular and scalable.

Use:

- React

- TypeScript

- Vite

- Tailwind CSS

- Canvas rendering for gameplay

- Supabase

- Responsive design

==================================================

VISUAL STYLE

==================================================

This is extremely important.

I do NOT want retro 8-bit graphics.

I also do NOT want ultra-detailed HD pixel art.

The style should sit between both.

Think:

- modern indie pixel art

- clean

- elegant

- highly readable

- handcrafted

- soft shading

- expressive characters

Characters should have enough pixels to show personality.

They should NEVER look like:

- squares

- circles

- placeholders

- programmer art

==================================================

COLOR PALETTE

==================================================

The game should have a calm artistic look.

Use:

- pastel colors

- complementary color palette

- mostly monochromatic scenes

- warm desert colors

- soft lighting

- subtle shadows

The overall feeling should be beautiful and relaxing despite the action.

==================================================

SETTING

==================================================

Ancient Egypt during the Exodus.

Large stylized desert.

Palm trees.

Rocks.

Ruins.

Pyramids.

Small vegetation.

Everything should fit the same artistic style.

==================================================

MAIN MENU

==================================================

Create a beautiful home screen.

Centered title:

EXODUS SURVIVORS

Buttons:

PLAY

MORE GAMES

SETTINGS

==================================================

MORE GAMES

==================================================

Create a placeholder page.

It will later contain links to my future games.

No content is needed yet.

==================================================

SETTINGS

==================================================

Create a settings window.

Language

Currently only:

English

Volume

Toggle ON/OFF

(No sounds yet.)

Game Dev Mode

Toggle ON/OFF

Currently this toggle does nothing.

It is reserved for future debugging features.

==================================================

GAMEPLAY

==================================================

Gameplay is inspired by Vampire Survivors.

The player controls Moses.

Enemies continuously spawn.

The goal is to survive as long as possible.

Gain experience.

Level up.

Choose upgrades.

Runs become increasingly spectacular.

==================================================

PLAYER

==================================================

Playable character:

Moses

Starts with only one attack.

Basic attack:

Throwing living serpents.

The snakes travel forward using a natural zig-zag movement.

==================================================

PLAGUES

==================================================

Unlock in biblical order.

1 Staff becomes Serpent

2 Water into Blood

3 Frogs

4 Gnats

5 Flies

6 Livestock Plague

7 Boils

8 Hail

9 Locusts

10 Darkness

11 Death of the Firstborn

After these:

Continue unlocking miracles like:

Pillar of Cloud and Fire

Parting of the Red Sea

Every plague should evolve infinitely.

==================================================

FRIENDLY NPCS

==================================================

Every 5 player levels unlock exactly one friendly companion.

Always in this order:

Bithiah (Thermutis)

Aaron

Miriam

Jethro

Zipporah

Joshua

Hur

Elder of Israel

After Elder of Israel:

Every additional 5 levels adds another Elder.

Friendly NPCs automatically fight nearby enemies.

Enemies primarily chase Moses but will attack friendly NPCs if they block their path.

==================================================

LEADERBOARD

==================================================

Use Supabase.

Create a global leaderboard.

Store:

Player name

Highest level reached

Survival time

Date

Display the Top 100 players.

==================================================

ARCHITECTURE

==================================================

The project should be easy to expand.

Each plague, miracle, enemy and NPC should be its own reusable module.

Avoid large monolithic files.

==================================================

IMPORTANT

==================================================

Build a strong scalable foundation.

Focus first on:

- clean architecture

- polished UI

- responsive menus

- gameplay framework

- Supabase integration

- leaderboard

The game should feel like the beginning of a commercial indie game, ready to grow with future updates.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7973ebb0-7f1c-46e2-bf85-fa982bb2621f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
