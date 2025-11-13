$(document).ready(() => {
    $("input:checkbox, input:text, select").uniform();
    setOptions();
    setEvents();
    savePreferences();
});

updateCallback = () => {
    setOptions();
};

const setOptions = () => {
    $("#saveMaxDateButton").button().hide();
    $("#maxDateType").controlgroup();
    $(':checkbox', '#options-box').removeAttr('checked');
    $("#justDelete").prop('checked', preferences.justDelete);
    $("#themeColor").prop('checked', preferences.themeColor);
    $("#showAlerts").prop('checked', preferences.showAlerts);
    $("#showDomain").prop('checked', preferences.showDomain);
    $("#showContextMenu").prop('checked', preferences.showContextMenu);
    $("#showFlagAndDeleteAll").prop('checked', preferences.showFlagAndDeleteAll);
    $("#showCommandsLabels").prop('checked', preferences.showCommandsLabels);

    if (isChristmasPeriod()) {
        $("#showChristmasIcon").prop('checked', preferences.showChristmasIcon);
    } else {
        $("#showChristmasIcon").closest(".formLine").hide();
    }

    $("#refreshAfterSubmit").prop('checked', preferences.refreshAfterSubmit);
    $("#skipCacheRefresh").prop('checked', preferences.skipCacheRefresh);
    $("#skipCacheRefresh").prop("disabled", !preferences.refreshAfterSubmit);
    if (!preferences.refreshAfterSubmit) {
        $("#skipCacheRefreshLabel").addClass("disabled");
    } else {
        $("#skipCacheRefreshLabel").removeClass("disabled");
    }

    $("#useCustomLocale").prop('checked', preferences.useCustomLocale);
    $("#customLocale").empty();
    $("#customLocale").prop("disabled", !preferences.useCustomLocale);
    const select = $("#customLocale");
    const existingLocales = chrome.i18n.getExistingLocales();
    for (let i = 0; i < existingLocales.length; i++) {
        $("#customLocale").append($("<option>").attr("value", existingLocales[i].code).prop("selected", (existingLocales[i].code == preferences.customLocale)).text(existingLocales[i].code));
    }

    $("#useMaxDate").prop('checked', preferences.useMaxCookieAge);
    $("#maxDate").prop("disabled", !preferences.useMaxCookieAge);
    if (!preferences.useMaxCookieAge) {
        $("#maxDateLabel").addClass("disabled");
        $("#maxDateType").controlgroup("disable");
        $("#saveMaxDateButton").button("disable");
    } else {
        $("#maxDateLabel").removeClass("disabled");
        $("#maxDateType").controlgroup("enable");
        $("#saveMaxDateButton").button("enable");
    }
    $("#maxDate").val(preferences.maxCookieAge);
    $("input:radio", ".radioMaxDate").prop('checked', false);
    $("input:radio[value='" + preferences.maxCookieAgeType + "']").prop('checked', true);
    $("#maxDateType").controlgroup("refresh");

    $("option[value='" + preferences.copyCookiesType + "']").prop("selected", true);

    $("#showDomainBeforeName").prop('checked', preferences.showDomainBeforeName);
    $("#showDomainBeforeName").prop("disabled", !preferences.showDomain);
    if (!preferences.showDomain) {
        $("#showDomainBeforeNameLabel").addClass("disabled");
    } else {
        $("#showDomainBeforeNameLabel").removeClass("disabled");
    }

    $("option[value='" + preferences.sortCookiesType + "']").prop("selected", true);

    $("#showDevToolsPanel").prop('checked', preferences.showDevToolsPanel);
    $("#urlDecodeValues").prop('checked', preferences.urlDecodeValues);

    savePreferences();

    $.uniform.update();
}

