require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./app");
const { initSocket } = require("./lib/socket");

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const server = http.createServer(app);
  initSocket(server);
  server.listen(process.env.PORT || 4000, () => console.log("API up"));
}
main().catch((e) => { console.error(e); process.exit(1); });
