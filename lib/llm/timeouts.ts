export const LLM_MODEL_DISCOVERY_TIMEOUT_MS = 15_000
// 控制在常见反代默认超时（nginx proxy_read_timeout 60s）之内，避免整段导入 504
export const RECIPE_LLM_TIMEOUT_MS = 40_000
