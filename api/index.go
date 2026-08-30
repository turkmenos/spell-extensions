// Package handler exposes the Turkmen toolkit as a Vercel Go Function.
package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	toolkitdata "github.com/dayanch/turkmen/data"
	"github.com/dayanch/turkmen/internal/dictionary"
	"github.com/dayanch/turkmen/internal/spellcheck"
)

var (
	loadOnce sync.Once
	dict     *dictionary.Dictionary
	checker  *spellcheck.Checker
	loadErr  error
)

// Handler handles all public API routes.
func Handler(w http.ResponseWriter, r *http.Request) {
	setHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	action := r.URL.Query().Get("action")
	if action == "" {
		action = strings.Trim(r.URL.Path, "/")
		action = strings.TrimPrefix(action, "v1/")
		action = strings.TrimPrefix(action, "api/")
	}
	if action == "health" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}

	loadOnce.Do(func() {
		dict, loadErr = dictionary.Decode(bytes.NewReader(toolkitdata.DictionaryJSON))
		if loadErr == nil {
			checker = spellcheck.New(dict)
		}
	})
	if loadErr != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "dictionary unavailable"})
		return
	}

	switch action {
	case "lookup":
		word := strings.TrimSpace(r.URL.Query().Get("word"))
		if word == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "word is required"})
			return
		}
		entries := dict.Lookup(word)
		writeJSON(w, http.StatusOK, struct {
			Word    string             `json:"word"`
			Exists  bool               `json:"exists"`
			Entries []dictionary.Entry `json:"entries"`
		}{word, len(entries) > 0, entries})
	case "check":
		word := strings.TrimSpace(r.URL.Query().Get("word"))
		if word == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "word is required"})
			return
		}
		exists := checker.Check(word)
		suggestions := []string{}
		if !exists {
			suggestions = checker.Suggest(word)
		}
		writeJSON(w, http.StatusOK, struct {
			Word        string   `json:"word"`
			Correct     bool     `json:"correct"`
			Suggestions []string `json:"suggestions"`
		}{word, exists, suggestions})
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
	}
}

func setHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=60, s-maxage=3600")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
