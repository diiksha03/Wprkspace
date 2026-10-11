const { Server } = require("socket.io");
const { verifyAccess } = require("./tokens");
const { Board, Membership } = require("../models");
const { isId } = require("./validate");

let io;

function initSocket(server) {
  io = new Server(server, { cors: { origin: process.env.FRONTEND_URL, credentials: true } });

  io.use((socket, next) => {
    try {
      socket.data.userId = verifyAccess(socket.handshake.auth?.token).sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("board:join", async (boardId, ack) => {
      try {

        if (!isId(boardId)) return ack?.(false);
        const board = await Board.findById(boardId);
        const m = board && await Membership.findOne({ userId: socket.data.userId, workspaceId: board.workspaceId });
        if (!m) return ack?.(false);
        socket.join(`board:${boardId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
    socket.on("board:leave", (boardId) => socket.leave(`board:${boardId}`));
  });
}

const emitBoard = (boardId, event, payload) => io?.to(`board:${boardId}`).emit(event, payload);

module.exports = { initSocket, emitBoard };
