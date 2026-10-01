import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeScanUrl } from "./index.js";

describe("normalizeScanUrl", () => {
  it("accepts https and eTLD+1", () => {
    const r = normalizeScanUrl("https://www.Example.com/path");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.registrableDomain, "example.com");
  });

  it("rejects localhost", () => {
    const r = normalizeScanUrl("http://localhost:3000");
    assert.equal(r.ok, false);
  });

  it("rejects private IP", () => {
    const r = normalizeScanUrl("http://192.168.1.1");
    assert.equal(r.ok, false);
  });
});
