import { add } from "../src/index.js";

describe("Basic Add Function", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(add(1, 2)).toBe(3);
  });
});
