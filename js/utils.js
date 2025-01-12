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
    const filterURL = {};

    if (rule.name !== undefined) {
        filterURL.name = rule.name;
    }
    if (rule.value !== undefined) {
        filterURL.value = rule.value;
    }
    if (rule.domain !== undefined) {
        filterURL.domain = rule.domain;
    }
    chrome.cookies.getAll({}, (cookieL) => {
        cookieL.forEach((cCookie) => {
            if (filterMatchesCookie(filterURL, cCookie.name, cCookie.domain, cCookie.value)) {
                const cUrl = `https://${cCookie.domain}${cCookie.path}`;
                deleteCookie(cUrl, cCookie.name, cCookie.storeId, cCookie);
            }
        });
    });
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
};

const _getMessage = (string, args) => chrome.i18n.getMessage(`editThis_${string}`, args);

const filterMatchesCookie = (rule, name, domain, value) => {
    const ruleDomainReg = new RegExp(rule.domain);
    const ruleNameReg = new RegExp(rule.name);
    const ruleValueReg = new RegExp(rule.value);
    if (rule.domain !== undefined && domain.match(ruleDomainReg) === null) {
        return false;
    }
    if (rule.name !== undefined && name.match(ruleNameReg) === null) {
        return false;
    }
    if (rule.value !== undefined && value.match(ruleValueReg) === null) {
        return false;
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
