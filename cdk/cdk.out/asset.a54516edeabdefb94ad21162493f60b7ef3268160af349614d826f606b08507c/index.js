"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/fast-safe-stringify/index.js
var require_fast_safe_stringify = __commonJS({
  "node_modules/fast-safe-stringify/index.js"(exports, module2) {
    module2.exports = stringify;
    stringify.default = stringify;
    stringify.stable = deterministicStringify;
    stringify.stableStringify = deterministicStringify;
    var LIMIT_REPLACE_NODE = "[...]";
    var CIRCULAR_REPLACE_NODE = "[Circular]";
    var arr = [];
    var replacerStack = [];
    function defaultOptions() {
      return {
        depthLimit: Number.MAX_SAFE_INTEGER,
        edgesLimit: Number.MAX_SAFE_INTEGER
      };
    }
    function stringify(obj, replacer, spacer, options) {
      if (typeof options === "undefined") {
        options = defaultOptions();
      }
      decirc(obj, "", 0, [], void 0, 0, options);
      var res;
      try {
        if (replacerStack.length === 0) {
          res = JSON.stringify(obj, replacer, spacer);
        } else {
          res = JSON.stringify(obj, replaceGetterValues(replacer), spacer);
        }
      } catch (_) {
        return JSON.stringify("[unable to serialize, circular reference is too complex to analyze]");
      } finally {
        while (arr.length !== 0) {
          var part = arr.pop();
          if (part.length === 4) {
            Object.defineProperty(part[0], part[1], part[3]);
          } else {
            part[0][part[1]] = part[2];
          }
        }
      }
      return res;
    }
    function setReplace(replace, val, k, parent) {
      var propertyDescriptor = Object.getOwnPropertyDescriptor(parent, k);
      if (propertyDescriptor.get !== void 0) {
        if (propertyDescriptor.configurable) {
          Object.defineProperty(parent, k, { value: replace });
          arr.push([parent, k, val, propertyDescriptor]);
        } else {
          replacerStack.push([val, k, replace]);
        }
      } else {
        parent[k] = replace;
        arr.push([parent, k, val]);
      }
    }
    function decirc(val, k, edgeIndex, stack, parent, depth, options) {
      depth += 1;
      var i;
      if (typeof val === "object" && val !== null) {
        for (i = 0; i < stack.length; i++) {
          if (stack[i] === val) {
            setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
            return;
          }
        }
        if (typeof options.depthLimit !== "undefined" && depth > options.depthLimit) {
          setReplace(LIMIT_REPLACE_NODE, val, k, parent);
          return;
        }
        if (typeof options.edgesLimit !== "undefined" && edgeIndex + 1 > options.edgesLimit) {
          setReplace(LIMIT_REPLACE_NODE, val, k, parent);
          return;
        }
        stack.push(val);
        if (Array.isArray(val)) {
          for (i = 0; i < val.length; i++) {
            decirc(val[i], i, i, stack, val, depth, options);
          }
        } else {
          var keys = Object.keys(val);
          for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            decirc(val[key], key, i, stack, val, depth, options);
          }
        }
        stack.pop();
      }
    }
    function compareFunction(a, b) {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    }
    function deterministicStringify(obj, replacer, spacer, options) {
      if (typeof options === "undefined") {
        options = defaultOptions();
      }
      var tmp = deterministicDecirc(obj, "", 0, [], void 0, 0, options) || obj;
      var res;
      try {
        if (replacerStack.length === 0) {
          res = JSON.stringify(tmp, replacer, spacer);
        } else {
          res = JSON.stringify(tmp, replaceGetterValues(replacer), spacer);
        }
      } catch (_) {
        return JSON.stringify("[unable to serialize, circular reference is too complex to analyze]");
      } finally {
        while (arr.length !== 0) {
          var part = arr.pop();
          if (part.length === 4) {
            Object.defineProperty(part[0], part[1], part[3]);
          } else {
            part[0][part[1]] = part[2];
          }
        }
      }
      return res;
    }
    function deterministicDecirc(val, k, edgeIndex, stack, parent, depth, options) {
      depth += 1;
      var i;
      if (typeof val === "object" && val !== null) {
        for (i = 0; i < stack.length; i++) {
          if (stack[i] === val) {
            setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
            return;
          }
        }
        try {
          if (typeof val.toJSON === "function") {
            return;
          }
        } catch (_) {
          return;
        }
        if (typeof options.depthLimit !== "undefined" && depth > options.depthLimit) {
          setReplace(LIMIT_REPLACE_NODE, val, k, parent);
          return;
        }
        if (typeof options.edgesLimit !== "undefined" && edgeIndex + 1 > options.edgesLimit) {
          setReplace(LIMIT_REPLACE_NODE, val, k, parent);
          return;
        }
        stack.push(val);
        if (Array.isArray(val)) {
          for (i = 0; i < val.length; i++) {
            deterministicDecirc(val[i], i, i, stack, val, depth, options);
          }
        } else {
          var tmp = {};
          var keys = Object.keys(val).sort(compareFunction);
          for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            deterministicDecirc(val[key], key, i, stack, val, depth, options);
            tmp[key] = val[key];
          }
          if (typeof parent !== "undefined") {
            arr.push([parent, k, val]);
            parent[k] = tmp;
          } else {
            return tmp;
          }
        }
        stack.pop();
      }
    }
    function replaceGetterValues(replacer) {
      replacer = typeof replacer !== "undefined" ? replacer : function(k, v) {
        return v;
      };
      return function(key, val) {
        if (replacerStack.length > 0) {
          for (var i = 0; i < replacerStack.length; i++) {
            var part = replacerStack[i];
            if (part[1] === key && part[0] === val) {
              val = part[2];
              replacerStack.splice(i, 1);
              break;
            }
          }
        }
        return replacer.call(this, key, val);
      };
    }
  }
});

