/* Phrase Potato: the phrase lists. Add, remove or edit phrases here.
   To add a whole new category, add it to DECKS and to DECK_KEYS. */
(function (PP) {
  'use strict';

  var DECKS = {
    things: { label: 'Everyday things', items: [
      'Umbrella', 'Bathtub', 'Garage sale', 'Alarm clock', 'Shopping cart', 'Toothbrush',
      'Elevator music', 'Parking ticket', 'Lawn mower', 'Snow globe', 'Yoga mat', 'Vending machine',
      'Bunk bed', 'Fire extinguisher', 'Garden hose', 'Cheese grater', 'Rubber duck', 'Piggy bank',
      'Remote control', 'Sleeping bag', 'Photo booth', 'Wind chime', 'Trampoline', 'Roller coaster',
      'Bubble wrap', 'Fortune cookie', 'Disco ball', 'Hot air balloon', 'Lighthouse', 'Snowman',
      'Scarecrow', 'Sandcastle', 'Paper airplane', 'Rocking chair', 'Roller skates', 'Birthday candles',
      'Phone charger', 'Ice scraper', 'Slinky', 'Lava lamp'
    ] },
    food: { label: 'Food', items: [
      'Pancake stack', 'Grilled cheese', 'Poutine', 'Butter tart', 'Maple syrup', 'Ice cream cone',
      'Popcorn', 'Spaghetti and meatballs', 'Hot chocolate', 'Garlic bread', 'Potato chips', 'Fruit salad',
      'Marshmallow', 'Cinnamon bun', 'Sushi roll', 'Birthday cake', 'Peanut butter', 'Pumpkin pie',
      'Chicken wings', 'French fries', 'Hot dog', 'Nachos', 'Caesar salad', 'Chocolate chip cookie',
      'Cereal bowl', 'Bagel and cream cheese', 'Apple cider', 'Candy cane', 'Leftover pizza', 'Mac and cheese',
      'Corn on the cob', 'Milkshake', 'Dinner roll', 'Breakfast burrito', 'Cotton candy', 'Gingerbread house',
      'Frozen pizza', 'Soup of the day', 'Lemonade stand', 'Toasted marshmallow'
    ] },
    places: { label: 'Places', items: [
      'Airport security', 'Hockey rink', 'Laundromat', 'Movie theatre', 'Roller rink', 'Campground',
      'Dentist office', 'Public library', 'Subway platform', 'Water park', 'Petting zoo', 'Drive-in theatre',
      'Farmers market', 'Haunted house', 'Waiting room', 'Car wash', 'Mini golf', 'Cottage dock',
      'Ski hill', 'Bowling alley', 'Gas station', 'Parking garage', 'Playground', 'Bus stop',
      'Aquarium', 'Fairground', 'Locker room', 'Hotel lobby', 'Back seat of a car', 'Coffee shop',
      'Rooftop patio', 'School gym', 'Grocery aisle', 'Skating rink', 'Hardware store', 'Observation deck',
      'Corn maze', 'Snowy driveway', 'Ferris wheel', 'Truck stop'
    ] },
    phrases: { label: 'Sayings', items: [
      'Piece of cake', 'Break the ice', 'Under the weather', 'Spill the beans', 'Once in a blue moon', 'Cold feet',
      'Hit the hay', 'Bite the bullet', 'Let the cat out of the bag', 'Raining cats and dogs', 'Back to square one',
      'Cost an arm and a leg', 'Let sleeping dogs lie', 'Elephant in the room', 'Burning the midnight oil',
      'Jump on the bandwagon', 'Beat around the bush', 'Barking up the wrong tree', 'Out of the blue', 'The last straw',
      'Add fuel to the fire', 'Cry over spilled milk', 'Two birds with one stone', 'Time flies', 'Walking on eggshells',
      'Face the music', 'Throw in the towel', 'On thin ice', 'Pull my leg', 'Hold your horses',
      'Cut corners', 'Better late than never', 'Under the radar', 'Ballpark figure', 'Full of beans',
      'Hot potato', 'A grain of salt', 'Wild goose chase', 'Butterflies in your stomach', 'Icing on the cake'
    ] },
    actions: { label: 'Actions', items: [
      'Doing the dishes', 'Walking the dog', 'Shoveling snow', 'Tying shoelaces', 'Taking a selfie', 'Blowing bubbles',
      'Skipping rocks', 'Ordering takeout', 'Binge watching', 'Jumping rope', 'Playing hide and seek', 'Giving a high five',
      'Folding laundry', 'Carving a pumpkin', 'Making a snow angel', 'Stuck in traffic', 'Running late', 'Losing your keys',
      'Singing in the shower', 'Parallel parking', 'Waiting in line', 'Karaoke night', 'Building a fort', 'Raking leaves',
      'Roasting marshmallows', 'Texting a friend', 'Planting a garden', 'Going camping', 'Wrapping presents', 'Setting the table',
      'Telling a joke', 'Hitting snooze', 'Brushing your teeth', 'Making a wish', 'Tripping on the stairs', 'Catching a bus',
      'Sneaking a snack', 'Doing a puzzle', 'Learning to skate', 'Charging your phone'
    ] }
  };
  var DECK_KEYS = ['things', 'food', 'places', 'phrases', 'actions'];

  PP.DECKS = DECKS;
  PP.DECK_KEYS = DECK_KEYS;
})(window.PP = window.PP || {});
