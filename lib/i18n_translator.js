const prefixLocaleStrings = "editThis_";

const translate = (messageID, args) => chrome.i18n.getMessage(`${prefixLocaleStrings}${messageID}`, args);

const localizePage = () => {
    $("[i18n]:not(.i18n-replaced)").each(function() {
        $(this).html($(this).html() + translate($(this).attr("i18n"), $(this).attr("i18n_argument")));
        $(this).addClass("i18n-replaced");
    });
    $("[i18n_value]:not(.i18n-replaced)").each(function() {
        $(this).val(translate($(this).attr("i18n_value")));
        $(this).addClass("i18n-replaced");
    });
    $("[i18n_title]:not(.i18n-replaced)").each(function() {
        $(this).attr("title", translate($(this).attr("i18n_title")));
        $(this).addClass("i18n-replaced");
    });
    $("[i18n_placeholder]:not(.i18n-replaced)").each(function() {
        $(this).attr("placeholder", translate($(this).attr("i18n_placeholder")) + $(this).attr("placeholder"));
        $(this).addClass("i18n-replaced");
    });
    $("[i18n_alt]:not(.i18n-replaced)").each(function() {
        $(this).attr("alt", translate($(this).attr("i18n_alt")));
        $(this).addClass("i18n-replaced");
    });
    $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
        const dummy_link = $("a", this);
        const text = dummy_link.text();
        const real_el = $(`#${$(this).attr("i18n_replacement_el")}`);
        real_el.text(text).val(text).replaceAll(dummy_link);
        $(this).addClass("i18n-replaced");
    });
};

$(document).ready(() => {
    localizePage();
});
