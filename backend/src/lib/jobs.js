
const { Notification } = require("../models");

const handlers = {};
const queue = [];
let running = false;

const register = (type, fn) => { handlers[type] = fn; };

function enqueue(type, data) {
  queue.push({ type, data, attempts: 0 });
  if (!running) setImmediate(run);
}

async function run() {
  running = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await handlers[job.type](job.data);
    } catch (e) {
      job.attempts += 1;
      if (job.attempts < 3) {
        setTimeout(() => { queue.push(job); if (!running) setImmediate(run); }, 1000 * job.attempts);
      } else {
        console.error(`job ${job.type} failed permanently:`, e.message);
      }
    }
  }
  running = false;
}

register("task.assigned", async ({ workspaceId, assigneeId, title }) => {
  await Notification.create({ userId: assigneeId, workspaceId, message: `You were assigned: ${title}` });
});

module.exports = { register, enqueue };
