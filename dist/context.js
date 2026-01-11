"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
function resolve(key, env, logic) {
    let lookup = env[key];
    if (lookup !== undefined)
        return lookup;
    return logic[key];
}
