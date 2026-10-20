/* form.hwpx 안의 누름틀과 품목 표를 채워 example.hwpx 와 같은 지출 신청서를 만든다. */
(function (root) {
  var ITEM_TABLE_ID = "1437329790";
  var ITEM_HEADER_H = 1399;
  var ITEM_ROW_H = 1607;
  var ITEM_TOTAL_H = 1504;
  var DETAIL_CELL_H = 31635;
  var OUTER_TABLE_H = 40425;
  var TIMING_AFTER = "사전집행 (  ) , 사후집행 ( O )";
  var TIMING_BEFORE = "사전집행 ( O ) , 사후집행 (  )";

  var DEFAULTS = {
    reason:
      "본 철도시스템학부 학생회에서는 2026년도 학생회 물품 구입으로 인하여 아래와 같이 집행 하고자 하오니 결재하여 주시기 바랍니다.",
    subject: "2026학년도 건.",
    receiptCount: 1,
    timing: "after",
    unit: "EA",
    accountant: "고승주",
    president: "조유찬",
  };

  var DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  var SMALL = ["", "십", "백", "천"];
  var BIG = ["", "만", "억", "조", "경"];

  function numberToKorean(amount) {
    var n = Math.round(Number(amount));
    if (!isFinite(n) || n < 0) return "";
    if (n === 0) return "영";
    var groupIndex = 0;
    var result = "";
    while (n > 0) {
      var group = n % 10000;
      n = Math.floor(n / 10000);
      if (group > 0) {
        var part = "";
        var g = group;
        for (var i = 0; i < 4; i++) {
          var d = g % 10;
          g = Math.floor(g / 10);
          if (d !== 0) part = DIGITS[d] + SMALL[i] + part;
        }
        result = part + BIG[groupIndex] + result;
      }
      groupIndex += 1;
    }
    return result;
  }

  function formatNumber(amount) {
    var n = Math.round(Number(amount));
    var sign = n < 0 ? "-" : "";
    var body = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + body;
  }

  function formatKoreanDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) throw new Error("날짜 형식이 올바르지 않습니다.");
    return m[1] + "년 " + m[2] + "월 " + m[3] + "일";
  }

  function oneLine(value) {
    return String(value == null ? "" : value)
      .replace(/[\r\n]+/g, " ")
      .trim();
  }

  function esc(value) {
    return oneLine(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function mustReplace(xml, from, to, label) {
    if (xml.indexOf(from) === -1) {
      throw new Error("서식에서 '" + label + "' 위치를 찾지 못했습니다.");
    }
    return xml.split(from).join(to);
  }

  function sliceBalanced(xml, start, openTag, closeTag) {
    var depth = 0;
    var i = start;
    while (i < xml.length) {
      var nextOpen = xml.indexOf(openTag, i);
      var nextClose = xml.indexOf(closeTag, i);
      if (nextClose < 0) throw new Error(closeTag + " 가 닫히지 않았습니다.");
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + openTag.length;
      } else {
        depth -= 1;
        i = nextClose + closeTag.length;
        if (depth === 0) return xml.slice(start, i);
      }
    }
    throw new Error(openTag + " 범위를 끝내지 못했습니다.");
  }

  function extractElements(xml, openTag, closeTag) {
    var found = [];
    var i = 0;
    while (i < xml.length) {
      var start = xml.indexOf(openTag, i);
      if (start < 0) break;
      var chunk = sliceBalanced(xml, start, openTag, closeTag);
      found.push(chunk);
      i = start + chunk.length;
    }
    return found;
  }

  function setRowAddr(rowXml, addr) {
    return rowXml.replace(/rowAddr="\d+"/g, 'rowAddr="' + addr + '"');
  }

  function fillRun(row, charPr, value) {
    var token = '<hp:run charPrIDRef="' + charPr + '"/>';
    var idx = row.indexOf(token);
    if (idx < 0) throw new Error("금액 칸(" + charPr + ")을 찾지 못했습니다.");
    var replacement =
      '<hp:run charPrIDRef="' + charPr + '"><hp:t>' + esc(value) + "</hp:t></hp:run>";
    return row.slice(0, idx) + replacement + row.slice(idx + token.length);
  }

  function formatQty(item) {
    var qty = Number(item.qty);
    var qtyText = Number.isInteger(qty) ? String(qty) : String(qty);
    return item.unit ? qtyText + item.unit : qtyText;
  }

  function fillAmounts(row, item) {
    var money = formatNumber(item.line);
    var price = formatNumber(item.price);
    row = fillRun(row, "29", price);
    row = fillRun(row, "30", formatQty(item));
    row = fillRun(row, "29", money);
    return row;
  }

  function fillFirstRow(row, item) {
    var from = '<hp:run charPrIDRef="35"><hp:t>품목</hp:t></hp:run>';
    if (row.indexOf(from) === -1) throw new Error("품목 누름틀을 찾지 못했습니다.");
    row = row.replace(from, '<hp:run charPrIDRef="32"><hp:t>' + esc(item.name) + "</hp:t></hp:run>");
    return fillAmounts(row, item);
  }

  function fillExtraRow(row, item) {
    var start = row.indexOf('<hp:run charPrIDRef="32">');
    var end = row.indexOf("<hp:linesegarray>");
    if (start < 0 || end < 0 || end < start) {
      throw new Error("품목 행을 복제하지 못했습니다.");
    }
    var plain = '<hp:run charPrIDRef="32"><hp:t>' + esc(item.name) + "</hp:t></hp:run>";
    return fillAmounts(plainRow(row, start, end, plain), item);
  }

  function plainRow(row, start, end, plain) {
    return row.slice(0, start) + plain + row.slice(end);
  }

  function normalizeItem(raw) {
    var name = oneLine(raw && raw.name);
    var priceText = String(raw && raw.price != null ? raw.price : "").replace(/,/g, "");
    var qtyText = String(raw && raw.qty != null ? raw.qty : "").replace(/,/g, "");
    if (!name) {
      if (priceText && priceText !== "0") throw new Error("금액이 있는 줄의 품목명을 입력해 주세요.");
      return null;
    }
    var price = Math.round(Number(priceText === "" ? "0" : priceText));
    var qty = Number(qtyText === "" ? "0" : qtyText);
    if (!isFinite(price) || price < 0) throw new Error("'" + name + "'의 단가를 확인해 주세요.");
    if (!isFinite(qty) || qty <= 0) throw new Error("'" + name + "'의 수량을 확인해 주세요.");
    var unit = oneLine(raw.unit == null ? DEFAULTS.unit : raw.unit);
    return {
      name: name,
      price: price,
      qty: qty,
      unit: unit,
      line: Math.round(price * qty),
    };
  }

  function rebuildItems(xml, items) {
    var marker = '<hp:tbl id="' + ITEM_TABLE_ID + '"';
    var start = xml.indexOf(marker);
    if (start < 0) throw new Error("품목 표를 찾지 못했습니다.");
    var tableXml = sliceBalanced(xml, start, "<hp:tbl", "</hp:tbl>");
    var rows = extractElements(tableXml, "<hp:tr", "</hp:tr>");
    if (rows.length !== 3) throw new Error("품목 표는 머리글, 빈 행, 총합 행이어야 합니다.");
    var header = rows[0];
    var template = rows[1];
    var total = rows[2];
    if (template.indexOf('charPrIDRef="29"/>') === -1) {
      throw new Error("단가 칸이 비어 있지 않습니다. form.hwpx 를 확인해 주세요.");
    }
    var built = [header];
    for (var i = 0; i < items.length; i++) {
      var row = i === 0 ? fillFirstRow(template, items[i]) : fillExtraRow(template, items[i]);
      built.push(setRowAddr(row, i + 1));
    }
    built.push(setRowAddr(total, items.length + 1));
    var first = tableXml.indexOf("<hp:tr");
    var last = tableXml.lastIndexOf("</hp:tr>") + "</hp:tr>".length;
    var height = ITEM_HEADER_H + items.length * ITEM_ROW_H + ITEM_TOTAL_H;
    var head = tableXml.slice(0, first);
    if (head.indexOf('rowCnt="3"') === -1 || head.indexOf('height="4510"') === -1) {
      throw new Error("품목 표 크기 정보를 찾지 못했습니다.");
    }
    head = head
      .replace('rowCnt="3"', 'rowCnt="' + (items.length + 2) + '"')
      .replace('height="4510"', 'height="' + height + '"');
    var nextTable = head + built.join("") + tableXml.slice(last);
    return xml.slice(0, start) + nextTable + xml.slice(start + tableXml.length);
  }

  function growDetailCell(xml, count) {
    var inner = ITEM_HEADER_H + count * ITEM_ROW_H + ITEM_TOTAL_H;
    var needed = inner + 285 + 285 + 400;
    if (needed <= DETAIL_CELL_H) return { xml: xml, delta: 0 };
    var delta = needed - DETAIL_CELL_H;
    var hits = xml.split('height="' + DETAIL_CELL_H + '"').length - 1;
    if (hits !== 2) throw new Error("지출 내역 칸 높이를 찾지 못했습니다.");
    xml = xml.split('height="' + DETAIL_CELL_H + '"').join('height="' + needed + '"');
    return { xml: xml, delta: delta };
  }

  function charUnits(ch) {
    return ch.charCodeAt(0) < 128 ? 1 : 2;
  }

  function wrapUnits(text, maxUnits) {
    var starts = [];
    var acc = 0;
    var start = 0;
    for (var i = 0; i < text.length; i++) {
      var w = charUnits(text.charAt(i));
      if (acc > 0 && acc + w > maxUnits) {
        starts.push(start);
        start = i;
        acc = w;
      } else {
        acc += w;
      }
    }
    starts.push(start);
    return starts;
  }

  function replaceReasonLines(xml, rawText, escaped) {
    var marker = '<hp:run charPrIDRef="6"><hp:t>' + escaped;
    var idx = xml.indexOf(marker);
    if (idx < 0) throw new Error("지출 사유 문단을 찾지 못했습니다.");
    var segStart = xml.indexOf("<hp:linesegarray>", idx);
    var segEnd = xml.indexOf("</hp:linesegarray>", segStart);
    if (segStart < 0 || segEnd < 0) throw new Error("지출 사유 줄 정보를 찾지 못했습니다.");
    var breaks = wrapUnits(rawText, 56);
    var segs = "";
    for (var i = 0; i < breaks.length; i++) {
      segs +=
        '<hp:lineseg textpos="' +
        breaks[i] +
        '" vertpos="' +
        i * 1920 +
        '" vertsize="1200" textheight="1200" baseline="1020" spacing="720" horzpos="0" horzsize="35524" flags="393216"/>';
    }
    xml =
      xml.slice(0, segStart) +
      "<hp:linesegarray>" +
      segs +
      "</hp:linesegarray>" +
      xml.slice(segEnd + "</hp:linesegarray>".length);
    return { xml: xml, lines: breaks.length };
  }

  function growReasonRow(xml, lines) {
    var content = (lines - 1) * 1920 + 1200;
    var need = Math.max(6375, content + 1335);
    if (need === 6375) return { xml: xml, delta: 0 };
    var hits = xml.split('height="6375"').length - 1;
    if (hits !== 2) throw new Error("지출 사유 칸 높이를 찾지 못했습니다.");
    xml = xml.split('height="6375"').join('height="' + need + '"');
    return { xml: xml, delta: need - 6375 };
  }

  function growOuter(xml, delta) {
    if (!delta) return xml;
    var outer = 'height="' + OUTER_TABLE_H + '"';
    if (xml.indexOf(outer) === -1) throw new Error("바깥 표 높이를 찾지 못했습니다.");
    return xml.replace(outer, 'height="' + (OUTER_TABLE_H + delta) + '"');
  }

  function replaceFieldRun(xml, charPr, placeholder, value, newCharPr) {
    var from = '<hp:run charPrIDRef="' + charPr + '"><hp:t>' + placeholder + "</hp:t></hp:run>";
    var to = '<hp:run charPrIDRef="' + newCharPr + '"><hp:t>' + value + "</hp:t></hp:run>";
    return mustReplace(xml, from, to, placeholder);
  }

  function centerSignatureRow(xml) {
    var picStart = xml.indexOf('<hp:pic id="1208551751"');
    if (picStart < 0) throw new Error("책임자 도장을 찾지 못했습니다.");
    var picXml = sliceBalanced(xml, picStart, "<hp:pic", "</hp:pic>");
    xml = xml.slice(0, picStart) + xml.slice(picStart + picXml.length);
    var splitName = "<hp:t>고  승  </hp:t><hp:t>주 (인)</hp:t>";
    if (xml.indexOf(splitName) === -1) throw new Error("책임자 이름을 찾지 못했습니다.");
    // 도장이 두 글자 사이에 있으면 웹 뷰어가 이름을 칸 위로 민다.
    // 영수증 표 문단으로 빼면 한글이 도장만 있는 빈 쪽을 만든다.
    // 좌표는 서식 그대로 이름 칸에 두고, 이름 뒤에 붙인다.
    return xml.replace(splitName, "<hp:t>고  승  주 (인)</hp:t>" + picXml);
  }

  function spacedName(value, fallback) {
    var compact = oneLine(value).replace(/\s+/g, "");
    if (!compact) compact = fallback;
    var chars = [];
    for (var i = 0; i < compact.length; i++) chars.push(compact.charAt(i));
    return esc(chars.join("  "));
  }

  function replaceSignNames(xml, data) {
    var accountant = spacedName(data && data.accountant, DEFAULTS.accountant);
    var president = spacedName(data && data.president, DEFAULTS.president);
    var roleGap = "       ";
    var afterName = "               (인)";
    xml = mustReplace(
      xml,
      "회계담당" + roleGap + "고  승  주" + afterName,
      "회계담당" + roleGap + accountant + afterName,
      "회계담당"
    );
    xml = mustReplace(xml, "<hp:t>고  승  주 (인)</hp:t>", "<hp:t>" + accountant + " (인)</hp:t>", "책임자");
    xml = mustReplace(
      xml,
      "학생회장" + roleGap + "조  유  찬" + afterName,
      "학생회장" + roleGap + president + afterName,
      "학생회장"
    );
    return xml;
  }

  function applyData(xml, data) {
    var items = (data.items || []).map(normalizeItem).filter(Boolean);
    if (!items.length) throw new Error("품목을 한 줄 이상 입력해 주세요.");
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].line;
    var timingText = data.timing === "before" ? TIMING_BEFORE : TIMING_AFTER;
    var reasonRaw = oneLine(data.reason || DEFAULTS.reason) || " ";
    var reason = esc(reasonRaw);
    var subject = esc(data.subject || DEFAULTS.subject) || DEFAULTS.subject;
    var sheets = String(Math.max(1, Math.round(Number(data.receiptCount) || 1))) + "매";
    var korean = numberToKorean(total);
    var money = formatNumber(total);

    xml = replaceFieldRun(xml, "33", "계한글", korean, "5");
    xml = replaceFieldRun(xml, "36", "계한글", korean, "13");
    xml = replaceFieldRun(xml, "33", "총계", money, "5");
    xml = replaceFieldRun(xml, "34", "총계", money, "31");
    xml = replaceFieldRun(xml, "36", "총계", money, "13");
    xml = replaceFieldRun(xml, "37", "date1", formatKoreanDate(data.expectDate), "2");
    xml = replaceFieldRun(xml, "37", "date2", formatKoreanDate(data.writeDate), "2");
    xml = mustReplace(xml, TIMING_AFTER, timingText, "집행 구분");
    xml = mustReplace(xml, DEFAULTS.reason, reason, "지출 사유");
    var wrapped = replaceReasonLines(xml, reasonRaw, reason);
    xml = wrapped.xml;
    var reasonGrow = growReasonRow(xml, wrapped.lines);
    xml = reasonGrow.xml;
    xml = mustReplace(xml, DEFAULTS.subject, subject, "지출항목");
    xml = mustReplace(xml, ">1매</hp:t>", ">" + esc(sheets) + "</hp:t>", "영수증 매수");
    xml = rebuildItems(xml, items);
    var detailGrow = growDetailCell(xml, items.length);
    xml = growOuter(detailGrow.xml, detailGrow.delta + reasonGrow.delta);
    xml = centerSignatureRow(xml);
    xml = replaceSignNames(xml, data);
    xml = xml.replace(/(<hp:fieldBegin\b[^>]*?)\sdirty="0"/g, '$1 dirty="1"');
    return xml;
  }

  function summarize(data) {
    var items = [];
    var error = "";
    try {
      items = (data.items || []).map(normalizeItem).filter(Boolean);
    } catch (err) {
      error = err.message;
    }
    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].line;
    return {
      items: items,
      total: total,
      money: formatNumber(total),
      korean: numberToKorean(total),
      error: error,
    };
  }

  async function buildHwpx(templateBuffer, data, options) {
    var JSZipLib = root.JSZip;
    if (!JSZipLib) throw new Error("JSZip 이 없습니다.");
    var zip = await JSZipLib.loadAsync(templateBuffer);
    var sectionFile = zip.file("Contents/section0.xml");
    if (!sectionFile) throw new Error("서식에 Contents/section0.xml 이 없습니다.");
    var xml = applyData(await sectionFile.async("string"), data);
    zip.file("Contents/section0.xml", xml);
    var images = options && options.images;
    if (images && images.accountant) zip.file("BinData/image1.png", images.accountant);
    if (images && images.president) zip.file("BinData/image2.png", images.president);
    var hpf = zip.file("Contents/content.hpf");
    if (hpf) {
      var meta = await hpf.async("string");
      var now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      meta = meta.replace(
        /(<opf:meta name="ModifiedDate" content="text">)[^<]*/,
        "$1" + now
      );
      zip.file("Contents/content.hpf", meta);
    }
    var mime = zip.file("mimetype");
    if (mime) mime.options.compression = "STORE";
    var type = (options && options.type) || "blob";
    return zip.generateAsync({
      type: type,
      mimeType: "application/octet-stream",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  }

  root.BudgetHwpx = {
    DEFAULTS: DEFAULTS,
    numberToKorean: numberToKorean,
    formatNumber: formatNumber,
    formatKoreanDate: formatKoreanDate,
    applyData: applyData,
    summarize: summarize,
    buildHwpx: buildHwpx,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
