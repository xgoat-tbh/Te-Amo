// Randomized Game Custom Messages Store
const messages = {
    'among us': [
        "aajao. Seven ko kill kari 👳",
        "Emergency meeting! Who is the imposter? Join now!",
        "Sus alert! Someone is venting in electrical. Hop in!",
        "Tasks to complete and imposters to catch. Join the crew!",
        "Among Us lobby is heating up. We need more crewmates!",
        "Don't let the imposter win! Get in here!",
        "Who wants to get voted out first? Join the lobby!",
        "Green is looking clean, but red is definitely sus. Come play!",
        "Lobby is open, venting is allowed. Let's go!",
        "Crewmates assemble! The ship is leaving."
    ],
    'monopoly': [
        "Let's roll the dice and bankrupt our friends! Hop in!",
        "Boardwalk is waiting for a hotel. Join the board!",
        "Get out of jail free card is ready. Come play Monopoly!",
        "Who is going to control all the utilities today? Join now!",
        "Passing GO and collecting $200. Let's start!",
        "Time to build houses and destroy friendships!",
        "Monopoly board is set. Roll your way to victory!",
        "Who wants to buy Mayfair? Join the VC!",
        "Trade deals are about to go down. Get in here!",
        "Income tax is unpaid, but Monopoly is starting. Join!"
    ],
    'skribble': [
        "Time to showcase your terrible drawing skills! Join now!",
        "Is that a cat or a toaster? Guess the drawing in Skribble!",
        "Grab your digital paintbrushes, Skribble is starting!",
        "Who is the ultimate drawing champion? Let's find out!",
        "Drawing lines and guessing words. Hop in the VC!",
        "Terrible drawings and hilarious guesses. Join the fun!",
        "Artists and finger-painters assemble! Skribble time!",
        "Can you guess this 3-letter word? Join the game!",
        "Skribbl.io lobby is ready. Come laugh at some art!",
        "Time is ticking, start guessing!"
    ],
    'bgmi': [
        "Squad up! Let's get that Chicken Dinner 🍗",
        "Pochinki is calling! Drop in and loot up!",
        "Zone is shrinking, get in the car and join the VC!",
        "Where are we dropping today boys? Hop in!",
        "AWM is waiting for you. Join the BGMI squad!",
        "Enemy ahead! We need backup in BGMI!",
        "Let's push the ranks together. Get in here!",
        "Loot, shoot, and survive. BGMI lobby is live!",
        "Level 3 helmet is mine, but you can have the vest. Join up!",
        "Time for some classic battle royale action. Join now!"
    ],
    'codenames': [
        "Spymasters, give your clues! Codenames is live!",
        "Can you connect these 3 words? Join the blue/red team!",
        "Avoid the assassin card at all costs! Hop in!",
        "Word agents are in place. Spymasters ready!",
        "Who will guess the secret words first? Join Codenames!",
        "Red agent, blue agent, assassin. Let's play!",
        "Code names are set. Cryptic clues incoming!",
        "Time for some intellectual word association. Join up!",
        "Secret agents assemble in the VC!",
        "Will your team find all the words? Get in here!"
    ],
    'smashkarts': [
        "Time to fire some rockets and smash some karts! Hop in!",
        "Avoid the explosive barrels, race to the top!",
        "Smash Karts arena is loaded. Grab your weapons!",
        "Who is going to get blown up first? Join the kart chaos!",
        "Bullets, bombs, and speed. Kart battle starts now!",
        "Karting with guns! Let's smash some karts!",
        "Ready, set, shoot! Join the Smashkarts lobby!",
        "Upgrade your weapons and take out the leader!",
        "Power-ups are spawning, get in your karts!",
        "Drifting and blasting. Hop in the VC!"
    ],
    'stumble guys': [
        "Don't fall off! Stumble your way to the crown!",
        "Lava Land and Block Dash are waiting. Join the race!",
        "Who is going to qualify for the final round? Hop in!",
        "Stumble Guys lobby is open. Dodge those obstacles!",
        "Running, jumping, and stumbling. Let's play!",
        "Who has the best emotes for the win? Join now!",
        "Grab your stumble pass and join the VC!",
        "Time to qualify and leave everyone behind!",
        "Watch out for the swinging hammers! Join the chaos!",
        "Stumble, tumble, and win the crown!"
    ],
    'call of duty': [
        "Tactical nuke incoming! Join the COD squad!",
        "Search and Destroy is about to start. Get in here!",
        "Loadouts are ready, choose your class and join!",
        "UAV is online! We need boots on the ground!",
        "Rust or Shipment? Let's settle it in the VC!",
        "Stay frosty, soldier. COD lobby is loading!",
        "Time to secure the capture points. Join the fight!",
        "Cover me, I'm reloading! Hop in the VC!",
        "1v1 me on Rust! Or join our squad lobby!",
        "Gulag is closed, real battle is here. Join up!"
    ],
    'valorant': [
        "Planting the spike! We need a retake squad!",
        "Instalock Jett is already done, let's pick agents!",
        "Let's buy on eco and win the round. Hop in!",
        "Who wants to carry us to Radiant today? Join the VC!",
        "Lineups are ready, Brimstone ult online. Join up!",
        "Precise gunplay and utilities. Valorant lobby is live!",
        "Watch the flank! Join our rank push squad!",
        "Checking corners and landing headshots. Get in here!",
        "Sage, pocket heal me! Valorant VC is open!",
        "Matchmaking is queueing. Get in the lobby now!"
    ],
    'generic': [
        "New gaming session starting! What are we playing?",
        "Lobby is open for any game. Hop in the VC!",
        "Gaming night is live. Get in here!",
        "We need more players. Join the fun!",
        "Let's hang out and play some games!",
        "Bring your favorite game and join the VC!",
        "Casual gaming session in progress. Hop in!",
        "Who is down for some quick games? Join up!",
        "Multiplayer action is starting. Get in the voice channel!",
        "Gaming party is open. Join and invite your friends!"
    ]
};

/**
 * Returns a random message from the corresponding list based on the game name.
 * @param {string} gameName - The name of the game
 * @returns {string} - The random message
 */
function getRandomMessage(gameName) {
    if (!gameName) {
        return messages.generic[Math.floor(Math.random() * messages.generic.length)];
    }
    
    const lower = gameName.toLowerCase();
    
    // Find matching key within the message database keys
    for (const key of Object.keys(messages)) {
        if (key !== 'generic' && lower.includes(key)) {
            const arr = messages[key];
            return arr[Math.floor(Math.random() * arr.length)];
        }
    }
    
    // Fallback to generic
    return messages.generic[Math.floor(Math.random() * messages.generic.length)];
}

module.exports = { getRandomMessage };
