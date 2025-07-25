var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-bOzV5T/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/worker.js
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (url.pathname === "/api/transcribe" && request.method === "POST") {
      return await handleTranscription(request, env);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({
        status: "ok",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        service: "audio-transcription"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(JSON.stringify({
        service: "Audio Transcription API",
        version: "1.0.0",
        endpoints: {
          transcribe: "/api/transcribe (POST)",
          health: "/health (GET)"
        }
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
async function handleTranscription(request, env) {
  try {
    console.log("\u{1F3A4} \u6536\u5230\u8F6C\u5F55\u8BF7\u6C42");
    const requestData = await request.json();
    const { audioBase64, mimeType, compressed } = requestData;
    console.log("\u{1F4CA} \u8BF7\u6C42\u4FE1\u606F:", {
      hasAudio: !!audioBase64,
      audioSize: audioBase64 ? audioBase64.length : 0,
      mimeType,
      compressed
    });
    if (!audioBase64) {
      throw new Error("\u7F3A\u5C11\u97F3\u9891\u6570\u636E");
    }
    if (!env.GEMINI_API_KEY) {
      throw new Error("API\u5BC6\u94A5\u672A\u914D\u7F6E\uFF0C\u8BF7\u68C0\u67E5\u73AF\u5883\u53D8\u91CF");
    }
    let audioData = audioBase64;
    if (compressed) {
      console.log("\u{1F4E6} \u89E3\u538B\u7F29\u97F3\u9891\u6570\u636E");
      audioData = await decompressBase64(audioBase64);
    }
    console.log("\u{1F916} \u8C03\u7528 Gemini API");
    const transcriptionResult = await callGeminiAPI(audioData, mimeType, env.GEMINI_API_KEY);
    console.log("\u2705 \u8F6C\u5F55\u5B8C\u6210");
    return new Response(JSON.stringify(transcriptionResult), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("\u274C \u8F6C\u5F55\u5931\u8D25:", error.message);
    console.error("\u274C \u9519\u8BEF\u5806\u6808:", error.stack);
    let status = 500;
    if (error.message.includes("API\u5BC6\u94A5")) {
      status = 401;
    } else if (error.message.includes("\u9891\u7387\u8FC7\u9AD8")) {
      status = 429;
    } else if (error.message.includes("\u8FC7\u5927")) {
      status = 413;
    }
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId: crypto.randomUUID()
    }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleTranscription, "handleTranscription");
async function callGeminiAPI(audioBase64, mimeType, apiKey) {
  if (!apiKey) {
    throw new Error("API\u5BC6\u94A5\u672A\u914D\u7F6E");
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          inline_data: {
            mime_type: mimeType || "audio/mpeg",
            data: audioBase64
          }
        }, {
          text: `Please transcribe this audio and provide timestamps for each sentence or phrase. 

CRITICAL: Return ONLY a valid JSON object in this EXACT format:
{
  "segments": [
    {"text": "Hello, I'm Neil.", "startTime": "00:05", "endTime": "00:08"},
    {"text": "Welcome to our show.", "startTime": "00:09", "endTime": "00:12"}
  ]
}

STRICT Requirements:
- startTime and endTime MUST be strings in MM:SS format (e.g., "00:05", "01:23")
- Use quotes around time values: "00:05" NOT 5
- Break text into natural sentences or phrases
- Provide accurate timestamps for each segment
- Do not include any markdown, code blocks, explanations, or other text
- Return ONLY the JSON object, nothing else

Example of CORRECT format:
{"segments": [{"text": "From BBC learning English.com.", "startTime": "00:05", "endTime": "00:10"}]}`
        }]
      }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API \u9519\u8BEF:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("API\u8C03\u7528\u9891\u7387\u8FC7\u9AD8\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    } else if (response.status === 401) {
      throw new Error("API\u5BC6\u94A5\u65E0\u6548");
    } else if (response.status === 413) {
      throw new Error("\u97F3\u9891\u6587\u4EF6\u8FC7\u5927\uFF0C\u8BF7\u9009\u62E9\u8F83\u5C0F\u7684\u6587\u4EF6");
    } else {
      throw new Error(`API\u8C03\u7528\u5931\u8D25: ${response.status}`);
    }
  }
  const result = await response.json();
  if (result.candidates && result.candidates.length > 0) {
    const content = result.candidates[0].content;
    if (content && content.parts && content.parts.length > 0) {
      const text = content.parts[0].text;
      try {
        const transcriptionData = JSON.parse(text);
        if (transcriptionData.segments) {
          return transcriptionData;
        }
      } catch (parseError) {
        console.warn("\u65E0\u6CD5\u89E3\u6790JSON\u683C\u5F0F\uFF0C\u4F7F\u7528\u6587\u672C\u683C\u5F0F:", parseError);
      }
      return {
        segments: [{
          text: text.trim(),
          startTime: 0,
          endTime: 0,
          confidence: 0.8
        }]
      };
    }
  }
  throw new Error("\u672A\u6536\u5230\u6709\u6548\u7684\u8F6C\u5F55\u7ED3\u679C");
}
__name(callGeminiAPI, "callGeminiAPI");
async function decompressBase64(compressedBase64) {
  console.warn("\u89E3\u538B\u7F29\u529F\u80FD\u6682\u672A\u5B9E\u73B0\uFF0C\u8FD4\u56DE\u539F\u6570\u636E");
  return compressedBase64;
}
__name(decompressBase64, "decompressBase64");

// ../../../../../../opt/homebrew/Cellar/nvm/0.39.7/versions/node/v21.6.2/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../opt/homebrew/Cellar/nvm/0.39.7/versions/node/v21.6.2/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-bOzV5T/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../../opt/homebrew/Cellar/nvm/0.39.7/versions/node/v21.6.2/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-bOzV5T/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
