$(document).ready(() => {
    setBlockRules();
    setEvents();
});

let forceHideOperations = false;
let newRowVisible = false;

updateCallback = () => {
    location.reload(true);
    return;

    // FIXME: Unreachable code due to "return" statement above. Explanations needed.
    setBlockRules();
    setEvents();
};

const setEvents = () => {
    $("#submitButton").button();

    $("#addRule").button();
    $("#addRule").unbind().click(() => {
        showNewEmptyRule();
    });

    $('.cmd_delete').unbind().click(function () {
        if (!preferences.showAlerts || confirm(`${_getMessage("Alert_deleteRule")}?`)) {
            hideEditCommands();
            const index = $('.active').attr("index");
            forceHideOperations = true;
            $('.operations:visible').clearQueue();
            $('.operations:visible').fadeOut();
            $('.active').fadeOut(() => {
                forceHideOperations = false;
                if (newRowVisible) {
                    showNewEmptyRule();
                }
                deleteBlockRule(index);
                if (data.filters.length === 0) {
                    const row = $("#no_rules").clone().removeClass('template');
                    $(".table").append(row);
                    return;
                } else {
                    $("#no_rules1").detach();
                }
                location.reload(true);
                return;
            });
        }
    });

    $('.cmd_accept').unbind().click(() => {
        submitRule();
    });

    $('.cmd_cancel').unbind().click(() => {
        hideEditCommands();
    });

    $('.data_row').unbind().mouseover(function () {
        // remove active class from previous element
        $('.active').removeClass('active');

        // add active class to current element
        $(this).addClass('active');

        $('.operations').clearQueue();

        $('.operations:hidden').animate({
            top: $(this).position().top
        }, 0, function () {
            $('.operations:hidden').css('display', 'inline-block');
        });

        // set bucket icon position
        const index = $(this).attr('index');
        const tableRowHeight = $('.table_row').height();
        const offsetTop = 34; // with the bucket in position: relative, we need to know pad for heading row
        const newTop = offsetTop + index * tableRowHeight;
        $('.operations').animate({
            top: newTop
        }, 250);
    });
}

const setBlockRules = () => {
    $('.table_row:not(.header, .template, #line_template)', '.table').detach();

    if (data.filters.length === 0) {
        const row = $("#no_rules").clone().removeClass('template').attr("id", "#no_rules1");
        $(".table").append(row);
        return;
    } else {
        $("#no_rules1").detach();
    }

    for (let i = 0; i < data.filters.length; i++) {
        try {
            const filter = data.filters[i];
            const domain = (filter.domain !== undefined) ? filter.domain : "any";
            const name = (filter.name !== undefined) ? filter.name : "any";
            const value = (filter.value !== undefined) ? filter.value : "any";
            addBlockLine(domain, name, value, i);
        } catch (e) {
            console.error(e.message);
        }
    }
}

const addBlockLine = (domain, name, value, index) => {
    const line = $("#line_template").clone();
    $('.domain_field', line).empty().text(domain);
    $('.name_field', line).empty().text(name);
    $('.value_field', line).empty().text(value);
    line.attr('id', `rule_n_${index}`);
    line.attr('index', index);
    line.css('display', '');
    $(".table").append(line);
}

const hideEditCommands = () => {
    newRowVisible = false;
    $(".new_rule_operations").fadeOut();
    $(".new_row:not(.template)").fadeOut().detach();
}

const showNewEmptyRule = () => {
    if ($(".new_row:not(.template)").length > 0) {
        $(".new_rule_operations").css("top", $(".new_row:not(.template)").position().top + "px");
        $(".new_rule_operations").css("left", $(".new_row:not(.template)").position().left + "px");
        return;
    }

    newRowVisible = true;

    const newRow = $(".new_row.template").clone().removeClass('template');
    $(".table").append(newRow);

    $(".new_rule_operations").css("top", newRow.position().top + "px");
    $(".new_rule_operations").css("left", newRow.position().left + "px");

    newRow.hide();
    newRow.fadeIn();
    $(".new_rule_operations").fadeIn();

    newRow.keyup((event) => {
        // ESC
        if (event.keyCode == 27) {
            $('.cmd_cancel').trigger('click');
        }
        // ENTER
        if (event.keyCode == 13) {
            $('.cmd_accept').trigger('click');
        }
    });
}

const submitRule = () => {
    let domain = $(".new_rule_domain", ".new_row:not(.template)").val();
    domain = (domain == "any" || domain == '') ? undefined : domain;
    let name = $(".new_rule_name", ".new_row:not(.template)").val();
    name = (name == "any" || name == '') ? undefined : name;
    let value = $(".new_rule_value", ".new_row:not(.template)").val();
    value = (value == "any" || value == '') ? undefined : value;

    const newRule = {};
    newRule.name = name;
    newRule.domain = domain;
    newRule.value = value;

    if (name === undefined && domain === undefined && value === undefined) {
        alert("Please specify at least one field (domain, name, or value) for the blocking rule.");
        return;
    }

    // Validate regex patterns if they contain special characters
    const validateRegexPattern = (pattern, fieldName) => {
        if (pattern && !pattern.startsWith('/') && !pattern.endsWith('/')) {
            // Check if it contains regex special characters
            const regexChars = /[.*+?^${}()|[\]\\]/;
            if (regexChars.test(pattern)) {
                console.warn(`Warning: ${fieldName} contains regex special characters. Consider wrapping in /pattern/ for regex matching.`);
            }
        }
    };

    validateRegexPattern(domain, 'Domain');
    validateRegexPattern(name, 'Name');
    validateRegexPattern(value, 'Value');

    addBlockRule(newRule);
    hideEditCommands();

    location.reload(true);
}
