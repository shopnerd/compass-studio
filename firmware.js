// firmware.js — writes the Arduino sketch for the Spin Compass (XIAO ESP32-S3, WS2812B ring,
// hall index + LSM6DS3TR-C gyro, MAX98357A I2S speaker). Pure strings; runs in Node and the browser.
// firmwareSketch(cfg) -> { files: [[path, text], ...] }. Not compiled or tested on hardware yet.

// GPIO numbers on the Seeed XIAO ESP32-S3. imuInt is extra: the IMU INT1 wake line (D3).
export const DEFAULT_PINS = { led: 1, hall: 2, sda: 5, scl: 6, bclk: 7, lrc: 8, din: 9, batt: 3, imuInt: 4 };
const XIAO = { 1: 'D0', 2: 'D1', 3: 'D2/A2', 4: 'D3', 5: 'D4', 6: 'D5', 43: 'D6', 44: 'D7', 7: 'D8', 8: 'D9', 9: 'D10' };
const KINDS = ['value', 'truth', 'dare', 'again', 'choose'];

export const DEFAULT_PROMPTS = {
  truth: [
    "What is one thing you would refuse to build, no matter the pay?",
    "Tell us about a time you turned in something you knew was not ready.",
    "What group-project decision did you agree to just to avoid an argument?",
    "Which engineering failure do you think about most, and why?",
    "Have you ever followed instructions you thought were wrong? What happened?",
    "What corner do you cut most often, and what would it cost if it failed?",
    "When did you last change your mind about something important?",
    "What is the most useless thing you have ever built or coded?",
    "If your work had a warning label, what would it say?",
    "Who taught you the most about doing things right, and how?",
    "What rule do you think is pointless, and what would break if everyone ignored it?",
    "What is a decision you made too fast? What would you check now?",
  ],
  dare: [
    "Explain your major using only hand gestures for 20 seconds.",
    "Give a 30-second safety briefing for a stapler, flight-attendant style.",
    "Pitch the object nearest you as a startup in 20 seconds.",
    "Narrate the next 30 seconds of class like a nature documentary.",
    "Draw a bridge with your other hand; the group rates how much it can hold.",
    "Do your best impression of a 3D printer starting a print.",
    "Teach the group one thing you know well in exactly 15 seconds.",
    "Give an acceptance speech for the Most Average Engineer award.",
    "Sell the group a used Moral Compass, used-car style.",
    "Argue for tabs over spaces for 20 seconds, then argue the other side.",
    "Walk to the door and back like a robot with one stuck joint.",
    "Say the alphabet backwards from M as fast as you can.",
  ],
  again: [
    "One more spin!",
    "The next answer counts double.",
    "The player on your left spins for you.",
    "Spin with your other hand.",
    "Call your segment before you spin.",
    "Spin it flat on the table; whoever the arrow points at answers.",
    "The group picks who spins next.",
    "If you land on a value, everyone answers it.",
    "Slow spin only. Make it stop in five seconds.",
    "Lucky you. One more spin.",
  ],
  choose: [
    "Spinner's choice: Truth or Dare?",
    "Truth or Dare, but the group gets one veto.",
    "Pick a player and choose Truth or Dare for them.",
    "Take a Truth, or pass a Dare to the player on your right.",
    "Truth, Dare, or answer one of your own four values.",
    "Pick one, then the group can swap it for the other by vote.",
    "Truth or Dare, and someone else writes the question.",
    "You pick for the person who spun last.",
    "Truth or Dare. Whoever laughs first goes next.",
    "Your call: Truth, Dare, or spin again.",
  ],
};

