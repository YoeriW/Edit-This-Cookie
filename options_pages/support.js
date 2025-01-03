jQuery(document).ready(function () {
    $("input:checkbox").uniform();
    setEvents();
    applyTheme();
});

function setEvents() {
    $(".linkify").click(function () {
        var urlToOpen = $(this).attr("lnk");
        if (urlToOpen == undefined)
            return;

        chrome.tabs.getCurrent(function (cTab) {
            chrome.tabs.create({
                "url": urlToOpen,
                "active": true,
                "index": cTab.index + 1,
                "openerTabId": cTab.id
            });
        });
    });
}

function applyTheme() {
    const themePreference = preferences.themeColor;
    const darkThemeStylesheet = document.getElementById('dark-theme-stylesheet');

    if (themePreference) {
        // Apply dark theme
        darkThemeStylesheet.href = '/css/dark_theme.css';
    } else {
        // Remove dark theme
        darkThemeStylesheet.href = '';
    }
}
