"use strict";

/* =========================================
   BUSINESS TOOLS — NUMBER TO WORDS ENGINE
   Version 1.1
   Accurate decimal handling with BigInt
========================================= */

/* 1. Number vocabulary */

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

/* 2. Supported currencies */

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

/* 3. Convert numbers below 1000 */

function underThousand(n) {
  if (n < 20) {
    return ONES[n];
  }

  if (n < 100) {
    const remainder = n % 10;

    return TENS[Math.floor(n / 10)] +
      (remainder ? "-" + ONES[remainder] : "");
  }

  const remainder = n % 100;

  return ONES[Math.floor(n / 100)] + " hundred" +
    (remainder ? " " + underThousand(remainder) : "");
}

/* 4. Convert large integers using BigInt */

function integerToWords(value) {
  let n = BigInt(value);

  if (n === 0n) {
    return "zero";
  }

  if (n < 0n) {
    return "minus " + integerToWords(-n);
  }

  const groups = [];
  let scale = 0;

  while (n > 0n) {
    const group = Number(n % 1000n);

    if (group > 0) {
      if (scale >= SCALES.length) {
        throw new Error(
          "The number is too large to convert."
        );
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

/* 5. Validate and parse user input */

function parseAmount(input, digits) {
  const value = String(input).trim();

  /*
    Accepted:
    999
    999.99
    999999.99
    999,999.99
    -999,999.99

    Rejected:
    999.999.99
    999.999.99.9
    99,99.99
    999,99,999
    abc123
  */

  const validFormat =
    /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

  if (!validFormat.test(value)) {
    throw new Error(
      "Invalid number format. Use commas for thousands and a dot for decimals. Example: 999,999.99"
    );
  }

  const negative = value.startsWith("-");

  const unsigned = negative
    ? value.slice(1)
    : value;

  const normalized = unsigned.replace(/,/g, "");

  const [whole, fraction = ""] = normalized.split(".");

  if (fraction.length > digits) {
    throw new Error(
      `This currency allows up to ${digits} decimal places.`
    );
  }

  return {
    negative,

    major: BigInt(whole),

    minor: digits > 0
      ? BigInt(
          (fraction + "0".repeat(digits)).slice(0, digits)
        )
      : 0n
  };
}

/* 6. Convert monetary amounts into words */

function amountToWords(input, currencyCode, language = "en") {
  if (language !== "en") {
    throw new Error(
      "This version currently supports English only."
    );
  }

  const currency = CURRENCIES[currencyCode];

  if (!currency) {
    throw new Error("Unsupported currency.");
  }

  const amount = parseAmount(input, currency.digits);

  const isZero =
    amount.major === 0n &&
    amount.minor === 0n;

  let result = "";

  /* Major currency unit */

  if (amount.major > 0n || amount.minor === 0n) {
    result =
      integerToWords(amount.major) + " " +
      (amount.major === 1n
        ? currency.major
        : currency.majorPlural);
  }

  /* Minor currency unit */

  if (amount.minor > 0n) {
    const minorWords =
      integerToWords(amount.minor) + " " +
      (amount.minor === 1n
        ? currency.minor
        : currency.minorPlural);

    result = result
      ? result + " and " + minorWords
      : minorWords;
  }

  /* Negative amounts */

  if (amount.negative && !isZero) {
    result = "minus " + result;
  }

  return result;
}
