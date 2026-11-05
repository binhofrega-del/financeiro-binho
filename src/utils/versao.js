// Preenchido no build pelo vite.config.js
export const VERSAO = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const BUILD_DATA = import.meta.env.VITE_BUILD_DATA || '';
export const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || '';
// Ex.: "v1.1.0 · 05/11/2026 21:40"
export const VERSAO_COMPLETA = `v${VERSAO}${BUILD_DATA ? ` · ${BUILD_DATA}` : ''}`;
