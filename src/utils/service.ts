import json5 from 'json5';

function createServiceConfig(baseURL: string, otherServiceBaseURL: string) {
  let other = {} as Record<App.Service.OtherBaseURLKey, string>;
  try {
    other = json5.parse(otherServiceBaseURL);
  } catch {
    // eslint-disable-next-line no-console
    console.error('VITE_OTHER_SERVICE_BASE_URL is not a valid json5 string');
  }

  const httpConfig: App.Service.SimpleServiceConfig = {
    baseURL,
    other
  };

  const otherHttpKeys = Object.keys(httpConfig.other) as App.Service.OtherBaseURLKey[];

  const otherConfig: App.Service.OtherServiceConfigItem[] = otherHttpKeys.map(key => {
    return {
      key,
      baseURL: httpConfig.other[key],
      proxyPattern: createProxyPattern(key)
    };
  });

  const config: App.Service.ServiceConfig = {
    baseURL: httpConfig.baseURL,
    proxyPattern: createProxyPattern(),
    other: otherConfig
  };

  return config;
}

/**
 * get backend service base url
 *
 * @param baseURL - VITE_SERVICE_BASE_URL (must be passed directly for Vite build-time replacement)
 * @param otherServiceBaseURL - VITE_OTHER_SERVICE_BASE_URL
 * @param isProxy - if use proxy
 */
export function getServiceBaseURL(baseURL: string, otherServiceBaseURL: string, isProxy: boolean) {
  const { baseURL: resolvedBaseURL, other } = createServiceConfig(baseURL, otherServiceBaseURL);

  const otherBaseURL = {} as Record<App.Service.OtherBaseURLKey, string>;

  other.forEach(item => {
    otherBaseURL[item.key] = isProxy ? item.proxyPattern : item.baseURL;
  });

  return {
    baseURL: isProxy ? createProxyPattern() : resolvedBaseURL,
    otherBaseURL
  };
}

/**
 * Get proxy pattern of backend service base url
 *
 * @param key If not set, will use the default key
 */
function createProxyPattern(key?: App.Service.OtherBaseURLKey) {
  if (!key) {
    return '/proxy-default';
  }

  return `/proxy-${key}`;
}
