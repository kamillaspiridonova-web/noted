import { asBlob } from "html-docx-js-typescript";
import JSZip from "jszip";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "document";
}

/** Wraps the Tiptap HTML in a proper HTML page with basic typography styling */
function buildHtmlPage(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: Georgia, serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 24px;
      line-height: 1.75;
      color: #1a1a1a;
    }
    h1 { font-size: 2em; margin-top: 1em; }
    h2 { font-size: 1.5em; margin-top: 1em; }
    h3 { font-size: 1.25em; margin-top: 0.8em; }
    ul { padding-left: 1.5em; }
    ol { padding-left: 1.5em; }
    blockquote {
      border-left: 3px solid #ccc;
      margin-left: 0;
      padding-left: 1em;
      color: #555;
      font-style: italic;
    }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
    code { background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Strip HTML tags to get plain text */
function htmlToText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.innerText || tmp.textContent || "";
}

export async function exportAsHtml(html: string, title: string) {
  const page = buildHtmlPage(html, title);
  const blob = new Blob([page], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${safeFilename(title)}.html`);
}

export async function exportAsTxt(html: string, title: string) {
  const text = htmlToText(html);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${safeFilename(title)}.txt`);
}

export async function exportAsDocx(html: string, title: string) {
  const page = buildHtmlPage(html, title);
  const result = await asBlob(page, {
    orientation: "portrait",
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
  });
  const blob = result instanceof Blob ? result : new Blob([result]);
  downloadBlob(blob, `${safeFilename(title)}.docx`);
}

export function exportAsPdf(html: string, title: string) {
  const page = buildHtmlPage(html, title);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Please allow pop-ups to export as PDF.");
    return;
  }
  win.document.open();
  win.document.write(page);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

export async function exportAsEpub(html: string, title: string) {
  const filename = safeFilename(title);
  const uuid = crypto.randomUUID();
  const now = new Date().toISOString().split("T")[0];

  const contentXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: serif; line-height: 1.6; margin: 1em 2em; }
    h1 { font-size: 1.8em; } h2 { font-size: 1.4em; } h3 { font-size: 1.2em; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; }
    code { font-family: monospace; background: #f4f4f4; padding: 0.1em 0.3em; }
  </style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${html}
</body>
</html>`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>`;

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="UTF-8"/><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <ol><li><a href="content.xhtml">${escapeHtml(title)}</a></li></ol>
  </nav>
</body>
</html>`;

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.folder("META-INF")!.file("container.xml", containerXml);
  const oebps = zip.folder("OEBPS")!;
  oebps.file("content.opf", contentOpf);
  oebps.file("content.xhtml", contentXhtml);
  oebps.file("nav.xhtml", navXhtml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });

  downloadBlob(blob, `${filename}.epub`);
}
