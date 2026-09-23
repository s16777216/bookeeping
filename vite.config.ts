import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { createAppleSplashScreens } from "@vite-pwa/assets-generator/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    base: "/",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.ico",
          "icon.png",
          "apple-touch-icon.png",
          "pwa-192x192.png",
          "pwa-512x512.png",
        ],
        manifest: {
          name: "Bookeeping 收據記帳",
          short_name: "Bookeeping",
          description: "以圖論為核心的 Local-first 極簡收據風格記帳應用",
          theme_color: "#f2f0e0",
          background_color: "#f2f0e0",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          id: "/",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable any",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        },
        pwaAssets: {
          preset: {
            // 空陣列：不生成或覆蓋任何 App Icons，保留原始滿版高解析圖示
            transparent: { sizes: [] },
            maskable: { sizes: [] },
            apple: { sizes: [] },
            // 僅負責生成 Apple iOS 開屏畫面（Splash Screens）
            appleSplashScreens: createAppleSplashScreens(
              {
                padding: 0.3,
                resizeOptions: {
                  background: "#f2f0e0",
                  fit: "contain",
                },
                linkMediaOptions: {
                  basePath: "/",
                  xhtml: false,
                },
              },
              [
                "iPhone 13 mini",
                "iPhone 13",
                "iPhone 13 Pro Max",
                "iPhone 14 Pro",
                "iPhone 14 Pro Max",
                "iPhone 11",
                "iPhone 11 Pro Max",
                'iPhone SE 4.7"',
              ],
            ),
          },
          image: "public/icon.png",
        },
      }),
    ],
});
