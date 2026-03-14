export type EnvName = 'test' | 'staging' | 'production';

interface EnvConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  appName: string;
}

const envConfigs: Record<EnvName, EnvConfig> = {
  test: {
    apiBaseUrl: 'http://localhost:8080/api/v1',
    wsBaseUrl: 'ws://localhost:8080/ws',
    appName: 'ThinkAgent (Test)',
  },
  staging: {
    apiBaseUrl: 'https://staging-api.thinkagent.ai/api/v1',
    wsBaseUrl: 'wss://staging-api.thinkagent.ai/ws',
    appName: 'ThinkAgent (Staging)',
  },
  production: {
    apiBaseUrl: 'https://api.thinkagent.ai/api/v1',
    wsBaseUrl: 'wss://api.thinkagent.ai/ws',
    appName: 'ThinkAgent',
  },
};

function getCurrentEnv(): EnvName {
  const env = (import.meta.env.VITE_UNI_ENV ||
    process.env.UNI_ENV ||
    'test') as string;
  if (env in envConfigs) {
    return env as EnvName;
  }
  return 'test';
}

export const currentEnv = getCurrentEnv();
export const envConfig = envConfigs[currentEnv];
