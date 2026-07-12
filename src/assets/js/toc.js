/* Table of contents: copy-link buttons, animated scroll for shared #links,
   and a scroll-spy that marks the section being read. Vanilla, no deps. */
(function () {
  var toc = document.querySelector(".toc");
  if (!toc) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- narrow screens get a collapsed disclosure; the desktop rail is
         always open (the summary is inert there via CSS) --- */
  var fold = toc.querySelector(".toc-fold");
  var wide = window.matchMedia("(min-width: 75rem)");
  if (fold) {
    if (!wide.matches) fold.open = false;
    var syncFold = function () {
      if (wide.matches) fold.open = true;
    };
    if (wide.addEventListener) wide.addEventListener("change", syncFold);
    else wide.addListener(syncFold);
  }

  function flash(el) {
    if (reduced || !el) return;
    el.classList.remove("anchor-flash");
    void el.offsetWidth; // restart the animation if re-triggered
    el.classList.add("anchor-flash");
    el.addEventListener(
      "animationend",
      function () { el.classList.remove("anchor-flash"); },
      { once: true }
    );
  }

  /* --- copy-link buttons --- */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* give up quietly */ }
    ta.remove();
  }

  toc.addEventListener("click", function (e) {
    var btn = e.target.closest(".toc-copy");
    if (!btn) return;
    var url =
      location.origin + location.pathname + "#" + encodeURIComponent(btn.dataset.id);
    var done = function () {
      clearTimeout(btn._t);
      btn.textContent = "✓";
      btn.classList.add("copied");
      btn._t = setTimeout(function () {
        btn.textContent = "⧉";
        btn.classList.remove("copied");
      }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {
        legacyCopy(url);
        done();
      });
    } else {
      legacyCopy(url);
      done();
    }
  });

  /* --- flash the target on ToC entry clicks (CSS smooth-scroll does the
         rest); on narrow screens also fold the disclosure out of the way --- */
  toc.addEventListener("click", function (e) {
    var a = e.target.closest(".toc-list a[href^='#']");
    if (!a) return;
    if (fold && !wide.matches) fold.open = false;
    flash(document.getElementById(decodeURIComponent(a.hash.slice(1))));
  });

  /* --- animated scroll when the page opens with a shared #link --- */
  if (location.hash) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && !reduced) {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          flash(target);
        });
      });
    }
    // reduced motion (or unknown id): keep the browser's default behavior
  }

  /* --- scroll-spy: highlight the section being read --- */
  var heads = [].slice.call(
    document.querySelectorAll(".prose h1[id],.prose h2[id],.prose h3[id],.prose h4[id],.prose h5[id],.prose h6[id]")
  );
  var itemFor = {};
  [].forEach.call(toc.querySelectorAll(".toc-item > a[href^='#']"), function (a) {
    itemFor[decodeURIComponent(a.hash.slice(1))] = a.parentElement;
  });

  if (heads.length) {
    var LINE = 88; // reading line, just below the sticky header + scroll margin
    var ticking = false;
    var setActive = function () {
      ticking = false;
      var current = null;
      var atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        current = heads[heads.length - 1];
      } else {
        for (var i = 0; i < heads.length; i++) {
          if (heads[i].getBoundingClientRect().top <= LINE) current = heads[i];
          else break;
        }
        if (!current) current = heads[0];
      }
      var prev = toc.querySelector(".toc-item.active");
      var li = itemFor[current.id];
      if (prev === li) return;
      if (prev) prev.classList.remove("active");
      if (li) {
        li.classList.add("active");
        var scroller = fold || toc; // .toc-fold is the scroll container on desktop
        if (scroller.scrollHeight > scroller.clientHeight) {
          li.scrollIntoView({ block: "nearest" });
        }
      }
    };
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(setActive);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    setActive();
  }
})();
