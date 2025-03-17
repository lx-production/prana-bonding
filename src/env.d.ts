/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALCHEMY_POLYGON_MAIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 