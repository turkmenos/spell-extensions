package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dayanch/turkmen/internal/dictionary"
	"github.com/dayanch/turkmen/internal/spellcheck"
)

func main() {
	data := flag.String("data", "", "path to dictionary JSON")
	flag.Usage = usage
	flag.Parse()
	if flag.NArg() != 2 {
		usage()
		os.Exit(2)
	}

	path, err := dictionaryPath(*data)
	if err != nil {
		fatal(err)
	}
	dict, err := dictionary.Load(path)
	if err != nil {
		fatal(err)
	}

	command, word := flag.Arg(0), flag.Arg(1)
	switch command {
	case "lookup":
		entries := dict.Lookup(word)
		if len(entries) == 0 {
			fmt.Printf("%q not found\n", word)
			os.Exit(1)
		}
		for _, entry := range entries {
			fmt.Printf("%s", entry.Word)
			if entry.Pronunciation != "" {
				fmt.Printf(" [%s]", entry.Pronunciation)
			}
			if entry.PartOfSpeech != "" {
				fmt.Printf(" — %s", entry.PartOfSpeech)
			}
			fmt.Println()
			for _, meaning := range entry.Meanings {
				fmt.Printf("  %d. %s\n", meaning.Number, meaning.Text)
			}
		}
	case "check":
		checker := spellcheck.New(dict)
		if checker.Check(word) {
			fmt.Printf("%s: correct\n", word)
			return
		}
		fmt.Printf("%s: not found\n", word)
		if suggestions := checker.Suggest(word); len(suggestions) > 0 {
			fmt.Println("suggestions:")
			for _, suggestion := range suggestions {
				fmt.Printf("  %s\n", suggestion)
			}
		}
		os.Exit(1)
	default:
		usage()
		os.Exit(2)
	}
}

func dictionaryPath(explicit string) (string, error) {
	if explicit != "" {
		return explicit, nil
	}
	for _, candidate := range []string{filepath.Join("data", "dictionary.json"), "dictionary.json"} {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("dictionary not found; use -data path/to/dictionary.json")
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: turkmen [-data dictionary.json] <lookup|check> <word>")
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "turkmen:", err)
	os.Exit(1)
}
