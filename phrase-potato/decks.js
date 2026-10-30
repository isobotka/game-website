/* Phrase Potato: the phrase lists. Add, remove or edit phrases here.
   To add a whole new category, add it to DECKS and to DECK_KEYS.
   Each phrase should appear only once across all decks (the tests check). */
(function (PP) {
  'use strict';

  var DECKS = {
    things: { label: 'Everyday things', items: [
      'Inside-out umbrella', 'Junk drawer', 'Garage sale', 'Alarm clock', 'Wobbly shopping cart', 'Electric toothbrush',
      'Elevator music', 'Parking ticket', 'Lawn mower', 'Snow globe', 'Yoga mat', 'Vending machine',
      'Bunk bed', 'Fire extinguisher', 'Tangled garden hose', 'Cheese grater', 'Rubber duck', 'Piggy bank',
      'Lost TV remote', 'Sleeping bag', 'Photo booth', 'Wind chime', 'Trampoline', 'Bubble wrap',
      'Fortune cookie', 'Disco ball', 'Hot air balloon', 'Lighthouse', 'Snowman with a carrot nose', 'Scarecrow',
      'Sandcastle', 'Paper airplane', 'Rocking chair', 'Roller skates', 'Trick birthday candles', 'Phone charger',
      'Ice scraper', 'Slinky', 'Lava lamp', 'Sock with a hole', 'Self-checkout machine', 'Whoopee cushion',
      'Rubber band ball', 'Fridge magnet', 'Smoke alarm', 'Hockey stick', 'Toque with a pom-pom', 'Snow shovel',
      'Mitten clips', 'Fuzzy slippers', 'Squeaky floorboard', 'Bean bag chair', 'Hula hoop', 'Magic 8 ball',
      'Kazoo', 'Pool noodle', 'Inflatable flamingo', 'Ugly holiday sweater', 'Tinfoil hat', 'Tape measure',
      'Plunger', 'Toilet paper roll', 'Lint roller', 'Stapler', 'Sticky note', 'Paper shredder',
      'Leaf blower', 'Garden gnome', 'Bird feeder', 'Mood ring', 'Fanny pack', 'Name tag',
      'Selfie stick', 'Doorbell camera', 'Robot vacuum', 'Rubik\'s cube', 'Jack-in-the-box', 'Jigsaw puzzle',
      'Bowling ball', 'Fly swatter', 'Can opener', 'Salad spinner', 'Pizza cutter', 'Waffle iron',
      'Kettle', 'Tea bag', 'Stuffed animal', 'Night light', 'Baby monitor', 'Mousetrap',
      'Treasure map', 'Message in a bottle', 'Wishing well', 'Time capsule', 'Pinata', 'Party hat',
      'Confetti cannon', 'Glow stick', 'Water balloon', 'Squirt gun', 'Kite stuck in a tree', 'Library card'
    ] },
    food: { label: 'Food', items: [
      'Pancake stack', 'Grilled cheese', 'Poutine', 'Butter tart', 'Maple syrup', 'Melting ice cream cone',
      'Burnt microwave popcorn', 'Spaghetti and meatballs', 'Hot chocolate with marshmallows', 'Garlic bread', 'Ketchup chips', 'Fruit salad',
      'Cinnamon bun', 'Sushi roll', 'Birthday cake', 'Peanut butter and jelly', 'Pumpkin pie', 'Chicken wings',
      'French fries', 'Ballpark hot dog', 'Nachos', 'Caesar salad', 'Chocolate chip cookie', 'Soggy cereal',
      'Bagel and cream cheese', 'Apple cider', 'Candy cane', 'Last slice of pizza', 'Mac and cheese', 'Corn on the cob',
      'Milkshake', 'Breakfast burrito', 'Cotton candy', 'Gingerbread house', 'Lemonade stand', 'S\'mores',
      'Mystery casserole', 'Nanaimo bar', 'Beaver tail', 'Timbits', 'Double double', 'Peameal bacon',
      'Maple taffy on snow', 'Bannock', 'Tourtiere', 'Montreal bagel', 'Smoked meat sandwich', 'Caesar cocktail',
      'Fondue', 'Taco Tuesday', 'Lasagna', 'Chicken noodle soup', 'Fish and chips', 'Shepherd\'s pie',
      'Pad thai', 'Butter chicken', 'Dumplings', 'Ramen noodles', 'Burrito bowl', 'Pierogi',
      'Tea party', 'Chocolate fountain', 'Jelly beans', 'Gummy bears', 'Bubble gum', 'Rock candy',
      'Candy apple', 'Funnel cake', 'Corn dog', 'Deep-fried pickle', 'Banana split', 'Root beer float',
      'Freezie', 'Popsicle', 'Slushie brain freeze', 'Ice cream sandwich', 'Sprinkles', 'Whipped cream',
      'Deviled eggs', 'Eggs Benedict', 'Avocado toast', 'French toast', 'Chicken and waffles', 'Bacon and eggs',
      'Brussels sprouts', 'Broccoli', 'Spicy pepper', 'Pickle jar', 'Jalapeno poppers', 'Onion rings',
      'Charcuterie board', 'Fruitcake', 'Turkey dinner', 'Cranberry sauce', 'Stuffing', 'Instant noodles',
      'Sour candy', 'Lunchbox sandwich', 'Hot sauce', 'Food truck', 'Potluck', 'Kids\' menu'
    ] },
    places: { label: 'Places', items: [
      'Airport security', 'Hockey rink', 'Laundromat', 'Movie theatre', 'Roller rink', 'Campground',
      'Dentist office', 'Public library', 'Subway platform', 'Water park', 'Petting zoo', 'Drive-in theatre',
      'Farmers market', 'Haunted house', 'Waiting room', 'Car wash', 'Mini golf', 'Cottage dock',
      'Ski hill', 'Bowling alley', 'Gas station', 'Parking garage', 'Playground at recess', 'Bus stop in the rain',
      'Aquarium', 'Fairground', 'Locker room', 'Hotel lobby', 'Back seat of a car', 'Coffee shop',
      'Rooftop patio', 'School gym', 'Grocery aisle', 'Hardware store', 'Observation deck', 'Corn maze',
      'Snowy driveway', 'Ferris wheel', 'Truck stop', 'Lost and found bin', 'Kids\' table at Thanksgiving', 'Line at the DMV',
      'Principal\'s office', 'Hospital waiting room', 'Escape room', 'Bouncy castle', 'Ball pit', 'Treehouse',
      'Igloo', 'Frozen lake', 'Sugar shack', 'Canoe trip', 'Tim Hortons drive-thru', 'Outdoor skating rink',
      'Niagara Falls', 'CN Tower', 'Rocky Mountains', 'Northern lights', 'Desert island', 'Volcano',
      'Surface of the moon', 'Space station', 'Submarine', 'Pirate ship', 'Castle', 'Dungeon',
      'Secret passage', 'Attic full of junk', 'Basement', 'Garage band practice', 'Sleepover', 'Summer camp',
      'Cabin in the woods', 'Haunted hotel', 'Wax museum', 'Art gallery', 'Museum gift shop', 'Dinosaur museum',
      'Science fair', 'Talent show', 'Spelling bee', 'Wedding reception', 'Dance floor', 'Karaoke bar',
      'Arcade', 'Laser tag arena', 'Trampoline park', 'Go-kart track', 'Circus tent', 'Magic show',
      'Gym class', 'Detention', 'Cafeteria', 'Hallway lockers', 'Parent-teacher night', 'Fire drill',
      'Car dealership', 'Toll booth', 'Rest stop', 'Moving truck', 'Open house', 'IKEA showroom'
    ] },
    phrases: { label: 'Sayings', items: [
      'Piece of cake', 'Break the ice', 'Under the weather', 'Spill the beans', 'Once in a blue moon', 'Cold feet',
      'Hit the hay', 'Bite the bullet', 'Let the cat out of the bag', 'Raining cats and dogs', 'Back to square one',
      'Cost an arm and a leg', 'Let sleeping dogs lie', 'Elephant in the room', 'Burning the midnight oil',
      'Jump on the bandwagon', 'Beat around the bush', 'Barking up the wrong tree', 'Out of the blue', 'The last straw',
      'Add fuel to the fire', 'Cry over spilled milk', 'Two birds with one stone', 'Time flies', 'Walking on eggshells',
      'Face the music', 'Throw in the towel', 'On thin ice', 'Pull my leg', 'Hold your horses',
      'Cut corners', 'Better late than never', 'Under the radar', 'Ballpark figure', 'Full of beans',
      'Hot potato', 'A grain of salt', 'Wild goose chase', 'Butterflies in your stomach', 'Icing on the cake',
      'When pigs fly', 'Don\'t count your chickens', 'Curiosity killed the cat', 'The early bird gets the worm', 'Actions speak louder than words',
      'Every cloud has a silver lining', 'Don\'t judge a book by its cover', 'The ball is in your court', 'Kill time', 'Break a leg',
      'Go the extra mile', 'Hit the nail on the head', 'In the same boat', 'Keep your chin up', 'Let off steam',
      'Miss the boat', 'No pain, no gain', 'On cloud nine', 'Over the moon', 'Put a sock in it',
      'Rain check', 'Sit on the fence', 'Sleep on it', 'Speak of the devil', 'Steal the show',
      'Cat got your tongue', 'Through thick and thin', 'Tie the knot', 'Up in the air', 'You can\'t have your cake and eat it too',
      'All bark and no bite', 'Apple of my eye', 'Bent out of shape', 'Bull in a china shop', 'Couch potato',
      'Cool as a cucumber', 'Drop of a hat', 'Fish out of water', 'Get your ducks in a row', 'Head in the clouds',
      'Jack of all trades', 'Keep your eyes peeled', 'Like a kid in a candy store', 'Monkey business', 'Needle in a haystack',
      'Not my cup of tea', 'Paint the town red', 'Rome wasn\'t built in a day', 'Steal someone\'s thunder', 'Teach an old dog new tricks',
      'The whole nine yards', 'Turn over a new leaf', 'Water under the bridge', 'You snooze, you lose', 'Zip your lip',
      'Bread and butter', 'Chicken scratch', 'Egg on your face', 'Go bananas', 'In a pickle'
    ] },
    actions: { label: 'Actions', items: [
      'Doing the dishes', 'Walking the dog', 'Shoveling snow', 'Tying shoelaces', 'Taking a selfie', 'Blowing bubbles',
      'Skipping rocks', 'Ordering takeout', 'Binge watching', 'Jumping rope', 'Playing hide and seek', 'Missing a high five',
      'Folding a fitted sheet', 'Carving a pumpkin', 'Making a snow angel', 'Stuck in traffic', 'Running late', 'Losing your keys',
      'Singing in the shower', 'Parallel parking', 'Waiting in line', 'Building a pillow fort', 'Jumping into a leaf pile', 'Roasting marshmallows',
      'Texting the wrong person', 'Planting a garden', 'Pitching a tent', 'Wrapping presents', 'Setting the table', 'Telling a bad joke',
      'Hitting snooze', 'Making a wish', 'Tripping on the stairs', 'Chasing a bus', 'Sneaking a snack', 'Learning to skate',
      'Pretending to be asleep', 'Assembling IKEA furniture', 'Stubbing your toe', 'Cracking your knuckles', 'Getting a haircut', 'Waving at someone who wasn\'t waving at you',
      'Sneezing in a quiet room', 'Forgetting someone\'s name', 'Walking into a glass door', 'Stepping on a Lego', 'Spilling coffee', 'Dropping your phone in the toilet',
      'Locking yourself out', 'Getting the hiccups', 'Burning toast', 'Sending a voice message', 'Doing the wave', 'Holding the door',
      'Flipping pancakes', 'Juggling', 'Doing a cartwheel', 'Moonwalking', 'Air guitar', 'Doing the floss',
      'Knitting a scarf', 'Tobogganing', 'Having a snowball fight', 'Ice fishing', 'Paddling a canoe', 'Portaging',
      'Swatting a mosquito', 'Applying sunscreen', 'Cannonball into the pool', 'Learning to ride a bike', 'Changing a flat tire', 'Getting lost',
      'Asking for directions', 'Reading a map upside down', 'Packing a suitcase', 'Missing your flight', 'Taking a nap', 'Sleepwalking',
      'Snoring', 'Brushing a cat', 'Giving the dog a bath', 'Teaching a dog to sit', 'Feeding the ducks', 'Bird watching',
      'Picking a lock', 'Hiding a surprise party', 'Popping a balloon', 'Opening a jar', 'Unclogging a drain', 'Changing a light bulb',
      'Hanging a picture crooked', 'Painting a fence', 'Mowing the lawn', 'Washing the car', 'Taking out the trash', 'Online shopping',
      'Haggling at a garage sale', 'Waiting for the microwave', 'Speed walking', 'Doing push-ups', 'Stretching before a race', 'Crossing the finish line',
      'Spinning in an office chair', 'Doing a crossword', 'Thumb wrestling', 'Rock paper scissors', 'Playing charades', 'Practising a speech'
    ] }
  };
  var DECK_KEYS = ['things', 'food', 'places', 'phrases', 'actions'];

  PP.DECKS = DECKS;
  PP.DECK_KEYS = DECK_KEYS;
})(window.PP = window.PP || {});
