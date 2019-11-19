const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const SQLite = require("better-sqlite3");
const sql = new SQLite('./pointTracker.sqlite');
const talkedRecently = new Set();
const talkedRecentlyB = new Set();

client.on("ready", () => {

  // Check if the table "points" exists.
 const table = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'pointTracker';").get();
if (!table['count(*)']) {
    console.log("Restarting...");
    // If the table isn't there, create it and setup the database correctly.
    sql.prepare("CREATE TABLE pointTracker (id TEXT PRIMARY KEY, user TEXT, guild TEXT, points INTEGER, uses INTEGER);").run();
    // Ensure that the "id" row is always unique and indexed.
    sql.prepare("CREATE UNIQUE INDEX idx_pointTracker_id ON pointTracker (id);").run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
}
  console.log("Done!");
  // And then we have two prepared statements to get and set the score data.
  client.getScore = sql.prepare("SELECT * FROM pointTracker WHERE user = ? AND guild = ?");
  client.setScore = sql.prepare("INSERT OR REPLACE INTO pointTracker (id, user, guild, points, uses) VALUES (@id, @user, @guild, @points, @uses);");
});
function RandomNum(){
  return(Math.floor(Math.random()*100)+1);
}
client.on("message", message => {
  if (message.author.bot) return;
  let score;
  if (message.guild) {
    score = client.getScore.get(message.author.id, message.guild.id);
    if (!score) {
      score = { id: `${message.guild.id}-${message.author.id}`, user: message.author.id, guild: message.guild.id, points: 0, uses: 0 }
    }
    if (!talkedRecentlyB.has(message.author.id)) {
      score.points++;
      client.setScore.run(score);
      talkedRecentlyB.add(message.author.id);
      setTimeout(() => {
        // Removes the user from the set after a minute
        talkedRecentlyB.delete(message.author.id);
      }, 60000);
    }
  }
  if (message.content.indexOf(config.prefix) !== 0) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // Command-specific code here!

  if(command==="help"){
    score = client.getScore.get(message.author.id, message.guild.id);
    score.uses++;
    client.setScore.run(score);
    const embed = new Discord.RichEmbed()
      .setTitle("Help")
      .setAuthor(client.user.username, client.user.avatarURL)
      .setDescription("Here's all of my current commands!")
      .addField('tt!points', 'Check how many points you have.', true)
      .addField('tt!boost', 'Test your luck for a 10 point boost, though you might lose 10 points as well.', true)
      .addField('tt!rng', 'Random numbers <o<', true)
      .addField('tt!leaderboard', 'Check the 10 users with the most points.', true)
      .addField('tt!uses', 'Check how many times you have used this bot.', true)
      .setColor([3, 252, 207]);
      return message.channel.send({embed});
  }
  if(command==="boost"){
    score = client.getScore.get(message.author.id, message.guild.id);
    score.uses++;
    client.setScore.run(score);
    if (talkedRecently.has(message.author.id)) {
            message.reply("you're so impatient! I'll have to punish you! (Hint: the cooldown of boost is 5 hours)");
            score = client.getScore.get(message.author.id, message.guild.id);
            score.points -=10;
            client.setScore.run(score);
    }
    else {

    let chance = RandomNum();
      if(chance <30){
       message.channel.send("Hmph! I don't think so!");
        score = client.getScore.get(message.author.id, message.guild.id);
        score.points -= 10;
        client.setScore.run(score);
        talkedRecently.add(message.author.id);
       setTimeout(() => {
         // Removes the user from the set after a minute
         talkedRecently.delete(message.author.id);
       }, 18000000);
       return;
      }
      if(chance >=30 && chance<60){
          message.channel.send("Hmm... Maybe later");
        talkedRecently.add(message.author.id);
       setTimeout(() => {
         // Removes the user from the set after a minute
         talkedRecently.delete(message.author.id);
       }, 18000000);
       return;
      }
      if(chance >=60){
          message.channel.send("Ok! Here you go!");
        score = client.getScore.get(message.author.id, message.guild.id);
        score.points += 10;
        client.setScore.run(score);
        talkedRecently.add(message.author.id);
       setTimeout(() => {
         // Removes the user from the set after a minute
         talkedRecently.delete(message.author.id);
       }, 18000000);
       return;
      }
    }
  }
  if(command==="rng"){
    return message.reply("your number is " + RandomNum());
  }
  if(command==="uses"){
    score = client.getScore.get(message.author.id, message.guild.id);
    score.uses++;
    client.setScore.run(score);

    return message.reply(`you've used this bot's commands ${score.uses} times!`)
  }
  if(command === "points") {
    score = client.getScore.get(message.author.id, message.guild.id);
    score.uses++;
    client.setScore.run(score);
  return message.reply(`You currently have ${score.points} points`);
}
if(command === "give") {
  // Limited to guild owner - adjust to your own preference!
  if(!message.author.id === message.guild.owner) return;

  const user = message.mentions.users.first() || client.users.get(args[0]);
  if(!user) return message.reply("Please mention the target");

  const pointsToAdd = parseInt(args[1], 10);
  if(!pointsToAdd) return message.reply("Please enter an amount of points");

  // Get their current points.
  let userscore = client.getScore.get(user.id, message.guild.id);
  // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
  if (!userscore) {
    userscore = { id: `${message.guild.id}-${user.id}`, user: user.id, guild: message.guild.id, points: 0, uses: 0}
  }
  userscore.points += pointsToAdd;


  client.setScore.run(userscore);
  score.uses++;
  return message.channel.send(`${user.tag} has received ${pointsToAdd} points and now stands at ${userscore.points} points.`);
}

if(command === "leaderboard") {
  const top10 = sql.prepare("SELECT * FROM pointTracker WHERE guild = ? ORDER BY points DESC LIMIT 10;").all(message.guild.id);

    // Now shake it and show it! (as a nice embed, too!)
  const embed = new Discord.RichEmbed()
    .setTitle("Leaderboard")
    .setAuthor(client.user.username, client.user.avatarURL)
    .setDescription("Displaying current Leaderboard!")
    .setColor([3, 252, 207]);

  for(const data of top10) {
    embed.addField(client.users.get(data.user).tag, `${data.points} points`);
  }
  score.uses++;
  return message.channel.send({embed});
}
});

client.login(config.token);
