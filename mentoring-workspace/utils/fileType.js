// services/mentoring-workspace/utils/fileType.js

/**
 * Maps a MIME type to the short label stored on a Note and shown in the UI.
 * Same rules as the monolith's `getFileType`, with two deliberate changes: a
 * guard for a missing type, and legacy PowerPoint (`application/vnd.ms-powerpoint`)
 * now maps to "ppt" (the monolith returned "other" for it).
 */
const getFileType = (mimetype) => {
  const type = String(mimetype || "");
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.includes("word")) return "doc";
  if (type.includes("presentation") || type.includes("powerpoint"))
    return "ppt";
  if (type.includes("excel") || type.includes("spreadsheet")) return "excel";
  if (type === "text/plain") return "txt";
  return "other";
};

module.exports = { getFileType };
