
const isStr = (v, min = 1, max = 200) => typeof v === "string" && v.trim().length >= min && v.length <= max;
const isEmail = (v) => isStr(v, 3, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
module.exports = { isStr, isEmail, isId };
