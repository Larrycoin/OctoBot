function get_active_tab_config(){
    return $(document).find("." + config_root_class + ".active").find("." + config_container_class);
}

function get_tabs_config(){
    return $(document).find("." + config_root_class + " ." + config_container_class);
}


function handle_reset_buttons(){
    $("#reset-config").click(function() {
        reset_configuration_element();
    })
}

function handle_remove_buttons(){
    // Card deck removing
    $(document).on("click", ".remove-btn", function() {
        const deleted_element_key = get_card_config_key($(this));
        const deck = get_deck_container($(this));
        const card = get_card_container($(this));
        if ($.inArray(deleted_element_key, deleted_global_config_elements) === -1 && !card.hasClass(added_class)){
            deleted_global_config_elements.push(deleted_element_key);
        }
        $(this).closest(".card").fadeOut("normal", function() {
            $(this).remove();
            check_deck_modifications(deck);
        });
    });
}

function check_deck_modifications(deck){
    if(deck.find("."+added_class).length > 0 || deleted_global_config_elements.length > 0){
        toogle_deck_container_modified(deck);
    }else{
        toogle_deck_container_modified(deck, false);
    }
}

function handle_add_buttons(){
    // Card deck adding
    $(".add-btn").click(function() {

        const button_id = $(this).attr("id");

        const deck = $(this).parents("." + config_root_class).find(".card-deck");
        const select_input = $("#" + button_id + "Select");
        const select_value = select_input.val();
        let target_template = $("#" + button_id + "-template-default");

        // currencies
        const select_symbol = select_input.children("[data-tokens='"+select_value+"']").attr("symbol");
        const reference_market = select_input.attr("reference_market");

        //services
        if (button_id === "AddService"){
            target_template = $("#" + button_id + "-template-default-"+select_value);
        }

        // check if not already added
        if(deck.find("div[name='"+select_value+"']").length === 0){
            let template_default = target_template.html().replace(new RegExp(config_default_value,"g"), select_value);
            template_default = template_default.replace(new RegExp("card-text symbols default","g"), "card-text symbols");
            if(isDefined(select_symbol)){
                template_default = template_default.replace(new RegExp(config_default_symbol + ".png","g"), select_symbol.toLowerCase() + ".png");
            }
            deck.append(template_default).hide().fadeIn();
            handle_editable();

            // select options with reference market if any
            $('.multi-select-element').each(function () {
                if ($(this).siblings('.select2').length === 0 && !$(this).parent().hasClass('default')){
                    $(this).children("option").each(function () {
                        const symbols = $(this).attr("value").split("/");
                        if (symbols[0] === select_symbol && symbols[1] === reference_market){
                            $(this).attr("selected", "selected");
                        }
                    });
                }
            });

            // add select2 selector
            $('.multi-select-element').each(function () {
                if ($(this).siblings('.select2').length === 0 && !$(this).parent().hasClass('default')){
                    $(this).select2({
                        width: 'resolve', // need to override the changed default
                        tags: true
                    });
                }
            });

            toogle_deck_container_modified(get_deck_container($(this)));

            register_edit_events();
        }

    });
}

function register_edit_events(){
    $('.config-element').each(function () {
        add_event_if_not_already_added($(this), 'save', card_edit_handler);
        add_event_if_not_already_added($(this), 'change', card_edit_handler);
    });
}

function card_edit_handler(e, params){
    const current_elem = $(this);
    let new_value = parse_new_value(current_elem);
    if(isDefined(params) && isDefined(params["newValue"])){
        new_value = params["newValue"];
    }
    const config_key = get_config_key(current_elem);
    const card_container = get_card_container(current_elem);

    const other_config_elements = card_container.find("."+config_element_class);
    let something_changed = get_config_value_changed(current_elem, new_value, config_key);

    if(!something_changed){
        // if nothing changed on the current field, check other fields of the card
        $.each(other_config_elements, function () {
            if ($(this)[0] !== current_elem[0]){
                var elem_new_value = parse_new_value($(this));
                var elem_config_key = get_config_key($(this));
                something_changed = something_changed || get_config_value_changed($(this), elem_new_value, elem_config_key);
            }

        });
    }

    toogle_card_modified(card_container, something_changed);

}

function something_is_unsaved(){

    const config_root = $("#super-container");
    return (
        config_root.find("."+card_class_modified).length > 0
            || config_root.find("."+deck_container_modified_class).length > 0
            || config_root.find("."+primary_badge).length > 0
    )
}

