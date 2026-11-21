# Reels

Short vertical videos (15-20 s, 1080x1920) for YouTube Shorts, Instagram
Reels and TikTok, in English for a mostly non-Christian audience: a narrator
(the portrait in `narrator/`, who opens the reel blinking and talking) tells
an ancient-history story over real gameplay. It ends on the game's poster
(`cards/`) with a "Wishlist now on Steam" badge. Episode 01 is the older
format (Moses in the first person, spoken call to action).

Each episode is one JSON file in `episodes/`:

| field | what it is |
| --- | --- |
| `id` | file name of the reel (`public/reels/<id>.mp4`) |
| `lang`, `voice`, `speed` | language for Whisper; voice: `elevenlabs:<voice id>` (any ElevenLabs library voice) or an OpenAI voice name (`onyx`, with `voiceStyle` as accent hint); `speed` for ElevenLabs (0.7-1.2) |
| `layout` | `portrait` (default: the game fills the 1080x1920 frame) or `square` (1080x1080 gameplay between blurred bands) |
| `music` | optional music file in the repo, e.g. `scripts/reels/music/Ancient-Mystery.mp3` (the owner's tracks, also used for the Eden to Heaven videos; looped); without it `music.ts` synthesizes a track |
| `gameSound` | `false`: no game sound effects in the mix |
| `narrator` | the talking portrait at the start: `chunks` (how many subtitle lines it stays), optional `image`, `width`, `x`, `y`, and the face boxes `eyes`/`mouth` for another image (`narrator/narrator-v2.png` holding papers and `narrator-v3.png` pointing at a book: see episodes 04 and 05 for their boxes) |
| `hook`, `ref` | big title on top and the line under it |
| `story` | the narration; `\|` splits it into subtitle lines |
| `cta` | optional spoken call to action over the card |
| `post` | texts for `publish.ts`: `title` (YouTube/Facebook, with `#shorts`), `hook` (the opening question), `summary`, `source` (Bible references), `hashtags`, `tags` (YouTube) |
| `card` | either `poster` (image, shown `seconds`, with the Steam badge and `button` text) or the older drawn card (`title`, `tag`, `button`, `buttonSmall`, `buttonCue` = the CTA word at which the button appears) |
| `capture` | gameplay to record: `seconds`, `warmup` (seconds played before recording), `clicks` (Test Map buttons to press first), `pick` (preferred level-up cards), `moves` (`[from, to, "keys"]` held, WASD) |
| `capture.takes` | cut gameplay instead of one long run: a list of takes (each a fresh game: `clicks`, `pick`, `warmup`, `warmupMoves`), each with `shots`: `len` (seconds on screen), `skip` (seconds played unfilmed before the shot, `skipMoves`), `moves`, `slow` (0.5 = slow motion), `cam`: `on` (`moses`, `enemy` = nearest enemy, locked until it dies, optional `kinds`; or `center`), `zoom` `[start, end]` (eased), `dx`/`dy` offset. The shot lengths must add up to at least the card time + 0.2 s (`timeline.json`). The HUD is hidden in takes. `capture.dpr` (default 3) is the render sharpness for close-ups |

To choose a narrator, `bun voice-samples.ts` renders the same line with 20 American male
ElevenLabs voices into `public/reels/voices/` (with an `index.html` to listen to them).

## Making a reel

Tools live in their own package (not part of the game build):

```sh
cd scripts/reels && bun install
# the game must be running: in the repo root, `bun run dev -- --port 5180`
E=episodes/02-plagues.json
bun voice.ts $E          # narration + word timings (ElevenLabs/OpenAI TTS, Whisper: OPENAI_API_KEY)
bun plan.ts $E           # subtitles and timing
node narrator.mjs $E     # talking narrator sprites (when the episode has `narrator`)
bun music.ts $E          # synthesized background music (skipped when the episode sets `music`)
node overlays.mjs $E     # hook, subtitles and card as PNGs (headless Chromium)
node capture.mjs $E      # gameplay frames + the sounds the game played (slow: ~0.5 s/frame)
bun sfx.ts $E            # game sounds track
bun compose.ts $E        # -> public/reels/<id>.mp4
```

Intermediate files go to `work/<id>/` (git-ignored); delete one to redo that step
(e.g. `vo.*` to re-record the voice). Run only one Chromium step at a time:
the build server is small.

How it works: `capture.mjs` replaces the game's clock (`performance.now`,
`requestAnimationFrame`, audio time) with a virtual one, so the video is a
perfect 30 fps however slow the machine is, and logs every sound the game
starts; `sfx.ts` re-mixes those sounds from `public/`. Level-up menus are
answered on the spot so they never appear on screen. Chromium comes from
`@sparticuz/chromium` and ffmpeg from `@ffmpeg-installer/ffmpeg`, so nothing
needs to be installed system-wide.

Publishing goes through upload-post.com (always ask the owner first):

```sh
bun publish.ts episodes/07-bronze-serpent.json 2026-11-21T17:00:00Z   # add --dry to only print the texts
```

It uploads `public/reels/<id>.mp4` to the brand in `schedule.json` (Brand_2_BibleFun:
YouTube, TikTok, Instagram, Facebook page, Pinterest board) with the post scheduled at
that UTC time, and records the job id in `schedule.json`. Run it with bun (bun goes
through the sandbox proxy; node's fetch does not). The Steam link is in every
description; TikTok and Instagram never make caption links clickable, so those also
say "link in bio". `GET /api/uploadposts/schedule` lists scheduled posts and
`DELETE /api/uploadposts/schedule/<job>` cancels one.

Channel direction (owner, Nov 2026): a Christian channel. Every reel teaches something
interesting from Exodus, Leviticus, Numbers or Deuteronomy, opens with a question hook
(title and first spoken line) and ends on the lesson.
