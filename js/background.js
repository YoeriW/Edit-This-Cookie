importScripts('utils.js');

// Initialize global variables
var data = {
    lastVersionRun: null,
    readOnly: [],
    filters: [],
    nCookiesProtected: 0,
    nCookiesFlagged: 0,
    nCookiesShortened: 0
};

// Initialize global preferences
var preferences = {
    showContextMenu: true,
    showChristmasIcon: false,
    useMaxCookieAge: false,
    maxCookieAgeType: 0
};

var showContextMenu = undefined;

// Load preferences and data from Chrome storage
chrome.storage.local.get(['lastVersionRun', 'readOnly', 'filters', 'preferences'], function (items) {
    data.lastVersionRun = items.lastVersionRun || null;
    data.readOnly = items.readOnly || [];
    data.filters = items.filters || [];
    preferences = items.preferences || preferences;

    showContextMenu = preferences.showContextMenu;

    var currentVersion = chrome.runtime.getManifest().version;
    var oldVersion = data.lastVersionRun;

    data.lastVersionRun = currentVersion;
    chrome.storage.local.set({ lastVersionRun: currentVersion });

    if (oldVersion !== currentVersion) {
        if (oldVersion === null || oldVersion === undefined) { 
            // Is firstrun
            chrome.tabs.create({ url: 'http://www.editthiscookie.com/start/' });
        } else {
            chrome.notifications.onClicked.addListener(function (notificationId) {
                chrome.tabs.create({
                    url: 'http://www.editthiscookie.com/changelog/'
                });
                chrome.notifications.clear(notificationId, function () {});
            });
            var opt = {
                type: "basic",
                title: "EditThisCookie",
                message: _getMessage("updated"),
                iconUrl: "/img/icon_128x128.png",
                isClickable: true
            };
            chrome.notifications.create("", opt, function () {});
        }
    }

    updateCallback();
});

function updateCallback() {
    if (showContextMenu !== preferences.showContextMenu) {
        showContextMenu = preferences.showContextMenu;
        setContextMenu(showContextMenu);
    }
    setChristmasIcon();
}

function setChristmasIcon() {
    if (isChristmasPeriod() && preferences.showChristmasIcon) {
        chrome.action.setIcon({ path: "/img/cookie_xmas_19x19.png" });
    } else {
        chrome.action.setIcon({ path: "/img/icon_19x19.png" });
    }
}

setChristmasIcon();
setInterval(setChristmasIcon, 60 * 60 * 1000);

// Every time the browser restarts, the first time the user goes to the options he ends up in the default page (support)
chrome.storage.local.set({ option_panel: "null" }, function () {
    if (chrome.runtime.lastError) {
        console.error("Error setting option_panel: ", chrome.runtime.lastError);
    } else {
        console.log("option_panel set to null");
    }
});

setContextMenu(preferences.showContextMenu);

chrome.cookies.onChanged.addListener(function (changeInfo) {
    var removed = changeInfo.removed;
    var cookie = changeInfo.cookie;
    var cause = changeInfo.cause;

    if (cause === "expired" || cause === "evicted") return;

    for (var i = 0; i < data.readOnly.length; i++) {
        var currentRORule = data.readOnly[i];
        if (compareCookies(cookie, currentRORule)) {
            if (removed) {
                chrome.cookies.get({
                    url: "http" + ((currentRORule.secure) ? "s" : "") + "://" + currentRORule.domain + currentRORule.path,
                    name: currentRORule.name,
                    storeId: currentRORule.storeId
                }, function (currentCookie) {
                    if (compareCookies(currentCookie, currentRORule)) return;
                    var newCookie = cookieForCreationFromFullCookie(currentRORule);
                    chrome.cookies.set(newCookie);
                    ++data.nCookiesProtected;
                });
            }
            return;
        }
    }

    if (!removed) {
        for (var i = 0; i < data.filters.length; i++) {
            var currentFilter = data.filters[i];
            if (filterMatchesCookie(currentFilter, cookie.name, cookie.domain, cookie.value)) {
                chrome.tabs.query({ active: true }, function (tabs) {
                    var toRemove = {
                        url: "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path,
                        name: cookie.name
                    };
                    chrome.cookies.remove(toRemove);
                    ++data.nCookiesFlagged;
                });
            }
        }
    }

    if (!removed && preferences.useMaxCookieAge && preferences.maxCookieAgeType > 0) {
        var maxAllowedExpiration = Math.round(Date.now() / 1000) + (preferences.maxCookieAge * preferences.maxCookieAgeType);
        if (cookie.expirationDate !== undefined && cookie.expirationDate > maxAllowedExpiration + 60) {
            var newCookie = cookieForCreationFromFullCookie(cookie);
            if (!cookie.session) newCookie.expirationDate = maxAllowedExpiration;
            chrome.cookies.set(newCookie);
            ++data.nCookiesShortened;
        }
    }
});

function setContextMenu(show) {
    chrome.contextMenus.removeAll(function() {
        if (chrome.runtime.lastError) {
            console.error("Error removing context menus: ", chrome.runtime.lastError);
        } else {
            console.log("Context menus removed");
        }

        if (show) {
            chrome.contextMenus.create({
                id: "editThisCookie", // Unique identifier for the context menu item
                title: "EditThisCookie",
                contexts: ["page"]
            }, function() {
                if (chrome.runtime.lastError) {
                    console.error("Error creating context menu: ", chrome.runtime.lastError);
                } else {
                    console.log("Context menu created");
                }
            });
        }
    });
}