// node_modules/lambda-log/lib/LogMessage.js
var require_LogMessage = __commonJS({
  "node_modules/lambda-log/lib/LogMessage.js"(exports, module2) {
    var stringify = require_fast_safe_stringify();
    var symbols = {
      LOG: Symbol("log"),
      META: Symbol("meta"),
      ERROR: Symbol("error"),
      OPTS: Symbol("opts")
    };
    var LogMessage = class {
      constructor(log2, opts) {
        this[symbols.LOG] = log2;
        this[symbols.META] = {};
        this[symbols.ERROR] = null;
        this[symbols.OPTS] = opts;
        const { meta, tags } = this[symbols.LOG];
        if (meta && (typeof meta !== "object" || Array.isArray(meta))) {
          this[symbols.LOG].meta = { meta };
        }
        if (!meta)
          this[symbols.LOG].meta = {};
        if (!tags)
          this[symbols.LOG].tags = [];
        if (LogMessage.isError(log2.msg)) {
          const err = log2.msg;
          this[symbols.ERROR] = err;
          this[symbols.META].stack = err.stack;
          this[symbols.LOG].msg = err.message;
        }
      }
      get level() {
        return this[symbols.LOG].level;
      }
      get msg() {
        return this[symbols.LOG].msg;
      }
      set msg(msg) {
        this[symbols.LOG].msg = msg;
      }
      get message() {
        return this.msg;
      }
      set message(msg) {
        this.msg = msg;
      }
      get meta() {
        const opts = this[symbols.OPTS];
        let meta = {
          ...this[symbols.META],
          ...this[symbols.OPTS].meta,
          ...this[symbols.LOG].meta
        };
        if (opts.dynamicMeta && typeof opts.dynamicMeta === "function") {
          const dynMeta = opts.dynamicMeta.call(this, this, opts);
          if (typeof dynMeta === "object") {
            meta = Object.assign(meta, dynMeta);
          }
        }
        for (const [key, val] of Object.entries(meta)) {
          if (typeof val !== "object")
            continue;
          if (LogMessage.isError(val)) {
            meta[key] = LogMessage.stubError(val);
          }
        }
        return meta;
      }
      set meta(obj) {
        this[symbols.LOG].meta = {
          ...this[symbols.LOG].meta,
          ...obj
        };
      }
      get tags() {
        const opts = this[symbols.OPTS];
        const tags = [].concat(opts.tags, this[symbols.LOG].tags);
        return tags.map((tag) => {
          if (typeof tag === "function") {
            return tag.call(this, {
              level: this.level,
              meta: this.meta,
              options: opts
            });
          }
          const hasVar = tag.match(/(<<(.*)>>)/);
          if (!hasVar)
            return tag;
          const varName = hasVar[2];
          if (varName === "level")
            return tag.replace(hasVar[1], this.level);
          return tag;
        }).filter((tag) => tag !== null && tag !== void 0 && tag !== "");
      }
      set tags(tags) {
        this[symbols.LOG].tags = this[symbols.LOG].tags.concat(tags);
      }
      get value() {
        const opts = this[symbols.OPTS];
        return {
          [opts.levelKey]: opts.levelKey ? this.level : void 0,
          [opts.messageKey]: this.msg,
          ...this.meta,
          [opts.tagsKey]: opts.tagsKey ? this.tags : void 0
        };
      }
      get log() {
        return this.value;
      }
      get throw() {
        const err = this[symbols.ERROR] || new Error(this.msg);
        err.log = this;
        throw err;
      }
      toJSON(format) {
        return stringify(this.value, this[symbols.OPTS].replacer || null, format ? 4 : 0);
      }
      static isError(val) {
        return Boolean(val) && typeof val === "object" && (val instanceof Error || Object.prototype.hasOwnProperty.call(val, "message") && Object.prototype.hasOwnProperty.call(val, "stack"));
      }
      static stubError(err) {
        if (typeof err.toJSON === "function")
          return err;
        err.toJSON = function() {
          const keys = [
            "name",
            "message",
            "stack"
          ].concat(Object.keys(err));
          return keys.reduce((obj, key) => {
            if (key in err) {
              const val = err[key];
              if (typeof val === "function")
                return obj;
              obj[key] = val;
            }
            return obj;
          }, {});
        };
        return err;
      }
    };
    LogMessage.symbols = symbols;
    module2.exports = LogMessage;
  }
});

