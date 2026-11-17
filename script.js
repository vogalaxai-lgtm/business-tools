
"use strict";

/* =========================================
   BUSINESS TOOLS — NUMBER TO WORDS ENGINE
   Version 2.1

   Improvements:
   - Automatic thousands separators in the input.
   - Preserves exact decimal values.
   - Supports negative amounts.
   - Clear amount button.
   - Live result and error state management.
   - Copy button enabled only after successful conversion.

   Public API preserved:
     amountToWords(value, currency, language = "en")
     parseAmount(input, digits)
     integerToWords(value)
     underThousand(n)
     CURRENCIES, ONES, TENS, SCALES
========================================= */

(function (root) {

  /* 1. Settings */

  const DEFAULT_LANGUAGE = "en";
  const SPELL_OUT_ZERO_MAJOR_UNIT = true;
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

  const SCALES = Object.freeze([
    "", "thousand", "million", "billion", "trillion",
    "quadrillion", "quintillion", "sextillion", "septillion",
    "octillion", "nonillion", "decillion", "undecillion",
    "duodecillion", "tredecillion", "quattuordecillion",
    "quindecillion", "sexdecillion", "septendecillion",
    "octodecillion", "novemdecillion", "vigintillion"
  ]);

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

  /* 5. Convert numbers below 1000 */

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

  /* 6. Convert whole numbers using BigInt */

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

      throw new AmountToWordsError(
        FORMAT_HELP,
        "INVALID_FORMAT"
      );

    }

    const sign = match[1];
    const integerDigits = match[2];
    const fractionDigits = match[3] || "";

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

    if (
      language === undefined ||
      language === null ||
      language === ""
    ) {
      return;
    }

    if (typeof language === "string") {

      const code = language.trim().toLowerCase();

      if (
        code === DEFAULT_LANGUAGE ||
        /^en[-_][a-z0-9]+$/.test(code)
      ) {
        return;
      }

    }

    throw new AmountToWordsError(
      "This version currently supports English only. French and Arabic are not available yet.",
      "UNSUPPORTED_LANGUAGE"
    );

  }

  function resolveCurrency(currencyCode) {

    if (
      typeof currencyCode !== "string" ||
      currencyCode.trim() === ""
    ) {

      throw new AmountToWordsError(
        "Please select a currency.",
        "MISSING_CURRENCY"
      );

    }

    const key = currencyCode.trim().toUpperCase();

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

    return integerToWords(count) + " " +
      (count === 1n ? singular : plural);

  }

  function amountToWords(
    value,
    currency,
    language = DEFAULT_LANGUAGE
  ) {

    assertSupportedLanguage(language);

    const currencyInfo = resolveCurrency(currency);
    const amount = parseAmount(value, currencyInfo.digits);

    const hasMinor = amount.minor > 0n;
    const parts = [];

    if (
      amount.major > 0n ||
      !hasMinor ||
      SPELL_OUT_ZERO_MAJOR_UNIT
    ) {

      parts.push(
        unitPhrase(
          amount.major,
          currencyInfo.major,
          currencyInfo.majorPlural
        )
      );

    }

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


/* =========================================
   BUSINESS TOOLS — PAGE INTERACTIONS
   Version 2.1
========================================= */

(function () {

  const amountInput = document.getElementById("amount");

  if (!amountInput) {
    return;
  }

  const languageSelect = document.getElementById("language");
  const currencySelect = document.getElementById("currency");

  const resultText = document.getElementById("resultText");
  const resultBox = document.getElementById("result");

  const messageBox = document.getElementById("message");
  const amountError = document.getElementById("amount-error");

  const convertButton = document.getElementById("convert");
  const copyButton = document.getElementById("copy");
  const clearAmountButton = document.getElementById("clearAmount");

  const quickCurrencyButtons =
    document.querySelectorAll(".quick-option");

  let currentResult = "";
  let copyResetTimer;

  const DEFAULT_RESULT = "Your result will appear here.";

  /* Update quick currency buttons */

  function updateQuickCurrencies() {

    quickCurrencyButtons.forEach(button => {

      const isActive =
        button.dataset.currency === currencySelect.value;

      button.classList.toggle("active", isActive);

      button.setAttribute(
        "aria-pressed",
        String(isActive)
      );

    });

  }

  /* Copy button state */

  function setCopyEnabled(enabled) {

    copyButton.disabled = !enabled;

    copyButton.setAttribute(
      "aria-disabled",
      String(!enabled)
    );

  }

  function resetCopyButton() {

    clearTimeout(copyResetTimer);

    copyButton.textContent = "Copy result";

    setCopyEnabled(false);

  }

  /* Clear messages */

  function clearMessages() {

    messageBox.textContent = "";
    amountError.textContent = "";

    amountInput.classList.remove("input-error");

    amountInput.setAttribute("aria-invalid", "false");

    resultBox.classList.remove("result-error");

  }

  /* Display an error */

  function showInputError(message) {

    amountError.textContent = message;

    amountInput.classList.add("input-error");

    amountInput.setAttribute("aria-invalid", "true");

  }

  /* Clear previous result */

  function clearPreviousResult() {

    currentResult = "";

    resultText.textContent = DEFAULT_RESULT;

    clearMessages();

    resetCopyButton();

  }

  /* Format thousands separators */

  function formatAmountValue(value) {

    const raw = value.replace(/,/g, "");

    /*
      Format only valid numeric editing states.
      Invalid text remains untouched so the engine can report errors.
    */

    if (!/^[+-]?\d+(?:\.\d*)?$/.test(raw)) {
      return value;
    }

    const sign = raw.match(/^[+-]/)?.[0] || "";
    const unsigned = raw.slice(sign.length);

    const parts = unsigned.split(".");
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : null;

    const formattedInteger =
      integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return sign + formattedInteger +
      (decimalPart !== null ? "." + decimalPart : "");

  }

  /* Preserve cursor position while adding commas */

  function formatInputWithCursor() {

    const oldValue = amountInput.value;
    const oldPosition =
      amountInput.selectionStart ?? oldValue.length;

    const nonCommaCharactersBeforeCursor =
      oldValue.slice(0, oldPosition).replace(/,/g, "").length;

    const newValue = formatAmountValue(oldValue);

    if (newValue === oldValue) {
      return;
    }

    amountInput.value = newValue;

    let newPosition = 0;
    let counted = 0;

    while (
      newPosition < newValue.length &&
      counted < nonCommaCharactersBeforeCursor
    ) {

      if (newValue[newPosition] !== ",") {
        counted++;
      }

      newPosition++;

    }

    amountInput.setSelectionRange(
      newPosition,
      newPosition
    );

  }

  /* Clear all numbers */

  clearAmountButton.addEventListener("click", () => {

    amountInput.value = "";

    clearPreviousResult();

    amountInput.focus();

  });

  /* Automatic formatting while typing */

  amountInput.addEventListener("input", () => {

    formatInputWithCursor();

    clearPreviousResult();

  });

  /* Quick currency selection */

  quickCurrencyButtons.forEach(button => {

    button.addEventListener("click", () => {

      currencySelect.value = button.dataset.currency;

      updateQuickCurrencies();

      clearPreviousResult();

    });

  });

  /* Currency dropdown */

  currencySelect.addEventListener("change", () => {

    updateQuickCurrencies();

    clearPreviousResult();

  });

  /* Language dropdown */

  languageSelect.addEventListener("change", () => {

    clearPreviousResult();

  });

  /* Convert amount */

  convertButton.addEventListener("click", () => {

    clearPreviousResult();

    try {

      if (!amountInput.value.trim()) {

        throw new AmountToWordsError(
          "Please enter an amount.",
          "EMPTY_INPUT"
        );

      }

      if (typeof amountToWords !== "function") {

        throw new AmountToWordsError(
          "Conversion engine is unavailable.",
          "ENGINE_UNAVAILABLE"
        );

      }

      const converted = amountToWords(
        amountInput.value,
        currencySelect.value,
        languageSelect.value
      );

      if (
        typeof converted !== "string" ||
        !converted.trim()
      ) {

        throw new AmountToWordsError(
          "No conversion result was returned.",
          "EMPTY_RESULT"
        );

      }

      currentResult = converted;

      resultText.textContent = converted;

      setCopyEnabled(true);

    } catch (error) {

      resultText.textContent =
        "Unable to convert this amount.";

      resultBox.classList.add("result-error");

      showInputError(
        error && error.message
          ? error.message
          : "An unexpected error occurred."
      );

      setCopyEnabled(false);

    }

  });

  /* Copy result */

  copyButton.addEventListener("click", async () => {

    if (!currentResult || copyButton.disabled) {
      return;
    }

    try {

      await navigator.clipboard.writeText(currentResult);

      clearTimeout(copyResetTimer);

      copyButton.textContent = "Copied ✓";

      messageBox.textContent =
        "Result copied successfully.";

      copyResetTimer = setTimeout(() => {

        copyButton.textContent = "Copy result";

      }, 2000);

    } catch (error) {

      messageBox.textContent =
        "Copy is unavailable in this browser.";

    }

  });

  /* Press Enter to convert */

  amountInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {

      convertButton.click();

    }

  });

  /* Initial state */

  updateQuickCurrencies();

  setCopyEnabled(false);

})();
