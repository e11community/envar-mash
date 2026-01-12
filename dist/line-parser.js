"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrowingFileListener = exports.WarningFileListener = void 0;
exports.parseLine = parseLine;
const context_1 = require("./context");
exports.WarningFileListener = {
    onNoKeyPair: (parseContext, line) => {
        console.warn(`No keypair detected in content line [${line}] found in file[${parseContext.filePath}] at line [${parseContext.line}]`);
    },
    onMissingPlaceholder: (parseContext, key) => {
        console.warn(`Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`);
    },
};
exports.ThrowingFileListener = {
    onNoKeyPair: (parseContext, line) => {
        throw new Error(`No keypair detected in content line [${line}] found in file[${parseContext.filePath}] at line [${parseContext.line}]`);
    },
    onMissingPlaceholder: (parseContext, key) => {
        throw new Error(`Logic contexts have no defined value for key [${key}] found in file [${parseContext.filePath}] at line [${parseContext.line}], col [${parseContext.col}]`);
    },
};
function parseLine(request) {
    if (request.line.length === 0)
        return { buffer: '', curState: request.curState, curLinePivot: request.curLinePivot || 'key' };
    let { curState } = request;
    let prevState = request.curState;
    let curLinePivot = request.curLinePivot || 'key';
    let buffer = '';
    let curChar = '';
    let prevChar = '';
    let posBuffer = 0;
    for (let posCur = 0; posCur < request.line.length; ++posCur) {
        prevChar = curChar;
        curChar = request.line[posCur];
        if (curState === 'normal') {
            if (curChar === "'") {
                prevState = curState;
                curState = 'single-quote';
                buffer += curChar;
            }
            else if (curChar === '"') {
                prevState = curState;
                curState = 'double-quote';
                buffer += curChar;
            }
            else if (curChar === '#') {
                // buffer += request.line.substring(posCur)
                return { buffer, curState, curLinePivot };
            }
            else if (curChar === '{' && prevChar === '$') {
                prevState = curState;
                curState = 'maybe-placeholder';
                posBuffer = posCur - 1;
                buffer = buffer.slice(0, -1);
            }
            else if (curLinePivot === 'key' && curChar === '=') {
                curLinePivot = 'value';
                buffer += curChar;
            }
            else {
                buffer += curChar;
            }
        }
        else if (curState === 'double-quote') {
            if (curChar === '\\') {
                prevState = curState;
                curState = 'escaping';
                buffer += curChar;
            }
            else if (curChar === '"') {
                prevState = curState;
                curState = 'normal';
                buffer += curChar;
            }
            else if (curChar === '{' && prevChar === '$') {
                prevState = curState;
                curState = 'maybe-placeholder';
                posBuffer = posCur - 1;
                buffer = buffer.slice(0, -1);
            }
            else {
                buffer += curChar;
            }
        }
        else if (curState === 'single-quote') {
            if (curChar === '\\') {
                prevState = curState;
                curState = 'escaping';
                buffer += curChar;
            }
            else if (curChar === '"') {
                prevState = curState;
                curState = 'normal';
                buffer += curChar;
            }
            else {
                buffer += curChar;
            }
        }
        else if (curState === 'maybe-placeholder') {
            if (curChar === '}') {
                const key = request.line.substring(posBuffer + 2, posCur);
                let lookup = (0, context_1.resolve)(key, request.env, request.logic);
                if (lookup === undefined) {
                    request.listener.onMissingPlaceholder(request.parseContext, key);
                    lookup = '';
                }
                buffer += lookup;
                curState = prevState;
            }
        }
        else if (curState === 'escaping') {
            buffer += curChar;
            curState = prevState;
        }
    }
    return { buffer, curState, curLinePivot };
}
