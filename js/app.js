(function () {
  var H = window.BudgetHwpx;
  var state = loadState();
  var templateBuffer = null;

  var expectDate = document.querySelector("#expectDate");
  var writeDate = document.querySelector("#writeDate");
  var timing = document.querySelector("#timing");
  var subject = document.querySelector("#subject");
  var receiptCount = document.querySelector("#receiptCount");
  var reason = document.querySelector("#reason");
  var itemsBox = document.querySelector("#items");
  var preview = document.querySelector("#preview");
  var totalMoney = document.querySelector("#totalMoney");
  var totalKorean = document.querySelector("#totalKorean");
  var statusEl = document.querySelector("#status");
  var errorEl = document.querySelector("#error");
  var saveBtn = document.querySelector("#saveBtn");
  var feeToggle = document.querySelector("#feeToggle");
  var accountant = document.querySelector("#accountant");
  var president = document.querySelector("#president");
  var accountantImg = document.querySelector("#accountantImg");
  var presidentImg = document.querySelector("#presidentImg");
  var stampOverride = { accountant: null, president: null };
  var rootStamp = { accountant: null, president: null };

  bindStaticFields();
  loadStampOverrides();
  renderItems();
  updateComputed();
  loadTemplate();
  refreshRootStamps();

  document.querySelector("#addRow").addEventListener("click", function () {
    var item = blankItem(lastUnit());
    var at = insertIndex();
    state.items.splice(at, 0, item);
    renderItems();
    updateComputed();
    save();
    focusName(at);
  });

  feeToggle.addEventListener("change", function () {
    setTransferFee(feeToggle.checked);
  });

  document.querySelector("#sampleBtn").addEventListener("click", function () {
    state.expectDate = "2026-10-08";
    state.writeDate = "2026-10-08";
    state.timing = "after";
    state.subject = H.DEFAULTS.subject;
    state.receiptCount = 1;
    state.reason = H.DEFAULTS.reason;
    state.items = [
      { name: "얼음", price: "44,000", qty: "1", unit: "EA" },
      feeItem(),
    ];
    syncStaticFields();
    renderItems();
    updateComputed();
    save();
  });

  document.querySelector("#resetBtn").addEventListener("click", function () {
    if (!window.confirm("입력한 내용을 지울까요?")) return;
    state = freshState();
    syncStaticFields();
    renderItems();
    updateComputed();
    save();
  });

  document.querySelector("#saveBtn").addEventListener("click", saveHwpx);

  itemsBox.addEventListener("input", onItemInput);
  itemsBox.addEventListener("blur", onItemBlur, true);
  itemsBox.addEventListener("keydown", onItemKey);
  itemsBox.addEventListener("click", onItemClick);

  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveHwpx();
    }
  });

  function freshState() {
    return {
      expectDate: today(),
      writeDate: today(),
      timing: "after",
      subject: H.DEFAULTS.subject,
      receiptCount: 1,
      reason: H.DEFAULTS.reason,
      accountant: H.DEFAULTS.accountant,
      president: H.DEFAULTS.president,
      items: [blankItem("EA"), blankItem("EA")],
    };
  }

  function blankItem(unit) {
    return { name: "", price: "", qty: "1", unit: unit || "EA" };
  }

  function feeItem() {
    return { name: "이체수수료", price: "600", qty: "1", unit: "EA", fee: true };
  }

  function feeIndex() {
    for (var i = state.items.length - 1; i >= 0; i--) {
      if (state.items[i].fee) return i;
    }
    return -1;
  }

  function insertIndex() {
    var index = feeIndex();
    return index < 0 ? state.items.length : index;
  }

  function isEmptyItem(item) {
    return !item.fee && !String(item.name || "").trim() && !String(item.price || "").replace(/[^\d]/g, "");
  }

  function setTransferFee(on) {
    var index = feeIndex();
    if (on) {
      if (index >= 0) {
        var kept = state.items.splice(index, 1)[0];
        state.items = state.items.filter(function (item) { return !item.fee; });
        state.items.push(kept);
      } else {
        if (state.items.length && isEmptyItem(state.items[state.items.length - 1])) state.items.pop();
        state.items.push(feeItem());
      }
    } else if (index >= 0) {
      state.items = state.items.filter(function (item) { return !item.fee; });
      if (!state.items.length) state.items.push(blankItem("EA"));
    }
    renderItems();
    updateComputed();
    save();
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem("budget-crafting-draft");
      if (!raw) return freshState();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return freshState();
      var next = {
        expectDate: today(),
        writeDate: today(),
        timing: parsed.timing === "before" ? "before" : "after",
        subject: parsed.subject || H.DEFAULTS.subject,
        receiptCount: parsed.receiptCount || 1,
        reason: parsed.reason || H.DEFAULTS.reason,
        accountant: compactPerson(parsed.accountant, H.DEFAULTS.accountant),
        president: compactPerson(parsed.president, H.DEFAULTS.president),
        items: parsed.items.map(function (item) {
          var row = {
            name: item.name || "",
            price: item.price || "",
            qty: item.qty || "1",
            unit: item.unit || "EA",
          };
          if (item.fee || row.name === "이체수수료") row.fee = true;
          return row;
        }),
      };
      var fees = next.items.filter(function (item) { return item.fee; });
      if (fees.length) {
        next.items = next.items.filter(function (item) { return !item.fee; });
        next.items.push(fees[fees.length - 1]);
      }
      return next;
    } catch (err) {
      return freshState();
    }
  }

  function save() {
    localStorage.setItem("budget-crafting-draft", JSON.stringify(state));
  }

  function bindStaticFields() {
    syncStaticFields();
    expectDate.addEventListener("input", function () {
      state.expectDate = expectDate.value;
      updateComputed();
      save();
    });
    writeDate.addEventListener("input", function () {
      state.writeDate = writeDate.value;
      updateComputed();
      save();
    });
    timing.addEventListener("change", function () {
      state.timing = timing.value;
      updateComputed();
      save();
    });
    subject.addEventListener("input", function () {
      state.subject = subject.value;
      updateComputed();
      save();
    });
    receiptCount.addEventListener("input", function () {
      state.receiptCount = receiptCount.value;
      updateComputed();
      save();
    });
    reason.addEventListener("input", function () {
      state.reason = reason.value;
      updateComputed();
      save();
    });
    accountant.addEventListener("input", function () {
      state.accountant = accountant.value;
      updateComputed();
      save();
    });
    president.addEventListener("input", function () {
      state.president = president.value;
      updateComputed();
      save();
    });
    document.querySelector("#accountantStamp").addEventListener("change", function (event) {
      readStampFile(event.target.files && event.target.files[0], "accountant");
      event.target.value = "";
    });
    document.querySelector("#presidentStamp").addEventListener("change", function (event) {
      readStampFile(event.target.files && event.target.files[0], "president");
      event.target.value = "";
    });
    document.querySelector("#accountantStampReset").addEventListener("click", function () {
      clearStampOverride("accountant");
    });
    document.querySelector("#presidentStampReset").addEventListener("click", function () {
      clearStampOverride("president");
    });
  }

  function syncStaticFields() {
    expectDate.value = state.expectDate;
    writeDate.value = state.writeDate;
    timing.value = state.timing;
    subject.value = state.subject;
    receiptCount.value = state.receiptCount;
    reason.value = state.reason;
    accountant.value = state.accountant;
    president.value = state.president;
  }

  function compactPerson(value, fallback) {
    var compact = String(value == null ? "" : value).replace(/\s+/g, "");
    return compact || fallback;
  }

  function loadStampOverrides() {
    try {
      var parsed = JSON.parse(localStorage.getItem("budget-crafting-stamps") || "{}");
      if (parsed.accountant) stampOverride.accountant = dataUrlToBuffer(parsed.accountant);
      if (parsed.president) stampOverride.president = dataUrlToBuffer(parsed.president);
    } catch (err) {
      stampOverride.accountant = null;
      stampOverride.president = null;
    }
    renderStampImages();
  }

  function saveStampOverrides() {
    var payload = {};
    if (stampOverride.accountant) payload.accountant = bufferToDataUrl(stampOverride.accountant);
    if (stampOverride.president) payload.president = bufferToDataUrl(stampOverride.president);
    localStorage.setItem("budget-crafting-stamps", JSON.stringify(payload));
  }

  function readStampFile(file, role) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      stampOverride[role] = reader.result;
      saveStampOverrides();
      renderStampImages();
      updateComputed();
      setStatus((role === "accountant" ? "회계담당" : "학생회장") + " 도장을 이 브라우저에 저장했습니다.");
    };
    reader.readAsArrayBuffer(file);
  }

  function clearStampOverride(role) {
    stampOverride[role] = null;
    saveStampOverrides();
    refreshRootStamps();
    setStatus((role === "accountant" ? "회계담당" : "학생회장") + " 도장을 루트 파일로 되돌렸습니다.");
  }

  async function refreshRootStamps() {
    if (!stampOverride.accountant) rootStamp.accountant = await loadStampFile("회계담당.png");
    if (!stampOverride.president) rootStamp.president = await loadStampFile("학생회장.png");
    renderStampImages();
    updateComputed();
  }

  async function loadStampFile(url) {
    try {
      var res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch (err) {
      return null;
    }
  }

  function renderStampImages() {
    accountantImg.src = stampSrc("accountant");
    presidentImg.src = stampSrc("president");
    document.querySelector("#accountantStampReset").hidden = !stampOverride.accountant;
    document.querySelector("#presidentStampReset").hidden = !stampOverride.president;
  }

  function stampSrc(role) {
    var buffer = stampOverride[role] || rootStamp[role];
    if (buffer) return bufferToDataUrl(buffer);
    return role === "accountant" ? "회계담당.png" : "학생회장.png";
  }

  function bufferToDataUrl(buffer) {
    var bytes = new Uint8Array(buffer);
    var parts = [];
    var size = 0x8000;
    for (var i = 0; i < bytes.length; i += size) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + size)));
    }
    return "data:image/png;base64," + btoa(parts.join(""));
  }

  function dataUrlToBuffer(url) {
    var comma = String(url).indexOf(",");
    var b64 = comma >= 0 ? String(url).slice(comma + 1) : String(url);
    return base64ToBuffer(b64);
  }

  function lastUnit() {
    for (var i = state.items.length - 1; i >= 0; i--) {
      if (!state.items[i].fee) return state.items[i].unit || "EA";
    }
    return "EA";
  }

  function renderItems() {
    itemsBox.innerHTML = state.items
      .map(function (item, index) {
        return (
          '<div class="item" data-index="' +
          index +
          '">' +
          '<span class="idx">' +
          (index + 1) +
          "</span>" +
          field("품목", "name", item.name, "text", "얼음") +
          field("단가", "price", item.price, "text", "0") +
          field("수량", "qty", item.qty, "text", "1") +
          field("단위", "unit", item.unit, "text", "EA") +
          '<div class="line"><span>합계</span><strong data-line>0</strong></div>' +
          '<button type="button" class="ghost remove" data-action="remove">삭제</button>' +
          "</div>"
        );
      })
      .join("");
    feeToggle.checked = feeIndex() >= 0;
    var prices = itemsBox.querySelectorAll('[data-field="price"]');
    for (var i = 0; i < prices.length; i++) prices[i].inputMode = "numeric";
    var qtys = itemsBox.querySelectorAll('[data-field="qty"]');
    for (var q = 0; q < qtys.length; q++) qtys[q].inputMode = "decimal";
  }

  function field(label, name, value, type, placeholder) {
    return (
      '<label class="field">' +
      "<span>" +
      label +
      "</span>" +
      '<input data-field="' +
      name +
      '" type="' +
      type +
      '" value="' +
      escapeAttr(value) +
      '" placeholder="' +
      placeholder +
      '">' +
      "</label>"
    );
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function onItemInput(event) {
    var input = event.target.closest("[data-field]");
    if (!input) return;
    var row = input.closest(".item");
    var index = Number(row.dataset.index);
    state.items[index][input.dataset.field] = input.value;
    updateComputed();
    save();
  }

  function onItemBlur(event) {
    var input = event.target.closest('[data-field="price"]');
    if (!input) return;
    var digits = input.value.replace(/[^\d]/g, "");
    if (!digits) return;
    input.value = H.formatNumber(digits);
    var index = Number(input.closest(".item").dataset.index);
    state.items[index].price = input.value;
    updateComputed();
    save();
  }

  function onItemKey(event) {
    if (event.key !== "Enter" || event.target.dataset.field !== "name") return;
    var row = event.target.closest(".item");
    var index = Number(row.dataset.index);
    if (state.items[index].fee) return;
    var lastProduct = state.items.length - 1;
    if (state.items[lastProduct].fee) lastProduct -= 1;
    if (index !== lastProduct) return;
    event.preventDefault();
    var at = index + 1;
    state.items.splice(at, 0, blankItem(state.items[index].unit));
    renderItems();
    updateComputed();
    save();
    focusName(at);
  }

  function onItemClick(event) {
    var button = event.target.closest("[data-action='remove']");
    if (!button) return;
    var index = Number(button.closest(".item").dataset.index);
    if (state.items.length === 1) {
      state.items[0] = blankItem(state.items[0].unit);
    } else {
      state.items.splice(index, 1);
    }
    renderItems();
    updateComputed();
    save();
  }

  function focusName(index) {
    var row = itemsBox.querySelector('.item[data-index="' + index + '"]');
    if (!row) return;
    var input = row.querySelector('[data-field="name"]');
    if (input) input.focus();
  }

  function updateComputed() {
    var summary = H.summarize(state);
    var rows = itemsBox.querySelectorAll(".item");
    rows.forEach(function (row) {
      var index = Number(row.dataset.index);
      var source = state.items[index];
      var line = row.querySelector("[data-line]");
      var normalized = null;
      try {
        normalized = H.summarize({ items: [source] }).items[0] || null;
      } catch (err) {
        normalized = null;
      }
      line.textContent = normalized ? H.formatNumber(normalized.line) : "0";
    });
    totalMoney.textContent = summary.money + "원";
    totalKorean.textContent = "일금 " + (summary.korean || "영") + " 원정";
    errorEl.textContent = summary.error || "";
    renderPreview(summary);
    saveBtn.disabled = !templateBuffer || !!summary.error || summary.items.length === 0;
  }

  function renderPreview(summary) {
    var expect = safeDate(state.expectDate);
    var written = safeDate(state.writeDate);
    var timingLabel =
      state.timing === "before"
        ? "사전집행 ( O ) , 사후집행 ( &nbsp;&nbsp; )"
        : "사전집행 ( &nbsp;&nbsp; ) , 사후집행 ( O )";
    var body = summary.items
      .map(function (item) {
        var qty = Number.isInteger(item.qty) ? String(item.qty) : String(item.qty);
        return (
          "<tr><td>" +
          escapeHtml(item.name) +
          "</td><td class=\"num\">" +
          H.formatNumber(item.price) +
          "</td><td class=\"num\">" +
          escapeHtml(qty + (item.unit || "")) +
          "</td><td class=\"num sum\">" +
          H.formatNumber(item.line) +
          "</td></tr>"
        );
      })
      .join("");
    if (!body) {
      body = '<tr><td class="muted" colspan="4">품목을 입력하면 여기에 표시됩니다.</td></tr>';
    }
    preview.innerHTML =
      '<article class="paper">' +
      '<header class="paper-head">' +
      "<div><b>철도시스템<br>학부</b></div>" +
      "<h2>학회비 지출 신청서</h2>" +
      '<div class="signs"><span>조교</span><span>취업<br>주임교수</span><span>학부장</span></div>' +
      "</header>" +
      '<p class="amount">금액 : 일 금 <strong>' +
      escapeHtml(summary.korean || "영") +
      "</strong> 원정 ( " +
      escapeHtml(summary.money) +
      "₩ )</p>" +
      "<p>위 금액을 다음과 같은 사유로 지출하고자 합니다.</p>" +
      '<p class="timing">' +
      timingLabel +
      "</p>" +
      '<table class="reason"><tr><th>지출 사유</th><td>' +
      escapeHtml(state.reason || H.DEFAULTS.reason) +
      "</td></tr>" +
      "<tr><th>지출 내역</th><td>" +
      '<table class="lines"><thead><tr><th>품목</th><th>단가</th><th>수량</th><th>합계</th></tr></thead><tbody>' +
      body +
      '</tbody><tfoot><tr><th colspan="3">총합</th><td class="num sum">' +
      escapeHtml(summary.money) +
      "</td></tr></tfoot></table></td></tr>" +
      "<tr><th>지출 예상 일자</th><td>" +
      escapeHtml(expect) +
      "</td></tr></table>" +
      '<p class="note">※ 지출 후 반드시 영수증 첨부</p>' +
      '<p class="date-line">' +
      escapeHtml(written) +
      "</p>" +
      '<p class="who">신청자&nbsp;&nbsp;회계담당&nbsp;&nbsp;' +
      escapeHtml(compactPerson(state.accountant, H.DEFAULTS.accountant)) +
      '&nbsp;&nbsp;(인)<img alt="" src="' +
      stampSrc("accountant") +
      '"></p>' +
      '<p class="who">학생회장&nbsp;&nbsp;' +
      escapeHtml(compactPerson(state.president, H.DEFAULTS.president)) +
      '&nbsp;&nbsp;(인)<img alt="" src="' +
      stampSrc("president") +
      '"></p>' +
      '<table class="slip"><tr><th>지출항목</th><td>' +
      escapeHtml(state.subject || H.DEFAULTS.subject) +
      '</td></tr><tr><th>지출금액</th><td>\\ ' +
      escapeHtml(summary.money) +
      "원 (일금 " +
      escapeHtml(summary.korean || "영") +
      ' 원정)</td></tr><tr><th>영수증</th><td>' +
      escapeHtml(String(Math.max(1, Math.round(Number(state.receiptCount) || 1))) + "매") +
      "&nbsp;&nbsp;책임자 " +
      escapeHtml(compactPerson(state.accountant, H.DEFAULTS.accountant)) +
      " (인)</td></tr></table>" +
      "</article>";
  }

  function safeDate(iso) {
    try {
      return H.formatKoreanDate(iso);
    } catch (err) {
      return "";
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function loadTemplate() {
    try {
      var res = await fetch("template/form.hwpx");
      if (!res.ok) throw new Error(String(res.status));
      templateBuffer = await res.arrayBuffer();
      setStatus("");
    } catch (err) {
      if (window.FORM_HWPX_BASE64) {
        templateBuffer = base64ToBuffer(window.FORM_HWPX_BASE64);
        setStatus("");
      } else {
        templateBuffer = null;
        setStatus("서식을 불러오지 못했습니다.");
      }
    }
    updateComputed();
  }

  function base64ToBuffer(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function saveHwpx() {
    errorEl.textContent = "";
    if (!templateBuffer) {
      errorEl.textContent = "서식 파일이 없습니다.";
      return;
    }
    var summary = H.summarize(state);
    if (summary.error || !summary.items.length) {
      errorEl.textContent = summary.error || "품목을 한 줄 이상 입력해 주세요.";
      return;
    }
    saveBtn.disabled = true;
    try {
      var blob = await H.buildHwpx(templateBuffer, state, {
        images: {
          accountant: stampOverride.accountant || (await loadStampFile("회계담당.png")) || rootStamp.accountant,
          president: stampOverride.president || (await loadStampFile("학생회장.png")) || rootStamp.president,
        },
      });
      var name = "학회비지출신청서_" + (state.writeDate || today()) + ".hwpx";
      var link = document.createElement("a");
      var url = URL.createObjectURL(blob);
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      setStatus(name + " 을 저장했습니다. 한글에서 열어 확인한 뒤, 필요하면 HWP로 다시 저장하세요.");
    } catch (err) {
      errorEl.textContent = err.message || String(err);
    } finally {
      updateComputed();
    }
  }
})();
