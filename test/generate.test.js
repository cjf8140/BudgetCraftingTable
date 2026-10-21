const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const context = { console, globalThis: global };
context.globalThis = context;
context.JSZip = require("jszip");
const vm = require("vm");
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js", "hwpx.js"), "utf8"), context);
const H = context.BudgetHwpx;

const formPath = path.join(root, "template", "form.hwpx");
const template = fs.readFileSync(formPath);
fs.mkdirSync(path.join(root, "test", "out"), { recursive: true });

test("한글 금액은 일금 표기로 변환된다", () => {
  assert.equal(H.numberToKorean(57800), "오만칠천팔백");
  assert.equal(H.numberToKorean(44600), "사만사천육백");
  assert.equal(H.numberToKorean(600), "육백");
  assert.equal(H.numberToKorean(1000), "일천");
  assert.equal(H.numberToKorean(10000), "일만");
  assert.equal(H.numberToKorean(11000), "일만일천");
  assert.equal(H.numberToKorean(101000), "일십만일천");
  assert.equal(H.numberToKorean(123456789), "일억이천삼백사십오만육천칠백팔십구");
  assert.equal(H.numberToKorean(0), "영");
  assert.equal(H.formatNumber(44000), "44,000");
  assert.equal(H.formatKoreanDate("2026-05-07"), "2026년 05월 07일");
});

test("예시 금액으로 품목 행과 누름틀을 채운다", async () => {
  const data = {
    expectDate: "2026-05-07",
    writeDate: "2026-05-07",
    timing: "after",
    reason: H.DEFAULTS.reason,
    subject: "2026학년도 건.",
    receiptCount: 1,
    items: [
      { name: "소 한근 세트", price: "49900", qty: "1", unit: "EA" },
      { name: "공기밥", price: "1000", qty: "1", unit: "EA" },
      { name: "추억의 도시락", price: "6900", qty: "1", unit: "EA" },
    ],
  };
  const buf = await H.buildHwpx(template, data, { type: "nodebuffer" });
  const out = path.join(root, "test", "out", "out-example.hwpx");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.match(xml, /rowCnt="5"/);
  assert.match(xml, /height="7724"/);
  assert.equal(xml.includes(">품목</hp:t>"), false);
  assert.equal(xml.includes(">총계</hp:t>"), false);
  assert.equal(xml.includes(">계한글</hp:t>"), false);
  assert.equal(xml.includes(">date1</hp:t>"), false);
  for (const text of ["소 한근 세트", "공기밥", "추억의 도시락", "49,900", "1,000", "6,900", "57,800", "오만칠천팔백", "1EA", "2026년 05월 07일"]) {
    assert.equal(xml.includes(text), true, text);
  }
  assert.equal(xml.includes("사전집행 (  ) , 사후집행 ( O )"), true);
  assert.equal(xml.includes('textpos="33"'), true);
  assert.equal(xml.includes('textpos="65"'), true);
  for (const id of ["33", "34", "35", "36", "37"]) {
    assert.equal(xml.includes(`charPrIDRef="${id}"`), false, id);
  }
  assert.equal(xml.includes("고  승  주 (인)"), true);
  assert.equal(xml.includes('<hp:t>고  승  주 (인)</hp:t><hp:pic id="1208551751"'), true);
  assert.equal(xml.includes('vertOffset="4294966702"'), true);
  assert.equal(xml.includes('horzOffset="5947"'), true);
  assert.equal(xml.includes('vertOffset="73716"'), true);
  assert.equal(xml.includes('horzOffset="48402"'), true);
  assert.equal(xml.includes('width="4068"'), true);
  assert.equal(xml.includes('height="1863"'), true);
  assert.equal(xml.includes('width="8053"'), true);
  assert.equal(xml.includes('height="3387"'), true);
  assert.equal(xml.split('dimwidth="48000" dimheight="21000"').length - 1, 2);
  assert.equal(xml.includes('vertOffset="6218"'), false);
  assert.equal(xml.includes('horzOffset="43982"'), false);
  assert.equal(xml.includes("<hp:t>고  승  </hp:t><hp:pic"), false);
  assert.equal((xml.match(/<hp:fieldBegin\b/g) || []).length, 8);
  assert.equal(/<hp:fieldBegin\b[^>]*dirty="0"/.test(xml), false);
  assert.equal(zipStored(out, "mimetype"), true);
  assert.equal(zipHas(out, "BinData/image1.png"), true);
  assertXml(out);
});

