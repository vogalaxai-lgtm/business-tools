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
