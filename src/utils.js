// ===== コメント関連 =====
export function getComment(diff, totalDiff, diffFromAverage7) {
  if (diff === null || diffFromAverage7 === null) {
    return "もう少し記録がたまると見やすくなる";
  }

  const diffNum = Number(diff);
  const avgNum = Number(diffFromAverage7);

  if (diffNum >= 0.5 && avgNum > 0) {
    return "昨日より増えてるね。たまたまかもしれないから、気にしすぎなくて大丈夫。";
  }

  if (diffNum > 0 && avgNum <= 0) {
    return "昨日よりちょっと増えてるけど、一時的なものかも。";
  }

  if (diffNum <= -0.5 && avgNum < 0) {
    return "昨日より減ってるね。ここ数日の中でも多めに減ったね。";
  }

  if (diffNum < 0 && avgNum >= 0) {
    return "昨日よりちょっと減ってるね。順調に減っていってるよ。";
  }

  return "今日は大きな動きはないね。このまま続けていこう。";
}

export function formatComment(text) {
  return text.split("。").filter(Boolean).join("。\n") + "。";
}

// ===== 表示用の補助関数 =====
export function formatValue(v) {
  if (v === null) return "-";
  return `${Number(v) > 0 ? "+" : ""}${v}`;
}

export function formatWeight(v) {
  if (v === null || v === undefined) return "--.- kg";
  return `${Number(v).toFixed(1)} kg`;
}

export function getPreviousDiff(records, targetDate) {
  const index = records.findIndex((r) => r.date === targetDate);
  if (index <= 0) return null;

  const current = records[index];
  const prev = records[index - 1];
  return (current.weight - prev.weight).toFixed(1);
}

export function shortDate(dateStr) {
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}/${Number(day)}`;
}