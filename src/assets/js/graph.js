/* hutlab.dev — interactive tag graph (/tags/)
   Zero-dependency canvas force simulation. Nodes = tags + posts;
   solid edges = tag↔post, dashed edges = post→post internal links. */
(function () {
  "use strict";

  var canvas = document.getElementById("graph-canvas");
  var dataEl = document.getElementById("graph-data");
  if (!canvas || !dataEl || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var panel = canvas.parentElement;
  var filterEl = document.querySelector(".graph-filter");
  var resetEl = document.querySelector(".graph-reset");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- palette (validated against the panel's fixed dark surface) --- */
  var css = getComputedStyle(panel);
  function cvar(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return v || fallback;
  }
  var C = {
    dot: cvar("--g-dot", "rgba(216,212,228,0.05)"),
    tag: cvar("--g-tag", "#a778e8"),
    tagGlow: cvar("--g-tag-glow", "rgba(167,120,232,0.55)"),
    post: cvar("--g-post", "#21a866"),
    postGlow: cvar("--g-post-glow", "rgba(33,168,102,0.5)"),
    edge: cvar("--g-edge", "rgba(139,132,162,0.3)"),
    edgeHi: cvar("--g-edge-hi", "#c39bf5"),
    text: cvar("--g-text", "#d8d4e4"),
    muted: cvar("--g-muted", "#8b84a2")
  };

  /* ---------- data ------------------------------------------------------- */
  var data = JSON.parse(dataEl.textContent);
  var nodes = data.nodes.map(function (n, i) {
    return {
      id: n.id, type: n.type, label: n.label, url: n.url,
      count: n.count || 0,
      r: n.type === "tag" ? 9 + Math.sqrt(n.count || 1) * 3.5 : 5,
      x: 0, y: 0, vx: 0, vy: 0,
      phase: i * 2.399963, // golden angle: unsynchronized drift
      fixed: false
    };
  });
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  var edges = data.edges
    .filter(function (e) { return byId[e.source] && byId[e.target]; })
    .map(function (e) {
      return { a: byId[e.source], b: byId[e.target], type: e.type };
    });
  var neighbors = {};
  nodes.forEach(function (n) { neighbors[n.id] = new Set([n.id]); });
  edges.forEach(function (e) {
    neighbors[e.a.id].add(e.b.id);
    neighbors[e.b.id].add(e.a.id);
  });

  /* warm start: tags on an inner ring, posts near their first tag */
  var tags = nodes.filter(function (n) { return n.type === "tag"; });
  tags.forEach(function (t, i) {
    var a = i * (Math.PI * 2 / Math.max(tags.length, 1)) - Math.PI / 2;
    t.x = Math.cos(a) * 70;
    t.y = Math.sin(a) * 70;
  });
  nodes.forEach(function (n, i) {
    if (n.type !== "post") return;
    var hub = edges.filter(function (e) {
      return e.type === "tag" && (e.a === n || e.b === n);
    })[0];
    var cx = hub ? (hub.a === n ? hub.b.x : hub.a.x) : 0;
    var cy = hub ? (hub.a === n ? hub.b.y : hub.a.y) : 0;
    var a = i * 2.399963;
    n.x = cx + Math.cos(a) * (90 + (i % 3) * 30);
    n.y = cy + Math.sin(a) * (90 + (i % 3) * 30);
  });

  /* ---------- viewport --------------------------------------------------- */
  var W = 0, H = 0, DPR = 1;
  var view = { x: 0, y: 0, k: 1 };       // screen = world*k + (x,y)
  var viewTarget = null;                  // animated reset destination

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = panel.clientWidth;
    H = panel.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }

  function bounds() {
    var m = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    nodes.forEach(function (n) {
      m.x0 = Math.min(m.x0, n.x - n.r); m.x1 = Math.max(m.x1, n.x + n.r);
      m.y0 = Math.min(m.y0, n.y - n.r); m.y1 = Math.max(m.y1, n.y + n.r);
    });
    return m;
  }

  function fitView() {
    var b = bounds();
    var pad = 70;
    var k = Math.min((W - pad * 2) / Math.max(b.x1 - b.x0, 1),
                     (H - pad * 2) / Math.max(b.y1 - b.y0, 1));
    k = Math.max(0.35, Math.min(k, 1.6));
    return {
      k: k,
      x: W / 2 - k * (b.x0 + b.x1) / 2,
      y: H / 2 - k * (b.y0 + b.y1) / 2
    };
  }

  function toWorld(sx, sy) {
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
  }

  /* ---------- simulation -------------------------------------------------- */
  var alpha = 1;
  var ALPHA_FLOOR = reducedMotion ? 0 : 0.02;
  var t = 0;

  function tick() {
    t += 0.016;
    var i, j, n, m, e, dx, dy, d2, d, f;

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.fixed) continue;
      /* centering gravity */
      n.vx -= n.x * 0.0045 * alpha;
      n.vy -= n.y * 0.0045 * alpha;
      /* idle drift — imperceptible wander so the space feels alive */
      if (!reducedMotion) {
        n.vx += Math.cos(t * 0.7 + n.phase) * 0.012;
        n.vy += Math.sin(t * 0.9 + n.phase * 1.7) * 0.012;
      }
    }

    /* pairwise repulsion */
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        n = nodes[i]; m = nodes[j];
        dx = m.x - n.x; dy = m.y - n.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = 1; dy = 0; }
        var rep = 1500 * alpha / d2;
        d = Math.sqrt(d2);
        var ux = dx / d, uy = dy / d;
        if (!n.fixed) { n.vx -= ux * rep; n.vy -= uy * rep; }
        if (!m.fixed) { m.vx += ux * rep; m.vy += uy * rep; }
      }
    }

    /* springs */
    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      dx = e.b.x - e.a.x; dy = e.b.y - e.a.y;
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      var rest = e.type === "tag" ? 105 : 150;
      f = (d - rest) * 0.03 * alpha;
      var fx = (dx / d) * f, fy = (dy / d) * f;
      if (!e.a.fixed) { e.a.vx += fx; e.a.vy += fy; }
      if (!e.b.fixed) { e.b.vx -= fx; e.b.vy -= fy; }
    }

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.86; n.vy *= 0.86;
      n.x += n.vx; n.y += n.vy;
    }

    if (alpha > ALPHA_FLOOR) alpha = Math.max(ALPHA_FLOOR, alpha * 0.994);
  }

  /* ---------- interaction state ------------------------------------------ */
  var hovered = null;      // node under pointer
  var selected = null;     // touch: first tap selects
  var dragNode = null;
  var panning = false;
  var moved = 0;
  var downAt = null;
  var pointers = {};       // active pointers (for pinch)
  var pinch = null;
  var query = "";

  function hit(sx, sy) {
    var w = toWorld(sx, sy);
    var best = null, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = n.x - w.x, dy = n.y - w.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var slop = n.r + 12 / view.k; // generous hit target
      if (d < slop && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  function matches(n) {
    return !query || n.label.toLowerCase().indexOf(query) !== -1;
  }

  /* node opacity given hover/selection/filter state */
  function nodeAlpha(n) {
    var focus = hovered || selected;
    if (focus && !neighbors[focus.id].has(n.id)) return 0.14;
    if (query && !matches(n)) {
      /* neighbors of a match stay readable */
      var nearMatch = nodes.some(function (m) {
        return matches(m) && neighbors[m.id].has(n.id);
      });
      return nearMatch ? 0.45 : 0.08;
    }
    return 1;
  }

  /* ---------- rendering --------------------------------------------------- */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* dot grid, drawn in world space */
    var spacing = 30;
    var w0 = toWorld(0, 0), w1 = toWorld(W, H);
    ctx.fillStyle = C.dot;
    var gx0 = Math.floor(w0.x / spacing) * spacing;
    var gy0 = Math.floor(w0.y / spacing) * spacing;
    if (view.k > 0.45) {
      for (var gx = gx0; gx < w1.x; gx += spacing) {
        for (var gy = gy0; gy < w1.y; gy += spacing) {
          var sx = gx * view.k + view.x, sy = gy * view.k + view.y;
          ctx.fillRect(sx, sy, 1.4, 1.4);
        }
      }
    }

    var focus = hovered || selected;

    /* edges */
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var ax = e.a.x * view.k + view.x, ay = e.a.y * view.k + view.y;
      var bx = e.b.x * view.k + view.x, by = e.b.y * view.k + view.y;
      var active = focus && (focus === e.a || focus === e.b);
      var a = Math.min(nodeAlpha(e.a), nodeAlpha(e.b));
      ctx.globalAlpha = active ? 1 : a * 0.9;
      ctx.strokeStyle = active ? C.edgeHi : C.edge;
      ctx.lineWidth = active ? 1.6 : 1;
      ctx.setLineDash(e.type === "link" ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* nodes */
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x = n.x * view.k + view.x, y = n.y * view.k + view.y;
      var r = n.r * view.k;
      var al = nodeAlpha(n);
      var isFocus = focus === n;
      ctx.globalAlpha = al;
      ctx.shadowColor = n.type === "tag" ? C.tagGlow : C.postGlow;
      ctx.shadowBlur = (isFocus ? 26 : 14) * Math.min(view.k, 1.4);
      ctx.fillStyle = n.type === "tag" ? C.tag : C.post;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isFocus) {
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* labels last, on top */
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      x = n.x * view.k + view.x; y = n.y * view.k + view.y;
      r = n.r * view.k;
      al = nodeAlpha(n);
      var showLabel;
      if (n.type === "tag") {
        showLabel = true;
      } else {
        var focusOn = focus && neighbors[focus.id].has(n.id);
        showLabel = focusOn || view.k > 1.15 || (query && matches(n));
      }
      if (!showLabel || al < 0.2) continue;
      ctx.globalAlpha = Math.min(1, al + 0.1);
      if (n.type === "tag") {
        var fs = Math.round((15 + Math.min(n.count, 8)) * Math.min(Math.max(view.k, 0.75), 1.5));
        ctx.font = fs + 'px "VT323", monospace';
        ctx.fillStyle = C.text;
        ctx.textAlign = "center";
        ctx.fillText("#" + n.label, x, y - r - 7);
      } else {
        var label = n.label.length > 30 ? n.label.slice(0, 29) + "…" : n.label;
        ctx.font = '10.5px "JetBrains Mono", monospace';
        ctx.fillStyle = C.muted;
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + r + 14);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- main loop ---------------------------------------------------- */
  var running = true;

  function frame() {
    if (!running) return;
    if (viewTarget) {
      view.x += (viewTarget.x - view.x) * 0.18;
      view.y += (viewTarget.y - view.y) * 0.18;
      view.k += (viewTarget.k - view.k) * 0.18;
      if (Math.abs(viewTarget.k - view.k) < 0.002 &&
          Math.abs(viewTarget.x - view.x) < 0.5 &&
          Math.abs(viewTarget.y - view.y) < 0.5) {
        view = { x: viewTarget.x, y: viewTarget.y, k: viewTarget.k };
        viewTarget = null;
      }
    }
    if (alpha > ALPHA_FLOOR || dragNode || !reducedMotion) tick();
    draw();
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  /* ---------- pointer events ----------------------------------------------- */
  function pos(ev) {
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", function (ev) {
    var p = pos(ev);
    pointers[ev.pointerId] = p;
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = {
        d: Math.hypot(b.x - a.x, b.y - a.y),
        k: view.k,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2
      };
      dragNode = null; panning = false;
      return;
    }
    moved = 0;
    downAt = p;
    var n = hit(p.x, p.y);
    if (n) {
      dragNode = n;
      n.fixed = true;
      alpha = Math.max(alpha, 0.35); // wake the web so it reacts
    } else {
      panning = true;
    }
    canvas.classList.add("dragging");
    canvas.setPointerCapture(ev.pointerId);
  });

  canvas.addEventListener("pointermove", function (ev) {
    var p = pos(ev);
    if (pointers[ev.pointerId]) {
      var prev = pointers[ev.pointerId];
      pointers[ev.pointerId] = p;
      var ids = Object.keys(pointers);
      if (pinch && ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(b.x - a.x, b.y - a.y);
        var k = Math.max(0.35, Math.min(4, pinch.k * d / pinch.d));
        var w = toWorld(pinch.cx, pinch.cy);
        view.k = k;
        view.x = pinch.cx - w.x * k;
        view.y = pinch.cy - w.y * k;
        return;
      }
      moved += Math.hypot(p.x - prev.x, p.y - prev.y);
      if (dragNode) {
        var w2 = toWorld(p.x, p.y);
        dragNode.x = w2.x; dragNode.y = w2.y;
        dragNode.vx = 0; dragNode.vy = 0;
        alpha = Math.max(alpha, 0.3);
        viewTarget = null;
      } else if (panning) {
        view.x += p.x - prev.x;
        view.y += p.y - prev.y;
        viewTarget = null;
      }
    } else {
      hovered = hit(p.x, p.y);
      canvas.style.cursor = hovered ? "pointer" : "";
    }
  });

  function release(ev) {
    delete pointers[ev.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    canvas.classList.remove("dragging");

    var isTap = downAt && moved < 6;
    if (dragNode) {
      var n = dragNode;
      n.fixed = false;
      dragNode = null;
      if (isTap && n.url) {
        if (ev.pointerType === "touch") {
          /* touch: first tap focuses, tap again to open */
          if (selected === n) { window.location.href = n.url; }
          else { selected = n; }
        } else {
          window.location.href = n.url;
        }
        return;
      }
    } else if (isTap) {
      selected = null; // tap on empty space clears focus
    }
    panning = false;
    downAt = null;
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", function () { hovered = null; });

  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var p = pos(ev);
    var k = Math.max(0.35, Math.min(4, view.k * Math.pow(1.0015, -ev.deltaY)));
    var w = toWorld(p.x, p.y);
    view.k = k;
    view.x = p.x - w.x * k;
    view.y = p.y - w.y * k;
    viewTarget = null;
  }, { passive: false });

  /* ---------- controls ------------------------------------------------------ */
  if (resetEl) {
    resetEl.addEventListener("click", function () {
      selected = null;
      viewTarget = fitView();
      if (reducedMotion) { view = viewTarget; viewTarget = null; }
    });
  }
  if (filterEl) {
    filterEl.addEventListener("input", function () {
      query = filterEl.value.trim().toLowerCase();
    });
  }

  /* ---------- boot ---------------------------------------------------------- */
  resize();
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      var hadNoInteraction = !viewTarget && view.k === 1 && view.x === 0;
      resize();
      if (hadNoInteraction) view = fitView();
    }).observe(panel);
  }

  /* settle instantly for reduced motion; otherwise animate from the warm start */
  if (reducedMotion) {
    for (var s = 0; s < 300; s++) tick();
  } else {
    for (s = 0; s < 60; s++) tick(); // pre-roll so first paint isn't chaotic
  }
  view = fitView();
  requestAnimationFrame(frame);

  /* re-render crisp labels once the webfonts arrive */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { /* next frame repaints anyway */ });
  }

  /* test hook */
  window.__graph = {
    nodes: nodes,
    view: function () { return view; },
    screen: function (id) {
      var n = byId[id];
      return n ? { x: n.x * view.k + view.x, y: n.y * view.k + view.y } : null;
    },
    state: function () {
      return { hovered: hovered && hovered.id, selected: selected && selected.id, alpha: alpha, query: query };
    }
  };
})();
