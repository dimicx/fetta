import { describe, it, expect, vi } from "vitest";
import { normalizeToPromise } from "../../core/splitText";

describe("normalizeToPromise", () => {
  it("returns null for null/undefined/falsy values", () => {
    expect(normalizeToPromise(null)).toBeNull();
    expect(normalizeToPromise(undefined)).toBeNull();
    expect(normalizeToPromise(0)).toBeNull();
    expect(normalizeToPromise("")).toBeNull();
    expect(normalizeToPromise(false)).toBeNull();
  });

  it("returns the same promise for Promise input", async () => {
    const promise = Promise.resolve("test");
    const result = normalizeToPromise(promise);

    expect(result).toBe(promise);
    await expect(result).resolves.toBe("test");
  });

  it("extracts .finished property from Motion-style animations", async () => {
    const finishedPromise = Promise.resolve("completed");
    const motionAnimation = { finished: finishedPromise };

    const result = normalizeToPromise(motionAnimation);

    expect(result).toBe(finishedPromise);
    await expect(result).resolves.toBe("completed");
  });

  it("wraps thenable objects (GSAP-style) in Promise.resolve", async () => {
    const gsapTimeline = {
      then: (resolve: (value: unknown) => void) => {
        resolve("gsap-done");
      },
    };

    const result = normalizeToPromise(gsapTimeline);

    expect(result).toBeInstanceOf(Promise);
    // Promise.resolve with a thenable calls .then() and resolves with its result
    await expect(result).resolves.toBeDefined();
  });

  it("handles arrays of Motion animations", async () => {
    const anim1 = { finished: Promise.resolve("anim1") };
    const anim2 = { finished: Promise.resolve("anim2") };

    const result = normalizeToPromise([anim1, anim2]);

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual(["anim1", "anim2"]);
  });

  it("handles arrays with mixed values (filters out nulls)", async () => {
    const anim1 = { finished: Promise.resolve("anim1") };
    const nullValue = null;
    const anim2 = { finished: Promise.resolve("anim2") };

    const result = normalizeToPromise([anim1, nullValue, anim2]);

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual(["anim1", "anim2"]);
  });

  it("returns null for empty array", () => {
    const result = normalizeToPromise([]);
    expect(result).toBeNull();
  });

  it("returns null for array with only null/undefined values", () => {
    const result = normalizeToPromise([null, undefined, 0]);
    expect(result).toBeNull();
  });

  it("returns null for plain objects without .finished or .then", () => {
    const plainObject = { foo: "bar" };
    expect(normalizeToPromise(plainObject)).toBeNull();
  });

  it("returns null for numbers and strings", () => {
    expect(normalizeToPromise(42)).toBeNull();
    expect(normalizeToPromise("string")).toBeNull();
  });

  it("handles nested arrays of animations", async () => {
    const anim1 = { finished: Promise.resolve("nested1") };
    const anim2 = { finished: Promise.resolve("nested2") };
    const nestedArray = [anim1, [anim2]];

    const result = normalizeToPromise(nestedArray);

    expect(result).toBeInstanceOf(Promise);
    // The nested array itself should be normalized
    await expect(result).resolves.toEqual(["nested1", ["nested2"]]);
  });
});
