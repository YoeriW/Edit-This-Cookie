let currentTabID;
let isTabIncognito = false;
let cookieList = [];
let newCookie = false;
let pasteCookie = false;
let currentLayout = "none";
let lastInput = "";

$.fx.speeds._default = 200;

$(document).ready(() => {
    ++data.nPopupClicked;
    start();

    /**
     * Force Repaint
     * Temporary workaround for Chromium #428044 bug
     * https://bugs.chromium.org/p/chromium/issues/detail?id=428044#c35
     */
    const body = $('body').css('display', 'none');
    setTimeout(() => {
        body.css('display', '');
    }, 100);
});

const start = () => {
    setLoaderVisible(true);

    const arguments = getUrlVars();
    if (arguments.url === undefined) {
        chrome.tabs.query(
            {
                active: true,
                lastFocusedWindow: true
            },
            (tabs) => {
                const currentTabURL = tabs[0].url;
                currentTabID = tabs[0].id;
                $('input', '#cookieSearchCondition').val(currentTabURL);
                document.title = `${document.title}-${currentTabURL}`;
                doSearch(false);
            }
        );
    } else {
        const url = decodeURI(arguments.url);
        currentTabID = parseInt(decodeURI(arguments.id));
        isTabIncognito = decodeURI(arguments.incognito) === "true";
        $('input', '#cookieSearchCondition').val(url);
        document.title = `${document.title}-${url}`;
        doSearch(true);
    }
}

const getUrlOfCookies = () => $('input', '#cookieSearchCondition').val();

const doSearch = (isSeparateWindow) => {
    const url = $('input', '#cookieSearchCondition').val();
    if (url.length < 3) return;
    const filter = new Filter();
    if (/^https?:\/\/.+$/.test(url)) {
        filter.setUrl(url);
    } else {
        filter.setDomain(url);
    }
    createList(filter.getFilter(), isSeparateWindow);
}

const submit = (currentTabID) => {
    if (newCookie) {
        submitNew(currentTabID);
    } else if (pasteCookie) {
        importCookies();
    } else {
        submitAll(currentTabID);
    }
}

const submitAll = (currentTabID) => {
    const cookies = $(".cookie", "#cookiesList");
    let nCookiesToUpdate = cookies.length;

    const onUpdateComplete = () => {
        data.nCookiesChanged += cookies.length;
        if (preferences.refreshAfterSubmit) {
            chrome.tabs.reload(currentTabID, { 'bypassCache': preferences.skipCacheRefresh });
        }
        doSearch();
    };

    cookies.each(function () {
        const cCookie = formCookieData($(this));

        if (cCookie === undefined) {
            return;
        }

        deleteCookie(cCookie.url, cCookie.name, cCookie.storeId, () => {
            chrome.cookies.set(cCookie, () => {
                if (--nCookiesToUpdate === 0) {
                    onUpdateComplete();
                }
            });
        });
    });
}

const submitNew = () => {
    let cCookie = formCookieData($("#newCookie"));
    if (cCookie === undefined) return;

    chrome.cookies.getAllCookieStores((cookieStores) => {
        for (let x = 0; x < cookieStores.length; x++) {
            if (cookieStores[x].tabIds.indexOf(currentTabID) != -1) {
                cCookie.storeId = cookieStores[x].id;
                break;
            }
        }

        cCookie = cookieForCreationFromFullCookie(cCookie);
        deleteCookie(cCookie.url, cCookie.name, cCookie.storeId, () => {
            chrome.cookies.set(cCookie, doSearch);
            ++data.nCookiesCreated;
        });
    });
}