function parse_new_value(element){
    const raw_data = replace_spaces(replace_break_line(element.text()));

    // simple case
    if(element[0].hasAttribute(current_value_attr)){
        const value = replace_spaces(replace_break_line(element.attr(current_value_attr)));
        if(element[0].hasAttribute(config_data_type_attr)){
            switch(element.attr(config_data_type_attr)) {
                case "bool":
                    return value === true || value === "true";
                case "number":
                    return Number(value);
                default:
                    return value;
            }
        }else{
            return value;
        }
    }
    // with data type
    else if(element[0].hasAttribute(config_data_type_attr)){
        switch(element.attr(config_data_type_attr)) {
            case "bool":
                return element.is(":checked");
            case "list":
                const new_value = [];
                element.find(":selected").each(function(index, value){
                    new_value.splice(index, 0, replace_spaces(replace_break_line(value.text)));
                });
                return new_value;
            case "number":
                return Number(raw_data);
            default:
                return raw_data;
        }

    // without information
    }else{
        return raw_data;
    }
}

function handle_save_buttons(){
    $("#save-config").click(function() {
        const full_config = $("#super-container");
        const updated_config = {};
        const update_url = $("#save-config").attr(update_url_attr);

        // take all tabs into account
        get_tabs_config().each(function(){
            $(this).find("."+config_element_class).each(function(){
                const config_type = $(this).attr(config_type_attr);

                if(!(config_type in updated_config)){
                    updated_config[config_type] = {};
                }

                const new_value = parse_new_value($(this));
                const config_key = get_config_key($(this));

                if(get_config_value_changed($(this), new_value, config_key)){
                    updated_config[config_type][config_key] = new_value;
                }
            })
        });

        // take removed elements into account
        updated_config["removed_elements"] = deleted_global_config_elements;

        // send update
        send_and_interpret_bot_update(updated_config, update_url, full_config, handle_save_buttons_success_callback);
    })
}

function get_config_key(elem){
    return elem.attr(config_key_attr);
}

function get_card_config_key(card_component, config_type="global_config"){
    const element_with_config = card_component.parent(".card-body");
    return get_config_key(element_with_config);
}

function get_deck_container(elem) {
    return elem.parents("."+deck_container_class);
}

function get_card_container(elem) {
    return elem.parents("."+config_card_class);
}

function get_config_value_changed(element, new_value, config_key) {
    let new_value_str = new_value.toString();
    if(new_value instanceof Array && new_value.length > 0){
        //need to format array to match python string representation of config
        var str_array = [];
        $.each(new_value, function(i, val) {
            str_array.push("'"+val+"'");
        });
        new_value_str = "[" + str_array.join(", ") + "]";
    }
    return get_value_changed(new_value_str, element.attr(config_value_attr), config_key);
}

function get_value_changed(new_val, dom_conf_val, config_key){
    const lower_case_val = new_val.toLowerCase();
    if(new_val.toLowerCase() !== dom_conf_val.toLowerCase()){
        return true;
    }else if (config_key in validated_updated_global_config){
        return lower_case_val !== validated_updated_global_config[config_key].toString().toLowerCase();
    }else{
        return false;
    }

}

function handle_save_buttons_success_callback(updated_data, update_url, dom_root_element, msg, status){
    updated_validated_updated_global_config(msg["global_updated_config"]);
    update_dom(dom_root_element, msg);
    create_alert("success", "Configuration successfully updated. Restart OctoBot for it to be applied", "");
}

function handle_evaluator_configuration_editor(){
    $(".config-element").click(function(){
        const element = $(this);

        if (element.hasClass(config_element_class)){

            if (element[0].hasAttribute(config_type_attr) && element.attr(config_type_attr) === evaluator_config_type){

                // build data update
                let new_value = parse_new_value(element);
                let current_value;

                try {
                    current_value = element.attr(current_value_attr).toLowerCase();
                }
                catch(e) {
                    current_value = element.attr(current_value_attr);
                }

                // todo
                if (current_value === "true"){
                    new_value = "false";
                }else if(current_value === "false"){
                    new_value = "true";
                }

                // update current value
                element.attr(current_value_attr, new_value);

                //update dom
                update_element_temporary_look(element);
            }
        }
    });
}

function reset_configuration_element(){
    remove_exit_confirm_function();
    location.reload();
}

function updated_validated_updated_global_config(updated_data){
    for (const conf_key in updated_data) {
        validated_updated_global_config[conf_key] = updated_data[conf_key];
    }
    deleted_global_config_elements = [];
}

let validated_updated_global_config = {};
let deleted_global_config_elements = [];

$(document).ready(function() {
    setup_editable();
    handle_editable();

    handle_reset_buttons();
    handle_save_buttons();

    handle_add_buttons();
    handle_remove_buttons();

    handle_evaluator_configuration_editor();

    register_edit_events();

    register_exit_confirm_function(something_is_unsaved);
});