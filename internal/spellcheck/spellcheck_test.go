package spellcheck

import (
	"strings"
	"testing"

	"github.com/dayanch/turkmen/internal/dictionary"
)

func testChecker(tb testing.TB) *Checker {
	tb.Helper()
	d, err := dictionary.Decode(strings.NewReader(`{"words":{"mekdep":[{"word":"MEKDEP"}],"mekdebe":[{"word":"MEKDEBE"}],"şäher":[{"word":"ŞÄHER"}],"ýeňil":[{"word":"ÝEŇIL"}]}}`))
	if err != nil {
		tb.Fatal(err)
	}
	return New(d)
}

func TestSuggest(t *testing.T) {
	c := testChecker(t)
	suggestions := c.Suggest("mekdepe")
	if len(suggestions) == 0 || suggestions[0] != "mekdebe" {
		t.Fatalf("unexpected suggestions: %v", suggestions)
	}
	if got := c.Suggest("mekdep"); len(got) != 0 {
		t.Fatalf("exact word should have no suggestions: %v", got)
	}
}

func TestSuggestTurkmenRunes(t *testing.T) {
	c := testChecker(t)
	if got := c.Suggest("säher"); len(got) == 0 || got[0] != "şäher" {
		t.Fatalf("unexpected suggestions: %v", got)
	}
}

func BenchmarkSuggest(b *testing.B) {
	c := testChecker(b)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = c.Suggest("mekdepe")
	}
}
