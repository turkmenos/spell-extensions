// Package data embeds the dictionary for deployments where external data files
// are not guaranteed to be present, such as serverless functions.
package data

import _ "embed"

// DictionaryJSON contains the bundled Turkmen dictionary.
//
//go:embed dictionary.json
var DictionaryJSON []byte