test("화면 예시 두 줄과 특수문자를 넣는다", async () => {
  const data = {
    expectDate: "2026-10-08",
    writeDate: "2026-10-08",
    timing: "before",
    reason: "아이스박스 & 얼음 <추가>",
    subject: "2026학년도 간식 건.",
    receiptCount: 2,
    items: [
      { name: "얼음", price: "44,000", qty: "1", unit: "EA" },
      { name: "이체수수료", price: "600", qty: "2", unit: "EA" },
    ],
  };
  const summary = H.summarize(data);
  assert.equal(summary.total, 45200);
  assert.equal(summary.korean, "사만오천이백");
  const buf = await H.buildHwpx(template, data, { type: "nodebuffer" });
  const out = path.join(root, "test", "out", "out-ice.hwpx");
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.match(xml, /rowCnt="4"/);
  assert.equal(xml.includes("얼음"), true);
  assert.equal(xml.includes("이체수수료"), true);
  assert.equal(xml.includes("44,000"), true);
  assert.equal(xml.includes("1,200"), true);
  assert.equal(xml.includes("45,200"), true);
  assert.equal(xml.includes("사만오천이백"), true);
  assert.equal(xml.includes("2EA"), true);
  assert.equal(xml.includes("사전집행 ( O ) , 사후집행 (  )"), true);
  assert.equal(xml.includes("아이스박스 &amp; 얼음 &lt;추가&gt;"), true);
  assert.equal(xml.includes("2026학년도 간식 건."), true);
  assert.equal(xml.includes(">2매</hp:t>"), true);
  assert.equal(xml.includes("2026년 10월 08일"), true);
  assertXml(out);
});

test("긴 지출 사유는 줄바꿈되고 칸이 늘어난다", async () => {
  const reason = "가".repeat(120);
  const buf = await H.buildHwpx(
    template,
    {
      expectDate: "2026-10-20",
      writeDate: "2026-10-20",
      timing: "after",
      reason,
      items: [{ name: "얼음", price: "1000", qty: "1", unit: "EA" }],
    },
    { type: "nodebuffer" }
  );
  const out = path.join(root, "test", "out", "out-reason.hwpx");
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.equal(xml.includes('textpos="28"'), true);
  assert.equal(xml.includes('textpos="56"'), true);
  assert.equal(xml.includes('height="6375"'), false);
  assertXml(out);
});

test("행이 칸보다 길어지면 지출 내역 칸을 늘린다", async () => {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    items.push({ name: "품목" + i, price: String(1000 * i), qty: "1", unit: "개" });
  }
  const buf = await H.buildHwpx(
    template,
    {
      expectDate: "2026-10-20",
      writeDate: "2026-10-20",
      timing: "after",
      items,
    },
    { type: "nodebuffer" }
  );
  const out = path.join(root, "test", "out", "out-long.hwpx");
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.match(xml, /rowCnt="22"/);
  assert.match(xml, /height="36013"/);
  assert.match(xml, /height="44803"/);
  assert.equal(xml.includes("품목20"), true);
  assert.equal(xml.includes("20,000"), true);
  assert.equal(xml.includes("1개"), true);
  assertXml(out);
});

