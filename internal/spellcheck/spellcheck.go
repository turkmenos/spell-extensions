// Package spellcheck provides spelling checks and suggestions independently
// from dictionary storage and parsing.
package spellcheck

import (
	"sort"

	"github.com/dayanch/turkmen/internal/dictionary"
)

const defaultLimit = 5

type node struct {
	word     string
	children map[int]*node
}

// Checker checks words against a dictionary and uses a BK-tree for suggestions.
type Checker struct {
	dict *dictionary.Dictionary
	root *node
}

// New builds a reusable suggestion index.
func New(dict *dictionary.Dictionary) *Checker {
	c := &Checker{dict: dict}
	for _, word := range dict.Words() {
		c.insert(word)
	}
	return c
}

// Check reports whether word is present exactly after case normalization.
func (c *Checker) Check(word string) bool { return c.dict.Exists(word) }

// Suggest returns up to five close dictionary words, ordered by edit distance
// and then alphabetically. Exact words return no suggestions.
func (c *Checker) Suggest(word string) []string {
	return c.SuggestN(word, defaultLimit)
}

// SuggestN returns up to limit close words. Distance is computed over Unicode
// code points, so Turkmen letters count as one edit each.
func (c *Checker) SuggestN(word string, limit int) []string {
	query := dictionary.Normalize(word)
	if query == "" || limit <= 0 || c.dict.Exists(query) {
		return nil
	}
	maxDistance := 2
	if len([]rune(query)) > 8 {
		maxDistance = 3
	}

	type candidate struct {
		word     string
		distance int
	}
	var found []candidate
	c.search(c.root, query, maxDistance, func(s string, distance int) {
		found = append(found, candidate{s, distance})
	})
	sort.Slice(found, func(i, j int) bool {
		if found[i].distance != found[j].distance {
			return found[i].distance < found[j].distance
		}
		return found[i].word < found[j].word
	})
	if len(found) > limit {
		found = found[:limit]
	}
	out := make([]string, len(found))
	for i := range found {
		out[i] = found[i].word
	}
	return out
}

func (c *Checker) insert(word string) {
	if c.root == nil {
		c.root = &node{word: word, children: make(map[int]*node)}
		return
	}
	current := c.root
	for {
		distance := editDistance(word, current.word)
		if child := current.children[distance]; child != nil {
			current = child
			continue
		}
		current.children[distance] = &node{word: word, children: make(map[int]*node)}
		return
	}
}

func (c *Checker) search(n *node, query string, max int, add func(string, int)) {
	if n == nil {
		return
	}
	distance := editDistance(query, n.word)
	if distance <= max {
		add(n.word, distance)
	}
	for edge, child := range n.children {
		if edge >= distance-max && edge <= distance+max {
			c.search(child, query, max, add)
		}
	}
}

func editDistance(a, b string) int {
	ar, br := []rune(a), []rune(b)
	if len(ar) > len(br) {
		ar, br = br, ar
	}
	previous := make([]int, len(ar)+1)
	for i := range previous {
		previous[i] = i
	}
	for j, rb := range br {
		current := make([]int, len(ar)+1)
		current[0] = j + 1
		for i, ra := range ar {
			cost := 0
			if ra != rb {
				cost = 1
			}
			current[i+1] = min(current[i]+1, previous[i+1]+1, previous[i]+cost)
		}
		previous = current
	}
	return previous[len(ar)]
}
