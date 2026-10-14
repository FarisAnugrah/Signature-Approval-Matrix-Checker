const loadModule = module.require.bind(module);
const assert = loadModule("node:assert/strict");
const fs = loadModule("node:fs");
const Module = loadModule("node:module");
const ts = loadModule("typescript");
const React = loadModule("react");
const { renderToStaticMarkup } = loadModule("react-dom/server");

let pathname = "/";
const load = Module._load;
Module._load = function (id, ...args) {
  return id === "next/navigation" ? { usePathname: () => pathname } : load.call(this, id, ...args);
};
require.extensions[".ts"] = require.extensions[".tsx"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  });
  module._compile(outputText, filename);
};

for (const route of ["/", "/folder-checker", "/zip-checker", "/pdf-checker"]) {
  pathname = route;
  const Page = loadModule(`./src/app${route === "/" ? "" : route}/page.tsx`).default;
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.equal(html.includes('id="folder-section"'), route === "/folder-checker");
  assert.equal(html.includes('id="zip-section"'), route === "/zip-checker");
  assert.equal(html.includes('id="pdf-section"'), route === "/pdf-checker");
  assert.equal(html.includes('type="file"'), route !== "/");
  assert.equal(html.includes("Kembali ke beranda"), route !== "/");
  if (route === "/") {
    assert.ok(html.includes('href="/folder-checker"'));
    assert.ok(html.includes('href="/zip-checker"'));
    assert.ok(html.includes('href="/pdf-checker"'));
    assert.ok(html.includes("Validasi Dokumen"));
  }
}
const EmailDraft = loadModule("./src/app/email-draft.tsx").default;
for (const pending of [false, true]) {
  const html = renderToStaticMarkup(React.createElement(EmailDraft, {
    projectName: "PDF", missingItems: [],
    missingSignatures: pending ? [{ path: "sample.pdf", missing_roles: ["Reviewer"] }] : []
  }));
  assert.ok(html.includes("email tidak dikirim"));
  assert.ok(html.includes("SEARCH kontak belum tersedia"));
  assert.ok(html.includes('type="email"'));
  assert.equal(/<button[^>]* disabled=""/.test(html), !pending);
}
console.log("Route separation and draft form checks passed.");

async function checkZipErrors() {
  const { zipRequest } = loadModule("./src/app/zip-request.ts");
  const originalFetch = global.fetch;
  const url = "http://localhost:8001/verify/zip";
  try {
    for (const stage of ["Upload ZIP", "Mengambil hasil ZIP"]) {
      global.fetch = async () => { throw new TypeError("Load failed"); };
      await assert.rejects(zipRequest(url, stage), error => error.message.startsWith(stage) && error.message.includes("port 8001") && error.message.includes("CORS"));
    }
    for (const status of [413, 502]) {
      global.fetch = async () => new Response("<html>Error</html>", { status });
      await assert.rejects(zipRequest(url, "Upload ZIP"), new RegExp(`HTTP ${status}`));
    }
    global.fetch = async () => Response.json({ detail: "Only ZIP files are supported" }, { status: 400 });
    await assert.rejects(zipRequest(url, "Upload ZIP"), /Only ZIP files are supported/);
    global.fetch = async () => new Response("not JSON");
    await assert.rejects(zipRequest(url, "Upload ZIP"), /bukan JSON/);
    const init = { method: "POST", body: new FormData() };
    global.fetch = async (actualUrl, actualInit) => {
      assert.equal(actualUrl, url);
      assert.equal(actualInit, init);
      return Response.json({ job_id: "generated" });
    };
    assert.equal((await zipRequest(url, "Upload ZIP", init)).job_id, "generated");
  } finally {
    global.fetch = originalFetch;
  }
  console.log("ZIP network, HTTP and response error checks passed.");
}
checkZipErrors().catch(error => { console.error(error); process.exitCode = 1; });