test("영수증 이미지는 2쪽 칸 안에 들어간다", async () => {
  const receipts = [];
  for (let i = 0; i < 7; i++) {
    receipts.push({ width: 900, height: 1400, bytes: Buffer.from("receipt-" + i) });
  }
  const buf = await H.buildHwpx(template, {
    expectDate: "2026-10-21",
    writeDate: "2026-10-21",
    timing: "after",
    items: [{ name: "얼음", price: "1000", qty: "1", unit: "EA" }],
    receipts,
  }, { type: "nodebuffer" });
  const out = path.join(root, "test", "out", "out-receipt.hwpx");
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.equal(xml.includes('<hp:run charPrIDRef="14"><hp:pic'), true);
  assert.equal(xml.includes('height="60000"'), true);
  assert.equal(xml.includes('height="68375"'), true);
  assert.equal(xml.includes('binaryItemIDRef="image9"'), true);
  const pics = xml.split("<hp:pic ").slice(1);
  let placed = 0;
  for (const block of pics) {
    if (!/binaryItemIDRef="image[3-9]"/.test(block)) continue;
    const height = Number(block.match(/<hp:sz width="\d+" widthRelTo="ABSOLUTE" height="(\d+)"/)[1]);
    const y = Number(block.match(/vertOffset="(\d+)"/)[1]);
    const x = Number(block.match(/horzOffset="(\d+)"/)[1]);
    const width = Number(block.match(/<hp:sz width="(\d+)"/)[1]);
    assert.equal(y + height <= 60000, true);
    assert.equal(x + width <= 47910, true);
    placed += 1;
  }
  assert.equal(placed, 7);
  assert.equal(zipHas(out, "BinData/image3.png"), true);
  assert.equal(zipHas(out, "BinData/image9.png"), true);
  assertXml(out);
});

test("서명 이름과 도장 파일을 바꾼다", async () => {
  const data = {
    expectDate: "2026-10-20",
    writeDate: "2026-10-20",
    timing: "after",
    accountant: "김 철 수",
    president: "이영희",
    items: [{ name: "얼음", price: "1000", qty: "1", unit: "EA" }],
  };
  const accountant = Buffer.from("PNG-ACCOUNTANT");
  const president = Buffer.from("PNG-PRESIDENT");
  const buf = await H.buildHwpx(template, data, {
    type: "nodebuffer",
    images: { accountant, president },
  });
  const out = path.join(root, "test", "out", "out-sign.hwpx");
  fs.writeFileSync(out, buf);
  const xml = readSection(out);
  assert.equal(xml.split("김  철  수").length - 1, 2);
  assert.equal(xml.includes("이  영  희"), true);
  assert.equal(xml.includes("고  승  주"), false);
  assert.equal(xml.includes("조  유  찬"), false);
  assert.equal(zipEntry(out, "BinData/image1.png").equals(accountant), true);
  assert.equal(zipEntry(out, "BinData/image2.png").equals(president), true);
  assertXml(out);
});

function readSection(file) {
  const script = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
sys.stdout.buffer.write(z.read("Contents/section0.xml"))
`;
  return execFileSync("python", ["-c", script, file]).toString("utf8");
}

function zipStored(file, name) {
  const script = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
info = z.getinfo(sys.argv[2])
print("1" if info.compress_type == zipfile.ZIP_STORED and z.namelist()[0] == sys.argv[2] else "0")
`;
  return execFileSync("python", ["-c", script, file, name], { encoding: "utf8" }).trim() === "1";
}

function zipEntry(file, name) {
  const script = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
sys.stdout.buffer.write(z.read(sys.argv[2]))
`;
  return execFileSync("python", ["-c", script, file, name]);
}

function zipHas(file, name) {
  const script = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
print("1" if sys.argv[2] in z.namelist() else "0")
`;
  return execFileSync("python", ["-c", script, file, name], { encoding: "utf8" }).trim() === "1";
}

function assertXml(file) {
  const script = `
import zipfile, sys
import xml.etree.ElementTree as ET
z = zipfile.ZipFile(sys.argv[1])
ET.fromstring(z.read("Contents/section0.xml"))
ET.fromstring(z.read("Contents/content.hpf"))
print("ok")
`;
  const out = execFileSync("python", ["-c", script, file], { encoding: "utf8" });
  assert.equal(out.trim(), "ok");
}
