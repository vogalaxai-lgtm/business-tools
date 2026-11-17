
"use strict";

const ONES = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];

const TENS = [
  "", "", "twenty", "thirty", "forty",
  "fifty", "sixty", "seventy", "eighty", "ninety"
];

const SCALES = [
  "", "thousand", "million", "billion", "trillion",
  "quadrillion", "quintillion"
];

const CURRENCIES = {
  USD: { major: "dollar", minor: "cent", digits: 2 },
  EUR: { major: "euro", minor: "cent", digits: 2 },
  GBP: { major: "pound", minor: "penny", digits: 2 },
  TND: { major: "Tunisian dinar", minor: "millime", digits: 3 },
  SAR: { major: "Saudi riyal", minor: "halala", digits: 2 },
  AED: { major: "UAE dirham", minor: "fils", digits: 2 },
  EGP: { major: "Egyptian pound", minor: "piastre", digits: 2 },
  INR: { major: "Indian rupee", minor: "paisa", digits: 2 }
};

function underThousand(n) {
  if (n < 20) return ONES[n];

  if (n < 100) {
    const remainder = n % 10;
    return TENS[Math.floor(n / 10)] +
      (remainder ? "-" + ONES[remainder] : "");
  }

  const remainder = n % 100;
  return ONES[Math.floor(n / 100)] + " hundred" +
    (remainder ? " " + underThousand(remainder) : "");
}

function integerToWords(value) {
  let n = BigInt(value);

  if (n === 0n) return "zero";
  if (n < 0n) return "minus " + integerToWords(-n);

  const groups = [];
  let scale = 0;

  while (n > 0n) {
    const group = Number(n % 1000n);

    if (group > 0) {
      if (!SCALES[scale]) {
        throw new Error("Number is too large.");
      }

      groups.unshift(
        underThousand(group) +
        (scale ? " " + SCALES[scale] : "")
      );
    }

    n /= 1000n;
    scale++;
  }

  return groups.join(" ");
}

function parseAmount(input, digits) {
  const value = String(input).trim();

  if (!/^-?\d+(?:\.\d+)?$/.test(value)) {
    throw new Error("Enter a valid number using a dot for decimals.");
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");

  if (fraction.length > digits) {
    throw new Error(`This currency allows up to ${digits} decimal places.`);
  }

  const major = BigInt(whole);
  const minor = digits
    ? BigInt((fraction + "0".repeat(digits)).slice(0, digits) || "0")
    : 0n;

  return { negative, major, minor };
}

function amountToWords(input, currencyCode) {
  const currency = CURRENCIES[currencyCode];

  if (!currency) {
    throw new Error("Unsupported currency.");
  }

  const amount = parseAmount(input, currency.digits);

  let result = integerToWords(amount.major) +
    " " + currency.major +
    (amount.major === 1n ? "" : "s");

  if (amount.digits !== 0 && amount.minor > 0n) {
    result += " and " + integerToWords(amount.minor) +
      " " + currency.minor +
      (amount.minor === 1n ? "" : "s");
  }

  if (amount.negative) {
    result = "minus " + result;
  }

  return result;
}
