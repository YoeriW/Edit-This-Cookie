importScripts('utils.js');
importScripts('cookie_helpers.js');

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
    
    // Log the current state for debugging
    console.log('Extension loaded with:', {
        filtersCount: data.filters.length,
        filters: data.filters,
        blockingDisabled: blockingDisabled
    });

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
    
    // Listen for storage changes to update blocking rules in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.filters) {
            console.log('Storage change detected - updating blocking rules');
            data.filters = changes.filters.newValue || [];
            console.log('Updated filters:', data.filters);
        }
    });
});

function updateCallback() {
    try {
        if (showContextMenu !== preferences.showContextMenu) {
            showContextMenu = preferences.showContextMenu;
            setContextMenu(showContextMenu);
        }
        setChristmasIcon();
    } catch (e) {
        console.error("Error in updateCallback:", {
            error: e.message,
            stack: e.stack,
            preferences: preferences
        });
    }
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

// Periodic cleanup of blocked cookies - OPTIMIZED VERSION
let cleanupInterval = null;
let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 30000; // 30 seconds between cleanups

const cleanupBlockedCookies = () => {
    // Skip if no blocking rules or blocking is disabled
    if (data.filters.length === 0 || blockingDisabled) {
        return;
    }
    
    // Skip if we just did a cleanup recently
    const now = Date.now();
    if (now - lastCleanupTime < CLEANUP_COOLDOWN) {
        return;
    }
    
    // Only run cleanup if there are active tabs with cookies
    chrome.tabs.query({}, (tabs) => {
        if (tabs.length === 0) return;
        
        // Get cookies only from active domains to reduce load
        const activeDomains = new Set();
        tabs.forEach(tab => {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                try {
                    const url = new URL(tab.url);
                    activeDomains.add(url.hostname);
                    // Also add parent domain for broader coverage
                    const parts = url.hostname.split('.');
                    if (parts.length > 2) {
                        activeDomains.add('.' + parts.slice(-2).join('.'));
                    }
                } catch (e) {
                    // Skip invalid URLs
                }
            }
        });
        
        if (activeDomains.size === 0) return;
        
        // Only get cookies from active domains
        const domainFilters = Array.from(activeDomains).map(domain => ({ domain }));
        
        chrome.cookies.getAll({}, (cookies) => {
            let processedCount = 0;
            let removedCount = 0;
            
            cookies.forEach((cookie) => {
                // Skip if not from active domains
                const cookieDomain = cookie.domain.replace(/^\./, '');
                const isActiveDomain = Array.from(activeDomains).some(domain => 
                    cookieDomain === domain.replace(/^\./, '') || 
                    cookieDomain.endsWith(domain.replace(/^\./, ''))
                );
                
                if (!isActiveDomain) return;
                
                // Skip cleanup for sites with redirect loop protection
                if (blockedSites.has(cookieDomain)) {
                    return;
                }
                
                processedCount++;
                
                // Check if cookie matches any blocking rule
                for (const filter of data.filters) {
                    if (filterMatchesCookie(filter, cookie.name, cookie.domain, cookie.value)) {
                        console.log('Periodic cleanup: found blocked cookie:', cookie.name, 'from', cookie.domain);
                        
                        try {
                            let domain = cookie.domain;
                            if (domain.startsWith('http://') || domain.startsWith('https://')) {
                                domain = domain.replace(/^https?:\/\//, '');
                            }
                            
                            const toRemove = {
                                url: `http${cookie.secure ? "s" : ""}://${domain}${cookie.path}`,
                                name: cookie.name,
                                storeId: cookie.storeId
                            };
                            
                            chrome.cookies.remove(toRemove, (details) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Error in periodic cleanup:', chrome.runtime.lastError);
                                } else {
                                    removedCount++;
                                    console.log('Periodic cleanup: removed blocked cookie:', cookie.name);
                                }
                            });
                        } catch (e) {
                            console.error('Error in periodic cleanup:', e);
                        }
                        break; // Found a match, no need to check other filters
                    }
                }
            });
            
            if (processedCount > 0 || removedCount > 0) {
                console.log(`Periodic cleanup completed: processed ${processedCount} cookies, removed ${removedCount} blocked cookies`);
                lastCleanupTime = now;
            }
        });
    });
};

// Start cleanup interval only when there are blocking rules
const startCleanupInterval = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }
    
    if (data.filters.length > 0 && !blockingDisabled) {
        cleanupInterval = setInterval(cleanupBlockedCookies, 5000);
        console.log('Started periodic cleanup interval');
    }
};

