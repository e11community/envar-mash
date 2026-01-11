"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFile = parseFile;
exports.main = main;
const fs_1 = require("fs");
const path_1 = require("path");
const line_parser_1 = require("./line-parser");
function parseFile(request) {
    const { env, filePath, listener, logic, outputPath } = request;
    const contents = (0, fs_1.readFileSync)(filePath, { encoding: 'utf8' });
    const lines = contents.split('\n');
    let data = '';
    let curState = 'normal';
    let curLinePivot = 'key';
    for (let iLine = 0; iLine < lines.length; ++iLine) {
        const parseContext = {
            col: 1,
            filePath,
            line: iLine + 1,
        };
        const response = (0, line_parser_1.parseLine)({
            curState,
            env,
            line: lines[iLine],
            listener,
            logic,
            parseContext,
        });
        curState = response.curState;
        curLinePivot = response.curLinePivot;
        const { buffer } = response;
        if (buffer.trim().length === 0)
            continue;
        if (curLinePivot === 'key')
            listener.onNoKeyPair(parseContext, buffer);
        addendLogic(logic, buffer);
        if (outputPath) {
            data += response.buffer + '\n';
        }
    }
    if (outputPath) {
        (0, fs_1.writeFileSync)(outputPath, data, { encoding: 'utf8' });
    }
}
function addendLogic(logic, line) {
    const iPos = line.indexOf('=');
    const key = line.substring(0, iPos);
    const value = line.substring(iPos + 1);
    // TODO "evaluate" value so logic does not have enclosing quotes
    logic[key] = value;
}
function main(request) {
    const targetPath = (0, path_1.join)(request.dirTarget, '.env.' + request.environmentName + '.template');
    const statTarget = (0, fs_1.statSync)(targetPath, { throwIfNoEntry: false });
    if (!statTarget) {
        console.log(`File [${targetPath}] is not present. Exiting.`);
        return 0;
    }
    const env = process.env;
    const logic = {};
    const listener = request.listenerType === 'throw' ? line_parser_1.ThrowingFileListener : line_parser_1.WarningFileListener;
    const statTop = (0, fs_1.statSync)(request.dirTop, { throwIfNoEntry: false });
    if (statTop) {
        const children = (0, fs_1.readdirSync)(request.dirTop, { encoding: 'utf8', recursive: false });
        if (children.includes('.env.ALL-after')) {
            parseFile({ filePath: (0, path_1.join)(request.dirTop, '.env.ALL-after'), env, listener, logic });
        }
        if (children.includes('.env.ALL-before')) {
            parseFile({ filePath: (0, path_1.join)(request.dirTop, '.env.ALL-before'), env, listener, logic });
        }
        if (children.includes('.env.' + request.environmentName)) {
            parseFile({ filePath: (0, path_1.join)(request.dirTop, '.env.' + request.environmentName), env, listener, logic });
        }
    }
    parseFile({ filePath: targetPath, env, listener, logic, outputPath: '.env.' + request.environmentName });
    return 0;
}
