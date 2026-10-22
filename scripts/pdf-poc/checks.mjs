export function assertPages(expected, actual) {
  if (expected.length !== actual.length) throw Error('INCOMPLETE: page count');
  expected.forEach((p, i) => {
    const q = actual[i];
    if (q.index !== i + 1 || p.index !== q.index) throw Error('INCOMPLETE: page order');
    if (Math.abs(p.width - q.width) > 0.01 || Math.abs(p.height - q.height) > 0.01)
      throw Error('INCOMPLETE: page dimensions');
    if (p.sourceHash !== q.sourceHash) throw Error('INCOMPLETE: source page identity');
  });
}
export function imageError(a, b) {
  if (a.length !== b.length || !a.length) throw Error('INCOMPLETE: pixel dimensions');
  let sum = 0, count = 0, edgeSum = 0, edgeCount = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ink = Math.min(a[i], a[i + 1], a[i + 2]) < 240;
    for (let k = 0; k < 3; k++) {
      const d = (a[i + k] - b[i + k]) ** 2; sum += d; count++;
      if (ink) { edgeSum += d; edgeCount++; }
    }
  }
  return { rmse: Math.sqrt(sum / count), inkRmse: edgeCount ? Math.sqrt(edgeSum / edgeCount) : 0 };
}
