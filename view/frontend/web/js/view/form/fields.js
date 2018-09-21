/**
 *
 *          ..::..
 *     ..::::::::::::..
 *   ::'''''':''::'''''::
 *   ::..  ..:  :  ....::
 *   ::::  :::  :  :   ::
 *   ::::  :::  :  ''' ::
 *   ::::..:::..::.....::
 *     ''::::::::::::''
 *          ''::''
 *
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Creative Commons License.
 * It is available through the world-wide-web at this URL:
 * http://creativecommons.org/licenses/by-nc-nd/3.0/nl/deed.en_US
 * If you are unable to obtain it through the world-wide-web, please send an email
 * to servicedesk@totalinternetgroup.nl so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade this module to newer
 * versions in the future. If you wish to customize this module for your
 * needs please contact servicedesk@totalinternetgroup.nl for more information.
 *
 * @copyright   Copyright (c) Total Internet Group B.V. https://tig.nl/copyright
 * @license     http://creativecommons.org/licenses/by-nc-nd/3.0/nl/deed.en_US
 */
define([
    'jquery',
    'Magento_Ui/js/form/components/group',
    'ko',
    'uiRegistry'
], function (
    $,
    uiComponent,
    ko,
    Registry
) {
    'use strict';
    return uiComponent.extend({
        defaults : {
            template  : 'TIG_Postcode/checkout/field-group',
            isLoading : false,
            message   : ko.observable(null),
            imports   : {
                observePostcode    : '${ $.parentName }.postcode-field-group.field-group.postcode:value',
                observeHousenumber : '${ $.parentName }.postcode-field-group.field-group.housenumber:value',
                observeCountry     : '${ $.parentName }.country_id:value'
            },
            timer     : undefined
        },

        initialize : function () {
            this._super()
                ._setClasses();

            return this;
        },

        enableAddressFields : function (enableFields) {
            var fields = [
                this.parentName + '.street.0',
                this.parentName + '.city'
            ];

            Registry.get(fields, function (streetElement, cityElement) {
                if (enableFields === true) {
                    streetElement.enable();
                    cityElement.enable();
                } else {
                    streetElement.disable();
                    cityElement.disable();
                }
            });
        },

        hideAddressFields : function (hideFields) {
            var self = this;
            var fields = [
                this.parentName + '.street.1',
                this.parentName + '.street.2',
                this.parentName + '.street.3'
            ];

            // Hide or show every address line that's not the first address line, depending on the country settings.
            for (var i=0; i < fields.length; i++) {
                self.hideAddressField(hideFields, fields[i]);
            }
        },

        hideAddressField : function (hideFields, field) {
            Registry.get(field, function (addressLine) {
                if (hideFields === true) {
                    addressLine.hide();
                } else {
                    addressLine.show();
                }
            });
        },

        updateFieldData : function () {
            var self = this;

            var country;

            // Only apply the postcode check for NL
            Registry.get([this.parentName + '.country_id'], function (countryElement) {
                country = countryElement.value();
            });

            if (country !== 'NL') {
                self.enableAddressFields(true);
                self.hideAddressFields(false);
                return;
            } else {
                self.hideAddressFields(true);
            }

            // Set a timer because we don't want to make a call at every change
            if (typeof this.timer !== 'undefined') {
                clearTimeout(this.timer);
            }

            this.timer = setTimeout(function () {
                self.setFieldData();
            }, 1000);
        },

        setFieldData : function () {
            var self = this;
            var formData = self.getFormData();

            if (formData !== false) {
                self.isLoading(true);
                self.enableAddressFields(false);
                self.getAddressData(formData);
            } else {
                self.isLoading(false);
                self.enableAddressFields(true);
            }
        },

        getFormData : function () {
            var postcode;
            var housenumber;

            var postcodeRegex = /^[1-9][0-9]{3} ?(?!sa|sd|ss)[a-z]{2}$/i;

            // Wait for the form to load, once loaded get the values of housenumber and postcode
            var fields = [
                this.parentName + '.postcode-field-group.field-group.housenumber',
                this.parentName + '.postcode-field-group.field-group.postcode'
            ];

            Registry.get(fields, function (housenumberElement, postcodeElement) {
                housenumber = housenumberElement.value();
                postcode = postcodeElement.value();
            });

            if ($.isNumeric(housenumber) && postcodeRegex.test(postcode)) {
                return [housenumber, postcode];
            }

            return false;
        },

        getAddressData : function (formData) {
            var self = this;

            if (self.request !== undefined) {
                self.request.abort('avoidMulticall');
            }

            // Make the request to get the streetname and city
            self.request = $.ajax({
                method:'GET',
                url: window.checkoutConfig.shipping.postnl.urls.address_postcode,
                data: {
                    housenumber: formData[0],
                    postcode: formData[1]
                },
            }).done(function (data) {
                self.handleResponse(data);
            }).fail(function (data) {
                if (data.statusText !== 'avoidMulticall') {
                    var errorMessage = $.mage.__('Unexpected error occurred. Please fill in the address details manually.');
                    self.handleError(errorMessage);
                    self.enableAddressFields(true);
                }
            }).always(function (data) {
                self.isLoading(false);
            });
        },

        handleResponse : function (data) {
            var self = this;
            var errorMessage = $.mage.__('Unexpected error occurred. Please fill in the address details manually.');

            if (data.status === false) {
                // In case the streetname and city are incorrect
                console.error(data.error);
                self.enableAddressFields(true);

                errorMessage = $.mage.__('Sorry, we could not find your address with the zipcode and housenumber combination. If you are sure that the zipcode and housenumber are correct, please fill in the address details manually.');
            }

            if (data.streetName && data.city) {
                // If the data is correct, set the streetname and city
                Registry.get(self.parentName + '.street.0').set('value', data.streetName);
                Registry.get(self.parentName + '.city').set('value', data.city);

                // Trigger change for subscripe methods.
                $("input[name*='street[0]']").trigger('change');
                $("input[name*='city']").trigger('change');

                errorMessage = '';
            }

            self.handleError(errorMessage);
        },

        handleError : function (errorMessage) {
            var error = $('.tig-postnl-validation-message');

            if (errorMessage) {
                error.html(errorMessage).show();

                var timer;
                if (typeof timer !== 'undefined') {
                    clearTimeout(timer);
                }

                timer = setTimeout(function () {
                    error.hide(100);
                }, 8000);
            } else {
                error.hide();
            }
        },

        initObservable : function () {
            this._super().observe(['isLoading']);

            return this;
        },

        observeHousenumber : function (value) {
            if (value) {
                this.updateFieldData();
            }
        },

        observePostcode : function (value) {
            if (value) {
                this.updateFieldData();
            }
        },

        observeCountry : function (value) {
            this.updateFieldData();
        }
    });
});
