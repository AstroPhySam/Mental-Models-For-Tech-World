import { isMain } from "./utils.js";

export const add = (a: number, b: number) => {
  return a + b;
};

if (isMain(import.meta.url)) {
  console.log("Hi From Entry Point!");
}
