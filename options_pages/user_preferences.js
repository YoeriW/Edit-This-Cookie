// Apply saved theme from localStorage during page load
const savedTheme = localStorage.getItem('themeColor') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
$("#themeColor").prop('checked', savedTheme === 'dark');

$(document).ready(function () {
    $("input:checkbox, input:text, select").uniform();
    setOptions();
    setEvents();
    savePreferences();
});

updateCallback = function () {
    setOptions();
};

function setOptions() {
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
    var select = $("#customLocale");
    existingLocales = chrome.i18n.getExistingLocales();
    for (var i = 0; i < existingLocales.length; i++) {
        $("#customLocale").append($("<option>").attr("value", existingLocales[i].code).prop("selected", (existingLocales[i].code == preferences.customLocale)).text(existingLocales[i].name));
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

    savePreferences();

    $.uniform.update();
}

//Set Events
function setEvents() {
    $("#themeColor").click(function () {
        // Update preferences and localStorage
        preferences.themeColor = $('#themeColor').prop("checked");
        const newTheme = preferences.themeColor ? 'dark' : 'light';
        localStorage.setItem('themeColor', newTheme); // Save to localStorage
        document.documentElement.setAttribute('data-theme', newTheme); // Apply theme
    });

    $("#showAlerts").click(function () {
        preferences.showAlerts = $('#showAlerts').prop("checked");
    });

    $("#showDomain").click(function () {
        preferences.showDomain = $('#showDomain').prop("checked");
        $("#showDomainBeforeName").prop("disabled", !preferences.showDomain);
        if (!preferences.showDomain) {
            $("#showDomainBeforeNameLabel").addClass("disabled");
        } else {
            $("#showDomainBeforeNameLabel").removeClass("disabled");
        }
        $.uniform.update();
    });

    $("#refreshAfterSubmit").click(function () {
        preferences.refreshAfterSubmit = $('#refreshAfterSubmit').prop("checked");
        $("#skipCacheRefresh").prop("disabled", !preferences.refreshAfterSubmit);
        if (preferences.refreshAfterSubmit) {
            $("#skipCacheRefreshLabel").removeClass("disabled");
        } else {
            $("#skipCacheRefreshLabel").addClass("disabled");
        }
        $.uniform.update();
    });

    $("#skipCacheRefresh").click(function () {
        preferences.skipCacheRefresh = $('#skipCacheRefresh').prop("checked");
    });

    $("#encodeCookieValue").click(function () {
        preferences.encodeCookieValue = $('#encodeCookieValue').prop("checked");
    });

    $("#showContextMenu").click(function () {
        preferences.showContextMenu = $('#showContextMenu').prop("checked");
    });

    $("#showFlagAndDeleteAll").click(function () {
        preferences.showFlagAndDeleteAll = $('#showFlagAndDeleteAll').prop("checked");
    });

    $("#showCommandsLabels").click(function () {
        preferences.showCommandsLabels = $('#showCommandsLabels').prop("checked");
    });

    $("#showChristmasIcon").click(function () {
        preferences.showChristmasIcon = $('#showChristmasIcon').prop("checked");
    });

    $("#useMaxDate").click(function () {
        updateMaxDate();
    });

    $("#maxDateType").click(function () {
        $("#saveMaxDateButton:hidden").fadeIn();
    });

    $("#maxDate").keydown(function (e) {
        var keyPressed;
        if (!e) var e = window.event;
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

    $("#maxDate").bind("keyup blur", function (e) {
        $("#saveMaxDateButton:hidden").fadeIn();
    });

    $("#saveMaxDateButton").click(function (e) {
        $("#saveMaxDateButton").fadeOut(function () {
            $("#shortenProgress").fadeIn(function () {
                updateMaxDate(true);
            });
        });
    });

    $("#useCustomLocale").click(function () {
        preferences.useCustomLocale = $('#useCustomLocale').prop("checked");
        top.location.reload();
    });

    $("#customLocale").change(function () {
        preferences.customLocale = $("#customLocale").val();
        top.location.reload();
    });

    $("#copyCookiesType").change(function () {
        preferences.copyCookiesType = $("#copyCookiesType").val();
    });

    $("#showDomainBeforeName").click(function () {
        preferences.showDomainBeforeName = $('#showDomainBeforeName').prop("checked");
    });

    $("#sortCookiesType").change(function () {
        preferences.sortCookiesType = $("#sortCookiesType").val();
    });

    $("#showDevToolsPanel").change(function () {
        preferences.showDevToolsPanel = $('#showDevToolsPanel').prop("checked");
    });
}

var totalCookies;
var cookiesShortened;
function updateMaxDate(filterAllCookies) {
    var tmp_useMaxCookieAge = $('#useMaxDate').prop("checked");

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

    tmp_maxCookieAge = parseInt($("#maxDate").val());
    if (!(typeof tmp_maxCookieAge === 'number' && tmp_maxCookieAge % 1 == 0)) {
        $("#maxDate").val(1);
        tmp_maxCookieAge = 1;
    }
    preferences.maxCookieAge = tmp_maxCookieAge;

    chrome.cookies.getAll({}, function (cookies) {
        totalCookies = cookies.length;
        cookiesShortened = 0;
        $("span", "#shortenProgress").text("0 / " + totalCookies);
        shortenCookies(cookies, setOptions);
    });
}
function shortenCookies(cookies, callback) {
    if (cookies.length <= 0) {
        data.nCookiesShortened += cookiesShortened;
        $("#shortenProgress").fadeOut(function () {
            if (callback != undefined)
                callback();
        });
        return;
    }
    $("span", "#shortenProgress").text((totalCookies - cookies.length) + " / " + totalCookies);
    var cookie = cookies.pop();
    var maxAllowedExpiration = Math.round((new Date).getTime() / 1000) + (preferences.maxCookieAge * preferences.maxCookieAgeType);
    if (cookie.expirationDate != undefined && cookie.expirationDate > maxAllowedExpiration) {
        console.log("Shortening life of cookie '" + cookie.name + "' from '" + cookie.expirationDate + "' to '" + maxAllowedExpiration + "'");
        var newCookie = cookieForCreationFromFullCookie(cookie);
        if (!cookie.session)
            newCookie.expirationDate = maxAllowedExpiration;
        chrome.cookies.set(newCookie, function () {
            shortenCookies(cookies, callback)
        });
        cookiesShortened++;
    } else
        shortenCookies(cookies, callback);
}

function savePreferences() {
    // Save preferences in chrome.storage.local
    chrome.storage.local.set({ preferences }, function () {
        if (chrome.runtime.lastError) {
            console.error("Error saving preferences: ", chrome.runtime.lastError);
        }
    });

    // Optionally, save preferences to localStorage (if needed for direct access)
    localStorage.setItem('themeColor', preferences.themeColor ? 'dark' : 'light');
}
