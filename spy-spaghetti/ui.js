/* Spy Spaghetti: drawing the screens. render(view) shows whatever the rules
   say is happening, including the board of words. */
(function (SS) {
  'use strict';

  var R = SS.rules;
  var TEAMS = R.TEAMS;

  function $(id) { return document.getElementById(id); }

  /* ---------- screens ---------- */
  var SCREENS = ['s-mode', 's-join', 's-lobby', 's-game', 's-win'];
  var current = 's-mode';
  function show(id) {
    if (id === current) return;
    current = id;
    SCREENS.forEach(function (s) { $(s).hidden = (s !== id); });
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function busy(id, text) {
    var b = $(id);
    if (text) { b.dataset.label = b.textContent; b.textContent = text; b.disabled = true; }
    else { if (b.dataset.label) b.textContent = b.dataset.label; b.disabled = false; }
  }

  /* ---------- the spymaster's number ---------- */
  // Chips for 0 to 9 and unlimited. Which one is picked stays on this device
  // until "I've said my clue".
  function initCounts() {
    var row = $('counts');
    R.COUNTS.forEach(function (c) {
      var label = document.createElement('label');
      label.className = 'chip';
      var input = document.createElement('input');
      input.className = 'vh';
      input.type = 'radio';
      input.name = 'count';
      input.value = String(c);
      var span = document.createElement('span');
      span.textContent = c === 'inf' ? '∞' : String(c);
      if (c === 'inf') label.title = 'No limit';
      label.appendChild(input);
      label.appendChild(span);
      row.appendChild(label);
    });
  }
  function pickedCount() {
    var i = document.querySelector('input[name="count"]:checked');
    if (!i) return null;
    return i.value === 'inf' ? 'inf' : parseInt(i.value, 10);
  }
  function clearCount() {
    document.querySelectorAll('input[name="count"]').forEach(function (i) { i.checked = false; });
  }

  /* ---------- drawing ---------- */
  var roomCode = '';
  function setRoom(code) { roomCode = code; $('lobbyCode').textContent = code; }

  function teamName(t) { return TEAMS[t].name; }
  function hint(id, text) {
    $(id).hidden = !text;
    if (text) $(id).textContent = text;
  }
  function tint(id, t) {
    var s = $(id);
    s.classList.remove('t0', 't1');
    s.classList.add(TEAMS[t].cls);
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function countText(c) { return c === 'inf' ? '∞' : String(c); }
  function box(cls, title, wide) {
    var b = document.createElement('div');
    b.className = 'score ' + cls + (wide ? ' wide' : '');
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = title;
    b.appendChild(name);
    return b;
  }
  function keyClass(k) { return k === null ? '' : 'k' + k; }

  // The 25 words. Tapping one is handled in main.js through data-card.
  function drawGrid(grid, v) {
    grid.textContent = '';
    v.cards.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      if (c.key !== null) b.classList.add(keyClass(c.key));
      if (c.key !== null && !c.shown) b.classList.add('key');
      if (c.shown) b.classList.add('shown');
      var live = v.canMark && !c.shown;
      if (live) b.classList.add('live');
      if (v.myMark === i) b.classList.add('mine');
      b.dataset.card = String(i);
      b.disabled = !live;
      var word = document.createElement('span');
      word.className = 'word';
      word.textContent = c.word;
      b.appendChild(word);
      var who = v.marks[i];
      var label = c.word;
      if (c.shown) label += ', ' + (c.key === 'n' ? 'bystander' : c.key === 'x' ? 'assassin' : teamName(c.key));
      else if (c.key !== null) label += ', ' + (c.key === 'n' ? 'bystander' : c.key === 'x' ? 'assassin' : teamName(c.key) + ' agent');
      if (who && who.length) {
        var marks = document.createElement('span');
        marks.className = 'marks';
        marks.textContent = who.map(function (p) { return p.name.slice(0, 3); }).join(' ');
        b.appendChild(marks);
        label += ', marked by ' + who.map(function (p) { return p.name; }).join(', ');
      }
      b.setAttribute('aria-label', label);
      grid.appendChild(b);
    });
  }

  function drawLog(v) {
    var list = $('log');
    list.textContent = '';
    $('logBox').hidden = !v.log.length;
    v.log.forEach(function (entry) {
      var li = document.createElement('li');
      var head = document.createElement('span');
      head.className = 'team-' + entry.team;
      head.textContent = teamName(entry.team) + ' · ' + countText(entry.count) + (entry.picks.length ? ': ' : '');
      li.appendChild(head);
      entry.picks.forEach(function (p, j) {
        var s = document.createElement('span');
        s.className = 'p' + p.key;
        s.textContent = p.word + (j < entry.picks.length - 1 ? ', ' : '');
        li.appendChild(s);
      });
      list.appendChild(li);
    });
  }

  function statusFor(v) {
    var team = teamName(v.active);
    var mineTurn = v.myTeam === v.active;
    var spy = v.spies[v.active];
    if (v.myTeam === null) return 'You\'re watching. Pick a team to join in as an operative.';
    if (v.phase === 'clue') {
      if (!spy) return team + ' has no spymaster. ' + (mineTurn ? 'Someone on your team can take over.' : 'Waiting for someone on ' + team + ' to take over.');
      if (v.canClue) return 'Say a one-word clue and a number out loud, then pick the number here.';
      return spy.name + ' is thinking of a clue for ' + team + '…';
    }
    if (v.phase === 'guess') {
      if (v.canMark) return v.myMark === null ? 'Talk it over, tap a word to mark it, then lock it in.' : 'Lock it in, or tap another word.';
      if (mineTurn && v.amSpy) return 'No hints! Your team is picking.';
      return team + ' is picking…';
    }
    return '';
  }

  function renderGame(v) {
    $('who').textContent = teamName(v.active) + '\'s turn' + (v.amSpy ? ' · you\'re the spymaster' : '');
    $('who').className = 'team-' + v.active;
    $('miniScore').textContent = 'Agents left: ' + teamName(0) + ' ' + v.remaining[0] + ' : ' + v.remaining[1] + ' ' + teamName(1);

    var clue = '';
    if (v.phase === 'guess') {
      clue = 'Clue for ' + countText(v.count) + ' · ' + (v.left === null ? 'no limit' : plural(v.left, 'pick') + ' left');
    }
    $('clue').textContent = clue;
    $('clue').className = 'clue team-' + v.active;
    drawGrid($('grid'), v);
    $('status').textContent = statusFor(v);

    if (!v.canClue) clearCount();
    $('joinRow').hidden = v.myTeam !== null;
    $('countField').hidden = !v.canClue;
    $('btnClue').hidden = !v.canClue;
    $('btnClue').disabled = pickedCount() === null;
    $('btnLock').hidden = !v.canMark;
    $('btnLock').disabled = v.myMark === null;
    $('btnPass').hidden = !v.canMark;
    $('btnPass').disabled = !v.canPass;
    $('btnTakeSpy').hidden = !(v.myTeam !== null && !v.spies[v.myTeam]);
    $('btnEnd').hidden = !v.isHost;
    drawLog(v);
  }

  function renderWin(v) {
    var w = v.winner;
    tint('s-win', w);
    $('winTitle').textContent = teamName(w) + ' team wins';
    $('winScore').textContent = v.reason === 'assassin'
      ? teamName(1 - w) + ' picked the assassin.'
      : teamName(w) + ' found all their agents.';
    drawGrid($('winGrid'), v);
    $('btnAgain').hidden = !v.isHost;
    $('btnAgain').disabled = !v.canStart;
    $('btnLobby').hidden = !v.isHost;
    var text = '';
    if (!v.isHost) text = 'Waiting for the host to start a new game.';
    else if (!v.canStart) text = 'Each team needs a spymaster and an operative. Go back to the lobby to sort out teams.';
    else text = 'Play again keeps the same teams. Go back to the lobby to swap spymasters.';
    hint('winHint', text);
  }

  function renderLobby(v) {
    $('lobbyCode').textContent = roomCode;
    $('team-0').checked = v.myTeam === 0;
    $('team-1').checked = v.myTeam === 1;
    var spy = v.myTeam === null ? null : v.spies[v.myTeam];
    $('spyToggle').checked = v.amSpy;
    $('spyToggle').disabled = v.myTeam === null || (!!spy && spy.id !== v.me);
    $('spyChip').querySelector('span').textContent = spy && spy.id !== v.me ? spy.name + ' is your spymaster' : 'I\'ll be the spymaster';

    var board = $('lobbyTeams');
    board.textContent = '';
    TEAMS.forEach(function (team, t) {
      var col = box(team.cls, team.name);
      var list = document.createElement('ul');
      var members = v.players.filter(function (p) { return p.team === t; });
      members.sort(function (a, b) { return (b.spy ? 1 : 0) - (a.spy ? 1 : 0); });
      members.forEach(function (p) {
        var li = document.createElement('li');
        li.textContent = p.name;
        if (p.id === v.me) li.className = 'you';
        if (p.spy) {
          var tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = ' · spymaster';
          li.appendChild(tag);
        }
        list.appendChild(li);
      });
      if (!members.length) {
        var none = document.createElement('li');
        none.className = 'empty';
        none.textContent = 'Nobody yet';
        list.appendChild(none);
      }
      col.appendChild(list);
      board.appendChild(col);
    });
    var picking = v.players.filter(function (p) { return p.team === null; }).map(function (p) { return p.name; });
    if (picking.length) {
      var p = document.createElement('p');
      p.className = 'hint wide';
      p.textContent = 'Still picking a team: ' + picking.join(', ');
      board.appendChild(p);
    }

    $('btnLobbyStart').hidden = !v.isHost;
    $('btnLobbyStart').disabled = !v.canStart;
    var status;
    if (v.myTeam === null) status = 'Pick a team.';
    else if (!v.isHost) status = 'Waiting for the host to start.';
    else if (!v.canStart) status = 'Each team needs a spymaster and at least one operative.';
    else status = 'Start when everyone is in.';
    $('lobbyStatus').textContent = status;
  }

  var SCREEN_FOR = { lobby: 's-lobby', clue: 's-game', guess: 's-game', win: 's-win' };

  var last = null;
  function render(v) {
    last = v;
    if (v.phase === 'lobby') renderLobby(v);
    else if (v.phase === 'win') renderWin(v);
    else renderGame(v);
    show(SCREEN_FOR[v.phase]);
  }
  // A number chip was tapped: only the clue button depends on it.
  function countChanged() { if (last) $('btnClue').disabled = pickedCount() === null; }

  // Leaving a game: forget the last view.
  function reset() {
    last = null;
    roomCode = '';
    clearCount();
  }

  initCounts();

  SS.ui = {
    $: $, show: show, render: render, reset: reset, setRoom: setRoom, busy: busy,
    pickedCount: pickedCount, countChanged: countChanged
  };
})(window.SS = window.SS || {});