// Engineering deck: shop-floor and design-review topics. Dares are hands-on: grab something nearby and read it like an engineer.
export const ENGINEERING_PROMPTS = {
  truth: [
    "When did you ignore a number on a datasheet, and what did it cost you?",
    "What is a mistake you made on a part that you would warn a first-year about?",
    "Have you ever asked the machinist or the shop before finishing a design? What changed?",
    "Who on your team knows how things really work? Have you ever told them?",
    "What spec have you written that was too vague to build from?",
    "Is CAD engineering, or is it documentation? Defend your answer.",
    "What do you check before you let anyone review your work?",
    "Tell us about a part that failed in a way you did not expect.",
    "When did a tolerance you never thought about cause a problem?",
    "Which do you trust more: a quick prototype or your calculations? Why?",
    "What trait matters most in an engineer that no class teaches?",
    "If your design failed tomorrow, who would you call first? Do you have their number?",
    "How has AI changed the way you learn engineering, honestly: better or worse?",
    "What question from a reviewer taught you the most?",
    "What simple mechanism did you skip testing because it seemed too easy? What happened?",
    "Where have you over-designed something just to feel safe? What did it cost?",
    "Have you ever drawn a part that could be installed backwards? Did someone do it?",
    "Do you sketch on paper before opening CAD? Be honest.",
    "Have you ever picked a material for one number and been surprised by another?",
    "When did you have to convince someone skeptical that your design was worth building?",
    "What question are you afraid to ask because it might sound basic?",
    "What job would park you instead of growing you? How would you tell in an interview?",
  ],
  dare: [
    "What is this? Grab the nearest object with a moving part and explain how it works in 30 seconds.",
    "Pick something plastic nearby and find its parting line or draft angle. Show the group.",
    "Guess how the nearest object was made: molded, machined, printed, stamped or cast. Point to the evidence.",
    "Find a fastener near you and name it: thread, head and drive. The group checks.",
    "Design-review the chair you are sitting on: one thing it gets right, one it gets wrong. 30 seconds.",
    "Find the part in something nearby that is meant to break first, and say why.",
    "Explain how a ratchet or a zip tie only goes one way, using just your hands.",
    "Explain why a soda can's top and bottom are shaped the way they are. 20 seconds.",
    "Explain how a tamper-evident bottle cap proves it was never opened.",
    "Name three ways a part can fail, then act one out.",
    "Name a material that breaks down in sunlight and what you would use instead.",
    "Sketch a quick-release mechanism, like a bike wheel or a clamp, in 30 seconds.",
    "Explain why two different metals touching can corrode, as if to a 10-year-old.",
    "Pick the most over-engineered object within reach and pitch how you would simplify it.",
    "Explain why a Phillips screwdriver slips out of the screw, and name a drive that does not.",
    "Explain how locking pliers stay shut without you squeezing. Use your hands as the linkage.",
    "Twist-off or pry-off bottle cap: argue for one in 20 seconds.",
    "Explain how a stovetop espresso pot pushes water up through the coffee.",
    "Find something in the room that can only go together one way. Show the feature that forces it.",
    "Explain lumens versus candela using a flashlight and a lamp.",
    "Explain how a hose clamp gets so much grip from a tiny screw.",
    "Explain how a can opener cuts without leaving a sharp edge, or admit you never noticed.",
  ],
};
// Funny deck: party-game style. Truth deals a fill-in card plus a random answer card (26 x 61 = 1,586 combos): the
// player defends the combo or the group swaps the answer. Dares are performances. A roast of engineering life,
// kept fine for class. Setups end where the answer goes; answers are short noun phrases. Written for Compass Studio.
export const FUNNY_SETUPS = [
  "Our capstone failed because of",
  "In the post-mortem, we blamed",
  "What is really holding the senior design project together?",
  "New rule in the shop: nobody brings in",
  "The tiny footnote on the datasheet warns about",
  "My resume calls it leadership. It was really",
  "The TA's only comment on my report was",
  "The safety factor on this bridge comes entirely from",
  "Tonight's all-nighter is powered by",
  "Version two fixes everything, except",
  "I did not fail the exam. I was testing",
  "The client asked for a bridge. We delivered",
  "Our group's communication plan is",
  "Every engineering building smells faintly of",
  "My professor's favorite problem-solving method is",
  "The robot stopped working the moment it saw",
  "Nobody warned the freshmen about",
  "What did the lab manager find inside the 3D printer this morning?",
  "My next startup pitch: Uber, but for",
  "The real reason the demo crashed:",
  "Ten years from now, my engineering legacy will be",
  "The most dangerous tool in the shop is still",
  "My design review went great until someone asked about",
  "Our team's secret weapon is",
  "Peer-reviewed research has finally confirmed",
  "The scariest words in engineering are",
];
export const FUNNY_ANSWERS = [
  "one zip tie doing the work of four bolts", "hot glue and denial", "the intern who left in June",
  "a 3D print with 5 percent infill and big dreams", "SolidWorks crashing at 98 percent", "the one Allen key nobody ever returns",
  "an Arduino held on with a rubber band", "a Gantt chart nobody has opened", "rounding pi to 3",
  "the wrong units, said with total confidence", "an extension cord plugged into another extension cord", "free pizza at an info session",
  "a group chat with 400 unread messages", "four energy drinks and a dream", "a design that only worked in simulation",
  "a strongly worded email to the TA", "the group member who only shows up for the photo", "a spreadsheet named FINAL final v7",
  "a bridge made entirely of popsicle sticks", "a mechanical pencil with no lead", "the stripped screw that ended my week",
  "a soldering iron left on overnight", "the smell of burning plastic", "an angry Roomba",
  "the factor of safety, rounded down", "a loose wire that only fails during demos", "duct tape rated for space flight",
  "a feature added at 3 a.m. and never tested", "a drone stuck in a tree", "the vending machine that ate my last dollar",
  "a license server that is always down", "a CAD model with no constraints whatsoever", "the printer jam heard around the world",
  "a battery that is definitely getting warmer", "an engineer explaining a joke", "a calculator stuck in radians",
  "measuring once and cutting twice", "a group chat named Doomed", "lecture slides from 1987",
  "a laser cutter fire drill", "a prototype held together by optimism", "one more coat of paint",
  "the shop vac's tragic backstory", "a breadboard with 200 jumper wires", "an AI confidently inventing a formula",
  "the big red button nobody explains", "a bolt that is almost the right size", "turning it off and on again",
  "a load-bearing sticky note", "an intern with a sledgehammer", "a code commit titled fixed stuff",
  "a robot arm that only waves", "an essay about the essay", "a whiteboard nobody is allowed to erase",
  "safety goggles worn as a headband", "requirements written on a napkin", "the last working USB-C cable on campus",
  "a toaster with Wi-Fi", "a fidget spinner that judges you", "a meeting that could have been an email",
  "a tape measure that only goes to 11",
];
// "Our capstone failed because of" + "hot glue and denial" -> "Our capstone failed because of hot glue and denial."
export function comboText(setup, answer) {
  const s = String(setup || '').trim(), a = String(answer || '').trim();
  if (!a) return s;
  if (/[?:]$/.test(s)) return `${s} ${a[0].toUpperCase()}${a.slice(1)}.`;
  return `${s} ${a}.`;
}
export const FUNNY_PROMPTS = {
  combo: true,
  truth: FUNNY_SETUPS,
  answer: FUNNY_ANSWERS,
  dare: [
    "Give a 30-second TED talk titled: Why my last prototype was actually a success.",
    "Pitch a startup that solves a problem nobody has. The group decides if they would invest.",
    "Act out a 3D printer failing eleven hours into a twelve-hour print. Sound effects required.",
    "Be a stripped screw in therapy. Tell the group how it started.",
    "Tell a client, calmly and professionally, that their bridge is made of spaghetti.",
    "Narrate the person on your left like a nature documentary about a rare engineer in the wild.",
    "Read the warning label for this spinner in your most dramatic movie-trailer voice. Make it up.",
    "Give a eulogy for your last failed prototype. The group may weep.",
    "Explain gravity like a burned-out TA on the last day of the semester.",
    "Do your best impression of a machine in the shop. The group guesses which one.",
    "Rename three things on the table with absurd technical names. A spoon is a handheld fluid transfer unit.",
    "Hold a 20-second design review of someone's shoes. Constructive, but brutal.",
    "Act out the exact moment you realize the units were wrong.",
    "Sell the group the most useless object within reach like it is next year's hottest gadget.",
    "Speak only in engineering jargon until your next turn. Slip up and you spin again.",
    "Give a safety briefing for opening a bag of chips. Cover every hazard.",
    "Explain a meme to the group as if it were a peer-reviewed paper.",
    "Reenact a group project meeting where you play all four group members.",
    "Interview the person on your right for a job at a company that only makes left-handed screwdrivers.",
    "Sketch a machine that makes toast and wakes up your roommate. 30 seconds.",
    "Defend a terrible design decision you have actually made, like a politician at a press conference.",
    "Announce your current project like a boxer entering the ring.",
  ],
  again: [
    "The design changed and nobody told you. One more spin.",
    "Version two always works better. Spin.",
    "Blame the tolerances. Spin.",
    "The spec was wrong. Spin, and pretend it was the plan.",
    "Bug, meet feature. Spin.",
    "Spin with your eyes closed. Engineers call this testing.",
    "Spin, and the person on your left scores it out of ten.",
    "Spin like your deadline depends on it.",
    "Spin while narrating it like a lab demo.",
    "The reviewer wants another iteration. Spin.",
  ],
  choose: [
    "Truth or Dare. Indecision costs extra.",
    "Your call: Truth, Dare, or pass the blame to the next person.",
    "Pick wisely. This is going in the design review.",
    "Truth or Dare, and the group picks your answer card.",
    "Pick one, and the person on your right gets a veto.",
    "Truth or Dare. Commit like it is a final design freeze.",
    "Pick for the person who laughed loudest last round.",
    "Truth or Dare, or explain why both are out of scope.",
    "Pick one in five seconds. That is the whole timeline.",
    "Truth or Dare. The group may request a redesign.",
  ],
};
// deck: 'classroom' (the original lists), 'engineering', 'both' (interleaved, so the first few voiced clips mix both),
// or 'funny' (the party-game deck: Truth deals setup + answer combos, with its own dares, spin-again and choose lines)
export function deckPrompts(deck = 'both') {
  if (deck === 'classroom') return DEFAULT_PROMPTS;
  if (deck === 'funny') return { ...DEFAULT_PROMPTS, ...FUNNY_PROMPTS };
  const mix = (a, b) => { const o = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (b[i]) o.push(b[i]); if (a[i]) o.push(a[i]); } return o; };
  const E = ENGINEERING_PROMPTS;
  if (deck === 'engineering') return { ...DEFAULT_PROMPTS, truth: E.truth, dare: E.dare };
  return { ...DEFAULT_PROMPTS, truth: mix(DEFAULT_PROMPTS.truth, E.truth), dare: mix(DEFAULT_PROMPTS.dare, E.dare) };
}