//Set Events
const setEvents = () => {
    $("#themeColor").click(() => {
        preferences.themeColor = $('#themeColor').prop("checked");
        localStorage.setItem('themeColor', preferences.themeColor); // Store as string
        
        document.documentElement.setAttribute('data-theme', preferences.themeColor ? 'dark' : 'light');
    });

    $("#showAlerts").click(() => {
        preferences.showAlerts = $('#showAlerts').prop("checked");
    });

    $("#showDomain").click(() => {
        preferences.showDomain = $('#showDomain').prop("checked");
        $("#showDomainBeforeName").prop("disabled", !preferences.showDomain);
        if (!preferences.showDomain) {
            $("#showDomainBeforeNameLabel").addClass("disabled");
        } else {
            $("#showDomainBeforeNameLabel").removeClass("disabled");
        }
        $.uniform.update();
    });

    $("#refreshAfterSubmit").click(() => {
        preferences.refreshAfterSubmit = $('#refreshAfterSubmit').prop("checked");
        $("#skipCacheRefresh").prop("disabled", !preferences.refreshAfterSubmit);
        if (preferences.refreshAfterSubmit) {
            $("#skipCacheRefreshLabel").removeClass("disabled");
        } else {
            $("#skipCacheRefreshLabel").addClass("disabled");
        }
        $.uniform.update();
    });

    $("#skipCacheRefresh").click(() => {
        preferences.skipCacheRefresh = $('#skipCacheRefresh').prop("checked");
    });

    $("#encodeCookieValue").click(() => {
        preferences.encodeCookieValue = $('#encodeCookieValue').prop("checked");
    });

    $("#showContextMenu").click(() => {
        preferences.showContextMenu = $('#showContextMenu').prop("checked");
    });

    $("#showFlagAndDeleteAll").click(() => {
        preferences.showFlagAndDeleteAll = $('#showFlagAndDeleteAll').prop("checked");
    });

    $("#showCommandsLabels").click(() => {
        preferences.showCommandsLabels = $('#showCommandsLabels').prop("checked");
    });

    $("#showChristmasIcon").click(() => {
        preferences.showChristmasIcon = $('#showChristmasIcon').prop("checked");
    });

    $("#useMaxDate").click(() => {
        updateMaxDate();
    });

    $("#maxDateType").click(() => {
        $("#saveMaxDateButton:hidden").fadeIn();
    });

    $("#maxDate").keydown((e) => {
        let keyPressed;
        if (!e) e = window.event;
        if (e.keyCode) keyPressed = e.keyCode;
        else if (e.which) keyPressed = e.which;
        if (keyPressed == 46 || keyPressed == 8 || keyPressed == 9 || keyPressed == 27 || keyPressed == 13 ||
            // Allow: Ctrl+A
            (keyPressed == 65 && e.ctrlKey === true) ||
            // Allow: home, end, left, right
            (keyPressed >= 35 && keyPressed <= 39)) {
            // let it happen, don't do anything
            return;
        }
        else {
            // Ensure that it is a number and stop the keypress
            if (e.shiftKey || (keyPressed < 48 || keyPressed > 57) && (keyPressed < 96 || keyPressed > 105)) {
                e.preventDefault();
            }
        }
    });

    $("#maxDate").bind("keyup blur", () => {
        $("#saveMaxDateButton:hidden").fadeIn();
    });

    $("#saveMaxDateButton").click(() => {
        $("#saveMaxDateButton").fadeOut(() => {
            $("#shortenProgress").fadeIn(() => {
                updateMaxDate(true);
            });
        });
    });

    $("#useCustomLocale").click(() => {
        preferences.useCustomLocale = $('#useCustomLocale').prop("checked");
        top.location.reload();
    });

    $("#customLocale").change(() => {
        preferences.customLocale = $("#customLocale").val();
        top.location.reload();
    });

    $("#copyCookiesType").change(() => {
        preferences.copyCookiesType = $("#copyCookiesType").val();
    });

    $("#showDomainBeforeName").click(() => {
        preferences.showDomainBeforeName = $('#showDomainBeforeName').prop("checked");
    });

    $("#sortCookiesType").change(() => {
        preferences.sortCookiesType = $("#sortCookiesType").val();
    });

    $("#showDevToolsPanel").change(() => {
        preferences.showDevToolsPanel = $('#showDevToolsPanel').prop("checked");
    });

    $("#urlDecodeValues").click(() => {
        preferences.urlDecodeValues = $('#urlDecodeValues').prop("checked");
    });
}

let totalCookies;
let cookiesShortened;
const updateMaxDate = (filterAllCookies) => {
    const tmp_useMaxCookieAge = $('#useMaxDate').prop("checked");

    $("#useMaxDate").prop('checked', tmp_useMaxCookieAge);
    $("#maxDate").prop("disabled", !tmp_useMaxCookieAge);

    if (!tmp_useMaxCookieAge) {
        $("#maxDateLabel").addClass("disabled");
        $("#maxDateType").controlgroup("disable");
        $("#saveMaxDateButton").button("disable").fadeOut();
        $("#saveMaxDateButton:visible").fadeOut();
    } else {
        $("#maxDateLabel").removeClass("disabled");
        $("#maxDateType").controlgroup("enable");
        $("#saveMaxDateButton").button("enable");
        if (!filterAllCookies)
            $("#saveMaxDateButton:hidden").fadeIn();
    }

    if (!tmp_useMaxCookieAge || filterAllCookies)
        preferences.useMaxCookieAge = tmp_useMaxCookieAge;

    if (filterAllCookies == undefined || filterAllCookies == false)
        return;

    preferences.maxCookieAgeType = $("input:radio[name='radioMaxDate']:checked").val();

    let tmp_maxCookieAge = parseInt($("#maxDate").val());
    if (!(typeof tmp_maxCookieAge === 'number' && tmp_maxCookieAge % 1 == 0)) {
        $("#maxDate").val(1);
        tmp_maxCookieAge = 1;
    }
    preferences.maxCookieAge = tmp_maxCookieAge;

    chrome.cookies.getAll({}, (cookies) => {
        totalCookies = cookies.length;
        cookiesShortened = 0;
        $("span", "#shortenProgress").text(`0 / ${totalCookies}`);
        shortenCookies(cookies, setOptions);
    });
}

const shortenCookies = (cookies, callback) => {
    if (cookies.length <= 0) {
        data.nCookiesShortened += cookiesShortened;
        $("#shortenProgress").fadeOut(() => {
            if (callback != undefined)
                callback();
        });
        return;
    }
    $("span", "#shortenProgress").text(`${totalCookies - cookies.length} / ${totalCookies}`);
    const cookie = cookies.pop();
    const maxAllowedExpiration = Math.round((new Date).getTime() / 1000) + (preferences.maxCookieAge * preferences.maxCookieAgeType);
    if (cookie.expirationDate != undefined && cookie.expirationDate > maxAllowedExpiration) {
        console.log(`Shortening life of cookie '${cookie.name}' from '${cookie.expirationDate}' to '${maxAllowedExpiration}'`);
        const newCookie = cookieForCreationFromFullCookie(cookie);
        if (!cookie.session)
            newCookie.expirationDate = maxAllowedExpiration;
        chrome.cookies.set(newCookie, () => {
            shortenCookies(cookies, callback)
        });
        cookiesShortened++;
    } else
        shortenCookies(cookies, callback);
}

const savePreferences = () => {
    chrome.storage.local.set({ preferences: preferences }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving preferences: ", chrome.runtime.lastError);
        }
    });

    // Store the theme color as a string in localStorage
    localStorage.setItem('themeColor', preferences.themeColor);
}
