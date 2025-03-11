importScripts('utils.js');

// Initialize global variables
const data = {
    lastVersionRun: null,
    readOnly: [],
    filters: [],
    nCookiesProtected: 0,
    nCookiesFlagged: 0,
    nCookiesShortened: 0
};

// Initialize global preferences
let preferences = {
    themeColor: 'light',
    showContextMenu: true,
    showChristmasIcon: false,
    useMaxCookieAge: false,
    maxCookieAgeType: 0
};

let showContextMenu = undefined;

// Load preferences and data from Chrome storage
chrome.storage.local.get(['lastVersionRun', 'readOnly', 'filters', 'preferences'], items => {
    data.lastVersionRun = items.lastVersionRun || null;
    data.readOnly = items.readOnly || [];
    data.filters = items.filters || [];
    preferences = items.preferences || preferences;

    showContextMenu = preferences.showContextMenu;

    const currentVersion = chrome.runtime.getManifest().version;
    const oldVersion = data.lastVersionRun;

    data.lastVersionRun = currentVersion;
    chrome.storage.local.set({ lastVersionRun: currentVersion });

    if (oldVersion !== currentVersion) {
        if (oldVersion === null || oldVersion === undefined) { 
            // Is firstrun
            chrome.tabs.create({ url: 'https://www.editthiscookiefork.com/getting-started/' });
        } else {
            chrome.notifications.onClicked.addListener(notificationId => {
                chrome.tabs.create({
                    url: 'https://www.editthiscookiefork.com/changelog/'
                });
                chrome.notifications.clear(notificationId, () => {});
            });
            const opt = {
                type: "basic",
                title: "EditThisCookie",
                message: _getMessage("updated"),
                iconUrl: "/img/icon_128x128.png",
                isClickable: true
            };
            chrome.notifications.create("", opt, () => {});
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
chrome.storage.local.set({ option_panel: "null" }, () => {
    if (chrome.runtime.lastError) {
        console.error("Error setting option_panel: ", chrome.runtime.lastError);
    } else {
        console.log("option_panel set to null");
    }
});

setContextMenu(preferences.showContextMenu);

chrome.cookies.onChanged.addListener(changeInfo => {
    const { removed, cookie, cause } = changeInfo;

    if (cause === "expired" || cause === "evicted") return;

    for (const currentRORule of data.readOnly) {
        if (compareCookies(cookie, currentRORule)) {
            if (removed) {
                chrome.cookies.get({
                    url: `http${currentRORule.secure ? "s" : ""}://${currentRORule.domain}${currentRORule.path}`,
                    name: currentRORule.name,
                    storeId: String(currentRORule.storeId)
                }, currentCookie => {
                    if (compareCookies(currentCookie, currentRORule)) return;
                    const newCookie = cookieForCreationFromFullCookie(currentRORule);
                    chrome.cookies.set(newCookie);
                    ++data.nCookiesProtected;
                });
            }
            return;
        }
    }

    if (!removed) {
        for (const currentFilter of data.filters) {
            if (filterMatchesCookie(currentFilter, cookie.name, cookie.domain, cookie.value)) {
                chrome.tabs.query({ active: true }, tabs => {
                    const toRemove = {
                        url: `http${cookie.secure ? "s" : ""}://${cookie.domain}${cookie.path}`,
                        name: cookie.name
                    };
                    chrome.cookies.remove(toRemove);
                    ++data.nCookiesFlagged;
                });
            }
        }
    }

    if (!removed && preferences.useMaxCookieAge && preferences.maxCookieAgeType > 0) {
        const maxAllowedExpiration = Math.round(Date.now() / 1000) + (preferences.maxCookieAge * preferences.maxCookieAgeType);
        if (cookie.expirationDate !== undefined && cookie.expirationDate > maxAllowedExpiration + 60) {
            const newCookie = cookieForCreationFromFullCookie(cookie);
            if (!cookie.session) newCookie.expirationDate = maxAllowedExpiration;
            chrome.cookies.set(newCookie);
            ++data.nCookiesShortened;
        }
    }
});

function setContextMenu(show) {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
            console.error("Error removing context menus: ", chrome.runtime.lastError);
        } else {
            console.log("Context menus removed");
        }

        if (show) {
            chrome.contextMenus.create({
                id: "editThisCookie",
                title: "Edit This Cookie",
                contexts: ["page"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error creating context menu: ", chrome.runtime.lastError);
                } else {
                    console.log("Context menu created");
                }
            });
            
            chrome.contextMenus.onClicked.addListener((info, tab) => {
                if (info.menuItemId === "editThisCookie") {
                    chrome.action.openPopup();
                }
            });
        }
    });
}

const handleMessage = (message, sender, sendResponse) => {
    switch (message.type) {
        case 'getCookies':
            getCookies(message.details, sendResponse);
            break;
        case 'setCookie':
            setCookie(message.details, sendResponse);
            break;
        case 'removeCookie':
            removeCookie(message.details, sendResponse);
            break;
        default:
            sendResponse({ error: 'Unknown message type' });
    }
};

const getCookies = ({ url, name }, callback) => {
    chrome.cookies.get({ url, name }, cookie => {
        callback(cookie);
    });
};

const setCookie = (details, callback) => {
    chrome.cookies.set(details, cookie => {
        callback(cookie);
    });
};

const removeCookie = ({ url, name, storeId }, callback) => {
    chrome.cookies.remove({ url, name, storeId }, details => {
        callback(details);
    });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep the message channel open for sendResponse
});
