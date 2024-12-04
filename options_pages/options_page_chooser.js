jQuery(document).ready(function () {
    setPageChooserEvents();
});

// Set Events
function setPageChooserEvents() {
    $(".chooser").click(function () {
        var panel = $(this).attr("id");

        if ($(this).hasClass("selected"))
            return;

        var id = $(this).attr("id");

        // Handle external page redirections
        if (id === "getting_started") {
            openExtPage("http://www.editthiscookie.com/start/");
            return;
        } else if (id === "help") {
            openExtPage("http://www.editthiscookie.com/faq/");
            return;
        }

        // Save the selected panel to chrome.storage
        chrome.storage.local.set({ option_panel: panel }, function () {
            if (chrome.runtime.lastError) {
                console.error("Error setting option_panel: ", chrome.runtime.lastError);
            } else {
                // Redirect to the appropriate options page
                location.href = "/options_pages/" + id + ".html";
            }
        });
    });
}

// Open an external page in a new tab
function openExtPage(url) {
    chrome.tabs.getCurrent(function (tab) {
        chrome.tabs.create({
            index: tab.index + 1,
            url: url,
            active: true,
            openerTabId: tab.id
        });
    });
}
