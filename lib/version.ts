/** 当前应用版本（构建时由 Dockerfile ARG APP_VERSION 注入；本地为 dev） */
export const APP_VERSION = process.env.APP_VERSION || 'dev'

/** 用于检查更新 / 自更新的镜像仓库（fork 可用 UPDATE_IMAGE 覆盖） */
export const IMAGE_REPO = process.env.UPDATE_IMAGE || 'gloridust/gancook'
