package dictionary

import (
	"strings"
	"testing"
)

const fixture = `{"meta":{"wordCount":3},"words":{"abadan":[{"word":"ABADAN","pronunciation":"avada:n","partOfSpeech":"syp","meanings":[{"number":1,"text":"abat"}],"raw":"raw"}],"şäher":[{"word":"ŞÄHER"}],"ýeňil":[{"word":"ÝEŇIL"}]}}`

func loadFixture(tb testing.TB) *Dictionary {
	tb.Helper()
	d, err := Decode(strings.NewReader(fixture))
	if err != nil {
		tb.Fatal(err)
	}
	return d
}

func TestLookupCaseInsensitiveTurkmen(t *testing.T) {
	d := loadFixture(t)
	for _, word := range []string{"abadan", "ABADAN", " ŞÄHER ", "ÝEŇIL"} {
		if !d.Exists(word) {
			t.Errorf("expected %q to exist", word)
		}
	}
	entries := d.Lookup("AbAdAn")
	if len(entries) != 1 || entries[0].Pronunciation != "avada:n" {
		t.Fatalf("unexpected lookup: %#v", entries)
	}
}

func TestDecodeRejectsMissingWords(t *testing.T) {
	if _, err := Decode(strings.NewReader(`{"meta":{}}`)); err == nil {
		t.Fatal("expected error")
	}
}

func BenchmarkLookup(b *testing.B) {
	d := loadFixture(b)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = d.Exists("ŞÄHER")
	}
}
