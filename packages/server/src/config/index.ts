import { loadConfig } from './loader';
import { AppConfig } from '../types/config.types';

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
