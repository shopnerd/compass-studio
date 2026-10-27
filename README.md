# Compass Studio

A browser version of the 2025 student-built Moral Compass generator (`Customized compass generator.py`, CadQuery) for the WRIT 340 Moral Compass project and the Baum Family Maker Space. Type a name and four values; get a print-ready MMU bed for PrusaSlicer. No Python install, about 0.4 s per compass instead of 15 s to 2 min.

## Live

https://shopnerd.github.io/compass-studio/ (GitHub Pages from `main`; pushing to `main` updates it in about a minute).

## Run it locally

```bash
cd "H:/My Drive/Baum Family Maker Space/WebDev_4_BFMS/compass-studio"
python -m http.server 8811 --bind 127.0.0.1
```

Open http://127.0.0.1:8811. It needs a server (module worker + WebAssembly); it does not run from a double-clicked file or inside a claude.ai artifact.

## What it makes

- The 2025 compass, rebuilt from the 2025 numbers: Ø75 × 7.6 mm, keyring loop, values in the raised ring (radius 33, 8.2 mm, longest two N/S), gold rose 1 mm under the centre, SC logo + name on the back, 695ZZ bearing pocket (r 6.51, 4 mm, 0.4 mm ledge), spinning needle (50 mm, pin Ø5.2 × 3.8), Ø10.4 × 0.4 mm NFC sticker recess.
- New: the white centre behind the rose is part of the model (the 2025 workflow paints it by hand in the slicer); words share the ring and shrink only when they would touch; size slider; USC Makers seal (2024) as an alternative back; NFC tag sealed inside with the pause height given; the **light needle** for a persistence-of-vision spinner (CR1220 slides into the hub, five pre-wired 0603 LEDs under 1.1 mm face windows, 6.4 × 9.4 mm controller pocket in the tail, wire grooves underneath; the test checks it is one piece and that the cell, LEDs and board fit).
- Bed packing for the Prusa MK4S / Core One + MMU3 and the XL: loops interlock between rows, the wipe tower is placed where it costs the fewest compasses, needles fill the gaps. 6 per MK4S bed at Ø75.
- Exports: full bed 3MF (each colour already on its MMU slot), one compass 3MF, STLs per colour, a fitment test plate (the original `fitmenttester.py` as five bore sizes and five pin sizes), and a whole class from a pasted roster (zip of bed 3MFs + a print sheet CSV).

## Spin Compass (second model, 2026-10-27)

A handheld fidget-spinner version that is also a game: spin the bottle + truth or dare + Wheel of Fortune. Switch with the buttons at the top of the panel.

- Ø82 × 13 mm disc on a 608 bearing between two finger caps that stay still. The top cap carries the pointer and a Ø3 magnet; a glue-on dome under the bottom cap lets it spin flat on a table (the north arrow on the rim then picks a player).
- Face: 8 segments, the four values + Truth, Dare, Again, Choose (editable), gold on every other segment, 12 WS2812B LEDs on the segment boundaries (8 outer, 4 inner) under white diffuser windows.
- Inside (all approximate until measured): Seeed XIAO ESP32-S3 with USB-C in the rim (charges the LiPo), LiPo 402025 ~180 mAh, MAX98357A amp + Ø20 speaker (grille in the floor), LSM6DS3TR-C IMU, DRV5032 hall sensor in the hub under the cap's magnet. The layout is chosen automatically for the best balance (11.6 g·mm off centre with the defaults); a coin cup is added when a dime/penny/nickel helps.
- Prints as tray (floor down), lid (face down, so the face is the smooth bed side), two caps and the dome. 2 complete kits per MK4S bed; only the lid and top cap are multi-colour.
- Play tab (`play.js`): flick the wheel, the LEDs smear into rings at speed, chase, tick, land; a card deals a prompt and the browser reads it aloud.
- Arduino code (`firmware.js` → zip): state machine, hall + gyro angle, light patterns, WAV clips from LittleFS, sleep, low battery. Not compiled or tested on hardware.
- `node test/spinner-test.mjs <outDir>`: all parts valid, no overlaps between tray, lid, inlays and caps as assembled.

### Part choices and parts list

