import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

async function readJsonBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!rawBody) return undefined;

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function attachJsonHelpers(res: any) {
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload: unknown) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    res.end(JSON.stringify(payload));
    return res;
  };

  return res;
}

function geminiApiDevMiddleware() {
  return {
    name: "gemini-api-dev-middleware",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/gemini-generate", async (req, res, next) => {
        try {
          const { default: handler } = await import("./api/gemini-generate.ts");
          const request = req as any;
          request.body = await readJsonBody(req);
          await handler(request, attachJsonHelpers(res));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return {
    server: {
      host: "localhost",
      port: 5173,
    },
    plugins: [react(), geminiApiDevMiddleware()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
