export interface SDKConfig {
  binDir: string;
  gameDir: string;
  fast: boolean;
}
declare global {
  interface Window {
    forgeDesktop?: {
      open: () => Promise<{ name: string; text: string } | null>;
      save: (data: { name: string; text: string; extension: string }) => Promise<string | null>;
      directory: () => Promise<string | null>;
      readPrefs: () => Promise<Partial<SDKConfig>>;
      savePrefs: (config: SDKConfig) => Promise<SDKConfig>;
      build: (data: { config: SDKConfig; vmf: string; name: string }) => Promise<string | null>;
      cancelBuild: () => Promise<void>;
      reveal: (file: string) => Promise<void>;
      onBuildLog: (callback: (text: string) => void) => () => void;
    };
  }
}