const stopCleanupInterval = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('Stopped periodic cleanup interval');
    }
};

// Initialize cleanup based on current state
if (data.filters.length > 0) {
    startCleanupInterval();
}

// Every time the browser restarts, the first time the user goes to the options he ends up in the default page (support)
chrome.storage.local.set({ option_panel: "null" }, () => {
    if (chrome.runtime.lastError) {
        console.error("Error setting option_panel: ", chrome.runtime.lastError);
    } else {
        console.log("option_panel set to null");
    }
});

setContextMenu(preferences.showContextMenu);

// Track redirect loops to prevent infinite blocking
let redirectLoopCount = {};
let blockedSites = new Set();
let blockingDisabled = false; // Global disable flag

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
        // Check if blocking is globally disabled
        if (blockingDisabled) {
            console.log('Blocking globally disabled, skipping cookie:', cookie.name, 'from', cookie.domain);
            return;
        }
        
        // Check if this site is temporarily blocked due to redirect loops
        const cookieDomain = cookie.domain.replace(/^\./, ''); // Remove leading dot
        if (blockedSites.has(cookieDomain)) {
            console.log('Skipping blocking for', cookieDomain, 'due to redirect loop protection');
            return;
        }
        
        for (const currentFilter of data.filters) {
            if (filterMatchesCookie(currentFilter, cookie.name, cookie.domain, cookie.value)) {
                console.log('Blocking cookie:', {
                    name: cookie.name,
                    domain: cookie.domain,
                    value: cookie.value,
                    filter: currentFilter,
                    cause: cause
                });
                
                // Track blocking frequency to detect redirect loops
                if (!redirectLoopCount[cookieDomain]) {
                    redirectLoopCount[cookieDomain] = { count: 0, lastReset: Date.now() };
                }
                
                const now = Date.now();
                const timeWindow = 10000; // 10 seconds
                
                if (now - redirectLoopCount[cookieDomain].lastReset > timeWindow) {
                    redirectLoopCount[cookieDomain] = { count: 1, lastReset: now };
                } else {
                    redirectLoopCount[cookieDomain].count++;
                }
                
                // If we're blocking too many cookies too quickly, it might be a redirect loop
                if (redirectLoopCount[cookieDomain].count > 20) {
                    console.warn('Potential redirect loop detected for', cookieDomain, '- temporarily disabling blocking');
                    blockedSites.add(cookieDomain);
                    
                    // Re-enable blocking after 5 minutes
                    setTimeout(() => {
                        blockedSites.delete(cookieDomain);
                        redirectLoopCount[cookieDomain] = { count: 0, lastReset: Date.now() };
                        console.log('Re-enabled blocking for', cookieDomain);
                    }, 5 * 60 * 1000);
                    
                    return;
                }
                
                // Remove the cookie immediately without waiting for tab query
                try {
                    // Ensure domain doesn't already include protocol
                    let domain = cookie.domain;
                    if (domain.startsWith('http://') || domain.startsWith('https://')) {
                        domain = domain.replace(/^https?:\/\//, '');
                    }
                    
                    const toRemove = {
                        url: `http${cookie.secure ? "s" : ""}://${domain}${cookie.path}`,
                        name: cookie.name,
                        storeId: cookie.storeId
                    };
                    
                    chrome.cookies.remove(toRemove, (details) => {
                        if (chrome.runtime.lastError) {
                            console.error('Error removing blocked cookie:', chrome.runtime.lastError, {
                                cookie: cookie.name,
                                domain: cookie.domain,
                                error: chrome.runtime.lastError.message
                            });
                        } else {
                            console.log('Successfully blocked cookie:', cookie.name, 'from', cookie.domain);
                            ++data.nCookiesFlagged;
                        }
                    });
                } catch (e) {
                    console.error('Error in cookie blocking logic:', e);
                }
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
    
    // Additional check: periodically clean up any blocked cookies that might have slipped through
    if (!removed && data.filters.length > 0) {
        // Small delay to ensure the cookie was fully set
        setTimeout(() => {
            for (const currentFilter of data.filters) {
                if (filterMatchesCookie(currentFilter, cookie.name, cookie.domain, cookie.value)) {
                    console.log('Additional cleanup: blocking persistent cookie:', cookie.name, 'from', cookie.domain);
                    
                    try {
                        let domain = cookie.domain;
                        if (domain.startsWith('http://') || domain.startsWith('https://')) {
                            domain = domain.replace(/^https?:\/\//, '');
                        }
                        
                        const toRemove = {
                            url: `http${cookie.secure ? "s" : ""}://${domain}${cookie.path}`,
                            name: cookie.name,
                            storeId: cookie.storeId
                        };
                        
                        chrome.cookies.remove(toRemove, (details) => {
                            if (chrome.runtime.lastError) {
                                console.error('Error in cleanup removal:', chrome.runtime.lastError);
                            } else {
                                console.log('Cleanup: successfully blocked persistent cookie:', cookie.name);
                            }
                        });
                    } catch (e) {
                        console.error('Error in cleanup logic:', e);
                    }
                }
            }
        }, 100); // 100ms delay
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
        case 'disableBlocking':
            const domain = message.domain;
            if (domain) {
                blockedSites.add(domain);
                console.log('Manually disabled blocking for:', domain);
                sendResponse({ success: true, message: `Blocking disabled for ${domain} for 5 minutes` });
                
                // Re-enable after 5 minutes
                setTimeout(() => {
                    blockedSites.delete(domain);
                    console.log('Re-enabled blocking for:', domain);
                }, 5 * 60 * 1000);
            } else {
                sendResponse({ error: 'Domain not specified' });
            }
            break;
        case 'enableBlocking':
            const domainToEnable = message.domain;
            if (domainToEnable) {
                blockedSites.delete(domainToEnable);
                console.log('Manually re-enabled blocking for:', domainToEnable);
                sendResponse({ success: true, message: `Blocking re-enabled for ${domainToEnable}` });
            } else {
                sendResponse({ error: 'Domain not specified' });
            }
            break;
        case 'clearAllBlocking':
            // Clear all blocking rules and disable blocking completely
            data.filters = [];
            blockedSites.clear();
            redirectLoopCount = {};
            
            // Stop cleanup interval since no rules exist
            stopCleanupInterval();
            
            // Clear from storage
            chrome.storage.local.set({ filters: [] }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error clearing filters from storage:', chrome.runtime.lastError);
                } else {
                    console.log('All blocking rules cleared from storage');
                }
            });
            
            console.log('All blocking rules cleared and blocking disabled');
            sendResponse({ success: true, message: 'All blocking rules cleared and blocking disabled' });
            break;
        case 'getBlockingStatus':
            sendResponse({ 
                filters: data.filters, 
                blockedSites: Array.from(blockedSites),
                redirectLoopCount: redirectLoopCount,
                blockingDisabled: blockingDisabled,
                extensionLoaded: true,
                timestamp: new Date().toISOString()
            });
            break;
        case 'disableAllBlocking':
            blockingDisabled = true;
            stopCleanupInterval();
            console.log('All cookie blocking disabled globally');
            sendResponse({ success: true, message: 'All cookie blocking disabled globally' });
            break;
        case 'enableAllBlocking':
            blockingDisabled = false;
            if (data.filters.length > 0) {
                startCleanupInterval();
            }
            console.log('All cookie blocking re-enabled globally');
            sendResponse({ success: true, message: 'All cookie blocking re-enabled globally' });
            break;
        case 'ruleAdded':
            // Immediately update filters when a new rule is added
            if (message.allFilters) {
                data.filters = message.allFilters;
                console.log('Immediately updated filters from rule addition:', data.filters);
                // Start cleanup interval if we now have rules
                startCleanupInterval();
            }
            sendResponse({ success: true, message: 'Rule added and filters updated' });
            break;
        case 'ruleDeleted':
            // Immediately update filters when a rule is deleted
            if (message.allFilters) {
                data.filters = message.allFilters;
                console.log('Immediately updated filters from rule deletion:', data.filters);
                // Stop cleanup interval if no more rules
                if (data.filters.length === 0) {
                    stopCleanupInterval();
                }
            }
            sendResponse({ success: true, message: 'Rule deleted and filters updated' });
            break;
        case 'restartBlocking':
            // Restart the blocking system by reloading data from storage
            chrome.storage.local.get(['filters', 'preferences'], items => {
                data.filters = items.filters || [];
                preferences = items.preferences || preferences;
                blockingDisabled = false;
                blockedSites.clear();
                redirectLoopCount = {};
                
                console.log('Blocking system restarted with', data.filters.length, 'rules');
                sendResponse({ 
                    success: true, 
                    message: `Blocking system restarted with ${data.filters.length} rules`,
                    filters: data.filters
                });
            });
            return true; // Keep message channel open for async response
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
