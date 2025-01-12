//TAKEN FROM:
//https://adblockforchrome.googlecode.com/svn/trunk/port.js

// Updated August 2024 to support Chrome manifest v3. Replaced chrome.extension.getURL
// with chrome.runtime.getURL.
// - cldevdad

// Chrome to Safari port
// Author: Michael Gundlach (gundlach@gmail.com)
// License: GPLv3 as part of adblockforchrome.googlecode.com
//          or MIT if GPLv3 conflicts with your code's license.

chrome.i18n = chrome.i18n || {};
chrome.i18n = (() => {

  const supportedLocales = [
    { code: "ar", name: "Arabic" },
    { code: "zh_CN", name: "Chinese (China)" },
    { code: "zh_TW", name: "Chinese (Taiwan)" },
    { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" },
    { code: "nl", name: "Dutch" },
    { code: "en", name: "English" },
    { code: "en_GB", name: "English (Great Britain)" },
    { code: "en_US", name: "English (USA)" },
    { code: "et", name: "Estonian" },
    { code: "fi", name: "Finnish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "el", name: "Greek" },
    { code: "he", name: "Hebrew" },
    { code: "hu", name: "Hungarian" },
    { code: "id", name: "Indonesian" },
    { code: "it", name: "Italian" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
    { code: "lt", name: "Lithuanian" },
    { code: "no", name: "Norwegian" },
    { code: "pl", name: "Polish" },
    { code: "pt_BR", name: "Portuguese (Brazil)" },
    { code: "pt_PT", name: "Portuguese (Portugal)" },
    { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" },
    { code: "sr", name: "Serbian" },
    { code: "sk", name: "Slovak" },
    { code: "es", name: "Spanish" },
    { code: "sv", name: "Swedish" },
    { code: "tr", name: "Turkish" },
    { code: "uk", name: "Ukrainian" },
    { code: "vi", name: "Vietnamese" }
  ];

  const syncFetch = (file, fn) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.runtime.getURL(file), false);
    xhr.onreadystatechange = function() {
      if (this.readyState === 4 && this.responseText !== "") {
        fn(this.responseText);
      }
    };
    try {
      xhr.send();
    } catch (e) {
      // File not found, perhaps
    }
  };

  const parseString = (msgData, args) => {
    if (msgData.placeholders === undefined && args === undefined)
      return msgData.message.replace(/\$\$/g, '$');

    const safesub = (txt, re, replacement) => {
      const dollaRegex = /\$\$/g, dollaSub = "~~~I18N~~:";
      txt = txt.replace(dollaRegex, dollaSub);
      txt = txt.replace(re, replacement);
      const undollaRegex = /~~~I18N~~:/g, undollaSub = "$$$$";
      txt = txt.replace(undollaRegex, undollaSub);
      return txt;
    };

    const $n_re = /\$([1-9])/g;
    const $n_subber = (_, num) => args[num - 1];

    const placeholders = {};
    for (const name in msgData.placeholders) {
      const content = msgData.placeholders[name].content;
      placeholders[name.toLowerCase()] = safesub(content, $n_re, $n_subber);
    }

    let message = safesub(msgData.message, $n_re, $n_subber);
    message = safesub(message, /\$(\w+?)\$/g, (full, name) => {
      const lowered = name.toLowerCase();
      return lowered in placeholders ? placeholders[lowered] : full;
    });
    message = message.replace(/\$\$/g, '$');

    return message;
  };

  let l10nData;

  const theI18nObject = {
    _getL10nData: () => {
      const result = { locales: [] };

      if (preferences.useCustomLocale && preferences.customLocale != null)
        result.locales.push(preferences.customLocale);
      result.locales.push(navigator.language.replace('-', '_'));
      if (navigator.language.length > 2)
        result.locales.push(navigator.language.substring(0, 2));
      if (!result.locales.includes("en"))
        result.locales.push("en");

      result.messages = {};
      for (const locale of result.locales) {
        const file = `_locales/${locale}/messages.json`;
        syncFetch(file, text => {
          result.messages[locale] = JSON.parse(text);
        });
      }

      return result;
    },

    _setL10nData: (data) => {
      l10nData = data;
    },

    getMessage: (messageID, args) => {
      if (l10nData === undefined) {
        chrome.i18n._setL10nData(chrome.i18n._getL10nData());
      }
      if (typeof args === "string")
        args = [args];
      for (const locale of l10nData.locales) {
        const map = l10nData.messages[locale];
        if (map && messageID in map)
          return parseString(map[messageID], args);
      }
      return "";
    },

    getExistingLocales: () => {
      const existingLocales = [];
      for (const { code } of supportedLocales) {
        const file = `_locales/${code}/messages.json`;
        const xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.runtime.getURL(file), false);
        try {
          xhr.send();
          existingLocales.push({ code });
        } catch (e) {
          // File not found, perhaps
        }
      }
      return existingLocales;
    }
  };

  return theI18nObject;
})();
