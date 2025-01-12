// Function to get URL variables
const getUrlParameters = () => {
    const vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m, key, value) => {
        vars[key] = value;
    });
    return vars;
};

// Function to redirect based on the panel state
const redirectBasedOnPanel = (panel) => {
    const arguments = getUrlParameters();
    let element;

    if (panel === "null" || panel === null || panel === undefined) {
        element = "support";
    } else {
        element = panel;
    }

    if (arguments.page !== undefined) {
        element = arguments.page;
    }

    location.href = `/options_pages/${element}.html`;
};

// Get the 'option_panel' value from chrome.storage
chrome.storage.local.get("option_panel", (result) => {
    if (chrome.runtime.lastError) {
        console.error("Error getting option_panel: ", chrome.runtime.lastError);
        // In case of error, default to 'support'
        redirectBasedOnPanel("support");
    } else {
        // Call the redirect function with the retrieved panel value
        redirectBasedOnPanel(result.option_panel);
    }
});
