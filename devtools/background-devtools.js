// Background page -- background.js
chrome.runtime.onConnect.addListener(function (port) {
    if (port.name != "devtools-page") {
        return;
    }
    // assign the listener function to a variable so we can remove it later
    var devToolsListener = function (message, sender, sendResponse) {
        var action = message.action;
        if (action === "getall") {
            getAll(port, message);
        } else if (action === "submitCookie") {
            var cookie = message.cookie;
            var origName = message.origName;
            deleteCookie(cookie.url, origName, cookie.storeId);
            chrome.cookies.set(cookie, function() {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                } else {
                    console.log("Cookie set successfully");
                }
            });
            issueRefresh(port);
        }

    };
    // add the listener
    port.onMessage.addListener(devToolsListener);

    port.onDisconnect.addListener(function () {
        port.onMessage.removeListener(devToolsListener);
    });
});

function issueRefresh(port) {
    port.postMessage({
        action: "refresh"
    });
}

function getAll(port, message) {

    chrome.tabs.get(message.tabId, function (tab) {
        var url = tab.url;

        chrome.cookies.getAllCookieStores((cookieStores) => {
            let storeId;
            for (let x = 0; x < cookieStores.length; x++) {
                if (cookieStores[x].tabIds.indexOf(message.tabId) != -1) {
                    storeId = cookieStores[x].id;
                    break;
                }
            }

            if (!storeId) {
                console.error("No valid cookie store id found.");
                return;
            }

            chrome.cookies.getAll({ url: url, storeId: storeId }, function (cks) {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    return;
                }

                port.postMessage({
                    action: "getall",
                    url: url,
                    cks: cks
                });
            });
        });
    });
}