// The segment name is said (and shown) once, then the prompt. A prompt that opens with the same name ("Service: …",
// "Again: …") loses that opening so nothing is said twice.
export function stripLead(label, text) {
  const L = String(label || '').trim(), t = String(text || '').trim();
  if (!L || t.length <= L.length || t.slice(0, L.length).toLowerCase() !== L.toLowerCase()) return t;
  let i = L.length; while (t[i] === ' ') i++;
  if (!':!.-'.includes(t[i] || 'x')) return t;   // "Truthfully" or "Choose Truth or Dare" stay as written
  i++; while (t[i] === ' ') i++;
  const rest = t.slice(i);
  return rest ? rest[0].toUpperCase() + rest.slice(1) : t;
}
// Value segments whose questions are the same (the usual case: the questions never name the value) share one shuffled
// deck and one set of voice clips, so two values never deal the same question back to back.
// Returns, for each segment index, the index of the first value segment with the same list (or -1 for other kinds).
export function valueShare(segments, valueLists) {
  const seen = new Map();
  return segments.map((s, i) => {
    if (s.kind !== 'value') return -1;
    const key = ((valueLists || {})[s.label] || []).map(t => stripLead(s.label, t)).join('\n');
    if (!seen.has(key)) seen.set(key, i);
    return seen.get(key);
  });
}
export function valuePrompts(label) {
  const L = String(label || 'This value').trim();
  return [
    `Name a time living it cost you something.`,
    `Who in your life shows it best, and how?`,
    `Describe an engineering decision where it should come first.`,
    `When did it clash with another of your values? Which won?`,
    `What would you do differently tomorrow if you took it 10% more seriously?`,
    `Name a product you use every day that gets it right, or wrong.`,
    `When is it easy to live this one, and when is it hard?`,
    `Who taught you this one, on purpose or by accident?`,
    `Give a quick example of it from this week.`,
    `What would a team that ignored it look like?`,
    `How would someone know you care about it without you saying so?`,
    `Is it ever wrong to follow it? When?`,
  ];
}