const createList = (filters, isSeparateWindow) => {
    let filteredCookies = [];

    if (filters === null) filters = {};

    const filterURL = {};
    if (filters.url !== undefined) filterURL.url = filters.url;
    if (filters.domain !== undefined) filterURL.domain = filters.domain;

    if (!isSeparateWindow) {
        $('#submitDiv').css({
            'bottom': 0
        });
    } else {
        $('#submitDiv').addClass("submitDivSepWindow");
    }

    chrome.cookies.getAllCookieStores((cookieStores) => {
        let storeId;
        for (let x = 0; x < cookieStores.length; x++) {
            console.log("Checking cookie store:", cookieStores[x]);
            if (cookieStores[x].tabIds.indexOf(currentTabID) != -1) {
                storeId = cookieStores[x].id;
                break;
            }
        }

        if (!storeId) {
            console.error("No valid cookie store id found.");
            return;
        }

        filterURL.storeId = storeId;

        chrome.cookies.getAll(filterURL, (cks) => {
            let currentC;
            for (let i = 0; i < cks.length; i++) {
                currentC = cks[i];

                if (filters.name !== undefined && currentC.name.toLowerCase().indexOf(filters.name.toLowerCase()) === -1) continue;
                if (filters.domain !== undefined && currentC.domain.toLowerCase().indexOf(filters.domain.toLowerCase()) === -1) continue;
                if (filters.secure !== undefined && currentC.secure.toLowerCase().indexOf(filters.secure.toLowerCase()) === -1) continue;
                if (filters.session !== undefined && currentC.session.toLowerCase().indexOf(filters.session.toLowerCase()) === -1) continue;

                for (let x = 0; x < data.readOnly.length; x++) {
                    try {
                        const lock = data.readOnly[x];
                        if (lock.name === currentC.name && lock.domain === currentC.domain) {
                            currentC.isProtected = true;
                            break;
                        }
                    } catch (e) {
                        console.error(e.message);
                        delete data.readOnly[x];
                    }
                }
                filteredCookies.push(currentC);
            }
            cookieList = filteredCookies;

            $("#cookiesList").empty();

            if (cookieList.length === 0) {
                swithLayout();
                setEvents();
                setLoaderVisible(false);
                return;
            }

            cookieList.sort((a, b) => {
                if (preferences.sortCookiesType === "domain_alpha") {
                    const compDomain = a.domain.toLowerCase().localeCompare(b.domain.toLowerCase());
                    if (compDomain) return compDomain;
                }
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });

            createAccordionList(cookieList, () => {
                swithLayout();
                setEvents();
                $("input:checkbox").uniform();
                setLoaderVisible(false);
            });
        });
    });
}

const createAccordionList = (cks, callback, callbackArguments) => {
    const createAccordionCallback = callback;
    const createAccordionCallbackArguments = callbackArguments;

    // Check if the accordion is initialized before attempting to destroy it
    if ($("#cookiesList").hasClass("ui-accordion")) {
        try {
            $("#cookiesList").accordion("destroy");
        } catch (e) {
            console.warn(e.message);
        }
    }

    if (cks === null) cks = cookieList;
    for (let i = 0; i < cks.length; i++) {
        currentC = cks[i];

        let domainText = "";
        if (preferences.showDomain) {
            domainText = currentC.domain;
            if (preferences.showDomainBeforeName) {
                domainText = `${domainText} | `;
            } else {
                domainText = ` | ${domainText}`;
            }
        }

        let titleText;
        if (preferences.showDomainBeforeName) {
            titleText = $("<p/>").text(domainText).append($("<b/>").text(currentC.name));
            if (currentC.isProtected) $(":first-child", titleText).css("color", "green");
        } else {
            titleText = $("<p/>").append($("<b/>").text(currentC.name)).append($("<span/>").text(domainText));
        }

        const titleElement = $("<h3/>").append($("<a/>").html(titleText.html()).attr("href", "#"));

        const cookie = $(".cookie_details_template").clone().removeClass("cookie_details_template");

        $(".index", cookie).val(i);
        $(".name", cookie).val(currentC.name);
        $(".value", cookie).val(currentC.value);
        $(".domain", cookie).val(currentC.domain);
        $(".path", cookie).val(currentC.path);
        $(".storeId", cookie).val(currentC.storeId);
        $(".sameSite", cookie).val(currentC.sameSite);

        if (currentC.isProtected) $(".unprotected", cookie).hide();
        else $(".protected", cookie).hide();

        if (currentC.hostOnly) {
            $(".domain", cookie).attr("disabled", "disabled");
            $(".hostOnly", cookie).prop("checked", true);
        }
        if (currentC.secure) {
            $(".secure", cookie).prop("checked", true);
        }
        if (currentC.httpOnly) {
            $(".httpOnly", cookie).prop("checked", true);
        }
        if (currentC.session) {
            $(".expiration", cookie).attr("disabled", "disabled");
            $(".session", cookie).prop("checked", true);
        }

        let expDate;
        if (currentC.session) {
            expDate = new Date();
            expDate.setFullYear(expDate.getFullYear() + 1);
        } else {
            expDate = new Date(currentC.expirationDate * 1000.0);
        }
        $('.expiration', cookie).val(expDate);

        $("#cookiesList").append(titleElement);
        $("#cookiesList").append(cookie);
    }

    $("#cookiesList").accordion({
        autoHeight: false,
        heightStyle: "content",
        collapsible: true,
        active: cks.length - 1,
        create: (event, ui) => {
            $.uniform.update();
            if (createAccordionCallback !== undefined) createAccordionCallback(createAccordionCallbackArguments);
        }
    });
}

