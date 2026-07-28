import fs from 'node:fs';
import path from 'node:path';

const serverDirectory = path.resolve('dist/server');
fs.mkdirSync(serverDirectory, { recursive: true });
fs.writeFileSync(
  path.join(serverDirectory, 'index.js'),
  `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (!acceptsHtml) return response;

    const fallbackUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};

export default worker;
`,
  'utf8',
);
