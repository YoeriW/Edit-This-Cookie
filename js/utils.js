let canvasLoader;

Array.prototype.toTop = function (a) {
    if (a <= 0 || a >= this.length) {
        return false;
    }
    const c = this[a];
    for (let b = a; b > 0; b--) {
        this[b] = this[b - 1];
    }
    this[0] = c;
    return true;
};

const getHost = (url) => (url.match(/:\/\/(.[^:/]+)/)[1]).replace(/^www\./, "");

const addBlockRule = (rule) => {
    const dfilters = data.filters;
    for (let x = 0; x < dfilters.length; x++) {
        const currFilter = dfilters[x];
        if ((currFilter.domain !== null) === (rule.domain !== null)) {
            if (currFilter.domain !== rule.domain) {
                continue;
            }
        } else {
            continue;
        }
        if ((currFilter.name !== null) === (rule.name !== null)) {
            if (currFilter.name !== rule.name) {
                continue;
            }
        } else {
            continue;
        }
        if ((currFilter.value !== null) === (rule.value !== null)) {
            if (currFilter.value !== rule.value) {
                continue;
            }
        } else {
            continue;
        }
        return x;
    }
    dfilters.push(rule);
    data.filters = dfilters;
    
    // Save the updated filters to storage
    chrome.storage.local.set({ filters: data.filters }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error saving filters:', chrome.runtime.lastError);
        } else {
            console.log('Blocking rule added successfully:', rule);
            
            // Notify background script immediately about the new rule
            chrome.runtime.sendMessage({type: 'ruleAdded', rule: rule, allFilters: data.filters}, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script notification sent');
                }
            });
        }
    });
    
    // Note: We don't immediately delete existing cookies here.
    // The blocking will happen automatically when new cookies are set
    // via the chrome.cookies.onChanged listener in background.js
};

const switchReadOnlyRule = (rule) => {
    let added = true;
    const readOnlyList = data.readOnly;
    for (let x = 0; x < readOnlyList.length; x++) {
        try {
            const cRule = readOnlyList[x];
            if (cRule.domain === rule.domain && cRule.name === rule.name && cRule.path === rule.path) {
                added = false;
                readOnlyList.splice(x, 1);
            }
        } catch (e) {
            console.error(e.message);
        }
    }
    if (added) {
        readOnlyList.push(rule);
    }
    data.readOnly = readOnlyList;
    return !!added;
};

const deleteReadOnlyRule = (toDelete) => {
    const readOnlyList = data.readOnly;
    readOnlyList.splice(toDelete, 1);
    data.readOnly = readOnlyList;
};

const deleteBlockRule = (toDelete) => {
    const filtersList = data.filters;
    filtersList.splice(toDelete, 1);
    data.filters = filtersList;
    
    // Save the updated filters to storage
    chrome.storage.local.set({ filters: data.filters }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error saving filters after deletion:', chrome.runtime.lastError);
        } else {
            console.log('Blocking rule deleted successfully, updated filters:', data.filters);
            
            // Notify background script immediately about the rule deletion
            chrome.runtime.sendMessage({type: 'ruleDeleted', allFilters: data.filters}, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Background script notification sent for deletion');
                }
            });
        }
    });
};

const _getMessage = (string, args) => chrome.i18n.getMessage(`editThis_${string}`, args);

const escapeRegex = (string) => {
    if (typeof string !== 'string') return string;
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const filterMatchesCookie = (rule, name, domain, value) => {
    // Only create regex patterns for defined rule properties
    if (rule.domain !== undefined && rule.domain !== null) {
        try {
            // Handle domain matching with better subdomain support
            let domainPattern = rule.domain;
            
            if (domainPattern.startsWith('/') && domainPattern.endsWith('/')) {
                // It's already a regex pattern
                domainPattern = domainPattern.slice(1, -1);
            } else {
                // For exact domain matching, handle subdomains properly
                // If rule domain starts with '.', it should match the domain and all subdomains
                if (domainPattern.startsWith('.')) {
                    // Convert '.example.com' to '.*\\.example\\.com' to match example.com and all subdomains
                    domainPattern = '.*' + escapeRegex(domainPattern);
                } else {
                    // For exact domain matching, escape special characters
                    domainPattern = escapeRegex(domainPattern);
                }
            }
            
            const ruleDomainReg = new RegExp(domainPattern);
            if (domain.match(ruleDomainReg) === null) {
                console.log('Domain mismatch:', { ruleDomain: rule.domain, cookieDomain: domain, pattern: domainPattern });
                return false;
            }
        } catch (e) {
            console.error('Invalid domain regex pattern:', rule.domain, e);
            return false;
        }
    }
    
    if (rule.name !== undefined && rule.name !== null) {
        try {
            // Escape regex special characters for exact matching unless it's already a regex pattern
            const namePattern = rule.name.startsWith('/') && rule.name.endsWith('/') 
                ? rule.name.slice(1, -1) 
                : escapeRegex(rule.name);
            const ruleNameReg = new RegExp(namePattern);
            if (name.match(ruleNameReg) === null) {
                return false;
            }
        } catch (e) {
            console.error('Invalid name regex pattern:', rule.name, e);
            return false;
        }
    }
    
    if (rule.value !== undefined && rule.value !== null) {
        try {
            // Escape regex special characters for exact matching unless it's already a regex pattern
            const valuePattern = rule.value.startsWith('/') && rule.value.endsWith('/') 
                ? rule.value.slice(1, -1) 
                : escapeRegex(rule.value);
            const ruleValueReg = new RegExp(valuePattern);
            if (value.match(ruleValueReg) === null) {
                return false;
            }
        } catch (e) {
            console.error('Invalid value regex pattern:', rule.value, e);
            return false;
        }
    }
    
    return true;
};

const getUrlVars = () => {
    const d = [];
    const a = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
    a.forEach((param) => {
        const [key, value] = param.split("=");
        d.push(key);
        d[key] = value;
    });
    return d;
};

const showPopup = (info, tab) => {
    const tabUrl = encodeURI(tab.url);
    const tabID = encodeURI(tab.id);
    const tabIncognito = encodeURI(tab.incognito);

    const urlToOpen = `${chrome.runtime.getURL("popup.html")}?url=${tabUrl}&id=${tabID}&incognito=${tabIncognito}`;

    chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (tabList) => {
        for (const cTab of tabList) {
            if (cTab.url.startsWith(urlToOpen)) {
                chrome.tabs.update(cTab.id, { active: true });
                return;
            }
        }
        chrome.tabs.create({ url: urlToOpen });
    });
};

const copyToClipboard = (text) => {
    if (text === undefined) return;

    const scrollsave = $('body').scrollTop();

    const copyDiv = document.createElement('textarea');
    copyDiv.style.height = "0.5px";
    document.body.appendChild(copyDiv);
    $(copyDiv).text(text);
    copyDiv.focus();
    copyDiv.select();
    document.execCommand("copy");
    document.body.removeChild(copyDiv);

    $('body').scrollTop(scrollsave);
};

const isChristmasPeriod = () => {
    const nowDate = new Date();
    const isMidDecember = (nowDate.getMonth() === 11 && nowDate.getDate() > 5);
    const isStartJanuary = (nowDate.getMonth() === 0 && nowDate.getDate() <= 6);
    return isMidDecember || isStartJanuary;
};

const setLoaderVisible = (visible) => {
    if (visible) {
        $("#loader-container").show();
    } else {
        $("#loader-container").hide();
    }
};