const importCookies = () => {
    let nCookiesImportedThisTime = 0;
    const text = $(".value", "#pasteCookie").val();
    const error = $(".error", "#pasteCookie");
    error.hide();
    error.text("For format reference export cookies in JSON");
    error.html(`${error.html()}<br> Also check&nbsp;<a href='https://developer.chrome.com/extensions/cookies.html#type-Cookie' target='_blank'>Developer Chrome Cookie</a><br>Error:`);

    try {
        let cookieArray = $.parseJSON(text);
        if (Object.prototype.toString.apply(cookieArray) === "[object Object]") {
            cookieArray = [cookieArray];
        }
        for (let i = 0; i < cookieArray.length; i++) {
            try {
                const cJSON = cookieArray[i];
                const cookie = cookieForCreationFromFullCookie(cJSON);
                chrome.cookies.set(cookie, (cookieResponse) => {
                    const error = chrome.runtime.lastError;
                    if (!cookieResponse || error) {
                        const errorMessage = (error ? error.message : '') || 'Unknown error';
                        console.error(`EditThisCookie::importCookies: ${errorMessage}`);
                    }
                });
                nCookiesImportedThisTime++;
            } catch (e) {
                error.html(`${error.html()}<br>${$('<div/>').text(`Cookie number ${i}`).html()}<br>${$('<div/>').text(e.message).html()}`);
                console.error(e.message);
                error.fadeIn();
                return;
            }
        }
    } catch (e) {
        error.html(`${error.html()}<br>${$('<div/>').text(e.message).html()}`);
        console.error(e.message);
        error.fadeIn();
        return;
    }

    data.nCookiesImported += nCookiesImportedThisTime;
    doSearch();
    return;
}

