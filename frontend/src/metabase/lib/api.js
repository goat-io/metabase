import EventEmitter from "events";
import querystring from "querystring";

import { isTest } from "metabase/env";
import { isWithinIframe } from "metabase/lib/dom";
import { delay } from "metabase/lib/promise";

let sessionToken = "";
let apiKey = "";

// Track if we've already set up listeners
let listenersInitialized = false;

// Single event listener to handle both message types
const handleParentMessages = (event) => {
  // TODO: Add origin validation for security * will do for now
  // if (event.origin !== 'https://your-expected-origin.com') return;

  if (event.data.type === "set-session-token") {
    sessionToken = event.data.sessionToken;
  } else if (event.data.type === "set-api-key") {
    apiKey = event.data.apiKey;
  }
};

// Only set up communication if we're in an iframe
if (isWithinIframe() && !listenersInitialized) {
  // Add the event listener once
  window.addEventListener("message", handleParentMessages);
  listenersInitialized = true;

  // Request both tokens
  window.parent.postMessage({ type: "get-session-token" }, "*");
  window.parent.postMessage({ type: "get-api-key" }, "*");
}

// Export getters so Api class can access these values
export const getSessionToken = () => sessionToken;
export const getApiKey = () => apiKey;

const ONE_SECOND = 1000;
const MAX_RETRIES = 10;

// eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
const ANTI_CSRF_HEADER = "X-Metabase-Anti-CSRF-Token";

let ANTI_CSRF_TOKEN = null;

const DEFAULT_OPTIONS = {
  json: true,
  hasBody: false,
  noEvent: false,
  transformResponse: ({ body }) => body,
  raw: {},
  headers: {},
  retry: false,
  retryCount: MAX_RETRIES,
  // Creates an array with exponential backoff in millis
  // i.e. [1000, 2000, 4000, 8000...]
  retryDelayIntervals: new Array(MAX_RETRIES)
    .fill(1)
    .map((_, i) => ONE_SECOND * Math.pow(2, i)),
};

export class Api extends EventEmitter {
  basename = "";
  apiKey = "";
  sessionToken;

  onBeforeRequest;

  /**
   * @type {string|{name: string, version: string}}
   */
  requestClient;

  GET;
  POST;
  PUT;
  DELETE;

  constructor() {
    super();
    this.GET = this._makeMethod("GET", { retry: true });
    this.DELETE = this._makeMethod("DELETE", {});
    this.POST = this._makeMethod("POST", { hasBody: true, retry: true });
    this.PUT = this._makeMethod("PUT", { hasBody: true });
  }

  getClientHeaders() {
    const self = this;
    const headers = {};

    // Use getter function or fall back to instance property
    const currentApiKey = getApiKey() || this.apiKey;
    if (currentApiKey) {
      headers["X-Api-Key"] = currentApiKey;
    }

    // Use getter function or fall back to instance property
    const currentSessionToken = getSessionToken() || this.sessionToken;
    if (currentSessionToken) {
      // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
      headers["X-Metabase-Session"] = currentSessionToken;
    }

    if (isWithinIframe()) {
      // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
      headers["X-Metabase-Embedded"] = "true";
      // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
      headers["X-Metabase-Client"] = "embedding-iframe";
    }

    if (self.requestClient) {
      if (typeof self.requestClient === "object") {
        // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
        headers["X-Metabase-Client"] = self.requestClient.name;
        // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
        headers["X-Metabase-Client-Version"] = self.requestClient.version;
      } else {
        // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
        headers["X-Metabase-Client"] = self.requestClient;
      }
    }

    if (ANTI_CSRF_TOKEN) {
      headers[ANTI_CSRF_HEADER] = ANTI_CSRF_TOKEN;
    }

    // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
    if (DEFAULT_OPTIONS.headers["X-Metabase-Locale"]) {
      // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
      headers["X-Metabase-Locale"] =
        // eslint-disable-next-line no-literal-metabase-strings -- Not a user facing string
        DEFAULT_OPTIONS.headers["X-Metabase-Locale"];
    }

    return headers;
  }

