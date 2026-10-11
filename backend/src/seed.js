require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Workspace, Membership, Board, List, Task } = require("./models");
const { GAP } = require("./lib/ordering");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Workspace, Membership, Board, List, Task].map((m) => m.init()));
  const passwordHash = await bcrypt.hash("Password123!", 12);
  const owner = await User.create({ email: "owner@example.com", name: "Olivia Owner", passwordHash });
  const member = await User.create({ email: "member@example.com", name: "Max Member", passwordHash });
  const ws = await Workspace.create({ name: "Demo Workspace" });
  await Membership.create({ userId: owner._id, workspaceId: ws._id, role: "OWNER" });
  await Membership.create({ userId: member._id, workspaceId: ws._id, role: "MEMBER" });
  const board = await Board.create({ workspaceId: ws._id, name: "Sprint Board" });
  const names = ["To Do", "In Progress", "Done"];
  for (let i = 0; i < names.length; i++) {
    const list = await List.create({ workspaceId: ws._id, boardId: board._id, name: names[i], position: (i + 1) * GAP });
    for (let j = 0; j < 2; j++)
      await Task.create({ workspaceId: ws._id, boardId: board._id, listId: list._id, title: `${names[i]} task ${j + 1}`,
        labels: j ? ["bug"] : ["feature"], assigneeId: j ? member._id : owner._id, position: (j + 1) * GAP });
  }
  console.log("Seeded. Workspace id:", String(ws._id));
  process.exit(0);
})();