const setEvents = () => {
    $("#submitButton:first-child").unbind().click(() => {
        submit(currentTabID);
    });
    if (cookieList.length > 0) {
        $("#submitDiv").show();
    }
    $("#submitFiltersButton").button();

    $("#submitFiltersDiv").unbind().click(() => {
        const domainChecked = $(".filterDomain:checked", "#cookieFilter").val() !== undefined;
        const domain = $("#filterByDomain", "#cookieFilter").text();
        const nameChecked = $(".filterName:checked", "#cookieFilter").val() !== undefined;
        const name = $("#filterByName", "#cookieFilter").text();
        const valueChecked = $(".filterValue:checked", "#cookieFilter").val() !== undefined;
        const value = $("#filterByValue", "#cookieFilter").text();

        console.log('Creating blocking rule:', { domainChecked, domain, nameChecked, name, valueChecked, value });

        const newRule = {};
        if (domainChecked && domain && domain !== 'any') newRule.domain = domain;
        if (nameChecked && name && name !== 'any') newRule.name = name;
        if (valueChecked && value && value !== 'any') newRule.value = value;

        // If no valid fields are selected, show an error
        if (Object.keys(newRule).length === 0) {
            alert("Please select at least one field (domain, name, or value) to block.");
            return;
        }

        console.log('Final blocking rule:', newRule);

        // Delete matching cookies from current page
        for (let i = 0; i < cookieList.length; i++) {
            const currentCookie = cookieList[i];
            if (currentCookie.isProtected) continue;
            if (!filterMatchesCookie(newRule, currentCookie.name, currentCookie.domain, currentCookie.value)) continue;

            const url = buildUrl(currentCookie.domain, currentCookie.path, getUrlOfCookies());
            deleteCookie(url, currentCookie.name, currentCookie.storeId);
        }
        
        data.nCookiesFlagged += cookieList.length;
        addBlockRule(newRule);

        doSearch();
        return;
    });

    $("#deleteAllButton").unbind().click(() => {
        if (cookieList.length === 0) return false;

        const okFunction = () => {
            nCookiesDeletedThisTime = cookieList.length;
            deleteAll(cookieList, getUrlOfCookies());
            data.nCookiesDeleted += nCookiesDeletedThisTime;
            doSearch();
        }
        startAlertDialog(_getMessage("Alert_deleteAll"), okFunction);
    });

    if (preferences.showCommandsLabels) {
        $(".commands-row", ".commands-table").addClass("commands-row-texy");
    }

    if (preferences.showFlagAndDeleteAll) {
        $("#flagAllButton").show();
        $("#flagAllButton").unbind().click(() => {
            if (cookieList.length === 0) return false;
            const okFunction = () => {
                nCookiesFlaggedThisTime = cookieList.length;
                for (let i = 0; i < cookieList.length; i++) {
                    const currentCookie = cookieList[i];
                    if (currentCookie.isProtected) continue;
                    const newRule = {};
                    newRule.domain = currentCookie.domain;
                    newRule.name = currentCookie.name;
                    addBlockRule(newRule);
                    const url = buildUrl(currentCookie.domain, currentCookie.path, getUrlOfCookies());
                    deleteCookie(url, currentCookie.name, currentCookie.storeId);
                }
                data.nCookiesFlagged += nCookiesFlaggedThisTime;
                doSearch();
                return;
            }
            startAlertDialog(_getMessage("flagAll"), okFunction);
        });
    } else {
        $("#flagAllButton").hide();
    }

    $("#refreshButton").unbind().click(() => {
        if (currentLayout === "new") {
            clearNewCookieData();
        } else {
            location.reload(true);
        }
    });

    $("#addCookieButton").unbind().click(() => {
        newCookie = true;
        pasteCookie = false;
        swithLayout("new");
    });

    $("#backToList").unbind().click(() => {
        newCookie = false;
        pasteCookie = false;
        swithLayout();
    });

    $("#optionsButton").unbind().click(() => {
        const urlToOpen = chrome.runtime.getURL('options_main_page.html');
        chrome.tabs.create({
            url: urlToOpen
        });
    });

    $("#copyButton").unbind().click(() => {
        copyToClipboard(cookiesToString.get(cookieList));
        data.nCookiesExported += cookieList.length;
        $("#copiedToast").fadeIn(() => {
            setTimeout(() => {
                $("#copiedToast").fadeOut();
            }, 2500);
        });
        const $this = $(this);
        if ($this.length) {
            $this.animate({ backgroundColor: "#B3FFBD" }, 300, function () {
                $this.animate({ backgroundColor: "#EDEDED" }, 500);
            });
        }
    });

    $("#pasteButton").unbind().click(() => {
        newCookie = false;
        pasteCookie = true;
        swithLayout("paste");
    });

    $("#searchButton").unbind().click(() => {
        $("#searchField").focus();
        $("#searchField").fadeIn("normal", () => { $("#searchField").focus(); });
        $("#searchField").focus();
    });

    $("#searchBox").unbind().focusout(() => {
        $("#searchField").fadeOut();
    });

    $("#searchField").unbind().keyup(() => {
        find($(this).val());
    });
    $('input', '#cookieSearchCondition').unbind().keyup(doSearch);
    clearNewCookieData();

    $(".toast").each(function () {
        $(this).css("margin-top", `-${$(this).height() / 2}px`);
        $(this).css("margin-left", `-${$(this).width() / 2}px`);
    });

    $('textarea.value, input.domain, input.path').keydown((event) => {
        if (event.ctrlKey && event.keyCode === 13) {
            submit(currentTabID);
            console.log('trigger save (submit)');
            event.preventDefault();
            event.stopPropagation();
        }
    });

    setCookieEvents();
}

