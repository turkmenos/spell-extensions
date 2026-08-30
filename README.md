# Turkmen language toolkit

An open-source, dependency-free Go foundation for querying a Turkmen dictionary
and suggesting corrections. The JSON file is decoded once and indexed in memory;
lookups do not rescan it.

## Commands

The CLI looks for `data/dictionary.json` and then `dictionary.json`. A different
location can be supplied with `-data`.

```sh
go run ./cmd/turkmen lookup "abadan"
go run ./cmd/turkmen check "mekdepe"
go run ./cmd/turkmen -data /path/to/dictionary.json lookup "şäher"
```

## HTTP API on Vercel

Connect the GitHub repository to a Vercel project with the repository root as
the Root Directory. No build command or environment variable is required. The
dictionary is embedded in the Go function so it is available at runtime.

```text
GET /health
GET /v1/lookup?word=abadan
GET /v1/check?word=çüýş
```

Example extension request:

```js
const response = await fetch(
  "https://api.turkmen.app/v1/check?word=" + encodeURIComponent(word),
);
const result = await response.json();
```

`internal/dictionary` owns JSON loading and exact, Unicode case-insensitive
lookup. `internal/spellcheck` owns the reusable BK-tree and rune-aware edit
distance. `internal/morphology` is the extension point for later Turkmen rules.

## Development

```sh
go test ./...
go test -bench=. ./internal/dictionary ./internal/spellcheck
```
