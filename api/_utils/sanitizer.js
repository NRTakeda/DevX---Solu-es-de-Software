export function sanitize(str) {
  if (!str) return '';
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}