// ---------------------------------------------------------------- helpers
const ascii = (s) => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E]/g, '');
const cstr = (s) => '"' + ascii(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const f1 = (x) => (Math.round(+x * 100) / 100).toFixed(2) + 'f';
const isOuter = (l) => typeof l.ring === 'string' ? /out|bound/i.test(l.ring) : typeof l.ring === 'number' ? l.ring === 0 : l.r > 26;
const mod = (a, n) => ((a % n) + n) % n;

function normalize(cfg = {}) {
  const segments = (cfg.segments && cfg.segments.length ? cfg.segments : [
    { label: 'Integrity', kind: 'value' }, { label: 'Truth', kind: 'truth' }, { label: 'Courage', kind: 'value' }, { label: 'Dare', kind: 'dare' },
    { label: 'Empathy', kind: 'value' }, { label: 'Again', kind: 'again' }, { label: 'Curiosity', kind: 'value' }, { label: 'Choose', kind: 'choose' },
  ]).map((s) => ({ label: ascii(s.label) || s.kind, kind: KINDS.includes(s.kind) ? s.kind : 'value' }));
  const leds = cfg.leds && cfg.leds.length ? cfg.leds : [
    ...Array.from({ length: 8 }, (_, k) => ({ angle: k * 45, r: 33, ring: 'outer' })),
    ...Array.from({ length: 4 }, (_, k) => ({ angle: 45 + k * 90, r: 19, ring: 'inner' })),
  ];
  const p = cfg.prompts || {};
  const prompts = {};
  const KN = { truth: 'Truth', dare: 'Dare', again: 'Again', choose: 'Choose' };
  for (const k of ['truth', 'dare', 'again', 'choose']) prompts[k] = (p[k] && p[k].length ? p[k] : DEFAULT_PROMPTS[k]).map(t => ascii(stripLead(KN[k], t)));
  // combo deck: Truth deals a setup (the truth list) plus an answer card, said as two clips
  prompts.combo = !!(p.combo && p.answer && p.answer.length && segments.some(s => s.kind === 'truth'));
  prompts.answer = prompts.combo ? p.answer.map(t => ascii(t)) : [];
  prompts.value = {};
  for (const s of segments) if (s.kind === 'value') prompts.value[s.label] = ((p.value && p.value[s.label] && p.value[s.label].length) ? p.value[s.label] : valuePrompts(s.label)).map(t => ascii(stripLead(s.label, t)));
  return { name: ascii(cfg.name || 'Spin Compass'), segments, leds, prompts, pins: { ...DEFAULT_PINS, ...(cfg.pins || {}) }, imuClass: cfg.imuClass, imuLabel: cfg.imuLabel ? ascii(cfg.imuLabel) : '' };
}
const IMU_CLASS = (c) => /^Adafruit_(LSM6DSOX|ISM330DHCX|LSM6DS3TRC|LSM6DS33)$/.test(c.imuClass || '') ? c.imuClass : 'Adafruit_LSM6DSOX';
// clip kind for a segment: truth/dare/again/choose, or value<i> for a value segment (i = segment index)
const clipKind = (s, i) => s.kind === 'value' ? `value${i}` : s.kind;

// ---------------------------------------------------------------- config.h
function configH(c) {
  const N = c.segments.length, span = 360 / N, P = c.pins;
  const segRows = c.segments.map((s, i) => `  { ${cstr(s.label)}, K_${s.kind.toUpperCase()}, ${f1(i * span)}, ${f1((i + 1) * span)} },`).join('\n');
  const ledRows = c.leds.map((l, i) => {
    let mask = 0;
    for (let k = 0; k < N; k++) { const d = mod(l.angle - k * span, 360); if (d <= span + 0.5 || d >= 359.5) mask |= 1 << k; }
    return `  { ${f1(l.angle)}, ${f1(l.r)}, ${isOuter(l) ? 0 : 1}, 0x${mask.toString(16).padStart(2, '0')} },  // #${i}`;
  }).join('\n');
  return `// config.h - generated by Compass Studio for "${c.name}". Edit pins here if your wiring differs.
#pragma once
#include <Arduino.h>

// ---- pins (GPIO numbers, Seeed XIAO ESP32-S3)
#define PIN_LED      ${P.led}   // ${XIAO[P.led] || '?'}  WS2812B data in
#define PIN_HALL     ${P.hall}   // ${XIAO[P.hall] || '?'}  hall switch, active low, internal pull-up
#define PIN_SDA      ${P.sda}   // ${XIAO[P.sda] || '?'}
#define PIN_SCL      ${P.scl}   // ${XIAO[P.scl] || '?'}
#define PIN_IMU_INT  ${P.imuInt}   // ${XIAO[P.imuInt] || '?'}  LSM6DS3TR-C INT1 (motion wake)
#define PIN_BCLK     ${P.bclk}   // ${XIAO[P.bclk] || '?'}  MAX98357A BCLK
#define PIN_LRC      ${P.lrc}   // ${XIAO[P.lrc] || '?'}  MAX98357A LRC
#define PIN_DIN      ${P.din}   // ${XIAO[P.din] || '?'}  MAX98357A DIN
#define PIN_BATT     ${P.batt}   // ${XIAO[P.batt] || '?'}  battery through a 1:2 divider

// ---- tuning
#define IMU_ADDR          0x6A    // 0x6B if SDO/SA0 is pulled high
#define GYRO_SIGN         1.0f    // flip to -1 if the wheel reads backwards (depends on how the IMU is mounted)
#define HALL_OFFSET_DEG   0.0f    // angle from the magnet to the pointer, measured on the disc
#define HALL_DEBOUNCE_US  2000    // ignore re-triggers closer than this (caps at 30000 rpm)
#define SWITCH_RPM        300.0f  // above: hall period gives the angle. below: integrate the gyro
#define START_DPS         150.0f  // counts as a spin
#define MIN_PEAK_DPS      360.0f  // a spin must reach this to deal a prompt
#define SLOW_DPS          900.0f  // SPINNING -> SLOWING (150 rpm)
#define TICK_DPS          240.0f  // ticker lights below this
#define LAND_DPS          10.0f   // landed when |w| stays under this...
#define LAND_MS           300     // ...for this long
#define LANDED_SHOW_MS    8000    // how long the landed segment pulses
#define IDLE_SLEEP_MS     60000   // light sleep after this much stillness
#define BATT_LOW_V        3.50f
#define BATT_CUTOFF_V     3.30f   // deep sleep below this to protect the cell
#define BATT_DIVIDER      2.0f
#define LED_BRIGHTNESS    90      // 0-255; WS2812B at full white is ~50 mA each
#define PLAY_PROMPT_CLIP  1       // 0 = only play /clips/<segment>.wav

// ---- segments: angles in degrees clockwise from disc north, seen from the top
enum Kind : uint8_t { K_VALUE, K_TRUTH, K_DARE, K_AGAIN, K_CHOOSE };
struct Segment { const char* label; Kind kind; float a0; float a1; };
#define NUM_SEG ${N}
static const Segment SEGMENTS[NUM_SEG] = {
${segRows}
};

// ---- LEDs in chain order (data in -> #0 -> #1 ...). ring 0 = boundary ring, 1 = inner ring.
// segMask: bit k set if the LED belongs to segment k (lit when that segment lands).
struct LedPos { float angle; float r; uint8_t ring; uint8_t segMask; };
#define NUM_LEDS ${c.leds.length}
static const LedPos LEDS[NUM_LEDS] = {
${ledRows}
};
`;
}

// ---------------------------------------------------------------- prompts.h
function promptsH(c) {
  const arr = (name, L) => `static const char* const ${name}[] = {\n${L.map((s) => '  ' + cstr(s) + ',').join('\n')}\n};`;
  const parts = [`// prompts.h - generated by Compass Studio. Text for Serial and for recording clips.
// Clip for prompt n of a list: /prompts/<clip>-<n>.wav  (clip = truth, dare, again, choose, answer, or value<segment>)
#pragma once`];
  parts.push(arr('P_TRUTH', c.prompts.truth), arr('P_DARE', c.prompts.dare), arr('P_AGAIN', c.prompts.again), arr('P_CHOOSE', c.prompts.choose));
  const answers = c.prompts.combo ? c.prompts.answer : [''];
  parts.push(`// Combo deck: on Truth, a setup from P_TRUTH then an answer card from P_ANSWER (/prompts/answer-<n>.wav).
#define COMBO_TRUTH ${c.prompts.combo ? 1 : 0}
#define NUM_ANSWERS ${c.prompts.combo ? answers.length : 0}`, arr('P_ANSWER', answers));
  const share = valueShare(c.segments, c.prompts.value);
  const rows = c.segments.map((s, i) => {
    if (s.kind === 'value') {   // values with the same questions share one list, one deck and one set of clips
      const j = share[i];
      if (j === i) parts.push(arr(`P_VALUE${i}`, c.prompts.value[s.label]));
      return `  { P_VALUE${j}, ${c.prompts.value[s.label].length}, "value${j}", ${j} },`;
    }
    const nm = 'P_' + s.kind.toUpperCase();
    return `  { ${nm}, ${c.prompts[s.kind].length}, "${s.kind}", ${i} },`;
  });
  const longest = Math.max(1, answers.length, ...['truth', 'dare', 'again', 'choose'].map(k => c.prompts[k].length), ...Object.values(c.prompts.value).map(L => L.length));
  parts.push(`#define MAX_PROMPTS ${Math.min(255, longest)}`);
  parts.push(`struct PromptList { const char* const* items; uint8_t count; const char* clip; uint8_t deck; };   // deck: shared by values with the same questions
static const PromptList SEG_PROMPTS[NUM_SEG] = {
${rows.join('\n')}
};`);
  return parts.join('\n\n') + '\n';
}

// ---------------------------------------------------------------- SpinCompass.ino
function ino(c) {
  return `// SpinCompass.ino - "${c.name}". Generated by Compass Studio (BFMS, WRIT 340).
// A disc on a 608 bearing between two still finger caps. Hall pulse once per turn + gyro z.
// States: IDLE -> SPINNING -> SLOWING -> LANDED -> IDLE.  Not compiled or tested on hardware yet.

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_NeoPixel.h>
#include <${IMU_CLASS(c)}.h>
#include <FS.h>
#include <LittleFS.h>
#include <ESP_I2S.h>
#include "esp_sleep.h"
#include "driver/gpio.h"
#include "config.h"
#include "prompts.h"

Adafruit_NeoPixel strip(NUM_LEDS, PIN_LED, NEO_GRB + NEO_KHZ800);
${IMU_CLASS(c)} imu;
I2SClass i2s;
bool imuOk = false, fsOk = false, audioOk = false;

// ---- hall index (ISR)
volatile uint32_t hallLast = 0, hallPrev = 0, hallCount = 0;
void IRAM_ATTR hallISR() {
  uint32_t t = micros();
  if (t - hallLast < HALL_DEBOUNCE_US) return;
  hallPrev = hallLast; hallLast = t; hallCount++;
}

// ---- motion estimate
float gyroBias = 0;        // dps
float gz = 0;              // latest gyro z, dps, clockwise-positive seen from the top
float omega = 0;           // best estimate of disc speed, dps, signed
float phi = 0;             // disc rotation since north last passed the pointer, deg, clockwise
uint32_t seenHall = 0, lastMicros = 0;
float spinTurns = 0;       // gyro-integrated turns this spin (spin-the-bottle check)
uint32_t spinHalls = 0;

enum State { IDLE, SPINNING, SLOWING, LANDED };
State state = IDLE;
uint32_t stateMs = 0, stillSinceMs = 0, lastMoveMs = 0;
float peakDps = 0;
int landedSeg = -1, lastSegUnder = -1;
bool bottleMode = false;
uint32_t flashUntil[NUM_LEDS];
float battV = 4.0f; uint32_t battMs = 0;
// Shuffle decks: each list is dealt in a shuffled order, no repeats until every prompt has come up.
// Deck NUM_SEG is the answer cards for the combo deck.
uint8_t deckOrder[NUM_SEG + 1][MAX_PROMPTS];
uint8_t deckLeft[NUM_SEG + 1];
int deckLast[NUM_SEG + 1];

static float wrap360(float a) { a = fmodf(a, 360.0f); return a < 0 ? a + 360.0f : a; }
static float angDist(float a, float b) { float d = wrap360(a - b); return d > 180 ? 360 - d : d; }
static int segmentAt(float u) {
  for (int i = 0; i < NUM_SEG; i++) if (u >= SEGMENTS[i].a0 && u < SEGMENTS[i].a1) return i;
  return NUM_SEG - 1;
}
// disc angle sitting under the fixed pointer
static float underPointer() { return wrap360(-phi + HALL_OFFSET_DEG); }

// ---- audio: a small task so the lights keep running while a clip plays
QueueHandle_t audioQ;
struct Clip { char path[40]; };
void audioTask(void*) {
  Clip c;
  for (;;) {
    if (xQueueReceive(audioQ, &c, portMAX_DELAY) != pdTRUE) continue;
    if (!fsOk || !audioOk || !LittleFS.exists(c.path)) { Serial.printf("clip missing: %s\\n", c.path); continue; }
    File f = LittleFS.open(c.path, "r");
    size_t n = f.size();
    uint8_t* buf = (uint8_t*)(psramFound() ? ps_malloc(n) : malloc(n));
    if (buf) { f.read(buf, n); i2s.playWAV(buf, n); free(buf); }   // playWAV reads the header and sets the rate
    f.close();
  }
}
void playClip(const char* path) { Clip c; strncpy(c.path, path, sizeof(c.path) - 1); c.path[sizeof(c.path) - 1] = 0; xQueueSend(audioQ, &c, 0); }

// ---- sensors
void readGyro() {
  if (!imuOk) { gz = 0; return; }
  sensors_event_t a, g, t;
  imu.getEvent(&a, &g, &t);
  gz = GYRO_SIGN * (g.gyro.z * 57.29578f - gyroBias);   // rad/s -> dps
}
void calibrateGyro() {
  if (!imuOk) return;
  float sum = 0; sensors_event_t a, g, t;
  for (int i = 0; i < 200; i++) { imu.getEvent(&a, &g, &t); sum += g.gyro.z * 57.29578f; delay(2); }
  gyroBias = sum / 200;
}
void readBattery() {
  uint32_t mv = 0;
  for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(PIN_BATT);
  battV = (mv / 8) * BATT_DIVIDER / 1000.0f;
}

void updateMotion(float dt) {
  readGyro();
  uint32_t now = micros();
  noInterrupts(); uint32_t hl = hallLast, hp = hallPrev, hc = hallCount; interrupts();
  bool newPass = hc != seenHall;
  if (newPass) { seenHall = hc; spinHalls++; }
  uint32_t period = (hc >= 2) ? hl - hp : 0;
  bool hallFresh = period > 0 && (now - hl) < 2 * period;
  float hallRpm = hallFresh ? 60e6f / period : 0;
  float dir = gz >= 0 ? 1.0f : -1.0f;     // the gyro still gives direction when it saturates

  if (hallRpm > SWITCH_RPM) {
    omega = dir * hallRpm * 6.0f;
    phi = dir * 360.0f * (float)(now - hl) / (float)period;
  } else {
    omega = gz;
    if (newPass) phi = 0;                 // re-zero on each pass
    phi += gz * dt;
  }
  spinTurns += fabsf(omega) * dt / 360.0f;
}

// ---- lights
uint32_t rgb(uint8_t r, uint8_t g, uint8_t b, float k) { k = constrain(k, 0.0f, 1.0f); return strip.Color(r * k, g * k, b * k); }
uint32_t kindColor(Kind k, float s) {
  switch (k) {
    case K_TRUTH:  return rgb(70, 170, 255, s);
    case K_DARE:   return rgb(255, 96, 56, s);
    case K_AGAIN:  return rgb(90, 220, 130, s);
    case K_CHOOSE: return rgb(190, 130, 255, s);
    default:       return rgb(255, 190, 0, s);
  }
}
uint32_t hueColor(float h) { return strip.gamma32(strip.ColorHSV((uint16_t)(wrap360(h) * 182.04f))); }

void showPOV() {
  // each LED's colour depends on where it is in the room (world angle), so the eye sees a still pattern
  float drift = millis() * 0.03f;
  for (int i = 0; i < NUM_LEDS; i++) {
    float w = wrap360(LEDS[i].angle + phi - HALL_OFFSET_DEG);
    uint32_t c;
    if (LEDS[i].ring == 0) c = angDist(w, 0) < 8 ? strip.Color(255, 255, 255) : hueColor(w + drift);
    else c = fmodf(w, 90.0f) < 14 ? strip.Color(255, 214, 90) : 0;
    strip.setPixelColor(i, c);
  }
}
void showChase() {
  float dir = omega >= 0 ? 1 : -1, head = wrap360(-dir * millis() * 0.3f);
  Kind k = SEGMENTS[segmentAt(underPointer())].kind;
  for (int i = 0; i < NUM_LEDS; i++) {
    if (LEDS[i].ring == 0) {
      float w = wrap360(LEDS[i].angle + phi), d = angDist(w, head), f = max(0.0f, 1 - d / 70.0f);
      strip.setPixelColor(i, rgb(255, 224, 140, f * f));
    } else strip.setPixelColor(i, kindColor(k, 0.35f));
  }
}
void showTicker() {
  uint32_t ms = millis();
  int seg = segmentAt(underPointer());
  if (lastSegUnder >= 0 && seg != lastSegUnder) {
    // flash the boundary LED that just passed the pointer
    bool fwd = (seg == (lastSegUnder + 1) % NUM_SEG);
    float b = fwd ? SEGMENTS[seg].a0 : SEGMENTS[lastSegUnder].a0;
    int best = -1; float bd = 1e9;
    for (int i = 0; i < NUM_LEDS; i++) if (LEDS[i].ring == 0) { float d = angDist(LEDS[i].angle, b); if (d < bd) { bd = d; best = i; } }
    if (best >= 0) flashUntil[best] = ms + 160;
  }
  lastSegUnder = seg;
  for (int i = 0; i < NUM_LEDS; i++) {
    if (LEDS[i].ring == 0) strip.setPixelColor(i, (int32_t)(flashUntil[i] - ms) > 0 ? strip.Color(255, 255, 255) : 0);
    else strip.setPixelColor(i, kindColor(SEGMENTS[seg].kind, 0.55f));
  }
}
void showLanded() {
  float p = 0.55f + 0.45f * sinf(millis() * 0.0052f);
  for (int i = 0; i < NUM_LEDS; i++) {
    if (bottleMode) {   // spun flat on a table: light disc north, the arrow
      bool north = LEDS[i].ring == 0 && angDist(LEDS[i].angle, 0) < 1;
      strip.setPixelColor(i, north ? rgb(255, 255, 255, p) : 0);
    } else {
      bool on = LEDS[i].segMask & (1 << landedSeg);
      strip.setPixelColor(i, on ? kindColor(SEGMENTS[landedSeg].kind, p) : 0);
    }
  }
}
void showIdle() {
  strip.clear();
  if (battV < BATT_LOW_V) {                       // low battery: slow red pulse on LED 0
    float p = 0.5f + 0.5f * sinf(millis() * 0.003f);
    strip.setPixelColor(0, rgb(255, 0, 0, p * 0.6f));
  }
}

// ---- landing
// Next prompt from deck d (count prompts): reshuffle when it runs out, and never start a new round with the last one dealt.
int deal(int d, int count) {
  if (count <= 1) return 0;
  if (count > MAX_PROMPTS) count = MAX_PROMPTS;
  if (deckLeft[d] == 0) {
    for (int i = 0; i < count; i++) deckOrder[d][i] = i;
    for (int i = count - 1; i > 0; i--) { int j = random(i + 1); uint8_t t = deckOrder[d][i]; deckOrder[d][i] = deckOrder[d][j]; deckOrder[d][j] = t; }
    if (deckOrder[d][count - 1] == deckLast[d]) { uint8_t t = deckOrder[d][0]; deckOrder[d][0] = deckOrder[d][count - 1]; deckOrder[d][count - 1] = t; }
    deckLeft[d] = count;
  }
  int n = deckOrder[d][--deckLeft[d]];
  deckLast[d] = n;
  return n;
}

void dealPrompt(int seg) {
  char path[40];
  snprintf(path, sizeof(path), "/clips/%d.wav", seg);
  playClip(path);
  const PromptList& L = SEG_PROMPTS[seg];
  int n = deal(L.deck, L.count);
  if (COMBO_TRUTH && SEGMENTS[seg].kind == K_TRUTH && NUM_ANSWERS > 0) {   // setup + a random answer card
    int a = deal(NUM_SEG, NUM_ANSWERS);
    Serial.printf("LANDED %d %s: %s %s\\n", seg, SEGMENTS[seg].label, L.items[n], P_ANSWER[a]);
    if (PLAY_PROMPT_CLIP) {
      snprintf(path, sizeof(path), "/prompts/%s-%d.wav", L.clip, n); playClip(path);
      snprintf(path, sizeof(path), "/prompts/answer-%d.wav", a); playClip(path);
    }
    return;
  }
  Serial.printf("LANDED %d %s: %s\\n", seg, SEGMENTS[seg].label, L.items[n]);
  if (PLAY_PROMPT_CLIP) {   // the name once (above), then the prompt; prompts never repeat the name
    snprintf(path, sizeof(path), "/prompts/%s-%d.wav", L.clip, n);
    playClip(path);
  }
}

void setState(State s) { state = s; stateMs = millis(); }

// ---- sleep
void goLightSleep() {
  strip.clear(); strip.show();
  Serial.println("light sleep"); Serial.flush();
  gpio_wakeup_enable((gpio_num_t)PIN_HALL, GPIO_INTR_LOW_LEVEL);
  gpio_wakeup_enable((gpio_num_t)PIN_IMU_INT, GPIO_INTR_HIGH_LEVEL);
  esp_sleep_enable_gpio_wakeup();
  esp_light_sleep_start();
  lastMicros = micros(); lastMoveMs = millis(); stillSinceMs = millis();
  Serial.println("awake");
}

// ---- setup / loop
void setup() {
  Serial.begin(115200);
  strip.begin(); strip.setBrightness(LED_BRIGHTNESS); strip.clear(); strip.show();
  pinMode(PIN_HALL, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_HALL), hallISR, FALLING);
  pinMode(PIN_IMU_INT, INPUT);
  analogReadResolution(12);

  Wire.begin(PIN_SDA, PIN_SCL, 400000);
  imuOk = imu.begin_I2C(0x6A, &Wire) || imu.begin_I2C(0x6B, &Wire);   // boards ship on either address
  if (imuOk) {
    imu.setGyroRange(LSM6DS_GYRO_RANGE_2000_DPS);
    imu.setGyroDataRate(LSM6DS_RATE_833_HZ);
    imu.setAccelDataRate(LSM6DS_RATE_104_HZ);
    imu.enableWakeup(true, 1, 2);                      // small shake wakes us (check thresholds on hardware)
    imu.configInt1(false, false, false, false, true);  // wake-up event on INT1
    calibrateGyro();
  } else Serial.println("IMU not found");

  fsOk = LittleFS.begin(false);
  if (!fsOk) Serial.println("LittleFS mount failed (upload the data folder)");
  i2s.setPins(PIN_BCLK, PIN_LRC, PIN_DIN);
  audioOk = i2s.begin(I2S_MODE_STD, 22050, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
  if (!audioOk) Serial.println("I2S init failed");
  audioQ = xQueueCreate(4, sizeof(Clip));
  xTaskCreatePinnedToCore(audioTask, "audio", 6144, nullptr, 1, nullptr, 0);

  for (int i = 0; i <= NUM_SEG; i++) { deckLeft[i] = 0; deckLast[i] = -1; }
  randomSeed(esp_random());
  readBattery();
  lastMicros = micros(); lastMoveMs = millis();
  Serial.printf("${c.name.replace(/["\%]/g, '')}: %d segments, %d LEDs, battery %.2f V\\n", NUM_SEG, NUM_LEDS, battV);
  if (fsOk && LittleFS.exists("/clips/hello.wav")) playClip("/clips/hello.wav");
}

void loop() {
  uint32_t nowUs = micros(), ms = millis();
  float dt = (nowUs - lastMicros) * 1e-6f; lastMicros = nowUs;
  updateMotion(dt);
  float w = fabsf(omega);
  if (w > START_DPS) lastMoveMs = ms;

  switch (state) {
    case IDLE:
    case LANDED:
      if (w > START_DPS) {                              // a new spin (also cuts a landed show short)
        peakDps = 0; spinTurns = 0; spinHalls = 0; bottleMode = false; lastSegUnder = -1;
        setState(SPINNING);
      } else if (state == LANDED && ms - stateMs > LANDED_SHOW_MS) setState(IDLE);
      break;
    case SPINNING:
      if (w < SLOW_DPS) setState(SLOWING);
      break;
    case SLOWING:
      if (w > SLOW_DPS * 1.3f) setState(SPINNING);
      if (w < LAND_DPS) { if (!stillSinceMs) stillSinceMs = ms; } else stillSinceMs = 0;
      if (stillSinceMs && ms - stillSinceMs > LAND_MS) {
        stillSinceMs = 0;
        if (peakDps < MIN_PEAK_DPS) { setState(IDLE); break; }
        // more than 1.5 turns without a hall pass: the caps turned with the disc, so it was spun flat on a table
        bottleMode = spinHalls == 0 && spinTurns > 1.5f;
        landedSeg = segmentAt(underPointer());
        setState(LANDED);
        if (bottleMode) { Serial.println("SPIN THE BOTTLE"); playClip("/clips/bottle.wav"); }
        else dealPrompt(landedSeg);
      }
      break;
  }
  if (w > peakDps) peakDps = w;

  switch (state) {
    case SPINNING: if (w > TICK_DPS) { showPOV(); break; }   // falls through when slow
    case SLOWING:  if (w > TICK_DPS) showChase(); else showTicker(); break;
    case LANDED:   showLanded(); break;
    default:       showIdle(); break;
  }
  strip.show();

  if (ms - battMs > 10000) {
    battMs = ms; readBattery();
    if (battV < BATT_CUTOFF_V && state == IDLE) {
      Serial.println("battery cutoff, deep sleep (plug in USB-C and press reset)");
      strip.clear(); strip.show(); esp_deep_sleep_start();
    }
  }
  if (state == IDLE && ms - lastMoveMs > IDLE_SLEEP_MS) goLightSleep();
  delayMicroseconds(500);   // ~1.5 kHz loop; gyro runs at 833 Hz
}
`;
}

// ---------------------------------------------------------------- README.txt
function readme(c) {
  const P = c.pins, N = c.segments.length;
  const row = (a, b, d) => `  ${a.padEnd(22)}${b.padEnd(16)}${d}`;
  const clips = c.segments.map((s, i) => `  /clips/${i}.wav   "${s.label}"`).join('\n');
  const share = valueShare(c.segments, c.prompts.value);
  const lists = c.segments.map((s, i) => [s, i]).filter(([s, i]) => s.kind === 'value' && share[i] === i).map(([s, i]) => `  value${i}-0 .. value${i}-${c.prompts.value[s.label].length - 1}  (${c.segments.filter((t, k) => share[k] === i).map(t => t.label).join(', ')})`);
  for (const k of ['truth', 'dare', 'choose']) lists.push(`  ${k}-0 .. ${k}-${c.prompts[k].length - 1}`);
  return `SPIN COMPASS FIRMWARE - "${c.name}"
Generated by Compass Studio (Baum Family Maker Space, WRIT 340).

STATUS: not compiled or tested on hardware yet. Treat it as a first draft:
expect to fix compile errors, tune thresholds, and check the IMU wake interrupt.

PARTS
  Seeed XIAO ESP32-S3 (USB-C, LiPo charger built in), LiPo 150-250 mAh, <= 5 mm thick
  ${c.leds.length} x WS2812B on 10 mm round PCBs (${c.leds.filter(isOuter).length} on the segment boundaries, ${c.leds.filter((l) => !isOuter(l)).length} on the inner ring)
  ${c.imuLabel || 'LSM6DSOX breakout'} (I2C 0x6A or 0x6B), +/-2000 dps gyro
  Always-on hall switch, open-drain: Melexis US5881 (Adafruit 158) or TI DRV5033AJ.
    The US5881 needs 3.5 V+, so power it from BAT+ (3.5-4.2 V), not 3V3; its
    open-drain output is pulled up to 3V3, so the pin stays safe. It only sees a
    SOUTH pole: glue the cap magnet south side down. Do NOT use micropower parts
    (DRV5032, AH1815) or A3144 (4.5 V min).
  Magnet in the TOP CAP at the pointer, south pole facing the disc; hall sensor in the DISC at disc north.
  MAX98357A I2S amp + 20 mm 8 ohm speaker
  2 x 100k resistors (battery divider), 608 bearing

WIRING (XIAO pin / GPIO)
${row('Function', 'XIAO pin', 'GPIO')}
${row('LED data in', XIAO[P.led] || '?', P.led + '   (330 ohm in series helps)')}
${row('Hall OUT', XIAO[P.hall] || '?', P.hall + '   (active low, internal pull-up)')}
${row('IMU SDA', XIAO[P.sda] || '?', P.sda)}
${row('IMU SCL', XIAO[P.scl] || '?', P.scl)}
${row('IMU INT1', XIAO[P.imuInt] || '?', P.imuInt + '   (motion wake)')}
${row('Amp BCLK', XIAO[P.bclk] || '?', P.bclk)}
${row('Amp LRC', XIAO[P.lrc] || '?', P.lrc)}
${row('Amp DIN', XIAO[P.din] || '?', P.din)}
${row('Battery sense', XIAO[P.batt] || '?', P.batt + '   (BAT+ -100k- pin -100k- GND)')}
  LEDs, amp VIN, IMU: 3V3 (or BAT+ for the LEDs and amp if 3V3 sags). Hall VCC: BAT+.
  Hall OUT also gets a 10k pull-up to 3V3 (the internal pull-up works for a first test).
  LED chain order must match the LEDS[] table in config.h (#0 first).
  Idle draw: WS2812Bs take ~1 mA each even when dark, the hall part a few mA.
  A switch on LED power would help battery life; not in this design yet.

SEGMENTS (clockwise from disc north, seen from the top)
${c.segments.map((s, i) => `  ${i}  ${(i * 360 / N).toFixed(1).padStart(5)}-${((i + 1) * 360 / N).toFixed(1).padStart(5)} deg  ${s.kind.padEnd(7)} ${s.label}`).join('\n')}

ARDUINO IDE SETUP
  1. Boards Manager: "esp32 by Espressif Systems" version 3.x (needed for ESP_I2S.h).
  2. Board: "XIAO_ESP32S3". USB CDC On Boot: Enabled. PSRAM: OPI PSRAM.
     Partition scheme: one with a large SPIFFS/LittleFS area, e.g.
     "8M with spiffs (3MB APP/1.5MB SPIFFS)".
  3. Library Manager: "Adafruit NeoPixel", "Adafruit LSM6DS" (we use its
     class picked from the IMU board you chose; it pulls in Adafruit BusIO + Unified Sensor).
     LittleFS, FS, ESP_I2S and Wire come with the ESP32 core.
  4. Open SpinCompass/SpinCompass.ino, pick the port, Upload. Serial 115200.

SOUND CLIPS (LittleFS)
  WAV, 16-bit PCM, mono, 16 or 22.05 kHz. 1.5 MB holds about 45 s at 16 kHz.
  Put them in SpinCompass/data/ before uploading:
${clips}
  /clips/hello.wav  (optional, plays at power-on)
  /clips/bottle.wav (spun flat on a table: "You!")
  /prompts/<clip>-<n>.wav, one per prompt line in prompts.h (optional,
  set PLAY_PROMPT_CLIP 0 to skip):
${lists.join('\n')}
  Missing clips are skipped and named on Serial.
  Upload the data folder: install the "arduino-littlefs-upload" plugin
  (earlephilhower) for Arduino IDE 2.x, close Serial Monitor, then
  Ctrl+Shift+P -> "Upload LittleFS to Pico/ESP8266/ESP32".

HOW IT WORKS
  Hall pass = disc north under the pointer. Above ${'~'}300 rpm the angle is
  360 x (time since pass) / (last period); the gyro only gives direction there
  (it saturates near 333 rpm). Below 300 rpm it integrates gyro z, re-zeroed
  on each pass. Landed when |w| < 10 dps for 300 ms; the segment under the
  pointer plays /clips/<segment>.wav then a prompt clip. More than 1.5 turns
  with no hall pass means it was spun flat on a table: north LED lights.
  Light sleep after 60 s still; wakes on a hall pulse or IMU motion.
  Red pulse under 3.5 V; deep sleep under 3.3 V.

NOT TESTED / CHECK FIRST
  - Nothing here has been compiled or run on hardware yet.
  - GYRO_SIGN and HALL_OFFSET_DEG depend on how parts sit in the print.
  - IMU wake-up (enableWakeup/configInt1) thresholds and polarity on the
    LSM6DS3TR-C; GPIO light-sleep wake on the S3.
  - POV timing: LED update rate vs. spin speed; WS2812B data on 3.3 V logic.
  - playWAV loads a whole clip into RAM (PSRAM if present); keep clips short.
  - Battery reading needs calibrating against a meter.
`;
}

export function firmwareSketch(cfg = {}) {
  const c = normalize(cfg);
  return {
    files: [
      ['SpinCompass/SpinCompass.ino', ino(c)],
      ['SpinCompass/config.h', configH(c)],
      ['SpinCompass/prompts.h', promptsH(c)],
      ['SpinCompass/README.txt', readme(c)],
    ],
  };
}
