import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

async function createServer() {
  const app = express();

  let vite: import("vite").ViteDevServer | undefined;

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    const compression = (await import("compression")).default;
    const sirv = (await import("sirv")).default;
    app.use(compression());
    app.use("/assets", sirv(path.resolve(__dirname, "dist/client/assets"), { maxAge: 31536000, immutable: true }));
    app.use(sirv(path.resolve(__dirname, "dist/client"), { maxAge: 0 }));
  }

  app.use("/{*path}", async (req, res) => {
    const url = req.originalUrl;

    try {
      let template: string;
      let render: () => { html: string };

      if (vite) {
        template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const mod = await vite.ssrLoadModule("/src/entry-server.tsx");
        render = mod.render;
      } else {
        template = fs.readFileSync(path.resolve(__dirname, "dist/client/index.html"), "utf-8");
        const mod = await import("./dist/server/entry-server.js");
        render = mod.render;
      }

      const { html: appHtml } = render();

      const html = template
        .replace("<!--app-head-->", "")
        .replace("<!--app-html-->", appHtml);

      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (e) {
      if (vite) {
        vite.ssrFixStacktrace(e as Error);
      }
      console.error(e);
      res.status(500).end((e as Error).message);
    }
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
