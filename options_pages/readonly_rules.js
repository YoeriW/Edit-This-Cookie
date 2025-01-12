$(document).ready(() => {
    setReadOnlyRules();
    setEvents();
});

let forceHideOperations = false;

updateCallback = () => {
    location.reload(true);
    return;

    setReadOnlyRules();
    setEvents();
};

const setEvents = () => {
    $('.cmd_delete').unbind().click(function () {
        if (!data.showAlerts || confirm(`${_getMessage("Alert_deleteRule")}?`)) {
            hideEditCommands();
            const index = $('.active').attr("index");
            forceHideOperations = true;
            $('.operations:visible').clearQueue();
            $('.operations:visible').fadeOut();
            $('.active').fadeOut(() => {
                forceHideOperations = false;
                deleteReadOnlyRule(index);
                location.reload(true);
                return;
            });
        }
    });

    $('.data_row').unbind().mouseover(function () {
        $('.active').removeClass('active');
        $(this).addClass('active');

        $('.operations').clearQueue();

        $('.operations:hidden').animate({
            top: $(this).position().top,
            left: $(this).position().left + 5,
        }, 0, () => {
            $('.operations:hidden').show('slide', 200);
        });

        $('.operations').animate({
            top: $(this).position().top,
            left: $(this).position().left + 5,
        }, 250);
    });

}


const setReadOnlyRules = () => {
    $('.table_row:not(.header, .template, #line_template)', '.table').detach();

    if (data.readOnly.length === 0) {
        const row = $("#no_rules").clone().removeClass('template');
        $(".table").append(row);
        return;
    }

    for (let i = 0; i < data.readOnly.length; i++) {
        try {
            const rule = data.readOnly[i];
            const domain = (rule.domain !== undefined) ? rule.domain : "any";
            const name = (rule.name !== undefined) ? rule.name : "any";
            const value = (rule.value !== undefined) ? rule.value : "any";
            addRuleLine(domain, name, value, i);
        } catch (e) {
            console.error(e.message);
        }
    }
}

const addRuleLine = (domain, name, value, index) => {
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
