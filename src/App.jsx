import { useMemo, useState } from "react";
import styles from "./styles";
import {
  formatValue,
  formatWeight,
  getComment,
  getPreviousDiff,
  shortDate,
  formatComment,
} from "./utils";

// ===== データ読み込み =====
function loadRecords() {
  try {
    const saved = localStorage.getItem("records");
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((record) => ({
        date: String(record.date ?? ""),
        weight: Number(record.weight),
      }))
      .filter((record) => record.date && !Number.isNaN(record.weight))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ===== カレンダー用 =====
function getMonthStart(dateStr) {
  return `${dateStr.slice(0, 7)}-01`;
}

function addMonths(monthStr, diff) {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 1 + diff, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  return `${year}年${month}月`;
}

function buildMonthCells(monthStr) {
  const [year, month] = monthStr.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatDateWithDay(dateStr) {
  const d = new Date(dateStr);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const day = days[d.getDay()];
  const [, month, date] = dateStr.split("-");
  return `${Number(month)}/${Number(date)}（${day}）`;
}

// ===== App本体 =====
export default function App() {
  const today = new Date().toISOString().slice(0, 10);

  const [page, setPage] = useState("top");
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [lastSavedDate, setLastSavedDate] = useState(today);
  const [hasSaved, setHasSaved] = useState(false);
  const [records, setRecords] = useState(loadRecords);

  const handleSave = () => {
    if (!weight) return;

    const normalized = String(weight).replace(",", ".").trim();
    const numericWeight = Number(normalized);
    if (Number.isNaN(numericWeight)) return;

    const newRecord = { date, weight: numericWeight };

    const filtered = records.filter((r) => r.date !== date);
    const updated = [...filtered, newRecord].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    setRecords(updated);
    localStorage.setItem("records", JSON.stringify(updated));
    setLastSavedDate(date);
    setHasSaved(true);
    setWeight("");
  };

  const handleDelete = (targetDate) => {
    const targetRecord = records.find((r) => r.date === targetDate);
    if (!targetRecord) return;

    const confirmed = window.confirm(
      `${targetRecord.date} の ${targetRecord.weight.toFixed(1)} kg の記録を削除しますか？`
    );

    if (!confirmed) return;

    const updated = records.filter((r) => r.date !== targetDate);
    setRecords(updated);
    localStorage.setItem("records", JSON.stringify(updated));

    setSelectedDate((prevSelected) => {
      if (prevSelected !== targetDate) return prevSelected;
      return updated.length > 0 ? updated[updated.length - 1].date : today;
    });

    setLastSavedDate((prevSaved) => {
      if (prevSaved !== targetDate) return prevSaved;
      return updated.length > 0 ? updated[updated.length - 1].date : today;
    });
  };

  // ===== 今日の体重カード用（トップ上部コメント欄は今は未使用だが維持）=====
  const latest = records.at(-1) ?? null;
  const prev = records.at(-2) ?? null;
  const first = records[0] ?? null;
  const isToday = latest ? latest.date === today : false;

  const diff =
    isToday && latest && prev
      ? (latest.weight - prev.weight).toFixed(1)
      : null;

  const total =
    isToday && latest && first
      ? (latest.weight - first.weight).toFixed(1)
      : null;

  const last7 = records.slice(-7);
  const avg =
    last7.length > 0
      ? (last7.reduce((s, r) => s + r.weight, 0) / last7.length).toFixed(1)
      : null;

  const avgDiff =
    isToday && latest && avg !== null
      ? (latest.weight - Number(avg)).toFixed(1)
      : null;

  const comment = isToday
    ? getComment(diff, total, avgDiff)
    : "今日の記録を入れると表示されます";

  // ===== トップページ用 =====
  const selectedRecord = records.find((r) => r.date === selectedDate) ?? null;

  const weekAverage = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const target = records.filter((r) => r.date >= startStr && r.date <= endStr);
    if (target.length === 0) return null;

    return target.reduce((acc, r) => acc + r.weight, 0) / target.length;
  }, [records, selectedDate]);

  const monthAverage = useMemo(() => {
    const prefix = selectedDate.slice(0, 7);
    const target = records.filter((r) => r.date.startsWith(prefix));
    if (target.length === 0) return null;

    return target.reduce((acc, r) => acc + r.weight, 0) / target.length;
  }, [records, selectedDate]);

  const recordsMap = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      map.set(record.date, record.weight);
    });
    return map;
  }, [records]);

  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  // ===== 記入ページ用 =====
  const reversedRecords = [...records].reverse();
  const selectedInputRecord = records.find((r) => r.date === selectedDate) ?? null;
  const selectedInputDiff = selectedInputRecord
    ? getPreviousDiff(records, selectedInputRecord.date)
    : null;

  const lastSavedRecord = records.find((r) => r.date === lastSavedDate) ?? null;
  const lastSavedDiff = lastSavedRecord
    ? getPreviousDiff(records, lastSavedRecord.date)
    : null;
  const lastSavedTotal =
    lastSavedRecord && first
      ? (lastSavedRecord.weight - first.weight).toFixed(1)
      : null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.appTitle}>からだメモ</h1>
        </header>

        <nav style={styles.tabRow}>
          <button
            onClick={() => {
              setPage("top");
              setHasSaved(false);
            }}
            style={{
              ...styles.tabButton,
              ...(page === "top" ? styles.tabButtonActive : {}),
            }}
          >
            トップ
          </button>

          <button
            onClick={() => {
              setPage("input");
              setHasSaved(false);
            }}
            style={{
              ...styles.tabButton,
              ...(page === "input" ? styles.tabButtonActive : {}),
            }}
          >
            記入
          </button>
        </nav>

        {page === "top" && (
          <>
            <section style={styles.summary}>
              <div style={styles.summaryHeader}>
                <div style={styles.summaryColumn}>
                  <div style={styles.sectionTitle}>日付</div>
                  <div style={styles.selectedDateText}>
                    {formatDateWithDay(selectedDate)}
                  </div>
                </div>

                <div style={styles.summaryColumn}>
                  <div style={styles.sectionTitle}>体重</div>
                  <div style={styles.mainWeight}>
                    {selectedRecord ? `${selectedRecord.weight.toFixed(1)} kg` : "--.- kg"}
                  </div>
                </div>
              </div>

              <div style={styles.metrics}>
                <div style={styles.metricGrid}>
                  <div style={styles.metricHalf}>
                    <span style={styles.metricName}>週平均</span>
                    <strong style={styles.metricValue}>{formatWeight(weekAverage)}</strong>
                  </div>

                  <div style={styles.metricHalf}>
                    <span style={styles.metricName}>月平均</span>
                    <strong style={styles.metricValue}>{formatWeight(monthAverage)}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.formCard}>
              <div style={styles.calendarHeader}>
                <button
                  onClick={() => setCalendarMonth((prevMonth) => addMonths(prevMonth, -1))}
                  style={styles.monthButton}
                >
                  ←
                </button>

                <div style={styles.calendarTitle}>{formatMonthLabel(calendarMonth)}</div>

                <button
                  onClick={() => setCalendarMonth((prevMonth) => addMonths(prevMonth, 1))}
                  style={styles.monthButton}
                >
                  →
                </button>
              </div>

              <div style={styles.weekdayRow}>
                {weekdayLabels.map((label) => (
                  <div key={label} style={styles.weekdayCell}>
                    {label}
                  </div>
                ))}
              </div>

              <div style={styles.calendarGrid}>
                {monthCells.map((cellDate, index) => {
                  if (!cellDate) {
                    return <div key={`blank-${index}`} style={styles.calendarBlankCell} />;
                  }

                  const isSelected = cellDate === selectedDate;
                  const weightValue = recordsMap.get(cellDate);
                  const dayNumber = Number(cellDate.slice(8, 10));

                  return (
                    <button
                      key={cellDate}
                      onClick={() => {
                        setSelectedDate(cellDate);
                        setCalendarMonth(getMonthStart(cellDate).slice(0, 7));
                      }}
                      style={{
                        ...styles.calendarCell,
                        ...(isSelected ? styles.calendarCellSelected : {}),
                      }}
                    >
                      <div style={styles.calendarDay}>{dayNumber}</div>
                      <div style={styles.calendarWeight}>
                        {weightValue !== undefined ? weightValue.toFixed(1) : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {page === "input" && (
          <>
            <section style={styles.formCard}>
              <div style={styles.sectionTitle}>入力</div>

              <div style={styles.inputRow}>
                <div style={styles.field}>
                  <div style={styles.labelRow}>
                    <label style={styles.label}>日付</label>
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.field}>
                  <div style={styles.labelRow}>
                    <label style={styles.label}>体重（kg）</label>
                    <span style={styles.hint}>例 52.3</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <button onClick={handleSave} style={styles.button}>
                登録 / 更新する
              </button>
            </section>

            {hasSaved && (
            <section style={styles.resultCard}>
              <div style={styles.resultDate}>{formatDateWithDay(lastSavedDate)} の記録</div>

              <div style={styles.resultMain}>
                {lastSavedRecord ? `${lastSavedRecord.weight.toFixed(1)} kg` : "--.- kg"}
              </div>

              <div style={styles.resultSub}>
                <span>前回比 {formatValue(lastSavedDiff)} kg</span>
                <span>開始時との差 {formatValue(lastSavedTotal)} kg</span>
              </div>
            </section>
            )}

            <section style={styles.historyCard}>
              <div style={styles.historyHeader}>
                <div style={styles.sectionTitle}>履歴</div>
                <div style={styles.countBadge}>{records.length}件</div>
              </div>

              {records.length === 0 ? (
                <div style={styles.emptyHistory}>まだ記録はありません</div>
              ) : (
                <>
                  <div style={styles.gridList}>
                    {reversedRecords.map((r) => {
                      const recordDiff = getPreviousDiff(records, r.date);
                      const isSelected = selectedDate === r.date;

                      return (
                        <button
                          key={r.date}
                          onClick={() => setSelectedDate(r.date)}
                          style={{
                            ...styles.gridCard,
                            ...(isSelected ? styles.gridCardSelected : {}),
                          }}
                        >
                          <div style={styles.gridDate}>{shortDate(r.date)}</div>
                          <div style={styles.gridWeight}>{r.weight.toFixed(1)} kg</div>
                          <div style={styles.gridDiff}>前回比 {formatValue(recordDiff)} kg</div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={styles.selectedCard}>
                    <button
                      onClick={() => selectedInputRecord && handleDelete(selectedInputRecord.date)}
                      style={styles.deleteMainButton}
                      disabled={!selectedInputRecord}
                    >
                      {selectedInputRecord
                        ? `${shortDate(selectedInputRecord.date)} の記録を削除する`
                        : "記録を削除する"}
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}