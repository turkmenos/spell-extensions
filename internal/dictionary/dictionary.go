// Package dictionary loads and queries a Turkmen dictionary.
package dictionary

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

// Meaning is one numbered meaning of a dictionary entry.
type Meaning struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

// Entry is one dictionary entry. A word may have multiple entries.
type Entry struct {
	Word          string    `json:"word"`
	Pronunciation string    `json:"pronunciation,omitempty"`
	PartOfSpeech  string    `json:"partOfSpeech,omitempty"`
	Meanings      []Meaning `json:"meanings"`
	Raw           string    `json:"raw,omitempty"`
}

// Meta describes the source dictionary.
type Meta struct {
	Title       string `json:"title"`
	Source      string `json:"source"`
	GeneratedAt string `json:"generatedAt"`
	WordCount   int    `json:"wordCount"`
}

type document struct {
	Meta  Meta               `json:"meta"`
	Words map[string][]Entry `json:"words"`
}

// Dictionary is an immutable, in-memory dictionary safe for concurrent reads.
type Dictionary struct {
	meta  Meta
	words map[string][]Entry
	keys  []string
}

// Load opens and indexes a dictionary JSON file.
func Load(path string) (*Dictionary, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open dictionary: %w", err)
	}
	defer f.Close()
	return Decode(f)
}

// Decode reads and indexes a dictionary JSON stream.
func Decode(r io.Reader) (*Dictionary, error) {
	var doc document
	if err := json.NewDecoder(r).Decode(&doc); err != nil {
		return nil, fmt.Errorf("decode dictionary: %w", err)
	}
	if doc.Words == nil {
		return nil, fmt.Errorf("decode dictionary: missing words object")
	}

	d := &Dictionary{meta: doc.Meta, words: make(map[string][]Entry, len(doc.Words))}
	for word, entries := range doc.Words {
		key := Normalize(word)
		if key == "" {
			continue
		}
		if _, exists := d.words[key]; !exists {
			d.keys = append(d.keys, key)
		}
		d.words[key] = append(d.words[key], entries...)
	}
	return d, nil
}

// Normalize produces the case-insensitive key used by dictionary operations.
// Go's Unicode case mapping covers Ä, Ç, Ž, Ň, Ö, Ş, Ü, and Ý.
func Normalize(word string) string {
	return strings.ToLower(strings.TrimSpace(word))
}

// Lookup returns every entry for word. The returned slice is a copy.
func (d *Dictionary) Lookup(word string) []Entry {
	entries := d.words[Normalize(word)]
	return append([]Entry(nil), entries...)
}

// Exists reports whether word is a dictionary key.
func (d *Dictionary) Exists(word string) bool {
	_, ok := d.words[Normalize(word)]
	return ok
}

// Words returns a copy of all normalized dictionary keys.
// It is intended for building indexes such as a spell checker.
func (d *Dictionary) Words() []string {
	return append([]string(nil), d.keys...)
}

// Meta returns the dictionary metadata.
func (d *Dictionary) Meta() Meta { return d.meta }

// Len returns the number of unique normalized keys.
func (d *Dictionary) Len() int { return len(d.words) }
