// なつき先生用 管理画面
(function () {
  let currentStudentId = null;

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  // 「漢字（かんじ）」を漢字の上のふりがな表示に変換（表示専用。編集フォームは括弧のまま）
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

  // ---- 生徒セレクター ----
  function renderStudentSelect() {
    const sel = document.getElementById("student-select");
    const students = Store.listStudents();
    if (!currentStudentId && students.length) currentStudentId = students[0].id;
    sel.innerHTML = students.map(s =>
      `<option value="${esc(s.id)}" ${s.id === currentStudentId ? "selected" : ""}>🌷 ${esc(s.name)}</option>`).join("");
  }
  document.getElementById("student-select").addEventListener("change", e => {
    currentStudentId = e.target.value;
    renderAll();
  });

  document.getElementById("add-student-btn").addEventListener("click", () => {
    openModal(`
      <h3>🌷 新しい生徒さん</h3>
      <div class="form-row"><label>お名前</label><input id="f-name" placeholder="例：キャスパーさん"></div>
      <div class="form-row"><label>パスコード（4〜6桁）</label><input id="f-pass" placeholder="例：1234" maxlength="6"></div>
      <div class="form-actions">
        <button class="mini-btn ghost" data-close>キャンセル</button>
        <button class="mini-btn" id="f-save">追加する</button>
      </div>`);
    document.getElementById("f-save").addEventListener("click", () => {
      const name = document.getElementById("f-name").value.trim();
      const pass = document.getElementById("f-pass").value.trim();
      if (!name || !pass) return;
      const s = Store.addStudent(name, pass);
      currentStudentId = s.id;
      closeModal();
      renderAll();
    });
  });

  // ---- モーダル ----
  const backdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("modal");
  function openModal(html) {
    modal.innerHTML = html;
    backdrop.classList.remove("hidden");
    modal.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
  }
  function closeModal() { backdrop.classList.add("hidden"); modal.innerHTML = ""; }
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });

  // ---- タブ ----
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById("tab-" + tab.dataset.tab).classList.remove("hidden");
    });
  });


  // ---- 生徒一覧ダッシュボード ----
  function renderOverview() {
    const el = document.getElementById("tab-overview");
    const students = Store.listStudents();
    if (!students.length) { el.innerHTML = '<div class="empty-note">生徒さんがいません</div>'; return; }
    const today = new Date();
    const rows = students.map(s => {
      const lessons = Store.getLessons(s.id);
      const vocab = Store.getVocab(s.id);
      const hw = Store.getHomework(s.id).flatMap(h => h.items);
      const lastLesson = lessons[0] ? lessons[0].date : null;
      const days = lastLesson ? Math.floor((today - new Date(lastLesson)) / 86400000) : null;
      const hwDone = hw.length ? Math.round(hw.filter(i => i.done).length / hw.length * 100) : null;
      const vocabDone = vocab.length ? Math.round(vocab.filter(v => v.checked).length / vocab.length * 100) : null;
      const lastReview = vocab.map(v => v.lastReview || "").sort().reverse()[0] || null;
      return { s, lessons: lessons.length, lastLesson, days, hwDone, vocab: vocab.length, vocabDone, lastReview };
    }).sort((a, b) => (a.lastLesson || "") < (b.lastLesson || "") ? 1 : -1);

    el.innerHTML = `
      <div class="card">
        <h3>👥 生徒さん一覧 <span class="badge">${students.length}人</span></h3>
        <div class="ov-scroll">
        <table class="ov-table">
          <thead><tr>
            <th>生徒さん</th><th>最終レッスン</th><th>回数</th><th>宿題</th><th>単語</th><th>最後の復習</th><th>言語</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
            <tr class="ov-row" data-sid="${esc(r.s.id)}">
              <td class="ov-name">🌷 ${esc(r.s.name)}</td>
              <td>${r.lastLesson ? fmtDate(r.lastLesson) : "—"}${r.days !== null && r.days >= 10 ? ' <span class="ov-warn">' + r.days + '日前</span>' : ""}</td>
              <td>${r.lessons}回</td>
              <td>${r.hwDone === null ? "—" : `<span class="${r.hwDone < 50 ? "ov-warn" : ""}">${r.hwDone}%</span>`}</td>
              <td>${r.vocab}語${r.vocabDone !== null ? `（${r.vocabDone}%✓）` : ""}</td>
              <td>${r.lastReview ? fmtDate(r.lastReview) : "—"}</td>
              <td>${r.s.language === "ja" ? "🇯🇵" : "🌍"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        </div>
        <p class="cat-note">行をクリックすると、その生徒さんの管理ページに移動します</p>
      </div>`;
    el.querySelectorAll(".ov-row").forEach(row => row.addEventListener("click", () => {
      currentStudentId = row.dataset.sid;
      renderStudentSelect();
      renderAll();
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelector('[data-tab="info"]').classList.add("active");
      document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      document.getElementById("tab-info").classList.remove("hidden");
    }));
  }

  // ---- 生徒情報 ----
  function renderInfo() {
    const s = Store.getStudent(currentStudentId);
    const el = document.getElementById("tab-info");
    if (!s) { el.innerHTML = '<div class="empty-note">生徒さんを選んでください</div>'; return; }
    const shareUrl = location.origin + location.pathname.replace("admin.html", "index.html") + "?s=" + s.id;
    el.innerHTML = `
      <div class="card">
        <h3>🌷 ${esc(s.name)}</h3>
        <div class="form-row"><label>お名前</label><input id="info-name" value="${esc(s.name)}"></div>
        <div class="form-row"><label>パスコード</label><input id="info-pass" value="${esc(s.passcode)}" maxlength="6"></div>
        <div class="form-row"><label>教科書</label><input id="info-book" value="${esc(s.textbook || "")}" placeholder="例：げんき2"></div>
        <div class="form-row">
          <label>まとめの言語（ビデオ分析のときに使います）</label>
          <select id="info-lang">
            <option value="en" ${(s.language || "en") === "en" ? "selected" : ""}>🌍 英語ベース（説明は英語＋日本語の例文）</option>
            <option value="ja" ${s.language === "ja" ? "selected" : ""}>🇯🇵 日本語（漢字が読める生徒さん向け）</option>
          </select>
        </div>
        <div class="form-actions"><button class="mini-btn" id="info-save">保存する 💾</button></div>
      </div>
      <div class="card">
        <h3>🔗 生徒さんに送るリンク</h3>
        <p style="font-size:0.85rem;color:var(--text-light)">このリンクとパスコードを生徒さんに教えてあげてください</p>
        <div class="share-box" id="share-url">${esc(shareUrl)}</div>
        <div class="form-actions">
          <button class="mini-btn ghost" id="copy-link">リンクをコピー 📋</button>
          <a class="mini-btn" href="${esc(shareUrl)}" target="_blank" rel="noopener" style="text-decoration:none">開いてみる ↗</a>
        </div>
      </div>`;
    document.getElementById("info-save").addEventListener("click", () => {
      s.name = document.getElementById("info-name").value.trim() || s.name;
      s.passcode = document.getElementById("info-pass").value.trim() || s.passcode;
      s.textbook = document.getElementById("info-book").value.trim();
      s.language = document.getElementById("info-lang").value;
      Store.saveStudent(s);
      renderStudentSelect();
      renderInfo();
    });
    document.getElementById("copy-link").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        e.target.textContent = "コピーしました ✅";
        setTimeout(() => { e.target.textContent = "リンクをコピー 📋"; }, 1500);
      } catch {}
    });
  }

  // ---- レッスン ----
  function lessonForm(lesson) {
    const l = lesson || { date: new Date().toISOString().slice(0, 10), number: "", studied: "", points: [], newPhrases: [], goodPoints: [], reviewPoints: [], mistakes: [], canNow: [], focusNext: [], note: "", homework: [] };
    const hwText = (l.homework || []).map(h => h.url ? `${h.text} | ${h.url}` : h.text).join("\n");
    openModal(`
      <h3>${lesson ? "📖 レッスンを編集" : "📖 新しいレッスン記録"}</h3>
      <div class="form-row"><label>日付</label><input id="f-date" type="date" value="${esc(l.date)}"></div>
      <div class="form-row"><label>レッスン回数</label><input id="f-number" type="number" value="${esc(l.number)}" placeholder="例：5"></div>
      <div class="form-row"><label>✏️ 今日勉強したこと</label><textarea id="f-studied" rows="2">${esc(l.studied)}</textarea></div>
      <div class="form-row"><label>💡 今日のポイント（1行に1つ）</label><textarea id="f-points" rows="2">${esc((l.points || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>💬 新しいフレーズ（1行に1つ）</label><textarea id="f-phrases" rows="2">${esc((l.newPhrases || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>🌟 よかったところ（1行に1つ）</label><textarea id="f-good" rows="2">${esc((l.goodPoints || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>🔁 もう一度チェック（1行に1つ）</label><textarea id="f-review" rows="2">${esc((l.reviewPoints || []).join("\n"))}</textarea></div>
      <div class="form-row">
        <label>✍️ ミス（1行に1つ：言った | 直した | 理由 | カテゴリ）</label>
        <textarea id="f-mistakes" rows="3">${esc((l.mistakes || []).map(m => [m.said, m.corrected, m.why || "", m.category || ""].join(" | ")).join("\n"))}</textarea>
        <div class="note">カテゴリは 助詞 / 活用 / 語彙 / 語順 / 発音 / その他</div>
      </div>
      <div class="form-row"><label>✨ できるようになったこと（1行に1つ）</label><textarea id="f-cannow" rows="2">${esc((l.canNow || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>🎯 つぎの目標（1行に1つ）</label><textarea id="f-focus" rows="2">${esc((l.focusNext || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>🌸 先生からのメッセージ</label><textarea id="f-note" rows="2">${esc(l.note || "")}</textarea></div>
      <div class="form-row">
        <label>📝 宿題（1行に1つ）</label>
        <textarea id="f-hw" rows="3">${esc(hwText)}</textarea>
        <div class="note">リンク付きにするには「宿題の名前 | https://...」のように | で区切ってください</div>
      </div>
      <div class="form-actions">
        <button class="mini-btn ghost" data-close>キャンセル</button>
        <button class="mini-btn" id="f-save">保存する 💾</button>
      </div>`);
    document.getElementById("f-save").addEventListener("click", () => {
      const lines = id => document.getElementById(id).value.split("\n").map(s => s.trim()).filter(Boolean);
      const hw = lines("f-hw").map(line => {
        const [text, url] = line.split("|").map(s => s.trim());
        const item = { text, done: false };
        if (url) item.url = url;
        // 既存の done 状態を維持
        const old = (l.homework || []).find(h => h.text === text);
        if (old) item.done = old.done;
        return item;
      });
      const saved = {
        ...l,
        studentId: currentStudentId,
        date: document.getElementById("f-date").value,
        number: Number(document.getElementById("f-number").value) || "",
        studied: document.getElementById("f-studied").value.trim(),
        points: lines("f-points"),
        newPhrases: lines("f-phrases"),
        goodPoints: lines("f-good"),
        reviewPoints: lines("f-review"),
        canNow: lines("f-cannow"),
        focusNext: lines("f-focus"),
        note: document.getElementById("f-note").value.trim(),
        mistakes: lines("f-mistakes").map(line => {
          const [said, corrected, why, category] = line.split("|").map(x => x.trim());
          const m = { said: said || "", corrected: corrected || "" };
          if (why) m.why = why;
          if (category) m.category = category;
          const old = (l.mistakes || []).find(o => o.said === m.said);
          if (old && old.count) m.count = old.count;
          return m;
        }).filter(m => m.said && m.corrected),
        homework: hw
      };
      Store.saveLesson(saved);
      closeModal();
      renderLessons();
    });
  }

  function renderLessons() {
    const lessons = Store.getLessons(currentStudentId);
    const el = document.getElementById("tab-lessons");
    el.innerHTML = `
      <div class="form-actions" style="justify-content:flex-start;margin:0 0 12px">
        <button class="mini-btn" id="add-lesson">＋ 新しいレッスン記録</button>
      </div>
      ${lessons.length ? lessons.map(l => `
        <div class="list-row">
          <div class="grow">
            <div>📖 レッスン${esc(l.number)}回目 <span class="sub">${fmtDate(l.date)}</span></div>
            <div class="sub">${ruby((l.studied || "").slice(0, 40))}${(l.studied || "").length > 40 ? "…" : ""}</div>
          </div>
          <button class="icon-btn" data-edit="${esc(l.id)}" title="編集">✏️</button>
          <button class="icon-btn" data-del="${esc(l.id)}" title="削除">🗑️</button>
        </div>`).join("") : '<div class="empty-note">まだレッスン記録がありません</div>'}`;
    document.getElementById("add-lesson").addEventListener("click", () => lessonForm(null));
    el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
      const lesson = lessons.find(l => l.id === b.dataset.edit);
      lessonForm(JSON.parse(JSON.stringify(lesson)));
    }));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
      const lesson = lessons.find(l => l.id === b.dataset.del);
      openModal(`
        <h3>🗑️ 削除しますか？</h3>
        <p style="font-size:0.9rem">レッスン${esc(lesson.number)}回目（${fmtDate(lesson.date)}）の記録を削除します。もとに戻せません。</p>
        <div class="form-actions">
          <button class="mini-btn ghost" data-close>キャンセル</button>
          <button class="mini-btn danger" id="f-del">削除する</button>
        </div>`);
      document.getElementById("f-del").addEventListener("click", () => {
        Store.deleteLesson(lesson.id);
        closeModal();
        renderLessons();
      });
    }));
  }

  // ---- 単語帳 ----
  function vocabForm(vocab) {
    const v = vocab || { word: "", pos: "noun", example: "", meaning: "", learned: new Date().toISOString().slice(0, 10), studyCount: 0, checked: false };
    openModal(`
      <h3>${vocab ? "📚 単語を編集" : "📚 新しい単語"}</h3>
      <div class="form-row"><label>ことば（日本語）</label><input id="f-word" value="${esc(v.word)}"></div>
      <div class="form-row"><label>品詞</label>
        <select id="f-pos">
          ${["noun", "verb", "i-adjective", "na-adjective", "adverb", "particle"].map(p =>
            `<option value="${p}" ${v.pos === p ? "selected" : ""}>${p}</option>`).join("")}
        </select>
      </div>
      <div class="form-row"><label>例文</label><textarea id="f-example" rows="2">${esc(v.example)}</textarea></div>
      <div class="form-row"><label>意味（英語）</label><input id="f-meaning" value="${esc(v.meaning)}"></div>
      <div class="form-row"><label>習った日</label><input id="f-learned" type="date" value="${esc(v.learned)}"></div>
      <div class="form-actions">
        <button class="mini-btn ghost" data-close>キャンセル</button>
        <button class="mini-btn" id="f-save">保存する 💾</button>
      </div>`);
    document.getElementById("f-save").addEventListener("click", () => {
      const saved = {
        ...v,
        studentId: currentStudentId,
        word: document.getElementById("f-word").value.trim(),
        pos: document.getElementById("f-pos").value,
        example: document.getElementById("f-example").value.trim(),
        meaning: document.getElementById("f-meaning").value.trim(),
        learned: document.getElementById("f-learned").value
      };
      if (!saved.word) return;
      Store.saveVocab(saved);
      closeModal();
      renderVocabAdmin();
    });
  }

  function renderVocabAdmin() {
    const vocab = Store.getVocab(currentStudentId).slice().reverse(); // 新しい順
    const el = document.getElementById("tab-vocab");
    el.innerHTML = `
      <div class="form-actions" style="justify-content:flex-start;margin:0 0 12px">
        <button class="mini-btn" id="add-vocab">＋ 新しい単語</button>
        <span class="sub" style="align-self:center;font-size:0.8rem;color:var(--text-light)">全 ${vocab.length} 語</span>
      </div>
      ${vocab.length ? vocab.map(v => `
        <div class="list-row vocab-admin-row">
          <div class="grow">
            <span class="word">${ruby(v.word)}</span>
            <span class="pos pos-${esc(v.pos)}">${esc(v.pos)}</span>
            <span class="sub"> ${esc(v.meaning)}</span>
            <div class="sub">💡 ${ruby(v.example || "")}</div>
          </div>
          <button class="icon-btn" data-edit="${esc(v.id)}" title="編集">✏️</button>
          <button class="icon-btn" data-del="${esc(v.id)}" title="削除">🗑️</button>
        </div>`).join("") : '<div class="empty-note">まだ単語がありません</div>'}`;
    document.getElementById("add-vocab").addEventListener("click", () => vocabForm(null));
    el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
      const v = vocab.find(v => v.id === b.dataset.edit);
      vocabForm(JSON.parse(JSON.stringify(v)));
    }));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
      const v = vocab.find(v => v.id === b.dataset.del);
      openModal(`
        <h3>🗑️ 「${esc(v.word)}」を削除しますか？</h3>
        <div class="form-actions">
          <button class="mini-btn ghost" data-close>キャンセル</button>
          <button class="mini-btn danger" id="f-del">削除する</button>
        </div>`);
      document.getElementById("f-del").addEventListener("click", () => {
        Store.deleteVocab(v.id);
        closeModal();
        renderVocabAdmin();
      });
    }));
  }

  // ---- 進捗 / Can-do（チェックの切り替え） ----
  function renderProgressAdmin() {
    const progress = Store.getProgress(currentStudentId);
    const cando = Store.getCando(currentStudentId);
    const el = document.getElementById("tab-progress");
    let html = "";

    if (progress.length) {
      html += progress.map(p => `
        <div class="card">
          <h3>🌱 ${esc(p.lesson)}</h3>
          ${p.items.map((i, idx) => `
            <div class="prog-item ${i.done ? "done" : ""}">
              <input type="checkbox" data-kind="progress" data-lesson="${esc(p.lesson)}" data-idx="${idx}" ${i.done ? "checked" : ""}>
              <span>${ruby(i.text)}</span>
              <span class="date">${esc(i.date || "")}</span>
            </div>`).join("")}
        </div>`).join("");
    }
    if (cando.length) {
      html += cando.map(c => `
        <div class="card">
          <h3>💪 ${esc(c.lesson)}</h3>
          ${c.items.map((i, idx) => `
            <div class="prog-item ${i.done ? "done" : ""}">
              <input type="checkbox" data-kind="cando" data-lesson="${esc(c.lesson)}" data-idx="${idx}" ${i.done ? "checked" : ""}>
              <span class="part">${esc(i.part)}</span>
              <span>${ruby(i.text)}</span>
            </div>`).join("")}
        </div>`).join("");
    }
    el.innerHTML = html || '<div class="empty-note">まだ進捗データがありません</div>';
    el.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const { kind, lesson, idx } = cb.dataset;
        if (kind === "progress") Store.setProgressDone(currentStudentId, lesson, Number(idx), cb.checked);
        else Store.setCandoDone(currentStudentId, lesson, Number(idx), cb.checked);
        renderProgressAdmin();
      });
    });
  }

  // ---- 文法ノート ----
  // 「[短形 / short form] と思います」→ [{type:"slot",label}, {type:"fixed",text}]
  function parsePattern(src) {
    return String(src).split(/(\[[^\]]*\])/).map(x => x.trim()).filter(Boolean).map(x =>
      x.startsWith("[") ? { type: "slot", label: x.slice(1, -1).trim() } : { type: "fixed", text: x });
  }
  function patternToText(pattern) {
    return (pattern || []).map(p => p.type === "slot" ? `[${p.label || ""}]` : p.text).join(" ");
  }
  function patternView(t, values) {
    let i = 0;
    return (t.pattern || []).map(p => {
      if (p.type !== "slot") return `<span class="gp-fixed">${ruby(p.text)}</span>`;
      const v = values ? values[i++] : null;
      return values
        ? `<span class="ga-ans ${v ? "" : "empty"}">${esc(v || "（空）")}</span>`
        : `<span class="gp-slot">${esc(p.label)}</span>`;
    }).join("");
  }
  const SAMPLE_8_3 = {
    id: "genki-8-3", textbook: "げんき", lesson: "8-3", title: "〜と思います",
    pattern: [{ type: "slot", label: "短形 / short form" }, { type: "fixed", text: "と思います" }],
    explanation: {
      ja: "自分の意見や予想を言うときに使います。「と思います」の前は、いつも短形（普通形）です。「〜じゃないと思います」のように、否定は前の部分に入れるのが自然です。",
      en: "Use this to say what you think or guess. The part before と思います is always in short form. To say \"I don't think...\", put the negative in the short form part: 〜ないと思います."
    },
    slotHint: {
      ja: "動詞（行く・行かない）、い形容詞（高い・高くない）、な形容詞＋だ（好きだ・好きじゃない）、名詞＋だ（学生だ・学生じゃない）",
      en: "Verb (行く / 行かない), い-adjective (高い / 高くない), な-adjective + だ (好きだ / 好きじゃない), noun + だ (学生だ / 学生じゃない)"
    },
    examples: [
      "明日（あした）は雨（あめ）が降（ふ）ると思います。",
      "この映画（えいが）はおもしろいと思います。",
      "たけしさんはメアリーさんが好きだと思います。",
      "山下先生（やましたせんせい）は今日（きょう）来（こ）ないと思います。"
    ],
    count: 5
  };

  function templateForm(t) {
    const x = t || { textbook: "げんき", lesson: "", title: "", pattern: [], explanation: {}, slotHint: {}, examples: [], count: 5 };
    openModal(`
      <h3>${t ? "✏️ 型を編集" : "✏️ 新しい型"}</h3>
      <div class="form-row"><label>教科書</label><input id="g-book" value="${esc(x.textbook)}" placeholder="例：げんき"></div>
      <div class="form-row"><label>レッスン</label><input id="g-lesson" value="${esc(x.lesson)}" placeholder="例：8-3"></div>
      <div class="form-row"><label>タイトル</label><input id="g-title" value="${esc(x.title)}" placeholder="例：〜と思います"></div>
      <div class="form-row">
        <label>型</label>
        <input id="g-pattern" value="${esc(patternToText(x.pattern))}" placeholder="[短形 / short form] と思います">
        <div class="note">[ ] で囲んだところが生徒さんの書き込む箱になります。例：[Topic] は [Information] です</div>
        <div class="gp-pattern" id="g-preview" style="margin-top:8px"></div>
      </div>
      <div class="form-row"><label>💡 いつ使う？（日本語）</label><textarea id="g-exp-ja" rows="3">${esc((x.explanation || {}).ja || "")}</textarea></div>
      <div class="form-row"><label>💡 いつ使う？（英語）</label><textarea id="g-exp-en" rows="3">${esc((x.explanation || {}).en || "")}</textarea></div>
      <div class="form-row"><label>📦 箱に入るもの（日本語）</label><textarea id="g-hint-ja" rows="2">${esc((x.slotHint || {}).ja || "")}</textarea></div>
      <div class="form-row"><label>📦 箱に入るもの（英語）</label><textarea id="g-hint-en" rows="2">${esc((x.slotHint || {}).en || "")}</textarea></div>
      <div class="form-row"><label>🗒️ 例文（1行に1つ。漢字（かんじ）でふりがな）</label><textarea id="g-examples" rows="4">${esc((x.examples || []).join("\n"))}</textarea></div>
      <div class="form-row"><label>問題の数</label><input id="g-count" type="number" min="1" max="20" value="${esc(x.count || 5)}"></div>
      <div class="form-actions">
        <button class="mini-btn ghost" data-close>キャンセル</button>
        <button class="mini-btn" id="g-save">保存する 💾</button>
      </div>`);
    const preview = () => {
      document.getElementById("g-preview").innerHTML =
        patternView({ pattern: parsePattern(document.getElementById("g-pattern").value) });
    };
    document.getElementById("g-pattern").addEventListener("input", preview);
    preview();
    document.getElementById("g-save").addEventListener("click", () => {
      const pattern = parsePattern(document.getElementById("g-pattern").value);
      if (!pattern.some(p => p.type === "slot")) { alert("型に [ ] の箱を1つ以上入れてください"); return; }
      const v = id => document.getElementById(id).value.trim();
      Store.saveTemplate({
        id: t ? t.id : undefined,
        textbook: v("g-book"), lesson: v("g-lesson"), title: v("g-title"), pattern,
        explanation: { ja: v("g-exp-ja"), en: v("g-exp-en") },
        slotHint: { ja: v("g-hint-ja"), en: v("g-hint-en") },
        examples: v("g-examples").split("\n").map(s => s.trim()).filter(Boolean),
        count: Math.min(20, Math.max(1, Number(v("g-count")) || 5))
      });
      closeModal();
      renderGrammarAdmin();
    });
  }

  function renderGrammarAdmin() {
    const el = document.getElementById("tab-grammar");
    const s = Store.getStudent(currentStudentId);
    const templates = Store.listTemplates();
    const assigned = (s && s.grammar) || [];
    let html = "";

    if (s) {
      html += `
      <div class="card">
        <h3>🌷 ${esc(s.name)}さんの文法ノート</h3>
        ${templates.length ? templates.map(t => `
          <label class="ga-assign">
            <input type="checkbox" data-assign="${esc(t.id)}" ${assigned.includes(t.id) ? "checked" : ""}>
            <span>${esc(t.textbook)} ${esc(t.lesson)}　${ruby(t.title)}</span>
          </label>`).join("") : '<p class="cat-note">まず下の「型の一覧」で型を作ってください</p>'}
      </div>`;
      html += templates.filter(t => assigned.includes(t.id)).map(t => {
        const p = Store.getPractice(s.id, t.id);
        const count = t.count || 5;
        return `
        <div class="card" data-tid="${esc(t.id)}">
          <h3>✍️ ${esc(t.textbook)} ${esc(t.lesson)}　${ruby(t.title)}
            ${p.updatedAt ? `<span class="badge">最終更新 ${fmtDate(p.updatedAt.slice(0, 10))}</span>` : '<span class="badge">まだ書き込みなし</span>'}</h3>
          ${Array.from({ length: count }, (_, i) => {
            const a = ((p.answers || [])[i] || {}).s || [];
            const fb = (p.feedback || [])[i] || {};
            return `
            <div class="ga-row" data-row="${i}">
              <div class="gp-line"><span class="gp-no">${i + 1}</span>${patternView(t, a.length ? a : [""])}</div>
              <div class="ga-fb">
                <label class="ga-ok"><input type="checkbox" class="ga-ok-input" ${fb.ok ? "checked" : ""}> ✓ いいね</label>
                <input class="ga-text" value="${esc(fb.text || "")}" placeholder="コメント・直し（例：雨が降るだと → 雨が降ると）">
              </div>
            </div>`;
          }).join("")}
          <div class="form-actions"><span class="copy-ok ga-status"></span><button class="mini-btn ga-save">添削を保存 💾</button></div>
        </div>`;
      }).join("");
    }

    html += `
      <div class="card">
        <h3>📐 型の一覧 <span class="badge">${templates.length}件</span></h3>
        ${templates.map(t => `
          <div class="list-row">
            <div class="grow">
              <div>${esc(t.textbook)} ${esc(t.lesson)}　<b>${ruby(t.title)}</b></div>
              <div class="sub">${esc(patternToText(t.pattern))}</div>
            </div>
            <button class="icon-btn" data-edit="${esc(t.id)}" title="編集">✏️</button>
            <button class="icon-btn" data-del="${esc(t.id)}" title="削除">🗑️</button>
          </div>`).join("")}
        <div class="form-actions">
          ${Store.getTemplate(SAMPLE_8_3.id) ? "" : '<button class="mini-btn ghost" id="g-sample">げんき8-3 のサンプルを入れる</button>'}
          <button class="mini-btn" id="g-new">＋ 新しい型</button>
        </div>
      </div>`;
    el.innerHTML = html;

    el.querySelectorAll("[data-assign]").forEach(cb => cb.addEventListener("change", () => {
      const set = new Set(s.grammar || []);
      if (cb.checked) set.add(cb.dataset.assign); else set.delete(cb.dataset.assign);
      s.grammar = [...set];
      Store.saveStudent(s);
      renderGrammarAdmin();
    }));
    el.querySelectorAll(".ga-save").forEach(btn => btn.addEventListener("click", async () => {
      const card = btn.closest(".card");
      const feedback = [...card.querySelectorAll(".ga-row")].map(row => ({
        ok: row.querySelector(".ga-ok-input").checked,
        text: row.querySelector(".ga-text").value.trim()
      }));
      try {
        await Store.saveFeedback(s.id, card.dataset.tid, feedback);
        card.querySelector(".ga-status").textContent = "保存しました ✅";
      } catch {}
    }));
    el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => templateForm(Store.getTemplate(b.dataset.edit))));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
      const t = Store.getTemplate(b.dataset.del);
      if (!confirm(`「${t.title}」の型を削除しますか？\n（生徒さんの書き込みは残ります）`)) return;
      Store.deleteTemplate(t.id);
      renderGrammarAdmin();
    }));
    document.getElementById("g-new").addEventListener("click", () => templateForm(null));
    const sample = document.getElementById("g-sample");
    if (sample) sample.addEventListener("click", () => {
      Store.saveTemplate(JSON.parse(JSON.stringify(SAMPLE_8_3)));
      renderGrammarAdmin();
    });
  }

  function renderAll() {
    renderOverview();
    renderStudentSelect();
    renderInfo();
    renderLessons();
    renderVocabAdmin();
    renderProgressAdmin();
    renderGrammarAdmin();
  }

  renderAll();
})();
