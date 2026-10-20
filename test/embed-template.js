const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const b64 = fs.readFileSync(path.join(root, "template", "form.hwpx")).toString("base64");
fs.writeFileSync(path.join(root, "js", "template.js"), "window.FORM_HWPX_BASE64 = \"" + b64 + "\";\n");
console.log("wrote template.js", b64.length);
