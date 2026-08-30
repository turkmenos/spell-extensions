package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLookup(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/lookup?word=ABADAN", nil)
	res := httptest.NewRecorder()
	Handler(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("status %d: %s", res.Code, res.Body.String())
	}
	var body struct {
		Exists bool `json:"exists"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil || !body.Exists {
		t.Fatalf("unexpected response: %s", res.Body.String())
	}
}

func TestCheckAndCORS(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/check?word=çüýş", nil)
	res := httptest.NewRecorder()
	Handler(res, req)
	if res.Code != http.StatusOK || res.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("unexpected response: status=%d cors=%q", res.Code, res.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestMissingWord(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/lookup", nil)
	res := httptest.NewRecorder()
	Handler(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("got status %d", res.Code)
	}
}