const setCookieEvents = () => {
    $(".hostOnly").click(function () {
        const cookie = $(this).closest(".cookie");
        const checked = $(this).prop("checked");
        if (!!checked) $(".domain", cookie).attr("disabled", "disabled");
        else $(".domain", cookie).removeAttr("disabled");
    });

    $(".session").click(function () {
        const cookie = $(this).closest(".cookie");
        const checked = $(this).prop("checked");
        if (!!checked) $(".expiration", cookie).attr("disabled", "disabled");
        else $(".expiration", cookie).removeAttr("disabled");
    });

    $(".deleteOne").click(function () {
        const cookie = $(this).closest(".cookie");
        const name = $(".name", cookie).val();
        const domain = $(".domain", cookie).val();
        const path = $(".path", cookie).val();
        const secure = $(".secure", cookie).prop("checked");
        const storeId = $(".storeId", cookie).val();
        const okFunction = () => {
            const url = buildUrl(domain, path, getUrlOfCookies());
            deleteCookie(url, name, storeId, (success) => {
                if (success === true) {
                    const head = cookie.prev('h3');
                    cookie.add(head).slideUp(() => {
                        $(this).remove();
                        swithLayout();
                    });
                } else {
                    location.reload(true);
                }
            });
            ++data.nCookiesDeleted;
        };
        startAlertDialog(_getMessage("Alert_deleteCookie") + ": \"" + name + "\"?", okFunction)
    });
    $(".flagOne").click(function () {
        const cookie = $(this).closest(".cookie");
        const domain = $(".domain", cookie).val();
        const name = $(".name", cookie).val();
        const value = $(".value", cookie).val();

        $("#filterByDomain", "#cookieFilter").text(domain);
        $("#filterByName", "#cookieFilter").text(name);
        $("#filterByValue", "#cookieFilter").text(value);

        swithLayout("flag");
    });

    $(".protectOne").click(function () {
        const cookie = $(this).closest(".cookie");
        const titleName = $("b", cookie.prev()).first();
        const index = $(".index", cookie).val();
        isProtected = switchReadOnlyRule(cookieList[index]);

        cookieList[index].isProtected = isProtected;
        if (isProtected) {
            $(".unprotected", cookie).fadeOut('fast', function () {
                $(".protected", cookie).fadeIn('fast');
            });
            titleName.css("color", "green");
        } else {
            $(".protected", cookie).fadeOut('fast', function () {
                $(".unprotected", cookie).fadeIn('fast');
            });
            titleName.css("color", "#000");
        }
    });
}

const startAlertDialog = (title, ok_callback, cancel_callback) => {
    if (ok_callback == undefined) {
        return
    }
    if (!preferences.showAlerts) {
        ok_callback();
        return;
    }

    $("#alert_ok").unbind().click(() => {
        $("#alert_wrapper").hide();
        ok_callback();
    });

    if (cancel_callback !== undefined) {
        $("#alert_cancel").show();
        $("#alert_cancel").unbind().click(() => {
            $("#alert_wrapper").hide('fade');
            cancel_callback();
        });
    } else {
        $("#alert_cancel").hide();
    }
    $("#alert_title_p").empty().text(title);
    $("#alert_wrapper").show('fade');
}

const clearNewCookieData = () => {
    const cookieForm = $("#newCookie");
    $(".index", cookieForm).val("");
    $(".name", cookieForm).val("");
    $(".value", cookieForm).val("");
    $(".domain", cookieForm).val(getHost(getUrlOfCookies()));
    $(".hostOnly", cookieForm).prop("checked", false);
    $(".path", cookieForm).val("/");
    $(".secure", cookieForm).prop("checked", false);
    $(".httpOnly", cookieForm).prop("checked", false);
    $(".session", cookieForm).prop("checked", false);

    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);
    $(".expiration", cookieForm).val(expDate);

    $.uniform.update();
}

const find = (pattern) => {
    if (pattern === lastInput) return;

    lastInput = pattern;
    $($(".cookie", "#cookiesList").get().reverse()).each(function () {
        const name = $(".name", $(this)).val();
        const node = $(this);
        const h3 = $(this).prev();
        if (pattern !== "" && name.toLowerCase().indexOf(pattern.toLowerCase()) !== -1) {
            h3.addClass("searchResult");
            node.detach();
            h3.detach();
            $("#cookiesList").prepend(node);
            $("#cookiesList").prepend(h3);
        } else {
            h3.removeClass("searchResult");
        }
    });
    $("#cookiesList").accordion("option", "collapsible", "true");
    $("#cookiesList").accordion("option", "active", cookieList.length);
}

