const classTones = [
  { accent: "#6d5bd0", soft: "#f0ebff", text: "#4937a7" },
  { accent: "#2b8bc6", soft: "#e8f5ff", text: "#146692" },
  { accent: "#2f9a72", soft: "#e7f7ef", text: "#176d4e" },
  { accent: "#d27a32", soft: "#fff1df", text: "#9a4f16" },
  { accent: "#c45f70", soft: "#ffedf0", text: "#913a4c" },
] as const;

function stableIndex(identifier: number | string): number {
  const input = String(identifier);
  let hash = 0;
  for (let index = 0; index < input.length; index += 1)
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  return Math.abs(hash) % classTones.length;
}

export function classColor(identifier: number | string) {
  return classTones[stableIndex(identifier)];
}
