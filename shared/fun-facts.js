// The top-left cat of the Halloween background shares fun facts in a speech bubble (CSS in fun-facts.css).
// A random fact each time the page loads.
(function () {
  var FACTS = [
    'Black cats are good luck in Britain and Japan!',
    'A group of cats is called a clowder.',
    'Cats sleep 12 to 16 hours a day.',
    'Cats can\'t taste sweet things.',
    'Cats have whiskers on the backs of their front legs.',
    'A black cat\'s fur can turn rusty brown in the sun.',
    'Pumpkins are fruit, not vegetables.',
    'The first jack-o\'-lanterns were carved from turnips.',
    'The heaviest pumpkin ever weighed over 1,200 kg!',
    'Bats are the only mammals that can truly fly.',
    'Vampire bats can run along the ground.',
    'Some bats live for over 40 years.',
    'My name is Miso!',
    'A group of bats is called a colony.',
    'Your skull is made of 22 bones.',
    'Babies have around 300 bones. Adults have 206.',
    'Halloween grew out of Samhain, an old Gaelic festival.',
    'Fear of Halloween is called samhainophobia.',
    'Candy corn has been around since the 1880s.',
    'Owls can\'t move their eyes, so they turn their heads.'
  ];

  document.addEventListener('DOMContentLoaded', function () {
    var bubble = document.createElement('p');
    bubble.className = 'fun-fact';
    bubble.textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
    document.body.appendChild(bubble);
  });
})();
