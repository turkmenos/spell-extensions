const fs = require("node:fs");
const path = require("node:path");

const sourceDirectory = path.join(__dirname, "..", "data", "json");
const outputPath = path.join(__dirname, "..", "data", "grammar-words.json");
const words = new Set();

for (const filename of fs.readdirSync(sourceDirectory).filter((name) => name.endsWith(".json"))) {
  const document = JSON.parse(fs.readFileSync(path.join(sourceDirectory, filename), "utf8"));
  if (!document || typeof document !== "object") continue;
  const source = [document.content, ...(document.examples || []), ...(document.rules || [])]
    .filter(Boolean)
    .join("\n")
    .replace(/[-‑]\s*\n\s*/gu, "")
    .replace(/--- PAGE \d+ ---/gu, " ");
  for (const match of source.matchAll(/[\p{L}]+(?:[-’'][\p{L}]+)*/gu)) {
    const word = match[0].toLocaleLowerCase("tk");
    if ([...word].length >= 1) words.add(word);
  }
}

fs.writeFileSync(outputPath, JSON.stringify([...words].sort((a, b) => a.localeCompare(b, "tk"))));
console.log(`Wrote ${words.size} grammar words to ${outputPath}`);
