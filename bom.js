// bom.js — the Spin Compass parts list, from real listings checked on 2026-10-27 (three research passes; each page
// was opened unless the note says the price came from a search result). Prices change: check at checkout.
// pack/packPrice = how the part is sold, so "to buy" rounds up the way a real order does.

export const CHECKED = '2026-10-27';
// Order plan: Adafruit + Amazon only (consolidated 2026-10-27). Filament comes from BFMS stock; the Prusa links are for reordering.
export const CATALOG = {
  board: { item: 'Seeed Studio XIAO ESP32-S3, 3-pack', spec: '21 × 17.8 mm, USB-C, LiPo charging, 8 MB flash + 8 MB PSRAM', unit: 9.0, pack: 3, packPrice: 26.99, store: 'Amazon', link: 'https://www.amazon.com/dp/B0DJ6NQFKX', note: 'Sold by Seeed Studio Official; free shipping Nov 3–10 (not Prime). Single: B0BYSB66S5, $16.99.' },
  hall: { item: 'Hall sensor US5881 (Adafruit 158)', spec: 'always-on, open-drain, TO-92S; power it from BAT+ (needs 3.5 V+); south pole only', unit: 2.0, pack: 1, store: 'Adafruit', link: 'https://www.adafruit.com/product/158', note: 'In stock. Glue the cap magnet south side down. Buy a spare.' },
  amp:      { item: 'Adafruit MAX98357A I2S amp (3006)', spec: '19.4 × 17.8 × 3.0 mm', unit: 5.95, pack: 1, store: 'Adafruit', link: 'https://www.adafruit.com/product/3006', note: 'In stock.' },
  speaker20:{ item: 'MECCANIXITY 20 mm speaker, 8 Ω 1 W (4-pack)', spec: 'Ø20 × 3.7 mm, PH1.25 plug', unit: 1.87, pack: 4, packPrice: 7.49, store: 'Amazon', link: 'https://www.amazon.com/dp/B0GR4G3W18', note: 'Low stock when checked. Backup: SparkFun COM-26553, $1.25 each.' },
  speaker15:{ item: 'Rebower 15 mm speaker, 8 Ω 1 W (8-pack)', spec: 'Ø15 × 3.7 mm, PH1.25 plug', unit: 1.06, pack: 8, packPrice: 8.49, store: 'Amazon', link: 'https://www.amazon.com/dp/B0HGVDP7KT', note: 'Ships Nov 9–17.' },
  led:      { item: 'DIY-Module WS2812B on Ø10 mm PCB (50-pack)', spec: 'Ø10 mm, 3 mm tall, chainable pads', unit: 0.24, pack: 50, packPrice: 11.99, store: 'Amazon', link: 'https://www.amazon.com/dp/B0DY88KS79', note: 'Generic chip. Known-good backup: Adafruit 1612, 5 for $4.95.' },
  bearing: { item: 'Antrader 608 bearings for fidget spinners (10)', spec: '8 × 22 × 7 mm, open (spins longest)', unit: 0.66, pack: 10, packPrice: 6.59, store: 'Amazon', link: 'https://www.amazon.com/dp/B07XD6PLV1', note: 'Prime. Sealed alternative: PGN 608-2RS B07XVPGMXQ, $9.95.' },
  magnet: { item: 'Neodymium disc magnets 3 × 1.5 mm, N48 (100)', spec: '3 × 1.5 mm', unit: 0.19, pack: 100, packPrice: 19.49, store: 'Amazon', link: 'https://www.amazon.com/dp/B0C67HB59N', note: 'Prime. Cheaper 3 × 1 mm 250-pack (B0F13KHDZH, $9.99) is a weaker field.' },
  bb: { item: 'BC Precision .177 steel BBs (500)', spec: '4.5 mm, ~0.37 g each', unit: 0.016, pack: 500, packPrice: 7.95, store: 'Amazon', link: 'https://www.amazon.com/dp/B01KKT2AU8', note: 'Prime. Or Daisy 350-count, B00279OFNA, $8.99.' },
  screw: { item: 'iexcell M2 × 6 flat head socket screws (100)', spec: '304 stainless, 0.4 pitch, 90° head Ø3.85, 1.3 mm hex; includes the hex key', unit: 0.083, pack: 100, packPrice: 8.26, store: 'Amazon', link: 'https://www.amazon.com/dp/B0F8J59QF7', note: 'Prime (Oct 29 when checked). Backup: PATIKIL M2 × 6 flat head, 100, B0DLWNLVBG, $6.89.' },
  insert: { item: 'uxcell M2 × 4 brass heat-set inserts (100)', spec: 'M2, 4 mm long, Ø3.5 knurl; printed hole Ø3.2, 5 mm deep', unit: 0.077, pack: 100, packPrice: 7.69, store: 'Amazon', link: 'https://www.amazon.com/dp/B0CTCQ6MHK', note: 'Prime (Oct 29 when checked). Set with a soldering iron at ~10–15 °C over the print temperature, flush with the boss. ruthex RX-M2x4 (70, B088QJG676, $9.99) is the reference size but shipped Nov 8–16.' },
  resistor: { item: 'Adafruit 100 kΩ resistors (25)', spec: '1/4 W through-hole; 2 per board for the battery divider', unit: 0.038, pack: 25, packPrice: 0.95, store: 'Adafruit', link: 'https://www.adafruit.com/product/2787', note: 'In stock.' },
  wire: { item: 'Adafruit 30 AWG silicone wire, 2 m (black 2003 + white 2006)', spec: 'two colours: power and data', unit: 0.38, pack: 2, packPrice: 0.75, store: 'Adafruit', link: 'https://www.adafruit.com/product/2003', note: 'Buy one black (2003) and one white (2006); red 2 m was out of stock.', per: 'm' },
  ca: { item: 'ALECPEA thin CA glue, 20 g', spec: 'holds BBs, magnet, LED boards', unit: 0, pack: 1, packPrice: 5.39, store: 'Amazon', link: 'https://www.amazon.com/dp/B0DKP4TVSF', note: 'Prime. Skip if BFMS has CA.', shared: true },
};
export const BATTERY_CATALOG = {
  '302025': { item: 'Adafruit LiPo 150 mAh (1317)', spec: '3.8 × 19.75 × 26 mm incl. protection, JST-PH', unit: 5.95, pack: 1, store: 'Adafruit', link: 'https://www.adafruit.com/product/1317', note: 'In stock, ships today. $5.36 at 10+.' },
  '402025': { item: 'JIATONG LiPo 402025 140 mAh (2-pack)', spec: '4 × 20 × 25 mm, protected; check the connector', unit: 5.0, pack: 2, packPrice: 9.99, store: 'Amazon', link: 'https://www.amazon.com/dp/B09PYBTRGV', note: '140 mAh, not 180. Seller ships Nov 10–25, +$6.49 shipping. Faster: Adafruit 1317.' },
  '502025': { item: 'AKZYTUE LiPo 502025 200 mAh', spec: '5 × 20 × 27 mm incl. protection, JST-PH2.0', unit: 7.49, pack: 1, packPrice: 7.49, store: 'Amazon', link: 'https://www.amazon.com/dp/B07BTR3G4X', note: 'Check polarity before plugging in.' },
  '402030': { item: 'JLJLUP LiPo 250 mAh (4-pack)', spec: '5 × 20 × 30 mm, protected, PH2.0', unit: 2.5, pack: 4, packPrice: 9.99, store: 'Amazon', link: 'https://www.amazon.com/dp/B0H2PKD9NM', note: 'Sold as 402030, really 5 mm thick. Best value.' },
};
export const IMU_CATALOG = {
  dsox:   { item: 'Adafruit LSM6DSOX 6-DoF IMU (4438)', spec: '25.6 × 17.8 × 4.6 mm, STEMMA QT', unit: 11.95, pack: 1, store: 'Adafruit', link: 'https://www.adafruit.com/product/4438', note: 'In stock. The LSM6DS3TR-C version (4503) was out of stock.' },
  pololu: { item: 'Pololu LSM6DSO carrier (2798)', spec: '23 × 13 × 3 mm, 1.8–5.5 V', unit: 19.95, pack: 1, store: 'Pololu', link: 'https://www.pololu.com/product/2798', note: 'Smaller and thinner; backorder allowed.' },
  ism330: { item: 'SparkFun Micro ISM330DHCX (SEN-20176)', spec: '19 × 7.6 mm, 3.3 V only', unit: 26.5, pack: 1, store: 'SparkFun', link: 'https://www.sparkfun.com/products/20176', note: 'Smallest; in stock.' },
};
export const FILAMENT = {
  perKg: 23.99, density: 1.24, fill: 0.75, store: 'BFMS stock',
  links: { body: 'https://www.prusa3d.com/product/prusament-pla-lipstick-red-1kg/', letters: 'https://www.prusa3d.com/product/prusament-pla-pristine-white-1kg/', gold: 'https://www.prusa3d.com/product/prusament-pla-pineapple-yellow-1kg/', caps: 'https://www.prusa3d.com/product/prusament-pla-lipstick-red-1kg/' },
  names: { body: 'Prusament PLA Lipstick Red', letters: 'Prusament PLA Pristine White', gold: 'Prusament PLA Pineapple Yellow (no gold PLA)', caps: 'Prusament PLA Lipstick Red' },
  note: 'From BFMS stock. Reorder: Prusament $23.99/kg on sale (normally $29.99).',
};

