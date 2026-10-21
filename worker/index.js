var MAX_IMAGES = 8;
var MAX_DATA = 9000000;

var PROMPT = [
  "영수증, 거래명세표, 카드전표 이미지를 읽고 JSON 객체만 반환한다.",
  "설명, 마크다운, 코드펜스는 넣지 않는다.",
  "여러 장이면 품목을 순서대로 한 목록에 합친다.",
  '{"vendor":"","date":"YYYY-MM-DD","items":[{"name":"","qty":1,"amount":0}],"shipping":0,"discount":0,"total":0}',
  "amount, shipping, discount, total은 원 단위 정수다. discount는 할인액의 절댓값이다.",
  "qty는 수량이다. 품목명에는 상품 설명을 남기고 금액은 amount에만 둔다.",
  "읽을 수 없는 값은 0 또는 빈 문자열로 둔다.",
].join(" ");

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-app-token",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function dataUrl(image) {
  var mime = String(image && image.mime || "image/jpeg").toLowerCase();
  if (mime !== "image/jpeg" && mime !== "image/png" && mime !== "image/webp" && mime !== "image/gif") {
    mime = "image/jpeg";
  }
  var data = String(image && image.data || "").replace(/^data:[^,]+,/, "");
  return { mime: mime, url: "data:" + mime + ";base64," + data, size: data.length };
}

async function askDeepSeek(env, content, withFormat) {
  var payload = {
    model: "deepseek-flash",
    temperature: 0,
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: content },
    ],
  };
  if (withFormat) payload.response_format = { type: "json_object" };
  return fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.DEEPSEEK_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function parseModelJson(text) {
  var raw = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("인식 결과가 JSON이 아닙니다.");
  return JSON.parse(raw.slice(start, end + 1));
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env || {});
    } catch (err) {
      return json({ error: "워커 처리 중 오류가 났습니다." }, 500);
    }
  },
};

async function handle(request, env) {
    if (request.method === "OPTIONS") return json({ ok: true });
    if (request.method !== "POST") return json({ error: "POST만 받습니다." }, 405);
    if (!env.DEEPSEEK_API_KEY) return json({ error: "워커에 DEEPSEEK_API_KEY가 없습니다." }, 500);
    if (env.APP_TOKEN && request.headers.get("x-app-token") !== env.APP_TOKEN) {
      return json({ error: "토큰이 맞지 않습니다." }, 401);
    }
    var body;
    try {
      body = await request.json();
    } catch (err) {
      return json({ error: "JSON 본문이 아닙니다." }, 400);
    }
    var images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    if (!images.length) return json({ error: "이미지가 없습니다." }, 400);
    var content = [{ type: "text", text: "첨부 영수증을 읽어 지정한 JSON으로 반환한다." }];
    var total = 0;
    for (var i = 0; i < images.length; i++) {
      var image = dataUrl(images[i]);
      total += image.size;
      if (total > MAX_DATA) return json({ error: "이미지가 너무 큽니다." }, 413);
      content.push({
        type: "image_url",
        image_url: { url: image.url, detail: "high" },
      });
    }
    var response = await askDeepSeek(env, content, true);
    if (response.status === 400) response = await askDeepSeek(env, content, false);
    if (!response.ok) {
      return json({ error: "딥시크 요청이 거절되었습니다. (" + response.status + ")" }, 502);
    }
    var payload = await response.json();
    var text = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? payload.choices[0].message.content
      : "";
    try {
      return json(parseModelJson(text));
    } catch (err) {
      return json({ error: err.message || "인식 결과를 읽지 못했습니다." }, 502);
    }
}
