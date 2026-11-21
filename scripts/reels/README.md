# Reels ("¿Sabías que...?" with Moses)

Short vertical videos (about 20 s, 1080x1920) for YouTube Shorts, Instagram
Reels and TikTok. In each one Moses tells, in the first person, something
that happened to him, over real gameplay. It ends on a card asking viewers
to wishlist the game on Steam.

Each episode is one JSON file in `episodes/`:

| field | what it is |
| --- | --- |
| `id` | file name of the reel (`public/reels/<id>.mp4`) |
| `lang`, `voice`, `speed` | language for Whisper; voice: `elevenlabs:<voice id>` (any ElevenLabs library voice) or an OpenAI voice name (`onyx`, with `voiceStyle` as accent hint); `speed` for ElevenLabs (0.7-1.2) |
| `layout` | `portrait` (default: the game fills the 1080x1920 frame) or `square` (1080x1080 gameplay between blurred bands) |
| `music` | optional music file in the repo (looped); without it `music.ts` synthesizes a track |
| `hook`, `ref` | big title on top and the Bible reference under it |
| `story` | what Moses says; `\|` splits it into subtitle lines |
| `cta` | what Moses says over the Steam card |
| `card` | Steam card texts; `buttonCue` = the CTA word at which the button appears |
| `capture` | gameplay to record: `seconds`, `warmup` (seconds played before recording), `clicks` (Test Map buttons to press first), `pick` (preferred level-up cards), `moves` (`[from, to, "keys"]` held, WASD) |

To choose a narrator, `bun voice-samples.ts` renders the same line with 20 male
ElevenLabs voices into `public/reels/voces/` (with an `index.html` to listen to them).

## Making a reel

Tools live in their own package (not part of the game build):

```sh
cd scripts/reels && bun install
# the game must be running: in the repo root, `bun run dev -- --port 5180`
E=episodes/01-serpent.json
bun voice.ts $E          # Moses' voice + word timings (OpenAI, needs OPENAI_API_KEY)
bun plan.ts $E           # subtitles and timing
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

Publishing (YouTube, Instagram, TikTok) goes through upload-post.com, which can
schedule posts ahead; always ask the owner before publishing anything.
