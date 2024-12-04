// Function to get URL variables
function getUrlVars() {
    var vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
        vars[key] = value;
    });
    return vars;
}

// Function to redirect based on the panel state
function redirectBasedOnPanel(panel) {
    var arguments = getUrlVars();
    var element;

    if (panel === "null" || panel === null || panel === undefined) {
        element = "support";
    } else {
        element = panel;
    }

    if (arguments.page !== undefined) {
        element = arguments.page;
    }

    location.href = "/options_pages/" + element + ".html";
}

// Get the 'option_panel' value from chrome.storage
chrome.storage.local.get("option_panel", function(result) {
    if (chrome.runtime.lastError) {
        console.error("Error getting option_panel: ", chrome.runtime.lastError);
        // In case of error, default to 'support'
        redirectBasedOnPanel("support");
    } else {
        // Call the redirect function with the retrieved panel value
        redirectBasedOnPanel(result.option_panel);
    }
});
