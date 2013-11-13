// Define a Dms object for creating validated Degree-Minute-Second representations of angles.
function Dms (degs, mins, secs, sign) {

    if (arguments.length == 1) {
        if (isNumeric(degs)) {
            this.sign = degs < 0 ? -1 : 1;
            degs = Math.abs(degs);
            this.degs = Math.floor(degs);
            this.mins = Math.floor((degs - this.degs) * 60);
            this.secs = (degs - this.degs - (this.mins / 60)) * 60 * 60;
        } else {
            throw new Error("Degrees argument to Dms() must be numeric.")
        }
    }

    else {

        if (isNumeric(degs) && +degs >= 0) {
            this.degs = +degs;
        } else {
            throw new Error("Degrees argument to Dms() must be a non-negative number.")
        }

        if (isNumeric(mins) && mins >= 0 && mins < 60) {
            this.mins = +mins;
        } else {
            throw new Error("Minutes argument to Dms() must be a number gte 0 and lt 60.")
        }

        if (isNumeric(secs) && secs >= 0 && secs < 60) {
            this.secs = +secs;
        } else {
            throw new Error("Seconds argument to Dms() must be a number gte 0 and lt 60.")
        }

        if (isNumeric(sign) && (+sign == 1 || +sign == -1)) {
            this.sign = +sign;
        } else {
            throw new Error("Sign argument to Dms() must be 1 or -1.")
        }
    }
}

// Provide a textual representation of the angle, with an option to
// specify the number of decimal places for the seconds component.
Dms.prototype.toString = function (fractionSize) {
    var s = this.secs.toFixed(fractionSize),
        m = this.mins + (s == "60" ? 1 : 0),
        d = this.degs + (s == "60" ? 1 : 0);

    function normalize (n) {
        return +n == 60 ? 0 : n;
    }

    return (this.sign < 0 ? "-" : "") + d + "°" + normalize(m) + "'" + normalize(s) + '"';
};

// Method to create a Dms object for a string. The string should contain three
// number the represent an angle in d-m-s format.
Dms.parse = function (str) {
    // Reject empty string
    if (!str) {
        return;
    }
    // or string with more than one negative sign
    var negs = str.split("-").length - 1;
    if (negs > 1) {
        return;
    }

    var dms = str.split(/[^\d\.\-]+/); // Break the string up into numbers
    try {
        var sign = negs ? -1 : 1;

        function f (n) {
            return angular.isDefined(n) ? Math.abs(n) : 0;
        }

        return new Dms(f(dms[0]), f(dms[1]), f(dms[2]), sign); // Only care about the first 3 numbers
    }
    catch (e) { /* Return undefined */
    }
};

// Add a function to the Dms() prototype to convert the angle from DMS representation
// into a standard decimal representation.
Dms.prototype.toDecimal = function () {
    var value = new Number(this.sign * (this.degs + (this.mins / 60.0) + (this.secs / 3600.0)));
    // Return an object of type 'number', with the _dms property already set.
    value._dms = this;
    return +value;
};

// Add a dms() method to the Number prototype, to convert the number into a DMS angular representation.
if (!Number.prototype.dms) {
    Number.prototype.dms = function () {
        if (!this._dms) {
            this._dms = new Dms(this);
        }
        return angular.copy(this._dms);
    };
}

// Test if the given object is a number or a string representation of a number.
function isNumeric (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

// Angular module offering filters and an extension to the HTML INPUT element to allow
// working with angles in decimal or DMS formats
angular.module('angularDms', [])

    // Tries to interpret the input value as a decimal or dms angle,
    // and returns a standard 'number' representation of the angle.
    .filter('angle', function () {
        return function (value) {
            if (isNumeric(value)) {
                return value;
            }
            else if (Dms.prototype.isPrototypeOf(value)) {
                return value.toDecimal();
            }
            else {
                var dms = Dms.parse(value);
                if (dms) {
                    return  dms.toDecimal();
                }
            }
        };
    })

    // Takes a numeric or DMS value and returns the DMS representation.
    // The number of decimal places for the seconds component can be set
    // by the first parameter.
    .filter('dms', function () {
        return function (value, fractionSize) {
            var dms;
            if (isNumeric(value)) {
                dms = (+value).dms();
            }
            else if (Dms.prototype.isPrototypeOf(value)) {
                dms = value;
            }
            else {
                dms = Dms.parse(value);
            }

            if (dms) {
                return dms.toString(fractionSize);
            }
            else {
                return '';
            }
        };
    })

    // Adds a new type to the HTML input element: 'angle'.  This causes the input to
    // accept values either in decimal or sexagesimal (degrees minutes seconds) format.
    // The variable bound with ng-model will contain a value of type 'number', decorated
    // with a dms() method that returns a Dms() object.
    .directive('input', function ($log, $filter) {
        return {
            restrict: 'E',
            require:  'ngModel',
            link:     function (scope, element, attrs, ngModel) {
                if (attrs.type !== 'angle') {
                    return;
                }

                // Parse the text value, returning a 'number' object.
                // As well as accepting a decimal number, the parser
                // with accept any three numbers, separated by anything
                // other than a period or minus sign, and convert
                // from a dms angle into a regular number, decorated with
                // the dms() method.
                ngModel.$parsers.push(function (value) {
                    if (value) {
                        value = value.replace(/[^\s\.\-\d]/g, ' ');

                        if (isNumeric(value)) {
                            ngModel.$setValidity('angle', true);
                            return +value;
                        }

                        var dms = Dms.parse(value);
                        if (dms) {
                            ngModel.$setValidity('angle', true);
                            return dms.toDecimal();
                        }

                        ngModel.$setValidity('angle', false);
                    }
                });

                // When passed a numeric string, the value is simply passed on.
                // Otherwise, attempt to coerce the string into a Dms() object.
                ngModel.$formatters.push(function (value) {
                    if (isNumeric(value)) {
                        return +value;
                    }
                    else {
                        return $filter('dms')(value);
                    }
                })
            }
        };
    });