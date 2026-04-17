import { useMemo, useState } from "react";
import styles from "./styles";
import {
  formatValue,
  formatWeight,
  getPreviousDiff,
  shortDate,
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

function getCalendarPoint(dateStr, monthCells, records) {
  const index = monthCells.findIndex((cell) => cell === dateStr);
  if (index === -1) return null;

  const col = index % 7;
  const row = Math.floor(index / 7);

  const cellSize = 100 / 7;

  // ===== 体重取得 =====
  const record = records.find((r) => r.date === dateStr);
  if (!record) return null;

  const weights = records.map((r) => r.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = Math.max(max - min, 0.5);

  // ===== Y座標（ここが本質）=====
  const baseY = row * 20 + 12;
  const offset = ((record.weight - min) / range) * 10;

  const gapAdjust = col * 0.8;
  const x = col * cellSize + cellSize / 2 + gapAdjust;
  const y = baseY - offset;

  return { x, y };
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

    const filtered = records.filter((record) => record.date !== date);
    const updated = [...filtered, newRecord].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    setRecords(updated);
    localStorage.setItem("records", JSON.stringify(updated));
    setLastSavedDate(date);
    setHasSaved(true);
    setWeight("");
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
  };

  const handleDelete = (targetDate) => {
    const targetRecord = records.find((record) => record.date === targetDate);
    if (!targetRecord) return;

    const confirmed = window.confirm(
      `${targetRecord.date} の ${targetRecord.weight.toFixed(1)} kg の記録を削除しますか？`
    );

    if (!confirmed) return;

    const updated = records.filter((record) => record.date !== targetDate);
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

  const first = records[0] ?? null;

  // ===== トップページ用 =====
  const selectedRecord = records.find((record) => record.date === selectedDate) ?? null;

  const weekAverage = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const target = records.filter(
      (record) => record.date >= startStr && record.date <= endStr
    );
    if (target.length === 0) return null;

    return target.reduce((acc, record) => acc + record.weight, 0) / target.length;
  }, [records, selectedDate]);

  const monthAverage = useMemo(() => {
    const prefix = selectedDate.slice(0, 7);
    const target = records.filter((record) => record.date.startsWith(prefix));
    if (target.length === 0) return null;

    return target.reduce((acc, record) => acc + record.weight, 0) / target.length;
  }, [records, selectedDate]);

  const recordsMap = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      map.set(record.date, record.weight);
    });
    return map;
  }, [records]);

  const monthCells = useMemo(() => buildMonthCells(calendarMonth), [calendarMonth]);
  const selectedPoint = getCalendarPoint(selectedDate, monthCells, records)
  const allPoints = records
    .map((record) => getCalendarPoint(record.date, monthCells, records))
    .filter(Boolean);
  const groupedPoints = [];

  let currentGroup = [];
  let prevIndex = null;
  let prevRow = null;

  records
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((record) => {
      const index = monthCells.findIndex((d) => d === record.date);
      const point = getCalendarPoint(record.date, monthCells, records);

      if (!point || index === -1) return;

      const row = Math.floor(index / 7);

      const shouldBreak =
        prevIndex !== null &&
        (index !== prevIndex + 1 || row !== prevRow);

      if (shouldBreak) {
        if (currentGroup.length > 0) {
          groupedPoints.push(currentGroup);
        }
        currentGroup = [];
      }

      currentGroup.push(point);
      prevIndex = index;
      prevRow = row;
    });

  if (currentGroup.length > 0) {
    groupedPoints.push(currentGroup);
  }
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  // ===== 記入ページ用 =====
  const reversedRecords = [...records].reverse();
  const selectedInputRecord = records.find((record) => record.date === selectedDate) ?? null;

  const lastSavedRecord = records.find((record) => record.date === lastSavedDate) ?? null;
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
            <svg viewBox="0 0 100 100" style={styles.calendarOverlay}>
              {groupedPoints.map((group, i) => (
                <polyline
                  key={i}
                  points={group.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
              ))}

              {allPoints.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  fill="#94a3b8"
                />
              ))}

              {selectedPoint && (
                <circle
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r="2"
                  fill="#111827"
                />
              )}
            </svg>

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
                <div style={styles.resultDate}>
                  {formatDateWithDay(lastSavedDate)} の記録
                </div>

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
                    {reversedRecords.map((record) => {
                      const recordDiff = getPreviousDiff(records, record.date);
                      const isSelected = selectedDate === record.date;

                      return (
                        <button
                          key={record.date}
                          onClick={() => setSelectedDate(record.date)}
                          style={{
                            ...styles.gridCard,
                            ...(isSelected ? styles.gridCardSelected : {}),
                          }}
                        >
                          <div style={styles.gridDate}>{shortDate(record.date)}</div>
                          <div style={styles.gridWeight}>
                            {record.weight.toFixed(1)} kg
                          </div>
                          <div style={styles.gridDiff}>
                            前回比 {formatValue(recordDiff)} kg
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={styles.selectedCard}>
                    <button
                      onClick={() =>
                        selectedInputRecord && handleDelete(selectedInputRecord.date)
                      }
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