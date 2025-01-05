const savedTheme = localStorage.getItem('themeColor');
if (savedTheme === 'dark' || savedTheme === 'light') {
    preferences.themeColor = savedTheme;
} else {
    preferences.themeColor = 'light'; // Fallback to default if invalid data
}
document.documentElement.setAttribute('data-theme', preferences.themeColor);
$("#themeColor").prop('checked', preferences.themeColor === 'dark');


jQuery(document).ready(function () {
    $("input:checkbox").uniform();
    setEvents();
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