  _makeMethod(method, creatorOptions = {}) {
    return (urlTemplate, methodOptions = {}) => {
      if (typeof methodOptions === "function") {
        methodOptions = { transformResponse: methodOptions };
      }

      const defaultOptions = {
        ...DEFAULT_OPTIONS,
        ...creatorOptions,
        ...methodOptions,
      };

      return async (rawData, invocationOptions = {}) => {
        if (this.onBeforeRequest) {
          await this.onBeforeRequest();
        }

        const options = { ...defaultOptions, ...invocationOptions };
        let url = urlTemplate;
        // this will transform arrays to objects with numeric keys
        // we shouldn't be using top level-arrays in the API
        const data = { ...rawData };
        for (const tag of url.match(/:\w+/g) || []) {
          const paramName = tag.slice(1);
          let value = data[paramName];
          delete data[paramName];
          if (value === undefined) {
            console.warn("Warning: calling", method, "without", tag);
            value = "";
          }
          if (!options.raw || !options.raw[paramName]) {
            value = encodeURIComponent(value);
          }
          url = url.replace(tag, value);
        }
        // remove undefined
        for (const name in data) {
          if (data[name] === undefined) {
            delete data[name];
          }
        }

        let body;
        if (options.hasBody) {
          body = options.formData
            ? rawData.formData
            : JSON.stringify(
                options.bodyParamName != null
                  ? data[options.bodyParamName]
                  : data,
              );
        } else {
          const qs = querystring.stringify(data);
          if (qs) {
            url += (url.indexOf("?") >= 0 ? "&" : "?") + qs;
          }
        }

        const headers = {
          ...this.getClientHeaders(),
          ...(options.json
            ? { Accept: "application/json", "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        };

        if (options.formData && options.fetch) {
          delete headers["Content-Type"];
        }

        if (options.retry) {
          return this._makeRequestWithRetries(
            method,
            url,
            headers,
            body,
            data,
            options,
          );
        } else {
          return this._makeRequest(method, url, headers, body, data, options);
        }
      };
    };
  }

  async _makeRequestWithRetries(method, url, headers, body, data, options) {
    // Get a copy of the delay intervals that we can pop items from as we retry
    const retryDelays = options.retryDelayIntervals.slice().reverse();
    let retryCount = 0;
    // maxAttempts is the first attempt followed by the number of retries
    const maxAttempts = options.retryCount + 1;
    // Make the first attempt for the request, then loop incrementing the retryCount
    do {
      try {
        return await this._makeRequest(
          method,
          url,
          headers,
          body,
          data,
          options,
        );
      } catch (e) {
        retryCount++;
        // If the response is 503 and the next retry won't put us over the maxAttempts,
        // wait a bit and try again
        if (e.status === 503 && retryCount < maxAttempts) {
          await delay(retryDelays.pop());
        } else {
          throw e;
        }
      }
    } while (retryCount < maxAttempts);
  }

  _makeRequest(...args) {
    const options = args[5];
    // this is temporary to not deal with failed cypress tests
    // we should switch to using fetch in all cases (metabase#28489)
    if (isTest || options.fetch) {
      return this._makeRequestWithFetch(...args);
    } else {
      return this._makeRequestWithXhr(...args);
    }
  }

  _makeRequestWithXhr(method, url, headers, body, data, options) {
    return new Promise((resolve, reject) => {
      let isCancelled = false;
      const xhr = new XMLHttpRequest();
      xhr.open(method, this.basename + url);
      for (const headerName in headers) {
        xhr.setRequestHeader(headerName, headers[headerName]);
      }
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          // getResponseHeader() is case-insensitive
          const antiCsrfToken = xhr.getResponseHeader(ANTI_CSRF_HEADER);
          if (antiCsrfToken) {
            ANTI_CSRF_TOKEN = antiCsrfToken;
          }

          let body = xhr.responseText;
          if (options.json) {
            try {
              body = JSON.parse(body);
            } catch (e) {}
          }
          let status = xhr.status;
          if (status === 202 && body && body._status > 0) {
            status = body._status;
          }
          if (status >= 200 && status <= 299) {
            if (options.transformResponse) {
              body = options.transformResponse({ body, data });
            }
            resolve(body);
          } else {
            reject({
              status: status,
              data: body,
              isCancelled: isCancelled,
            });
          }
          if (!options.noEvent) {
            this.emit(status, url);
          }
        }
      };
      xhr.send(body);

      if (options.cancelled) {
        options.cancelled.then(() => {
          isCancelled = true;
          xhr.abort();
        });
      }
    });
  }

  async _makeRequestWithFetch(
    method,
    url,
    headers,
    requestBody,
    data,
    options,
  ) {
    const controller = options.controller || new AbortController();
    const signal = options.signal ?? controller.signal;
    options.cancelled?.then(() => controller.abort());

    const requestUrl = new URL(this.basename + url, location.origin);
    const request = new Request(requestUrl.href, {
      method,
      headers,
      body: requestBody,
      signal,
    });

    return fetch(request)
      .then((response) => {
        const unreadResponse = response.clone();
        return response.text().then((body) => {
          if (options.json) {
            try {
              body = JSON.parse(body);
            } catch (e) {}
          }

          let status = response.status;
          if (status === 202 && body && body._status > 0) {
            status = body._status;
          }

          const token = response.headers.get(ANTI_CSRF_HEADER);
          if (token) {
            ANTI_CSRF_TOKEN = token;
          }

          if (!options.noEvent) {
            this.emit(status, url);
          }

          if (status >= 200 && status <= 299) {
            if (options.transformResponse) {
              body = options.transformResponse({
                body,
                data,
                response: unreadResponse,
              });
            }
            return body;
          } else {
            throw { status: status, data: body };
          }
        });
      })
      .catch((error) => {
        if (signal.aborted) {
          throw { isCancelled: true };
        } else {
          throw error;
        }
      });
  }
}

const instance = new Api();

export default instance;
export const { GET, POST, PUT, DELETE } = instance;

export const setLocaleHeader = (locale) => {
  /* `X-Metabase-Locale` is a header that the BE stores as *user* locale for the scope of the request.
   * We need it to localize downloads. It *currently* only work if there is a user, so it won't work
   * for public/static embedding.
   */
  // eslint-disable-next-line no-literal-metabase-strings -- Header name, not a user facing string
  DEFAULT_OPTIONS.headers["X-Metabase-Locale"] = locale ?? undefined;
};
