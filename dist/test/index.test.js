"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-await-in-loop */
const config = __importStar(require("config"));
const optimistSDK_js_1 = __importDefault(require("../src/libs/nightfall/optimistSDK.js"));
const globals_1 = require("@jest/globals");
globals_1.jest.useFakeTimers();
const { ENVIRONMENTS, RESTRICTIONS } = config;
// eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
const environment = ENVIRONMENTS[process.env.ENVIRONMENT] || ENVIRONMENTS.localhost;
describe('Test', () => {
    const optimist = new optimistSDK_js_1.default({
        environment,
    });
    test('new sdk', async function () {
        console.log(environment);
        await optimist.init();
        // optimist.connection.close();
        // console.log(optimist);
    });
    afterEach(() => {
        optimist.connection.close();
    });
});
//# sourceMappingURL=index.test.js.map