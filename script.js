"use strict";

/* =========================================
   BUSINESS TOOLS — NUMBER TO WORDS ENGINE
   Version 2.0
   Exact decimal handling with BigInt (no floats anywhere)

   Public API (same global names as v1.1):
     amountToWords(value, currency, language = "en")
     parseAmount(input, digits)
     integerToWords(value)
     underThousand(n)
     CURRENCIES, ONES, TENS, SCALES
   New:
     AmountToWordsError  (extends Error, adds a machine-readable .code)

   Every failure is thrown as an AmountToWordsError whose message is
   safe to show to users. Messages never echo the user's input.
========================================= */

(function (root) {

  /* 1. Settings */

  const DEFAULT_LANGUAGE = "en";

  /*
    true  -> 0.01 EUR is spoken as "zero euros and one cent"
    false -> 0.01 EUR is spoken as "one cent"
  */
  const SPELL_OUT_ZERO_MAJOR_UNIT = true;

  /* Sanity cap on the raw input text (guards against pathological input). */
  const MAX_INPUT_LENGTH = 256;

  /* 2. Errors */

  class AmountToWordsError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "AmountToWordsError";
      this.code = code;
    }
  }

  /* 3. Number vocabulary */

  const ONES = Object.freeze([
    "zero", "one", "two", "three", "four",
    "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen",
    "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"
  ]);

  const TENS = Object.freeze([
    "", "", "twenty", "thirty", "forty",
    "fifty", "sixty", "seventy", "eighty", "ninety"
  ]);

  /* Short scale. Index k names 10^(3k): 1 = thousand ... 21 = vigintillion. */
  const SCALES = Object.freeze([
    "", "thousand", "million", "billion", "trillion",
    "quadrillion", "quintillion", "sextillion", "septillion",
    "octillion", "nonillion", "decillion", "undecillion",
    "duodecillion", "tredecillion", "quattuordecillion",
    "quindecillion", "sexdecillion", "septendecillion",
    "octodecillion", "novemdecillion", "vigintillion"
  ]);

  /* Largest supported integer part: 10^66 - 1 (66 digits). */
  const MAX_INTEGER_DIGITS = SCALES.length * 3;
  const MAX_EXCLUSIVE = 1000n ** BigInt(SCALES.length);

  /* 4. Supported currencies */

  function deepFreeze(object) {
    Object.values(object).forEach(Object.freeze);
    return Object.freeze(object);
  }

  const CURRENCIES = deepFreeze({
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
  });

  /* 5. Convert numbers below 1000 (n is a Number from 0 to 999) */

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

  /* 6. Convert whole numbers of any supported size using BigInt */

  function toBigInt(value) {
    try {
      return BigInt(value);
    } catch (error) {
      throw new AmountToWordsError(
        "Expected a whole number.",
        "INVALID_INTEGER"
      );
    }
  }

  function integerToWords(value) {
    const n = toBigInt(value);

    if (n < 0n) {
      return "minus " + integerToWords(-n);
    }

    if (n === 0n) {
      return "zero";
    }

    if (n >= MAX_EXCLUSIVE) {
      throw new AmountToWordsError(
        "The number is too large to convert " +
        `(maximum ${MAX_INTEGER_DIGITS} digits before the decimal point).`,
        "NUMBER_TOO_LARGE"
      );
    }

    const groups = [];
    let rest = n;
    let scale = 0;

    while (rest > 0n) {
      const group = Number(rest % 1000n);

      if (group > 0) {
        groups.push(
          underThousand(group) +
          (scale ? " " + SCALES[scale] : "")
        );
      }

      rest /= 1000n;
      scale++;
    }

    return groups.reverse().join(" ");
  }

  /* 7. Validate and parse user input */

  /*
    Accepted (optional + or - sign; integer part required):
      999            999.99          007.50        0.001
      999999.99      999,999.99      -999,999.99   1250.500
      1,000,000

    Rejected:
      999.999.99     99,99.99        999,99,999    1,25
      0,500          .5              5.            1e5
      abc123         1 250           $100          (empty)

    Commas, when used, must group exact thousands and the first group
    may not start with 0. That way "0,500" (a European 0.5) can never
    be silently read as 500.
  */
  const AMOUNT_PATTERN =
    /^([+-]?)(\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d+))?$/;

  const SCIENTIFIC_PATTERN =
    /^[+-]?(?:\d+\.?\d*|\.\d+)e[+-]?\d+$/i;

  const FORMAT_HELP =
    "Invalid number format. Use commas for thousands and a dot for decimals. Example: 999,999.99";

  function normalizeInput(input) {
    let text;

    if (input === undefined || input === null) {
      throw new AmountToWordsError(
        "Please enter an amount.",
        "EMPTY_INPUT"
      );
    }

    if (typeof input === "string") {
      text = input;
    } else if (typeof input === "bigint") {
      text = input.toString();
    } else if (typeof input === "number") {
      if (!Number.isFinite(input)) {
        throw new AmountToWordsError(
          "The amount must be a finite number.",
          "INVALID_NUMBER"
        );
      }

      text = String(input);
    } else {
      throw new AmountToWordsError(
        "The amount must be text or a number.",
        "INVALID_TYPE"
      );
    }

    /* U+2212 is the typographic minus sign that appears when pasting. */
    text = text.trim().replace(/−/g, "-");

    if (text === "") {
      throw new AmountToWordsError(
        "Please enter an amount.",
        "EMPTY_INPUT"
      );
    }

    if (text.length > MAX_INPUT_LENGTH) {
      throw new AmountToWordsError(
        "The input is too long.",
        "INPUT_TOO_LONG"
      );
    }

    return text;
  }

  function parseAmount(input, digits) {
    if (!Number.isInteger(digits) || digits < 0) {
      throw new AmountToWordsError(
        "Invalid decimal precision.",
        "INVALID_PRECISION"
      );
    }

    const text = normalizeInput(input);
    const match = AMOUNT_PATTERN.exec(text);

    if (!match) {
      if (SCIENTIFIC_PATTERN.test(text)) {
        throw new AmountToWordsError(
          "Scientific notation is not supported. Enter the amount as plain digits, for example 1000000.50.",
          "SCIENTIFIC_NOTATION"
        );
      }

      throw new AmountToWordsError(FORMAT_HELP, "INVALID_FORMAT");
    }

    const sign = match[1];
    const integerDigits = match[2];
    const fractionDigits = match[3] || "";

    /*
      Trailing zeros carry no value ("100.250" equals "100.25"),
      so dropping them is lossless. Any other extra digit is rejected:
      amounts are never rounded or truncated.
    */
    const fraction = fractionDigits.replace(/0+$/, "");

    if (fraction.length > digits) {
      throw new AmountToWordsError(
        `This currency allows up to ${digits} decimal places.`,
        "TOO_MANY_DECIMALS"
      );
    }

    const major = BigInt(integerDigits.replace(/,/g, ""));

    const minor = digits > 0
      ? BigInt(fraction.padEnd(digits, "0"))
      : 0n;

    const isZero = major === 0n && minor === 0n;

    return {
      negative: sign === "-" && !isZero,
      major,
      minor
    };
  }

  /* 8. Language and currency lookup */

  function assertSupportedLanguage(language) {
    if (language === undefined || language === null || language === "") {
      return;
    }

    if (typeof language === "string") {
      const code = language.trim().toLowerCase();

      if (code === DEFAULT_LANGUAGE || /^en[-_][a-z0-9]+$/.test(code)) {
        return;
      }
    }

    throw new AmountToWordsError(
      "This version currently supports English only. French and Arabic are not available yet.",
      "UNSUPPORTED_LANGUAGE"
    );
  }

  function resolveCurrency(currencyCode) {
    if (typeof currencyCode !== "string" || currencyCode.trim() === "") {
      throw new AmountToWordsError(
        "Please select a currency.",
        "MISSING_CURRENCY"
      );
    }

    const key = currencyCode.trim().toUpperCase();

    /* hasOwnProperty blocks inherited keys such as "constructor". */
    if (!Object.prototype.hasOwnProperty.call(CURRENCIES, key)) {
      throw new AmountToWordsError(
        "Unsupported currency. Supported currencies: " +
        Object.keys(CURRENCIES).join(", ") + ".",
        "UNSUPPORTED_CURRENCY"
      );
    }

    return CURRENCIES[key];
  }

  /* 9. Convert monetary amounts into words */

  function unitPhrase(count, singular, plural) {
    return integerToWords(count) + " " + (count === 1n ? singular : plural);
  }

  function amountToWords(value, currency, language = DEFAULT_LANGUAGE) {
    assertSupportedLanguage(language);

    const currencyInfo = resolveCurrency(currency);
    const amount = parseAmount(value, currencyInfo.digits);

    const hasMinor = amount.minor > 0n;
    const parts = [];

    /* Major currency unit */

    if (amount.major > 0n || !hasMinor || SPELL_OUT_ZERO_MAJOR_UNIT) {
      parts.push(
        unitPhrase(
          amount.major,
          currencyInfo.major,
          currencyInfo.majorPlural
        )
      );
    }

    /* Minor currency unit */

    if (hasMinor) {
      parts.push(
        unitPhrase(
          amount.minor,
          currencyInfo.minor,
          currencyInfo.minorPlural
        )
      );
    }

    let result = parts.join(" and ");

    /* Negative amounts (zero is never negative; parseAmount handles it) */

    if (amount.negative) {
      result = "minus " + result;
    }

    return result;
  }

  /* 10. Public exports */

  const api = {
    amountToWords,
    parseAmount,
    integerToWords,
    underThousand,
    CURRENCIES,
    ONES,
    TENS,
    SCALES,
    AmountToWordsError
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }

})(typeof globalThis !== "undefined" ? globalThis : window);
