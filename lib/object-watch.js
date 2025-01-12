/*
 * object.watch polyfill
 *
 * 2012-04-03
 *
 * By Eli Grey, https://eligrey.com
 * Public Domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */

// object.watch
if (!Object.prototype.watch) {
    Object.defineProperty(Object.prototype, "watch", {
        enumerable: false,
        configurable: true,
        writable: false,
        value: function (prop, writeHandler, readHandler) {
            let oldval = this[prop];
            let newval = oldval;
            const getter = () => {
                if (readHandler !== undefined) readHandler.call(this, prop);
                return newval;
            };
            const setter = (val) => {
                oldval = newval;
                newval = writeHandler.call(this, prop, oldval, val);
                return newval;
            };

            if (delete this[prop]) { // can't watch constants
                Object.defineProperty(this, prop, {
                    get: getter,
                    set: setter,
                    enumerable: true,
                    configurable: true
                });
            }
        }
    });
}

// object.unwatch
if (!Object.prototype.unwatch) {
    Object.defineProperty(Object.prototype, "unwatch", {
        enumerable: false,
        configurable: true,
        writable: false,
        value: function (prop) {
            const val = this[prop];
            delete this[prop]; // remove accessors
            this[prop] = val;
        }
    });
}
