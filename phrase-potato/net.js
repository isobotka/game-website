/* Phrase Potato: online play comes from ../shared/net.js. This adds the
   buzzer, which runs next to the rules on the host (or the one phone). */
(function (PP) {
  'use strict';

  var R = PP.rules;

  // Only this timer ends a round. Re-armed after every change, and when the tab
  // comes back from the background, so a sleeping phone buzzes as soon as it wakes.
  function schedule(session) {
    clearTimeout(session.timer);
    session.timer = null;
    var s = session.state;
    if (s.phase !== 'playing') return;
    var left = Math.max(0, s.roundMs - (Date.now() - s.roundStartedAt));
    session.timer = setTimeout(function () { session.dispatch({ type: 'BUZZ' }, R.TIMER); }, left);
  }

  PP.net = Games.net(R, {
    start: function (session) {
      session.timer = null;
      session.onVisible = function () { if (document.visibilityState === 'visible') schedule(session); };
      document.addEventListener('visibilitychange', session.onVisible);
    },
    change: schedule,
    stop: function (session) {
      clearTimeout(session.timer);
      document.removeEventListener('visibilitychange', session.onVisible);
    }
  });
})(window.PP = window.PP || {});
