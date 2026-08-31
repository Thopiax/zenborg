#!/usr/bin/env node
/**
 * Populate coordinates on all places and fix Belo Horizonte's parentKey.
 *
 *   node scripts/populate-place-coords.mjs            # dry-run
 *   node scripts/populate-place-coords.mjs --apply    # writes places.json
 *
 * Vault resolution mirrors mcp-server/vault.ts.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const APPLY = process.argv.includes("--apply");
const VAULT = process.env.KAIROS_HOME ?? path.join(os.homedir(), ".kairos");

const COORDS = {
  // ── Countries ──
  "france":         { lat: 46.2276,  lng:   2.2137 },
  "espana":         { lat: 40.4637,  lng:  -3.7492 },
  "uk":             { lat: 55.3781,  lng:  -3.4360 },
  "us":             { lat: 37.0902,  lng: -95.7129 },
  "brasil":         { lat: -14.2350, lng: -51.9253 },
  "ecuador":        { lat:  -1.8312, lng: -78.1834 },
  "uruguay":        { lat: -32.5228, lng: -55.7658 },
  "italia":         { lat: 41.8719,  lng:  12.5674 },
  "portugal":       { lat: 39.3999,  lng:  -8.2245 },
  "maroc":          { lat: 31.7917,  lng:  -7.0926 },
  "nederland":      { lat: 52.1326,  lng:   5.2913 },
  "belgique":       { lat: 50.5039,  lng:   4.4699 },

  // ── France ──
  "paris":          { lat: 48.8566,  lng:  2.3522 },
  "marseille":      { lat: 43.2965,  lng:  5.3698 },
  "chindrieux":     { lat: 45.8167,  lng:  5.8500 },
  "hedouville":     { lat: 49.1500,  lng:  2.2000 },
  "la-couarde":     { lat: 46.1972,  lng: -1.4233 },
  "sanary":         { lat: 43.1186,  lng:  5.7983 },
  "antibes":        { lat: 43.5808,  lng:  7.1239 },
  "lille":          { lat: 50.6292,  lng:  3.0573 },
  "valence":        { lat: 44.9334,  lng:  4.8924 },
  "grenoble":       { lat: 45.1885,  lng:  5.7245 },
  "annecy":         { lat: 45.8992,  lng:  6.1294 },
  "dhamma-mahi":    { lat: 47.5800,  lng:  4.4700 },
  "cevennes":       { lat: 44.2000,  lng:  3.7000 },

  // ── Paris sub-places ──
  "la-villette":    { lat: 48.8930,  lng:  2.3908 },
  // gomas: skipped — home address, coordinates unknown

  // ── Brasil ──
  "sao-paulo":      { lat: -23.5505, lng: -46.6333 },
  "rio":            { lat: -22.9068, lng: -43.1729 },
  "minas":          { lat: -18.5122, lng: -44.5550 },
  "belo-horizonte": { lat: -19.9167, lng: -43.9345 },
  "itacare":        { lat: -14.2786, lng: -38.9958 },
  "ilhabela":       { lat: -23.7781, lng: -45.3581 },
  "florianopolis":  { lat: -27.5954, lng: -48.5480 },
  "morere":         { lat: -13.3833, lng: -38.9167 },
  "salvador":       { lat: -12.9714, lng: -38.5014 },
  "santarem":       { lat:  -2.4426, lng: -54.7085 },
  "paraty":         { lat: -23.2178, lng: -44.7131 },
  "vale-do-paty":   { lat: -12.5500, lng: -41.3500 },
  "arraial-dajuda": { lat: -16.4842, lng: -39.0742 },
  "ilha-grande":    { lat: -23.1500, lng: -44.2300 },
  "porto-seguro":   { lat: -16.4435, lng: -39.0643 },
  "camburizinho":   { lat: -23.7800, lng: -45.6600 },
  "sul-de-minas":   { lat: -22.0000, lng: -45.5000 },

  // ── São Paulo sub-places ──
  "porto-caires":   { lat: -23.5706, lng: -46.6420 },
  "ibira":          { lat: -23.5874, lng: -46.6576 },
  "soho-house":     { lat: -23.5614, lng: -46.6547 },

  // ── España ──
  "barcelona":      { lat: 41.3874,  lng:  2.1686 },
  "madrid":         { lat: 40.4168,  lng: -3.7038 },
  "aiguablava":     { lat: 41.9389,  lng:  3.2142 },
  "begur":          { lat: 41.9533,  lng:  3.2064 },
  "castellfollit":  { lat: 42.2186,  lng:  2.5472 },
  "menorca":        { lat: 39.9496,  lng:  4.1106 },
  "donostia":       { lat: 43.3183,  lng: -1.9812 },
  "camprodon":      { lat: 42.3133,  lng:  2.3650 },

  // ── Italia ──
  "trentino":       { lat: 46.0664,  lng: 11.1217 },
  "turin":          { lat: 45.0703,  lng:  7.6869 },
  "modena":         { lat: 44.6471,  lng: 10.9252 },
  "lucca":          { lat: 43.8430,  lng: 10.5027 },
  "bono":           { lat: 40.4142,  lng:  8.9583 },

  // ── UK ──
  "london":         { lat: 51.5074,  lng: -0.1278 },
  "cotswolds":      { lat: 51.8330,  lng: -1.6667 },

  // ── US ──
  "boston":          { lat: 42.3601,  lng: -71.0589 },
  "new-york":       { lat: 40.7128,  lng: -74.0060 },

  // ── Ecuador ──
  "quito":          { lat: -0.1807,  lng: -78.4678 },
  "otavalo":        { lat:  0.2342,  lng: -78.2611 },
  "galapagos":      { lat: -0.9538,  lng: -90.9656 },

  // ── Portugal ──
  "lisboa":         { lat: 38.7223,  lng:  -9.1393 },
  "sagres":         { lat: 37.0089,  lng:  -8.9406 },

  // ── Others ──
  "rabat":          { lat: 34.0209,  lng: -6.8416 },
  "rotterdam":      { lat: 51.9244,  lng:  4.4777 },
  "brussels":       { lat: 50.8503,  lng:  4.3517 },
  "sint-niklaas":   { lat: 51.1641,  lng:  4.1442 },
  "montevideo":     { lat: -34.9011, lng: -56.1645 },
};

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(VAULT, `${name}.json`), "utf8"));

const placesById = readJson("places");
let coordsSet = 0;
let parentFixed = 0;
const skipped = [];

for (const p of Object.values(placesById)) {
  let changed = false;

  // Populate coordinates
  const coords = COORDS[p.key];
  if (coords && !p.coordinates) {
    placesById[p.id] = { ...placesById[p.id], coordinates: coords };
    changed = true;
    coordsSet++;
    if (!APPLY) console.log(`  + ${p.key}: ${coords.lat}, ${coords.lng}`);
  } else if (!coords && !p.coordinates) {
    skipped.push(p.key);
  }

  // Fix Belo Horizonte: should be under brasil, not root
  if (p.key === "belo-horizonte" && p.parentKey === null) {
    placesById[p.id] = { ...placesById[p.id], parentKey: "brasil" };
    changed = true;
    parentFixed++;
    if (!APPLY) console.log(`  ~ ${p.key}: parentKey null → brasil`);
  }

  if (changed) {
    placesById[p.id].updatedAt = new Date().toISOString();
  }
}

console.log(`\n${APPLY ? "Applied" : "Dry-run"} against ${VAULT}`);
console.log(`  coordinates set: ${coordsSet}`);
console.log(`  parent fixed: ${parentFixed}`);
if (skipped.length) console.log(`  skipped (no coords in map): ${skipped.join(", ")}`);

if (APPLY && (coordsSet > 0 || parentFixed > 0)) {
  const target = path.join(VAULT, "places.json");
  const tmp = path.join(VAULT, `.places.json.tmp-${process.pid}`);
  fs.writeFileSync(tmp, `${JSON.stringify(placesById, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
  console.log("  places.json written atomically.");
}
