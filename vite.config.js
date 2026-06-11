import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Relative asset paths so the site works when deployed to any folder or subdomain.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        openPositions: resolve(__dirname, "open-positions.html"),
        job: resolve(__dirname, "job.html"),
        apply: resolve(__dirname, "apply.html"),
        payment: resolve(__dirname, "payment.html"),
        howWeHire: resolve(__dirname, "how-we-hire.html"),
        workWithUs: resolve(__dirname, "work-with-us.html"),
        diversity: resolve(__dirname, "diversity-and-inclusion.html"),
        weAreFifa: resolve(__dirname, "we-are-fifa.html"),
      },
    },
  },
  server: {
    proxy: {
      "/postings.json": {
        target: "https://jobs.fifa.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      "/postings.json": {
        target: "https://jobs.fifa.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
