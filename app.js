(function () {
  "use strict";
  var API = "https://api.slipkiln.com";
  var $ = function (id) { return document.getElementById(id); };
  function msg(el, text, ok) { el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); }
  function post(path, body, key) {
    var h = { "Content-Type": "application/json" };
    if (key) h.Authorization = "Bearer " + key;
    return fetch(API + path, { method: "POST", headers: h, body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.message || ("Request failed (" + r.status + ")")); return j; });
    });
  }
  function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || "Working…"; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; }
  function checkout(key, plan, btn, out) {
    busy(btn, true, "Redirecting to Stripe…");
    post("/v1/billing/checkout", { plan: plan }, key).then(function (j) { location.href = j.url; })
      .catch(function (e) { busy(btn, false); msg(out, e.message); });
  }
  function plans(container, getKey, out) {
    var q = new URLSearchParams(location.search).get("plan");
    container.querySelectorAll("button[data-plan]").forEach(function (b) {
      if (b.dataset.plan === q) b.classList.add("sel");
      b.addEventListener("click", function () { var k = getKey(); if (!k) return msg(out, "Enter your API key first."); checkout(k, b.dataset.plan, b, out); });
    });
  }

  // Signup page
  var form = $("signup-form");
  if (form) {
    var apiKey = null;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      if (!$("agree").checked) return msg($("signup-msg"), "Please accept the Terms and Privacy Policy.");
      busy(btn, true, "Creating key…");
      post("/v1/signup", { email: $("email").value, website: $("website").value }).then(function (j) {
        apiKey = j.api_key;
        $("api-key").textContent = apiKey;
        form.classList.add("hidden"); $("result").classList.remove("hidden");
      }).catch(function (e2) { busy(btn, false); msg($("signup-msg"), e2.message); });
    });
    $("copy").addEventListener("click", function () {
      navigator.clipboard.writeText(apiKey).then(function () { $("copy").textContent = "Copied ✓"; });
    });
    plans($("result"), function () { return apiKey; }, $("plan-msg"));
  }

  // Billing page
  var bform = $("billing-form");
  if (bform) {
    var key = function () { return $("bkey").value.trim(); };
    bform.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = bform.querySelector("button[type=submit]");
      busy(btn, true, "Opening portal…");
      post("/v1/billing/portal", {}, key()).then(function (j) { location.href = j.url; })
        .catch(function (e2) { busy(btn, false); msg($("billing-msg"), e2.message); });
    });
    document.querySelectorAll("#change button[data-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!key()) return msg($("billing-msg"), "Enter your API key first.");
        busy(b, true, "Switching…");
        post("/v1/billing/change-plan", { plan: b.dataset.plan }, key()).then(function (j) { busy(b, false); msg($("billing-msg"), "You're now on the " + j.plan + " plan.", true); })
          .catch(function (e2) {
            busy(b, false);
            if (/No active subscription/i.test(e2.message)) checkout(key(), b.dataset.plan, b, $("billing-msg"));
            else msg($("billing-msg"), e2.message);
          });
      });
    });
  }

  // Docs code tabs
  document.querySelectorAll(".tabs").forEach(function (t) {
    var btns = t.querySelectorAll("button"), panes = t.parentNode.querySelectorAll("pre[data-lang]");
    btns.forEach(function (b) { b.addEventListener("click", function () {
      btns.forEach(function (x) { x.classList.toggle("on", x === b); });
      panes.forEach(function (p) { p.classList.toggle("hidden", p.dataset.lang !== b.dataset.lang); });
    }); });
  });

  if (new URLSearchParams(location.search).get("subscribed") === "1" && $("subscribed")) $("subscribed").classList.remove("hidden");
})();
