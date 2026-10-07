import { describe, expect, it } from "vitest";
import { formatMs, formatSolve, parseClock, parseTimeEntry } from "../time";

describe("formatMs", () => {
  it("formats like csTimer and truncates", () => {
    expect(formatMs(9876)).toBe("9.87");
    expect(formatMs(9879)).toBe("9.87");
    expect(formatMs(62345)).toBe("1:02.34");
    expect(formatMs(3_602_340)).toBe("1:00:02.34");
    expect(formatMs(5000, 3)).toBe("5.000");
    expect(formatMs(12345, 1)).toBe("12.3");
    expect(formatMs(12345, 0)).toBe("12");
    expect(formatMs(null)).toBe("DNF");
  });
});

describe("formatSolve", () => {
  it("shows penalties", () => {
    expect(formatSolve(12340, 0)).toBe("12.34");
    expect(formatSolve(12340, 2000)).toBe("14.34+");
    expect(formatSolve(12340, -1)).toBe("DNF");
    expect(formatSolve(12340, -1, { dnfRaw: true })).toBe("DNF(12.34)");
  });
});

describe("parseClock", () => {
  it("parses clock formats", () => {
    expect(parseClock("12.34")).toBe(12340);
    expect(parseClock("1:02.5")).toBe(62500);
    expect(parseClock("1:00:02.345")).toBe(3_602_345);
    expect(parseClock("7")).toBe(7000);
    expect(parseClock("abc")).toBeNull();
  });
});

describe("parseTimeEntry (typing mode)", () => {
  it("treats bare digits csTimer-style", () => {
    expect(parseTimeEntry("1234")).toEqual({ time: 12340, penalty: 0 });
    expect(parseTimeEntry("12345")).toEqual({ time: 83450, penalty: 0 });
    expect(parseTimeEntry("987")).toEqual({ time: 9870, penalty: 0 });
  });
  it("handles separators and penalties", () => {
    expect(parseTimeEntry("12.34+")).toEqual({ time: 12340, penalty: 2000 });
    expect(parseTimeEntry("1:02.34")).toEqual({ time: 62340, penalty: 0 });
    expect(parseTimeEntry("dnf")).toEqual({ time: 0, penalty: -1 });
    expect(parseTimeEntry("DNF(12.34)")).toEqual({ time: 12340, penalty: -1 });
    expect(parseTimeEntry("")).toBeNull();
    expect(parseTimeEntry("0")).toBeNull();
  });
});
