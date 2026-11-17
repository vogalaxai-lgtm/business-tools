
"use strict";

const ONES = [
  "zero", "one", "two", "three", "four",
  "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen"
];

const TENS = [
  "", "", "twenty", "thirty", "forty",
  "fifty", "sixty", "seventy", "eighty", "ninety"
];

const SCALES = [
  "", "thousand", "million", "billion",
  "trillion", "quadrillion", "quintillion"
];

const CURRENCIES = {
  USD: {
    major: "dollar",
    majorPlural: "dollars",
    minor: "cent",
    minorPlural: "cents",
    digits: 2
  },
  EUR: {
    major: "euro",
    majorPlural: "euros",
    minor: "cent",
    minorPlural: "cents",
    digits: 2
  },
  GBP: {
    major: "pound",
    majorPlural: "pounds",
    minor: "penny",
    minorPlural: "pence",
    digits: 2
  },
  TND: {
    major: "Tunisian dinar",
    majorPlural: "Tunisian dinars",
    minor: "millime",
    minorPlural: "millimes",
    digits: 3
  },
  SAR: {
    major: "Saudi riyal",
    majorPlural: "Saudi riyals",
    minor: "halala",
    minorPlural: "halalas",
    digits: 2
  },
  AED: {
    major: "UAE dirham",
    majorPlural: "UAE dirhams",
    minor: "fils",
    minorPlural: "fils",
    digits: 2
  },
  EGP: {
    major: "Egyptian pound",
    majorPlural: "Egyptian pounds",
    minor: "piastre",
    minorPlural: "piastres",
    digits: 2
  },
  INR: {
    major: "Indian rupee",
    majorPlural: "Indian rupees",
    minor: "paisa",
    minorPlural: "paise",
    digits: 2
  }
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

  if (n < 0n) {
    return "minus " + integerToWords(-n);
  }

  const groups = [];
  let scale = 0;

  while (n > 0n) {
    const group = Number(n % 1000n);

    if (group > 0) {
      if (scale >= SCALES.length) {
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
    throw new Error(
      "Enter a valid number using a dot for decimals."
    );
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;

  const [whole, fraction = ""] = unsigned.split(".");

  if (fraction.length > digits) {
    throw new Error(
      `This currency allows up to ${digits} decimal places.`
    );
  }

  return {
    negative,
    major: BigInt(whole),
    minor: digits > 0
      ? BigInt((fraction + "0".repeat(digits)).slice(0, digits))
      : 0n
  };
}

function amountToWords(input, currencyCode) {
  const currency = CURRENCIES[currencyCode];

  if (!currency) {
    throw new Error("Unsupported currency.");
  }

  const amount = parseAmount(input, currency.digits);

  const isZero =
    amount.major === 0n && amount.minor === 0n;

  let result =
    integerToWords(amount.major) + " " +
    (amount.major === 1n
      ? currency.major
      : currency.majorPlural);

  if (amount.minor > 0n) {
    result += " and " +
      integerToWords(amount.minor) + " " +
      (amount.minor === 1n
        ? currency.minor
        : currency.minorPlural);
  }

  if (amount.negative && !isZero) {
    result = "minus " + result;
  }

  return result;
}