- Inside: disc Ø82/86/90, 8/12/16 LEDs, battery 120/180/220/250 mAh, 20 mm or 15 mm speaker or no sound. Each choice re-runs the fit, height and balance checks and the layout search (~2–7 s the first time, cached after). All 108 combinations fit (Ø78 never did, so it was dropped).
- Balance: parts go where the heavy ones oppose, then a slot of 4.5 mm steel BBs (0.37 g each) trims it. Defaults end at 0.7 g·mm; 8 heavy-battery/no-speaker combinations stay above 8 g·mm and say so.
- Parts list (`bom.js`): real listings checked 2026-10-27 (store, link, pack, price, note), per-spinner cost, an order for N spinners with packs rounded up, totals by store, CSV and copy. Defaults (Ø86, Adafruit LSM6DSOX, Adafruit 150 mAh, 20 mm speaker, 12 LEDs): consolidated to two stores: Amazon ~$92 (XIAO 3-pack from Seeed's Amazon store, speakers, LEDs, bearings, magnets, BBs, screws, CA) + Adafruit ~$80 (IMU, battery, amp, hall sensor, resistors, wire) = ~$174 for 3 before shipping; filament from BFMS stock. `parts-list-3-prototypes-2026-10-27.csv` is that order.
- What the real listings changed: hall switch is the US5881 (Adafruit 158), powered from BAT+ because it needs 3.5 V+, magnet south pole down (the DRV5032 samples at 5 Hz and would miss passes; DRV5033 is the in-spec part if DigiKey has it); motion sensors come as real boards (Adafruit 25.6 × 17.8, Pololu 23 × 13, SparkFun 19 × 7.6) with the firmware class picked to match and both I²C addresses tried; real battery/speaker sizes; magnet is 1/8 × 1/16 in (pocket Ø3.3); screws are M2 machine screws (T6 Torx). The Adafruit sensor needs Ø86 with a speaker; balance can use two BB slots.

### Voice clips (Voice section of the Spin Compass panel)

- Every clip the board plays: segment names (`/clips/0–7.wav`), `/clips/bottle.wav`, `/clips/hello.wav`, and prompts (`/prompts/<list>-<n>.wav`). Record your own voice (Record/Stop per clip, mic in the browser) or use the robot voice (meSpeak, eSpeak compiled to JS, 6 English accents, pitch, speed). Clips are trimmed, levelled, faded and resampled to 16 or 11 kHz 16-bit mono WAV (`voice.js`), and kept in this browser (IndexedDB).
- Storage meter against the board: 5.5 MB with the included `partitions.csv` (2 MB sketch / ~5.9 MB LittleFS on the XIAO's 8 MB), or 1.4 MB with the stock scheme. Defaults: 4 prompts per list at 16 kHz = 42 clips, ~4.3 MB.
- "Download sketch + sound files" = one zip: `SpinCompass/` sketch with `prompts.h` cut to the voiced prompts, `data/` ready for the arduino-littlefs-upload plugin, `partitions.csv`, `HOW_TO_UPLOAD_SOUNDS.txt`.
- meSpeak leaks memory after ~60 clips; `voice-ui.js` replaces its worker every 30. meSpeak is GPL (vendor/mespeak).
- `node test/voice-test.mjs <outDir>`: WAV round trip, resampler keeps a 440 Hz tone, robot-voices four plans (names only → every prompt) and reports flash size. Checked in the browser: 42 robot clips in 7 s, zip contents and trimmed prompts.h. Not checked: microphone recording (needs a real mic in Chrome/Edge), and anything on the board.

## Files

`core.js` geometry, packing, 3MF/STL/zip writers (runs in Node too) · `worker.js` Manifold + font off the main thread · `app.js` UI + three.js viewer · `data/design2025.js` rose and SC logo outlines taken from the original `Name_Example.3mf` · `data/seal.js` the 2024 seal · `fonts/` Nunito ExtraBold (OFL; the original used Arial Rounded MT Bold, which cannot be shipped) · `test/core-test.mjs`.

## Checked (2026-10-26)

- `node test/core-test.mjs <outDir>`: 30 variants (needle / light / fixed × SC / seal / none × sticker / embedded / none, long words, 0.85 and 1.2 scale) are valid solids with zero overlap between colours; 0.2–0.8 s each.
- Rendered top and back match the original `Name_Example.3mf`.
- Bed 3MF structure: indices and per-colour triangle ranges consistent, extruders 1/2/3, needles on 1.
- In the browser: all five views, light needle, class export of 7 students → 2 beds in 3.5 s, no console errors.

## Not checked yet

- Opening the 3MF in PrusaSlicer (not installed on this laptop). If parts land off the bed, press A to arrange; colours should already be on their slots.
- A real print, the bore/pin fit on the BFMS Prusas (print the fitment plate first; the original 6.51 was for a Bambu X1C), and the light needle electronics (no wiring or firmware yet).
- Phone layout and other browsers.
