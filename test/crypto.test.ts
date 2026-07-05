import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { generateSignature } from "../src/core/crypto.js";

describe("generateSignature", () => {
  it("produces a deterministic HMAC-SHA256 over action,client_id,baseValue", () => {
    const sig = generateSignature("getnonce", "client-1", "secret", 1700000000);
    const expected = createHmac("sha256", "secret")
      .update("getnonce,client-1,1700000000")
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("accepts a string base value (nonce)", () => {
    const sig = generateSignature("requesttoken", "cid", "sec", "nonce-abc");
    const expected = createHmac("sha256", "sec")
      .update("requesttoken,cid,nonce-abc")
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("changes when any component changes", () => {
    const base = generateSignature("a", "b", "s", "n");
    expect(generateSignature("a2", "b", "s", "n")).not.toBe(base);
    expect(generateSignature("a", "b2", "s", "n")).not.toBe(base);
    expect(generateSignature("a", "b", "s2", "n")).not.toBe(base);
    expect(generateSignature("a", "b", "s", "n2")).not.toBe(base);
  });
});
