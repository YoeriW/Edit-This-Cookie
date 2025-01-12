$(document).ready(() => {
    $("input:checkbox").uniform();
    setEvents();
});

const setEvents = () => {
    $(".linkify").click(function () {
        const urlToOpen = $(this).attr("lnk");
        if (urlToOpen === undefined) return;

        chrome.tabs.getCurrent((cTab) => {
            chrome.tabs.create({
                url: urlToOpen,
                active: true,
                index: cTab.index + 1,
                openerTabId: cTab.id
            });
        });
    });
};