export function spinBom(S, info, grams, qty = 1) {
  const rows = [];
  const add = (c, per, group = 'Electronics') => {
    if (!per) return;
    const need = per * qty, pack = c.pack || 1, packs = Math.ceil(need / pack);
    const buy = c.shared ? '1 (shared)' : pack > 1 ? `${packs} × ${pack}` : String(need);
    const order = c.shared ? (c.packPrice || 0) : (c.packPrice ? packs * c.packPrice : need * c.unit);
    rows.push({ group, item: c.item, spec: c.spec, per, unitLabel: c.per || 'ea', need, buy, each: c.unit * per, order, link: c.link, store: c.store, note: c.note || '' });
  };
  const hasSpk = info.parts.some(p => p.key === 'speaker');
  add(CATALOG.board, 1);
  add(BATTERY_CATALOG[S.battery] || BATTERY_CATALOG['402025'], 1);
  add(IMU_CATALOG[S.imu] || IMU_CATALOG.dsox, 1);
  add(CATALOG.hall, 1);
  if (hasSpk) { add(CATALOG.amp, 1); add(S.speaker === '15' ? CATALOG.speaker15 : CATALOG.speaker20, 1); }
  add(CATALOG.led, info.leds.length);
  add(CATALOG.resistor, 2);
  add(CATALOG.bearing, 1, 'Hardware'); add(CATALOG.magnet, 1, 'Hardware');
  if (info.balance.n) add(CATALOG.bb, info.balance.n, 'Hardware');
  add(CATALOG.insert, 3, 'Hardware'); add(CATALOG.screw, 3, 'Hardware'); add(CATALOG.wire, 1, 'Hardware'); add(CATALOG.ca, 1, 'Hardware');
  // filament: one spool per colour covers far more than a few spinners, so the order line is what you use
  for (const [k, g] of Object.entries(grams)) {
    const gr = g * FILAMENT.fill;
    rows.push({ group: 'Printed', item: FILAMENT.names[k] || `PLA ${k}`, spec: `${k}: ~${gr.toFixed(0)} g a spinner`, per: +gr.toFixed(1), unitLabel: 'g', need: +(gr * qty).toFixed(0), buy: `${(gr * qty).toFixed(0)} g`, each: gr * FILAMENT.perKg / 1000, order: gr * qty * FILAMENT.perKg / 1000, link: FILAMENT.links[k] || '', store: FILAMENT.store, note: FILAMENT.note });
  }
  const each = rows.reduce((s, r) => s + r.each, 0), order = rows.reduce((s, r) => s + r.order, 0);
  const stores = {}; for (const r of rows) if (r.group !== 'Printed') stores[r.store] = (stores[r.store] || 0) + r.order;
  return { rows, each, order, qty, stores, checked: CHECKED };
}
export function bomCSV(b) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Group', 'Part', 'Spec', 'Per spinner', 'Unit', `Need for ${b.qty}`, 'To buy', 'Each spinner (USD)', `Order for ${b.qty} (USD)`, 'Store', 'Link', 'Note'].map(q).join(',')];
  for (const r of b.rows) lines.push([r.group, r.item, r.spec, r.per, r.unitLabel, r.need, r.buy, r.each.toFixed(2), r.order.toFixed(2), r.store, r.link, r.note].map(q).join(','));
  lines.push(['', 'Total', '', '', '', '', '', b.each.toFixed(2), b.order.toFixed(2), '', '', ''].map(q).join(','));
  lines.push('');
  for (const [s, v] of Object.entries(b.stores).sort((x, y) => y[1] - x[1])) lines.push(['', `Order from ${s}`, '', '', '', '', '', '', v.toFixed(2), s, '', 'before shipping and tax'].map(q).join(','));
  lines.push(q(`Prices from listings checked ${b.checked}, before shipping and tax. Check each listing before ordering.`));
  return lines.join('\n');
}
