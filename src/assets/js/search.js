/* Client-side post search: lazy-loads /search.json on first focus,
   then filters as you type. No dependencies. */
(function () {
  var input = document.getElementById("search-input");
  var results = document.getElementById("search-results");
  var staticList = document.getElementById("post-list");
  var status = document.getElementById("search-status");
  if (!input || !results || !staticList) return;

  var index = null;
  var loading = null;
  var timer = null;

  function loadIndex() {
    if (!loading) {
      loading = fetch("/search.json")
        .then(function (r) { return r.json(); })
        .then(function (data) { index = data; return data; });
    }
    return loading;
  }

  function score(post, tokens) {
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var s = 0;
      if (post.title.toLowerCase().indexOf(t) !== -1) s += 8;
      for (var j = 0; j < post.tags.length; j++) {
        if (post.tags[j].toLowerCase().indexOf(t) !== -1) { s += 5; break; }
      }
      if (post.description.toLowerCase().indexOf(t) !== -1) s += 3;
      if (post.text.indexOf(t) !== -1) s += 1;
      if (s === 0) return 0; // every token must match somewhere
      total += s;
    }
    return total;
  }

  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function render(matches, query) {
    results.innerHTML = matches.map(function (m) {
      var tags = m.post.tags.map(function (t) {
        return '<a class="tag-chip" href="/tags/' + esc(t) + '/">#' + esc(t) + "</a>";
      }).join(" ");
      return (
        '<li class="post-item">' +
          '<div class="post-item-meta"><time>' + esc(m.post.date) + "</time> " + tags + "</div>" +
          '<h2 class="post-item-title"><a href="' + esc(m.post.url) + '">' + esc(m.post.title) + "</a></h2>" +
          (m.post.description ? '<p class="post-item-excerpt">' + esc(m.post.description) + "</p>" : "") +
          '<p class="post-item-more"><a href="' + esc(m.post.url) + '">./read <span aria-hidden="true">→</span></a></p>' +
        "</li>"
      );
    }).join("");
    status.hidden = false;
    status.textContent = matches.length
      ? matches.length + (matches.length === 1 ? " match" : " matches") + ' for "' + query + '"'
      : 'grep: no matches for "' + query + '"';
    results.hidden = false;
    staticList.hidden = true;
  }

  function reset() {
    results.hidden = true;
    results.innerHTML = "";
    staticList.hidden = false;
    status.hidden = true;
  }

  function run() {
    var query = input.value.trim();
    if (!query) { reset(); return; }
    loadIndex().then(function (data) {
      var tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      var matches = [];
      for (var i = 0; i < data.length; i++) {
        var s = score(data[i], tokens);
        if (s > 0) matches.push({ post: data[i], score: s, i: i });
      }
      matches.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
      render(matches, query);
    });
  }

  input.addEventListener("focus", loadIndex, { once: true });
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  });
  input.addEventListener("search", run); // clear button in some browsers
})();