// node_modules/lambda-log/lib/LambdaLog.js
var require_LambdaLog = __commonJS({
  "node_modules/lambda-log/lib/LambdaLog.js"(exports, module2) {
    var EventEmitter = require("events");
    var LogMessage = require_LogMessage();
    var symbols = {
      LEVELS: Symbol("levels")
    };
    var LambdaLog2 = class extends EventEmitter {
      constructor(options = {}, levels = {}) {
        super();
        this.LambdaLog = LambdaLog2;
        this.LogMessage = LogMessage;
        this.options = {
          meta: {},
          tags: [],
          dynamicMeta: null,
          debug: false,
          dev: false,
          silent: ["true", "yes", "y", "1"].includes(process.env.LAMBDALOG_SILENT),
          replacer: null,
          logHandler: console,
          levelKey: "_logLevel",
          messageKey: "msg",
          tagsKey: "_tags",
          ...options
        };
        this[symbols.LEVELS] = {
          info: "info",
          warn: "warn",
          error: "error",
          debug() {
            if (this.options.debug)
              return "debug";
            return false;
          },
          ...levels
        };
        this.console = this.options.logHandler;
        const levelsConfig = this[symbols.LEVELS];
        for (const lvl in levelsConfig) {
          if (Object.prototype.hasOwnProperty.call(levelsConfig, lvl)) {
            this.addLevel(lvl, levelsConfig[lvl]);
          }
        }
      }
      addLevel(name, handler) {
        this[symbols.LEVELS][name] = handler;
        this[name] = (msg, meta = {}, tags = []) => this.log(name, msg, meta, tags);
        return this;
      }
      log(level, msg, meta = {}, tags = []) {
        if (!Object.prototype.hasOwnProperty.call(this[symbols.LEVELS], level)) {
          throw new Error(`"${level}" is not a valid log level`);
        }
        const message = new this.LogMessage({
          level,
          msg,
          meta,
          tags
        }, this.options);
        let method = this[symbols.LEVELS][level];
        if (typeof method === "function") {
          method = method.call(this, message);
        }
        if (!method)
          return false;
        if (!this.options.silent) {
          this.console[method](message.toJSON(this.options.dev));
        }
        this.emit("log", message);
        return message;
      }
      assert(test, msg, meta = {}, tags = []) {
        if (test)
          return false;
        return this.log("error", msg, meta, tags);
      }
      result(promise, meta = {}, tags = []) {
        if (!promise || typeof promise.then !== "function") {
          throw new Error("A promise must be provided as the first argument");
        }
        const wrapper = new Promise((resolve) => {
          promise.then((value) => resolve(this.log("info", value, meta, tags))).catch((err) => resolve(this.log("error", err, meta, tags)));
        });
        return wrapper;
      }
    };
    LambdaLog2.symbols = symbols;
    module2.exports = LambdaLog2;
  }
});

// node_modules/lambda-log/index.js
var require_lambda_log = __commonJS({
  "node_modules/lambda-log/index.js"(exports, module2) {
    var LambdaLog2 = require_LambdaLog();
    var log2 = new LambdaLog2();
    module2.exports = log2;
  }
});

// src/lambda/processMessage.ts
var processMessage_exports = {};
__export(processMessage_exports, {
  processMessage: () => processMessage
});
module.exports = __toCommonJS(processMessage_exports);
var import_lambda_log = __toESM(require_lambda_log());
var DEBUG_LOGS = process.env.DEBUG_LOGS == "true";
var FAILURE_TEST = process.env.FAILURE_TEST == "true";
var redactLogProperties = ["AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"];
var log = new import_lambda_log.LambdaLog({
  tags: [
    "processing-lambda"
  ],
  debug: DEBUG_LOGS,
  replacer(key, value) {
    if (redactLogProperties.includes(key)) {
      return "redacted";
    }
    return value;
  }
});
async function processMessage(event, context) {
  log.debug(event);
  log.debug(context);
  if (FAILURE_TEST) {
    throw new Error("Testing failure for DL Queue");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  processMessage
});
//# sourceMappingURL=index.js.map
