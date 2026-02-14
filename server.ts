import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

async function createServer() {
  const app = Fastify({ logger: true });

  let vite: import("vite").ViteDevServer | undefined;

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    await app.register(import("@fastify/middie"));
    app.use(vite.middlewares);
  } else {
    await app.register(import("@fastify/compress"));
    await app.register(import("@fastify/static"), {
      root: path.resolve(__dirname, "dist/client"),
      prefix: "/",
      wildcard: false,
      setHeaders(res, filePath) {
        if (filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=0");
        }
      },
    });
  }

  app.get("*", async (request, reply) => {
    const url = request.url;

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

      reply.status(200).header("Content-Type", "text/html").send(html);
    } catch (e) {
      if (vite) {
        vite.ssrFixStacktrace(e as Error);
      }
      request.log.error(e);
      reply.status(500).send((e as Error).message);
    }
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });
}

createServer();
