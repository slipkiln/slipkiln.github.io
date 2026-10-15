(function () {
  "use strict";
  var API = "https://api.slipkiln.com", LS = "slipkiln_api_key";
  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);

  function msg(el, text, ok) { if (!el) return; el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); }
  function clear(el) { if (el) { el.textContent = ""; el.className = "msg"; } }
  function friendly(status, j) {
    if (status === 429) return "Too many attempts. Please wait a minute and try again.";
    if (status === 409 && j.error === "email_exists") return "That email already has a key. Lost it? Email support@slipkiln.com and we’ll help.";
    if (status === 401) return "That API key wasn’t recognized. Check it and try again.";
    if (j.error === "no_customer") return "This key is on the Free plan, so there’s no billing account yet. Choose a plan below to upgrade.";
    if (j.error === "already_subscribed") return "You already have a paid plan. Use “Change plan” on the Billing page.";
    if (j.error === "same_plan") return "You’re already on that plan.";
    return j.message || "Something went wrong (" + status + "). Please try again.";
  }
  function post(path, body, key) {
    var h = { "Content-Type": "application/json" };
    if (key) h.Authorization = "Bearer " + key;
    return fetch(API + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) })
      .catch(function () { throw new Error("Can’t reach the SlipKiln API. Check your connection and try again."); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(friendly(r.status, j)); e.code = j.error; throw e; }
          return j;
        });
      });
  }
  function busy(btn, on, label) {
    if (!btn) return; btn.disabled = on;
    if (on) { btn.dataset.l = btn.innerHTML; btn.textContent = label || "Working…"; } else if (btn.dataset.l) btn.innerHTML = btn.dataset.l;
  }
  function copyText(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = t; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} ta.remove(); }
  }

  // ---- saved key ----
  function getSaved() { try { return localStorage.getItem(LS) || ""; } catch (e) { return ""; } }
  function save(k) { try { if (/^sk_[A-Za-z0-9_-]{20,}$/.test(k)) localStorage.setItem(LS, k); } catch (e) {} }
  function forget() { try { localStorage.removeItem(LS); } catch (e) {} }
  function mask(k) { return k.slice(0, 6) + "••••••••••••" + k.slice(-4); }
  function widgets() {
    var k = getSaved();
    document.querySelectorAll("[data-keywidget]").forEach(function (w) {
      w.innerHTML = ""; if (!k) return;
      var box = document.createElement("div"); box.className = "keybox";
      var code = document.createElement("code"); code.textContent = mask(k);
      var mk = function (label, cls, fn) { var b = document.createElement("button"); b.type = "button"; b.className = "btn sm " + cls; b.textContent = label; b.addEventListener("click", fn); return b; };
      var shown = false;
      var rev = mk("Show", "alt", function () { shown = !shown; code.textContent = shown ? k : mask(k); rev.textContent = shown ? "Hide" : "Show"; });
      var cp = mk("Copy", "", function () { copyText(k, cp); });
      var fg = mk("Forget", "link", function () {
        if (confirm("Remove the saved key from this browser? Keep a copy first: we can’t show it again.")) { forget(); location.reload(); }
      });
      fg.title = "Remove the key from this browser";
      box.append(code, cp, rev, fg); w.appendChild(box);
    });
  }

  // ---- copy buttons on every code block ----
  document.querySelectorAll("pre").forEach(function (pre) {
    if (pre.id === "first-request") return;
    if (!pre.dataset.copy) pre.dataset.copy = pre.textContent.replace(/\s+$/, "");
    var b = document.createElement("button"); b.type = "button"; b.className = "copy"; b.textContent = "Copy"; b.setAttribute("aria-label", "Copy code");
    b.addEventListener("click", function () { copyText(pre.dataset.copy, b); });
    pre.appendChild(b);
  });
  function setCopy(pre, text, shown) { pre.textContent = shown; pre.dataset.copy = text; var b = document.createElement("button"); b.type = "button"; b.className = "copy"; b.textContent = "Copy"; b.addEventListener("click", function () { copyText(text, b); }); pre.appendChild(b); }
  function firstRequest(k) {
    var body = "curl https://api.slipkiln.com/v1/render/template \\\n  -H \"Authorization: Bearer KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"template\":\"invoice\",\"data\":{\"number\":\"INV-1\",\"currency\":\"USD\",\"customer\":{\"name\":\"Acme Co.\"},\"items\":[{\"description\":\"Consulting\",\"qty\":10,\"unit_price\":120}]}}' \\\n  -o invoice.pdf";
    return { text: body.replace("KEY", k), shown: body.replace("KEY", mask(k)) };
  }

  function checkout(key, plan, btn, out) {
    busy(btn, true, "Opening checkout…");
    post("/v1/billing/checkout", { plan: plan }, key).then(function (j) { location.href = j.url; })
      .catch(function (e) { busy(btn, false); msg(out, e.message); });
  }

  // ---- signup ----
  var form = $("signup-form");
  if (form) {
    var showResult = function () {
      var k = getSaved(); widgets();
      var fr = firstRequest(k); setCopy($("first-request"), fr.text, fr.shown);
      $("step1").classList.add("hidden"); $("result").classList.remove("hidden"); window.scrollTo(0, 0);
    };
    if (getSaved()) { $("saved").classList.remove("hidden"); $("show-saved").addEventListener("click", function (e) { e.preventDefault(); showResult(); }); }
    form.addEventListener("submit", function (e) {
      e.preventDefault(); clear($("signup-msg"));
      var email = $("email").value.trim(), btn = form.querySelector("button[type=submit]");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg($("signup-msg"), "Please enter a valid email address."); $("email").focus(); return; }
      busy(btn, true, "Creating…");
      post("/v1/signup", { email: email, website: $("website").value }).then(function (j) { save(j.api_key); showResult(); })
        .catch(function (e2) { busy(btn, false); msg($("signup-msg"), e2.message); });
    });
    var pick = qs.get("plan");
    document.querySelectorAll("#result button[data-plan]").forEach(function (b) {
      if (b.dataset.plan === pick) b.classList.add("sel");
      b.addEventListener("click", function () { checkout(getSaved(), b.dataset.plan, b, $("plan-msg")); });
    });
  }

  // ---- billing ----
  var bform = $("billing-form");
  if (bform) {
    if (getSaved()) { $("bkey-saved").classList.remove("hidden"); $("bkey-entry").classList.add("hidden"); }
    var key = function () { return getSaved() || $("bkey").value.trim(); };
    var need = function (out) { if (key()) return true; msg(out, "Enter your API key first."); $("bkey").focus(); return false; };
    var remember = function () { if (!getSaved()) { save($("bkey").value.trim()); } };
    bform.addEventListener("submit", function (e) {
      e.preventDefault(); clear($("billing-msg")); if (!need($("billing-msg"))) return;
      var btn = bform.querySelector("button[type=submit]"); busy(btn, true, "Opening portal…");
      post("/v1/billing/portal", {}, key()).then(function (j) { remember(); location.href = j.url; })
        .catch(function (e2) { busy(btn, false); if (e2.code !== undefined && e2.code !== "unauthorized") remember(); msg($("billing-msg"), e2.message); });
    });
    document.querySelectorAll("#change button[data-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        var out = $("change-msg"); clear(out); if (!need(out)) return;
        busy(b, true, "Switching…");
        post("/v1/billing/change-plan", { plan: b.dataset.plan }, key()).then(function (j) { remember(); busy(b, false); msg(out, "Done. You’re now on the " + j.plan.charAt(0).toUpperCase() + j.plan.slice(1) + " plan.", true); })
          .catch(function (e2) {
            busy(b, false);
            if (e2.code === "no_subscription") { remember(); checkout(key(), b.dataset.plan, b, out); }
            else msg(out, e2.message);
          });
      });
    });
  }

  // ---- docs: code tabs + active nav ----
  document.querySelectorAll(".tabs").forEach(function (t) {
    var btns = t.querySelectorAll("button"), panes = t.parentNode.querySelectorAll("pre[data-lang]");
    btns.forEach(function (b) { b.addEventListener("click", function () {
      btns.forEach(function (x) { x.classList.toggle("on", x === b); });
      panes.forEach(function (p) { p.classList.toggle("hidden", p.dataset.lang !== b.dataset.lang); });
    }); });
  });
  var nav = $("docnav");
  if (nav && "IntersectionObserver" in window) {
    var links = {}; nav.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && links[e.target.id]) { nav.querySelectorAll("a").forEach(function (a) { a.classList.remove("on"); }); links[e.target.id].classList.add("on"); } }); }, { rootMargin: "-80px 0px -70% 0px" });
    Object.keys(links).forEach(function (id) { var el = $(id); if (el) io.observe(el); });
  }

  widgets();
  if (qs.get("subscribed") === "1" && $("subscribed")) $("subscribed").classList.remove("hidden");
})();
