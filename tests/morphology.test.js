const assert = require("node:assert/strict");
const morphology = require("../morphology.js");

const lexicon = new Set([
  "gämi", "howa", "kitap", "mekdep", "okamak", "gelmek", "işlemek", "görmek", "türkmen"
]);

for (const word of [
  "gämisi", "howasy", "kitaby", "kitaplar", "kitaplarymyzdan",
  "mekdepde", "gelýär", "işledi", "gördi", "türkmen"
]) {
  assert.equal(morphology.isKnown(lexicon, word), true, `${word} should be recognized`);
}

for (const word of ["xyzabc", "kitapzzz", "gelýärzzz"]) {
  assert.equal(morphology.isKnown(lexicon, word), false, `${word} should be rejected`);
}

console.log("Morphology tests passed");
