import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, formatBalance, formatMoney, groupIndian, parseRupees, sumPaisa } from "./money.ts";

test("groups digits the Nepali/Indian way", () => {
  assert.equal(groupIndian("0"), "0");
  assert.equal(groupIndian("999"), "999");
  assert.equal(groupIndian("1000"), "1,000");
  assert.equal(groupIndian("123456"), "1,23,456");
  assert.equal(groupIndian("12345678"), "1,23,45,678");
});

test("formats paisa as rupees with two decimals", () => {
  assert.equal(formatMoney(0), "Rs 0.00");
  assert.equal(formatMoney(5), "Rs 0.05");
  assert.equal(formatMoney(1234550), "Rs 12,345.50");
  assert.equal(formatMoney(12345600), "Rs 1,23,456.00");
  assert.equal(formatMoney(1234567800), "Rs 1,23,45,678.00");
  assert.equal(formatAmount(-1250), "12.50");
});

test("a negative balance reads as credit, never a minus", () => {
  assert.equal(formatBalance(250000), "Rs 2,500.00");
  assert.equal(formatBalance(-200000), "Credit Rs 2,000.00");
  assert.equal(formatBalance(0), "Rs 0.00");
});

test("refuses non-integer money", () => {
  assert.throws(() => formatMoney(10.5));
  assert.throws(() => sumPaisa([1, 2.5]));
});

test("parses typed rupees into paisa exactly", () => {
  assert.equal(parseRupees("1,250.5"), 125050);
  assert.equal(parseRupees("Rs 99"), 9900);
  assert.equal(parseRupees("0.07"), 7);
  assert.equal(parseRupees("12.345"), null);
  assert.equal(parseRupees("abc"), null);
  // 0.1 + 0.2 style float errors cannot happen: 0.10 + 0.20 rupees is 30 paisa
  assert.equal(sumPaisa([parseRupees("0.10")!, parseRupees("0.20")!]), 30);
});