const swithLayout = (newLayout) => {
    if (newLayout === undefined) {
        if ($("h3", "#cookiesList").length) {
            newLayout = "list";
        } else {
            newLayout = "empty";
        }
    }

    if (currentLayout === newLayout) return;
    currentLayout = newLayout;

    if (newLayout === "list" || newLayout === "empty") {
        $("#newCookie").slideUp();
        $("#pasteCookie").slideUp();
        $("#cookieFilter").slideUp();
        $("#submitFiltersButton").slideUp();
    }

    if (newLayout === "list") {
        $(".commands-table").first().animate({ opacity: 0 }, () => {
            $("#deleteAllButton").show();
            if (preferences.showFlagAndDeleteAll) $("#flagAllButton").show();
            $("#addCookieButton").show();
            $("#backToList").hide();
            $("#copyButton").show();
            $("#pasteButton").show();
            $("#searchButton").show();
            $(".commands-table").first().animate({ opacity: 1 });
            $("#cookieSearchCondition").show();
        });
        $("#noCookies").slideUp();
        $("#cookiesList").slideDown();
        $("#submitDiv").show();
    } else if (newLayout === "empty") {
        $(".commands-table").first().animate({ opacity: 0 }, () => {
            $("#deleteAllButton").hide();
            $("#flagAllButton").hide();
            $("#addCookieButton").show();
            $("#backToList").hide();
            $("#copyButton").hide();
            $("#pasteButton").show();
            $("#searchButton").hide();
            $(".commands-table").first().animate({ opacity: 1 });
            $("#cookieSearchCondition").show();
        });
        $(".notOnEmpty").hide();
        $("#noCookies").slideDown();
        $("#cookiesList").slideUp();
        $("#submitDiv").hide();
    } else {
        $(".commands-table").first().animate({ opacity: 0 }, () => {
            $("#deleteAllButton").hide();
            $("#flagAllButton").hide();
            $("#addCookieButton").hide();
            $("#backToList").show();
            $("#copyButton").hide();
            $("#pasteButton").hide();
            $("#searchButton").hide();
            $(".commands-table").first().animate({ opacity: 1 });
        });

        $("#noCookies").slideUp();
        $("#cookiesList").slideUp();
        $("#cookieSearchCondition").slideUp();

        if (newLayout === "flag") {
            $("#submitFiltersButton").slideDown();
            $("#cookieFilter").slideDown();
            $("#newCookie").slideUp();
            $("#pasteCookie").slideUp();
            $("#submitDiv").slideUp();
        } else if (newLayout === "paste") {
            $("#pasteCookie").slideDown();
            $("#newCookie").slideUp();
            $("#cookieFilter").slideUp();
            $("#submitFiltersButton").slideUp();
            $("#submitDiv").slideDown();
            $(".value", "#new").focus();
        } else if (newLayout === "new") {
            $("#newCookie").slideDown();
            $("#pasteCookie").slideUp();
            $("#cookieFilter").slideUp();
            $("#submitFiltersButton").slideUp();
            $("#submitDiv").slideDown();
            $('#newCookie input.name').focus();
        }
    }
}

const formCookieData = (form) => {
    const index = $(".index", form).val();
    const name = $(".name", form).val();
    let value = $(".value", form).val();
    const domain = $(".domain", form).val();
    const hostOnly = $(".hostOnly", form).prop("checked");
    const path = $(".path", form).val();
    const secure = $(".secure", form).prop("checked");
    const httpOnly = $(".httpOnly", form).prop("checked");
    const session = $(".session", form).prop("checked");
    const storeId = $(".storeId", form).val();
    const expiration = $(".expiration", form).val();
    const sameSite = $(".sameSite", form).val();

    const newCookie = {};
    newCookie.url = buildUrl(domain, path, getUrlOfCookies());
    newCookie.name = name.replace(";", "").replace(",", "");
    value = value.replace(";", "");
    newCookie.value = value;
    newCookie.path = path;
    newCookie.storeId = storeId;
    if (!hostOnly) newCookie.domain = domain;
    if (!session) {
        const expirationDate = new Date(expiration).getTime() / 1000;
        newCookie.expirationDate = expirationDate;

        // If the expiration date is not valid, tell the user by making the
        // invalid date red and showing it in the accordion
        if (isNaN(expirationDate)) {
            console.log("Invalid date");
            $(".expiration", form).addClass("error");
            $(".expiration", form).focus();
            if (index !== undefined) {
                // This is an existing cookie, not a new one
                $("#cookiesList").accordion("option", "active", parseInt(index));
            }
            return undefined;
        } else {
            $(".expiration", form).removeClass("error");
        }
    }

    /*
     * New Chrome restrictions do not allow SameSite=None without Secure being
     * marked as true.
     */
    if (sameSite === 'no_restriction' && !secure) {
        $(".sameSite", form).addClass("error");
        $(".sameSite", form).focus();
        $(".error-message").html("'No Restriction' requires that Secure be checked.");
        $(".error-message").show();
        return undefined;
    } else {
        $(".sameSite", form).removeClass("error");
        $(".error-message").hide();
    }
    
    newCookie.secure = secure;
    newCookie.httpOnly = httpOnly;
    newCookie.sameSite = sameSite;

    return newCookie;
}