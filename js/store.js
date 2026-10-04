// データ層：Firebase Firestore 版
// - 生徒ページ：自分のデータだけ読み込む（initForStudent）
// - 管理画面・確認画面：ログイン後に全データを読み込む（initForTeacher）
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

// メモリ上のキャッシュ
const cache = { students: {}, lessons: [], vocab: [], progress: [], cando: [], templates: [], practice: [] };

function docsOf(snap) { return snap.docs.map(d => ({ id: d.id, ...d.data() })); }

// 先生用：全データ読み込み（要ログイン）
async function initForTeacher() {
  const [students, lessons, vocab, progress, cando, templates, practice] = await Promise.all(
    ["students", "lessons", "vocab", "progress", "cando", "grammarTemplates", "practice"].map(name => getDocs(collection(db, name)))
  );
  cache.students = {};
  students.forEach(d => { cache.students[d.id] = { id: d.id, ...d.data() }; });
  cache.lessons = docsOf(lessons);
  cache.vocab = docsOf(vocab);
  cache.progress = docsOf(progress);
  cache.cando = docsOf(cando);
  cache.templates = docsOf(templates);
  cache.practice = docsOf(practice);
}

// 生徒用：自分のぶんだけ読み込み
async function initForStudent(studentId) {
  const sSnap = await getDoc(doc(db, "students", studentId));
  cache.students = sSnap.exists() ? { [sSnap.id]: { id: sSnap.id, ...sSnap.data() } } : {};
  const byStudent = name =>
    getDocs(query(collection(db, name), where("studentId", "==", studentId)));
  const [lessons, vocab, progress, cando, practice] = await Promise.all(
    ["lessons", "vocab", "progress", "cando", "practice"].map(byStudent)
  );
  cache.lessons = docsOf(lessons);
  cache.vocab = docsOf(vocab);
  cache.progress = docsOf(progress);
  cache.cando = docsOf(cando);
  cache.practice = docsOf(practice);
  const assigned = (cache.students[studentId] || {}).grammar || [];
  const tSnaps = await Promise.all(assigned.map(id => getDoc(doc(db, "grammarTemplates", id))));
  cache.templates = tSnaps.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
}

// Firestore に書く（失敗したら画面に出す）
function push(col, id, data) {
  const { id: _drop, ...body } = data;
  setDoc(doc(db, col, id), body).catch(e => {
    console.error("保存に失敗しました", col, id, e);
    alert("保存に失敗しました 🥲\n" + e.message);
  });
}
// 指定した欄だけ書き換える（生徒さんの答えと先生の添削が上書きし合わないように）
function merge(col, id, fields) {
  return setDoc(doc(db, col, id), fields, { merge: true }).catch(e => {
    console.error("保存に失敗しました", col, id, e);
    alert("保存に失敗しました 🥲\n" + e.message);
    throw e;
  });
}
function remove(col, id) {
  deleteDoc(doc(db, col, id)).catch(e => console.error("削除に失敗しました", col, id, e));
}
function newId(col) {
  return doc(collection(db, col)).id;
}
// 「レッスン12」「Lesson 3: ...」から番号を取り出す（なければ最後尾へ）
function lessonNum(name) {
  const m = String(name || "").match(/\d+/);
  return m ? Number(m[0]) : 999;
}

// 新しい生徒さんに自動で付ける練習アプリ一覧
const DEFAULT_APPS = [
  { name: "⏰ 時間の練習", nameEn: "Time Practice", url: "https://natsuki1997m-hue.github.io/clock-practice/clock_practice.html" },
  { name: "📅 カレンダー​クイズ", nameEn: "Calendar Quiz", url: "https://natsuki1997m-hue.github.io/calendar/calendar_quiz.html" },
  { name: "💰 おかねの練習", nameEn: "Money Practice", url: "https://natsuki1997m-hue.github.io/moneypractice/" },
  { name: "🗺️ 道案内ゲーム", nameEn: "Directions Game", url: "https://natsuki1997m-hue.github.io/navigame/" },
  { name: "✏️ げんき1漢字", nameEn: "Genki 1 Kanji", url: "https://natsuki1997m-hue.github.io/kanji_practice1/" },
  { name: "✏️ げんき2漢字", nameEn: "Genki 2 Kanji", url: "https://natsuki1997m-hue.github.io/kanji_practice2/" },
  { name: "🔄 活用マスター", nameEn: "Conjugation Master", url: "https://natsuki1997m-hue.github.io/conjugationmaster/" }
];

