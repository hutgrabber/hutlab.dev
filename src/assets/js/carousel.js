/* Carousel controls: previous/next buttons, a clickable rail with one stop
   per card, arrow-key support and "which card is showing" tracking. The
   cards themselves scroll and snap with CSS alone, so this file is an
   enhancement, not a requirement. Vanilla, no deps.

   Read from the markup (written by lib/markdown-carousel.js):
     [data-carousel]            the block
     data-rail                  labels (default) | numbers | dots | none
     data-counter="off"         hide the "label · 3 of 14" line
     .carousel-card[data-label] text for that card's stop on the rail */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(document.querySelectorAll("[data-carousel]"), function (root) {
    var track = root.querySelector(".carousel-track");
    if (!track || root.classList.contains("is-live")) return;
    var cards = Array.prototype.slice.call(track.children);
    if (cards.length < 2) return;

    var railMode = root.getAttribute("data-rail") || "labels";
    var showCounter = root.getAttribute("data-counter") !== "off";
    var last = cards.length - 1;
    var active = -1;

    function make(tag, cls, text) {
      var el = document.createElement(tag);
      el.className = cls;
      if (tag === "button") el.type = "button";
      if (text) el.textContent = text;
      return el;
    }

    /* what a card is called: its label, else its title, else its number */
    function nameOf(card, i) {
      var title = card.querySelector(".carousel-title");
      return card.getAttribute("data-label") || (title && title.textContent.trim()) || String(i + 1);
    }
    /* what the rail prints for a card */
    function stopText(card, i) {
      if (railMode === "numbers") return String(i + 1);
      return card.getAttribute("data-label") || String(i + 1);
    }

    function go(i) {
      i = Math.max(0, Math.min(last, i));
      track.scrollTo({ left: cards[i].offsetLeft, behavior: reduced ? "auto" : "smooth" });
    }

    /* --- controls --- */
    var nav = make("div", "carousel-nav");
    var prev = make("button", "carousel-btn", "←");
    var next = make("button", "carousel-btn", "→");
    prev.setAttribute("aria-label", "Previous card");
    next.setAttribute("aria-label", "Next card");
    prev.addEventListener("click", function () { go(active - 1); });
    next.addEventListener("click", function () { go(active + 1); });

    var rail = make("div", "carousel-rail");
    var stops = cards.map(function (card, i) {
      var stop = make("button", "carousel-stop", stopText(card, i));
      var tone = (card.className.match(/\btone-[\w-]+/) || [""])[0];
      if (tone) stop.classList.add(tone);
      stop.setAttribute("aria-label", "Go to card " + (i + 1) + ": " + nameOf(card, i));
      stop.addEventListener("click", function () { go(i); });
      rail.appendChild(stop);
      return stop;
    });

    nav.appendChild(prev);
    nav.appendChild(rail);
    nav.appendChild(next);
    root.appendChild(nav);

    var counter = null;
    if (showCounter) {
      counter = make("span", "carousel-counter");
      counter.setAttribute("aria-live", "polite");
      root.appendChild(counter);
    }

    /* --- rail falls back to dots when its text does not fit --- */
    function fitRail() {
      if (railMode === "none") return;
      if (railMode === "dots") { rail.classList.add("is-dots"); return; }
      rail.classList.remove("is-dots");
      if (rail.scrollWidth > rail.clientWidth + 1) rail.classList.add("is-dots");
    }

    /* --- active card = the one whose left edge is nearest the track's --- */
    function setActive(i) {
      if (i === active) return;
      active = i;
      cards.forEach(function (c, n) { c.classList.toggle("is-active", n === i); });
      stops.forEach(function (s, n) {
        s.classList.toggle("is-active", n === i);
        if (n === i) s.setAttribute("aria-current", "true");
        else s.removeAttribute("aria-current");
      });
      prev.disabled = i === 0;
      next.disabled = i === last;
      if (counter) {
        var name = nameOf(cards[i], i);
        var pos = (i + 1) + " of " + cards.length;
        counter.textContent = name === String(i + 1) ? pos : name + " · " + pos;
      }
    }

    function measure() {
      var x = track.scrollLeft;
      var best = 0;
      var bestDist = Infinity;
      cards.forEach(function (c, n) {
        var d = Math.abs(c.offsetLeft - x);
        if (d < bestDist) { bestDist = d; best = n; }
      });
      setActive(best);
    }

    var ticking = false;
    track.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; measure(); });
    }, { passive: true });

    track.addEventListener("keydown", function (ev) {
      var k = ev.key;
      if (k === "ArrowRight") go(active + 1);
      else if (k === "ArrowLeft") go(active - 1);
      else if (k === "Home") go(0);
      else if (k === "End") go(last);
      else return;
      ev.preventDefault();
    });

    var resizing = false;
    window.addEventListener("resize", function () {
      if (resizing) return;
      resizing = true;
      requestAnimationFrame(function () { resizing = false; fitRail(); measure(); });
    });

    root.classList.add("is-live");
    fitRail();
    measure();
    // web fonts change label widths once they load
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRail);
  });
})();
