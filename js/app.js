// 生徒さん用ページ
(function () {
  const params = new URLSearchParams(location.search);
  const studentId = params.get("s") || "caspar-k7x2"; // デモ用デフォルト
  const student = Store.getStudent(studentId);

  const gate = document.getElementById("gate");
  const main = document.getElementById("main");

  if (!student) {
    document.body.innerHTML = '<div class="gate"><h2>ページが見つかりません 🥲</h2><p>リンクをもう一度確認してください。</p></div>';
    return;
  }

  // ---- パスコードゲート ----
  const authKey = "auth-" + studentId;
  function showMain() {
    gate.classList.add("hidden");
    main.classList.remove("hidden");
    document.getElementById("student-name").textContent = "🌷 " + student.name;
    renderAll();
  }
  if (sessionStorage.getItem(authKey) === "ok") {
    showMain();
  } else {
    gate.classList.remove("hidden");
    const input = document.getElementById("passcode-input");
    const tryEnter = () => {
      if (Store.checkPasscode(studentId, input.value)) {
        sessionStorage.setItem(authKey, "ok");
        showMain();
      } else {
        document.getElementById("gate-error").textContent = "パスコードがちがいます 🥲";
        input.value = "";
      }
    };
    document.getElementById("passcode-btn").addEventListener("click", tryEnter);
    input.addEventListener("keydown", e => { if (e.key === "Enter") tryEnter(); });
  }

  // ---- タブ切替 ----
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById("tab-" + tab.dataset.tab).classList.remove("hidden");
    });
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // 「漢字（かんじ）」形式を、漢字の上にふりがなが乗る表示（ルビ）に変換する
  function ruby(s) {
    return esc(s).replace(
      /([一-鿿々ヶ〆]+)（([ぁ-んァ-ヶー]+)）/g,
      "<ruby>$1<rt>$2</rt></ruby>"
    );
  }
  function fmtDate(d) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${y}年${Number(m)}月${Number(day)}日`;
  }

  // ---- クラスまとめ（日付一覧 → タップで開閉） ----
  function renderLessons() {
    const lessons = Store.getLessons(studentId);
    const el = document.getElementById("tab-lessons");
    if (!lessons.length) { el.innerHTML = '<div class="empty-note">まだレッスン記録がありません 🌱</div>'; return; }
    el.innerHTML = lessons.map((l, i) => `
      <div class="lesson-acc">
        <button class="lesson-acc-head" type="button">
          <span class="acc-date">📖 ${fmtDate(l.date)}</span>
          <span class="acc-num">レッスン${l.number}回目</span>
          ${i === 0 ? '<span class="acc-new">NEW</span>' : ""}
          <span class="acc-arrow">▾</span>
        </button>
        <div class="lesson-acc-body hidden">
          <div class="lesson-section">
            <div class="label">✏️ 今日勉強したこと <span class="label-en">What we studied</span></div>
            <p class="lesson-text">${ruby(l.studied)}</p>
          </div>
          ${l.points && l.points.length ? `
          <div class="lesson-section">
            <div class="label">💡 今日のポイント <span class="label-en">Key points</span></div>
            <ul>${l.points.map(p => `<li>${ruby(p)}</li>`).join("")}</ul>
          </div>` : ""}
          ${l.newPhrases && l.newPhrases.length ? `
          <div class="lesson-section">
            <div class="label">💬 新しいフレーズ <span class="label-en">New phrases</span></div>
            <ul>${l.newPhrases.map(p => `<li>${ruby(p)}</li>`).join("")}</ul>
          </div>` : ""}
          ${l.goodPoints && l.goodPoints.length ? `
          <div class="lesson-section">
            <div class="label">🌟 よかったところ <span class="label-en">Good job!</span></div>
            <ul>${l.goodPoints.map(p => `<li class="good">${ruby(p)}</li>`).join("")}</ul>
          </div>` : ""}
          ${l.mistakes && l.mistakes.length ? `
          <div class="lesson-section">
            <div class="label">✍️ なおしたところ <span class="label-en">Mistake details</span></div>
            ${l.mistakes.map(m => `
            <div class="mistake">
              <div class="mistake-row">
                <span class="m-said">${ruby(m.said)}</span>
                <span class="m-arrow">→</span>
                <span class="m-fixed">${ruby(m.corrected)}</span>
              </div>
              ${m.why ? `<div class="m-why">${ruby(m.why)}</div>` : ""}
              <div class="m-meta">
                ${m.category ? `<span class="m-cat">${esc(m.category)}</span>` : ""}
                ${m.count && m.count > 1 ? `<span class="m-count">×${m.count} このミス${m.count}回目！</span>` : ""}
              </div>
            </div>`).join("")}
          </div>` : ""}
          ${l.reviewPoints && l.reviewPoints.length ? `
          <div class="lesson-section">
            <div class="label">🔁 もう一度チェック <span class="label-en">Let's review</span></div>
            <ul>${l.reviewPoints.map(p => `<li class="review">${ruby(p)}</li>`).join("")}</ul>
          </div>` : ""}
        </div>
      </div>
    `).join("");
    el.querySelectorAll(".lesson-acc-head").forEach(head => {
      head.addEventListener("click", () => {
        head.parentElement.classList.toggle("open");
        head.nextElementSibling.classList.toggle("hidden");
      });
    });
  }

  // ---- 単語帳 ----
  function renderVocab() {
    const search = document.getElementById("vocab-search").value.trim().toLowerCase();
    const filter = document.getElementById("vocab-filter").value;
    let vocab = Store.getVocab(studentId);
    const total = vocab.length;
    const checkedCount = vocab.filter(v => v.checked).length;

    if (search) {
      vocab = vocab.filter(v =>
        v.word.toLowerCase().includes(search) ||
        v.meaning.toLowerCase().includes(search) ||
        (v.example || "").toLowerCase().includes(search));
    }
    if (filter) vocab = vocab.filter(v => v.pos === filter);

    document.getElementById("vocab-stats").textContent =
      `おぼえた: ${checkedCount} / ${total}  🌟  ひょうじ中: ${vocab.length}`;

    const list = document.getElementById("vocab-list");
    if (!vocab.length) { list.innerHTML = '<div class="empty-note">みつかりませんでした 🔍</div>'; return; }
    list.innerHTML = vocab.map(v => `
      <div class="vocab-item" data-id="${esc(v.id)}">
        <div class="row1">
          <input type="checkbox" class="vocab-check" ${v.checked ? "checked" : ""}>
          <span class="word">${ruby(v.word)}</span>
          <span class="pos pos-${esc(v.pos)}">${esc(v.pos)}</span>
          <span class="meaning">${esc(v.meaning)}</span>
        </div>
        <div class="example">💡 ${ruby(v.example || "")}</div>
      </div>
    `).join("");

    list.querySelectorAll(".vocab-item").forEach(item => {
      item.addEventListener("click", e => {
        if (e.target.classList.contains("vocab-check")) return;
        item.classList.toggle("open");
      });
      item.querySelector(".vocab-check").addEventListener("change", e => {
        Store.setVocabChecked(studentId, item.dataset.id, e.target.checked);
        renderVocab();
      });
    });
  }
  document.getElementById("vocab-search").addEventListener("input", renderVocab);
  document.getElementById("vocab-filter").addEventListener("change", renderVocab);

  // ---- 復習モード（フラッシュカード） ----
  let reviewDeck = [], reviewIndex = 0, reviewFlipped = false;
  function renderReview() {
    const el = document.getElementById("tab-review");
    if (!reviewDeck.length) {
      el.innerHTML = `
        <div class="card" style="text-align:center">
          <h3 style="justify-content:center">🃏 フラッシュカードで復習！</h3>
          <p style="font-size:0.9rem;color:var(--text-light);margin-bottom:16px">カードをタップすると意味が見られます</p>
          <div class="review-nav">
            <button class="btn-ok" id="review-start-all">ぜんぶ復習</button>
            <button class="btn-ng" id="review-start-unchecked">まだのことばだけ</button>
          </div>
        </div>`;
      document.getElementById("review-start-all").addEventListener("click", () => startReview(false));
      document.getElementById("review-start-unchecked").addEventListener("click", () => startReview(true));
      return;
    }
    const v = reviewDeck[reviewIndex];
    el.innerHTML = `
      <div class="vocab-stats" style="text-align:center">${reviewIndex + 1} / ${reviewDeck.length}</div>
      <div class="review-card" id="review-card">
        ${reviewFlipped
          ? `<div class="big">${esc(v.meaning)}</div><div>💡 ${ruby(v.example || "")}</div><div class="hint">タップでもどる</div>`
          : `<div class="big">${ruby(v.word)}</div><span class="pos pos-${esc(v.pos)}">${esc(v.pos)}</span><div class="hint">タップで意味を見る</div>`}
      </div>
      <div class="review-nav">
        <button class="btn-ng" id="review-ng">🤔 まだ</button>
        <button class="btn-neutral" id="review-quit">おわる</button>
        <button class="btn-ok" id="review-ok">😊 おぼえた！</button>
      </div>`;
    document.getElementById("review-card").addEventListener("click", () => { reviewFlipped = !reviewFlipped; renderReview(); });
    document.getElementById("review-ok").addEventListener("click", () => {
      Store.setVocabChecked(studentId, v.id, true);
      nextReview();
    });
    document.getElementById("review-ng").addEventListener("click", () => {
      Store.setVocabChecked(studentId, v.id, false);
      nextReview();
    });
    document.getElementById("review-quit").addEventListener("click", () => { reviewDeck = []; renderReview(); renderVocab(); });
  }
  function startReview(uncheckedOnly) {
    let vocab = Store.getVocab(studentId);
    if (uncheckedOnly) vocab = vocab.filter(v => !v.checked);
    if (!vocab.length) vocab = Store.getVocab(studentId); // 全部おぼえてたら全部から
    reviewDeck = vocab.sort(() => Math.random() - 0.5);
    reviewIndex = 0;
    reviewFlipped = false;
    renderReview();
  }
  function nextReview() {
    reviewFlipped = false;
    reviewIndex++;
    if (reviewIndex >= reviewDeck.length) {
      const el = document.getElementById("tab-review");
      el.innerHTML = `
        <div class="card" style="text-align:center">
          <h3 style="justify-content:center">🎉 おつかれさまでした！</h3>
          <p style="font-size:0.9rem;margin-bottom:16px">ぜんぶのカードをみました✨</p>
          <div class="review-nav"><button class="btn-ok" id="review-again">もういちど</button></div>
        </div>`;
      document.getElementById("review-again").addEventListener("click", () => { reviewDeck = []; renderReview(); });
      renderVocab();
      return;
    }
    renderReview();
  }

  // ---- 宿題 ----
  function renderHomework() {
    const hw = Store.getHomework(studentId);
    const el = document.getElementById("tab-homework");
    if (!hw.length) { el.innerHTML = '<div class="empty-note">宿題はありません 🎉</div>'; return; }
    el.innerHTML = hw.map(lesson => `
      <div class="hw-lesson-label">📖 レッスン${lesson.number}回目（${fmtDate(lesson.date)}）</div>
      ${lesson.items.map(h => `
        <div class="hw-item ${h.done ? "done" : ""}" data-key="${esc(h.key)}">
          <input type="checkbox" ${h.done ? "checked" : ""}>
          <span class="hw-text">${ruby(h.text)}</span>
          ${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">ひらく ↗</a>` : ""}
        </div>
      `).join("")}
    `).join("");
    el.querySelectorAll(".hw-item input").forEach(cb => {
      cb.addEventListener("change", e => {
        Store.setHomeworkDone(studentId, cb.closest(".hw-item").dataset.key, e.target.checked);
        renderHomework();
      });
    });
  }

  // ---- 進捗 + Can-do ----
  function renderProgress() {
    const progress = Store.getProgress(studentId);
    const cando = Store.getCando(studentId);
    const el = document.getElementById("tab-progress");
    let html = "";

    if (progress.length) {
      html += progress.map(p => {
        const done = p.items.filter(i => i.done).length;
        const pct = Math.round(done / p.items.length * 100);
        return `
        <div class="card">
          <h3>🌱 ${esc(p.lesson)} <span class="badge">${done}/${p.items.length}</span></h3>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          ${p.items.map(i => `
            <div class="prog-item ${i.done ? "done" : ""}">
              <span>${i.done ? "✅" : "⬜️"}</span>
              <span>${ruby(i.text)}</span>
              <span class="date">${esc(i.date || "")}</span>
            </div>`).join("")}
        </div>`;
      }).join("");
    }

    if (cando.length) {
      html += cando.map(c => {
        const done = c.items.filter(i => i.done).length;
        const pct = Math.round(done / c.items.length * 100);
        return `
        <div class="card">
          <h3>💪 ${esc(c.lesson)} <span class="badge">${done}/${c.items.length}</span></h3>
          <div class="progress-bar"><div style="width:${pct}%"></div></div>
          ${c.items.map(i => `
            <div class="prog-item ${i.done ? "done" : ""}">
              <span>${i.done ? "✅" : "⬜️"}</span>
              <span class="part">${esc(i.part)}</span>
              <span>${ruby(i.text)}</span>
            </div>`).join("")}
        </div>`;
      }).join("");
    }

    el.innerHTML = html || '<div class="empty-note">まだ進捗データがありません 🌱</div>';
  }

  // ---- アプリリンク集 ----
  function renderApps() {
    const el = document.getElementById("tab-apps");
    const apps = student.apps || [];
    el.innerHTML = apps.length
      ? `<div class="app-grid">${apps.map(a =>
          `<a class="app-link" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`).join("")}</div>`
      : '<div class="empty-note">アプリはまだありません</div>';
  }

  function renderAll() {
    renderLessons();
    renderVocab();
    renderReview();
    renderHomework();
    renderProgress();
    renderApps();
  }
})();
