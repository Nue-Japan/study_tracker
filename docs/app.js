async function loadData() {
  const response = await fetch("./data/data.json");
  if (!response.ok) {
    throw new Error(`Failed to load data.json: ${response.status}`);
  }
  return response.json();
}

function setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function renderMetrics(summary) {
  setMetric("totalHours", summary.total_hours.toFixed(2));
  setMetric("totalSessions", String(summary.total_sessions));
  setMetric("studyDays", String(summary.study_days));
}

function renderDailyChart(daily) {
  const ctx = document.getElementById("dailyChart");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: daily.map((item) => item.date),
      datasets: [
        {
          label: "Hours",
          data: daily.map((item) => item.total_hours),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.25)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function renderSubjectChart(subjects) {
  const ctx = document.getElementById("subjectChart");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: subjects.map((item) => item.subject),
      datasets: [
        {
          label: "Hours",
          data: subjects.map((item) => item.total_hours),
          backgroundColor: "#0369a1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

async function main() {
  try {
    const data = await loadData();
    renderMetrics(data.summary);
    renderDailyChart(data.trends.daily);
    renderSubjectChart(data.trends.by_subject);
  } catch (error) {
    console.error(error);
    const container = document.querySelector(".container");
    container.insertAdjacentHTML(
      "beforeend",
      `<p style="color:#b91c1c;">Could not load study data.</p>`,
    );
  }
}

main();
