/* Spy Spaghetti: online play comes from ../shared/net.js. Online only, so
   main.js never uses net.local. */
(function (SS) {
  'use strict';

  SS.net = Games.net(SS.rules);
})(window.SS = window.SS || {});