window.Store = {
  initForTeacher,
  initForStudent,

  // ---- ログイン（先生用） ----
  auth: {
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    onChange: cb => onAuthStateChanged(auth, cb),
    current: () => auth.currentUser
  },

  // ---- 生徒 ----
  listStudents() { return Object.values(cache.students); },
  getStudent(id) { return cache.students[id] || null; },
  checkPasscode(id, code) {
    const s = cache.students[id];
    return !!s && String(s.passcode) === String(code).trim();
  },
  saveStudent(student) {
    cache.students[student.id] = student;
    push("students", student.id, student);
  },
  addStudent(name, passcode) {
    const slug = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 8) || "student";
    const id = slug + "-" + newId("students").slice(0, 4).toLowerCase();
    const s = {
      id, name, passcode, textbook: "",
      startDate: new Date().toISOString().slice(0, 10),
      apps: DEFAULT_APPS.slice()
    };
    cache.students[id] = s;
    push("students", id, s);
    return s;
  },

  // ---- レッスン ----
  getLessons(studentId) {
    return cache.lessons
      .filter(l => l.studentId === studentId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  saveLesson(lesson) {
    if (!lesson.id) lesson.id = newId("lessons");
    const i = cache.lessons.findIndex(l => l.id === lesson.id);
    if (i >= 0) cache.lessons[i] = lesson; else cache.lessons.push(lesson);
    push("lessons", lesson.id, lesson);
    return lesson;
  },
  deleteLesson(lessonId) {
    cache.lessons = cache.lessons.filter(l => l.id !== lessonId);
    remove("lessons", lessonId);
  },

  // ---- 単語 ----
  getVocab(studentId) { return cache.vocab.filter(v => v.studentId === studentId); },
  saveVocab(vocab) {
    if (!vocab.id) vocab.id = newId("vocab");
    const i = cache.vocab.findIndex(v => v.id === vocab.id);
    if (i >= 0) cache.vocab[i] = vocab; else cache.vocab.push(vocab);
    push("vocab", vocab.id, vocab);
    return vocab;
  },
  deleteVocab(vocabId) {
    cache.vocab = cache.vocab.filter(v => v.id !== vocabId);
    remove("vocab", vocabId);
  },
  setVocabChecked(studentId, vocabId, checked) {
    const v = cache.vocab.find(v => v.id === vocabId);
    if (!v) return;
    v.checked = checked;
    if (checked) {
      v.lastReview = new Date().toISOString().slice(0, 10);
      v.studyCount = (v.studyCount || 0) + 1;
    }
    push("vocab", v.id, v);
  },

  // ---- 宿題（レッスン内の homework 配列） ----
  getHomework(studentId) {
    return this.getLessons(studentId).map(lesson => ({
      lessonId: lesson.id,
      date: lesson.date,
      number: lesson.number,
      items: (lesson.homework || []).map((h, i) => ({ ...h, key: lesson.id + ":" + i }))
    }));
  },
  setHomeworkDone(studentId, key, done) {
    const sep = key.lastIndexOf(":");
    const lessonId = key.slice(0, sep);
    const idx = Number(key.slice(sep + 1));
    const lesson = cache.lessons.find(l => l.id === lessonId);
    if (!lesson || !lesson.homework || !lesson.homework[idx]) return;
    lesson.homework[idx].done = done;
    push("lessons", lesson.id, lesson);
  },

  // ---- 進捗 / Can-do ----
  // 「レッスン1, 2, ... 12, 漢字」の順に並べる（番号なしグループは最後）
  getProgress(studentId) {
    return cache.progress
      .filter(p => p.studentId === studentId)
      .sort((a, b) => lessonNum(a.lesson) - lessonNum(b.lesson));
  },
  getCando(studentId) {
    return cache.cando
      .filter(c => c.studentId === studentId)
      .sort((a, b) => lessonNum(a.lesson) - lessonNum(b.lesson));
  },
  setProgressDone(studentId, lessonName, itemIndex, done) {
    const p = cache.progress.find(p => p.studentId === studentId && p.lesson === lessonName);
    if (!p || !p.items[itemIndex]) return;
    p.items[itemIndex].done = done;
    push("progress", p.id, p);
  },
  setCandoDone(studentId, lessonName, itemIndex, done) {
    const c = cache.cando.find(c => c.studentId === studentId && c.lesson === lessonName);
    if (!c || !c.items[itemIndex]) return;
    c.items[itemIndex].done = done;
    push("cando", c.id, c);
  },

  // ---- 文法ノート（型 ＋ 生徒さんの書き込み ＋ 添削） ----
  listTemplates() {
    return cache.templates.slice().sort((a, b) =>
      String(a.lesson || "").localeCompare(String(b.lesson || ""), "ja", { numeric: true }));
  },
  getTemplate(id) { return cache.templates.find(t => t.id === id) || null; },
  saveTemplate(t) {
    if (!t.id) t.id = newId("grammarTemplates");
    const i = cache.templates.findIndex(x => x.id === t.id);
    if (i >= 0) cache.templates[i] = t; else cache.templates.push(t);
    push("grammarTemplates", t.id, t);
    return t;
  },
  deleteTemplate(id) {
    cache.templates = cache.templates.filter(t => t.id !== id);
    remove("grammarTemplates", id);
  },
  getPractice(studentId, templateId) {
    return cache.practice.find(p => p.id === studentId + "_" + templateId)
      || { id: studentId + "_" + templateId, studentId, templateId, answers: [], feedback: [] };
  },
  listPractice(studentId) { return cache.practice.filter(p => p.studentId === studentId); },
  _upsertPractice(p) {
    const i = cache.practice.findIndex(x => x.id === p.id);
    if (i >= 0) cache.practice[i] = p; else cache.practice.push(p);
  },
  // answers: [{ s: ["箱1の答え", "箱2の答え"] }, ...]
  saveAnswers(studentId, templateId, answers) {
    const p = this.getPractice(studentId, templateId);
    p.answers = answers;
    p.updatedAt = new Date().toISOString();
    this._upsertPractice(p);
    return merge("practice", p.id, { studentId, templateId, answers, updatedAt: p.updatedAt });
  },
  // feedback: [{ text: "コメント", ok: true }, ...]
  saveFeedback(studentId, templateId, feedback) {
    const p = this.getPractice(studentId, templateId);
    p.feedback = feedback;
    p.feedbackAt = new Date().toISOString();
    this._upsertPractice(p);
    return merge("practice", p.id, { studentId, templateId, feedback, feedbackAt: p.feedbackAt });
  }
};
