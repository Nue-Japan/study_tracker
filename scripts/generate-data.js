#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LOGS_DIR = path.join(ROOT, "logs");
const OUTPUT_FILE = path.join(ROOT, "docs", "data", "data.json");

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".md")) {
      const fileName = entry.name.toLowerCase();
      if (fileName === "template.md" || fileName.startsWith("_")) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatterBlock(content, filePath) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath}: missing or invalid frontmatter block`);
  }

  const [, frontmatterRaw, bodyRaw] = match;
  const metadata = {};
  const lines = frontmatterRaw.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const keyValueMatch = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.+)$/);
    if (!keyValueMatch) {
      throw new Error(`${filePath}: invalid frontmatter line "${rawLine}"`);
    }

    const [, key, rawValue] = keyValueMatch;
    metadata[key] = parseScalarOrArray(rawValue.trim());
  }

  return { metadata, body: bodyRaw.trim() };
}

function parseScalarOrArray(value) {
  if (value.startsWith("[") && value.endsWith("]")) {
    const listBody = value.slice(1, -1).trim();
    if (!listBody) {
      return [];
    }
    return listBody
      .split(",")
      .map((item) => normalizeString(item.trim()))
      .filter(Boolean);
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }

  return normalizeString(value);
}

function normalizeString(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function validateAndNormalizeLog(parsed, filePath) {
  const { metadata, body } = parsed;
  const date = metadata.date;
  const duration = metadata.duration_minutes;
  const subject = metadata.subject;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${filePath}: "date" must be YYYY-MM-DD`);
  }

  const normalizedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(normalizedDate.getTime())) {
    throw new Error(`${filePath}: invalid date "${date}"`);
  }

  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error(
      `${filePath}: "duration_minutes" must be a positive integer`,
    );
  }

  if (typeof subject !== "string" || !subject.trim()) {
    throw new Error(`${filePath}: "subject" must be a non-empty string`);
  }

  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.map((tag) => String(tag))
    : [];

  return {
    date,
    duration_minutes: duration,
    subject: subject.trim(),
    tags,
    notes: body,
    source_file: path.relative(ROOT, filePath).replaceAll(path.sep, "/"),
  };
}

function buildAggregates(logs) {
  const totalMinutes = logs.reduce((sum, log) => sum + log.duration_minutes, 0);
  const byDateMap = new Map();
  const bySubjectMap = new Map();

  for (const log of logs) {
    byDateMap.set(log.date, (byDateMap.get(log.date) || 0) + log.duration_minutes);

    const subjectStats = bySubjectMap.get(log.subject) || {
      subject: log.subject,
      total_minutes: 0,
      sessions: 0,
    };

    subjectStats.total_minutes += log.duration_minutes;
    subjectStats.sessions += 1;
    bySubjectMap.set(log.subject, subjectStats);
  }

  const daily = Array.from(byDateMap.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, minutes]) => ({
      date,
      total_minutes: minutes,
      total_hours: roundToTwo(minutes / 60),
    }));

  const bySubject = Array.from(bySubjectMap.values())
    .sort((a, b) => b.total_minutes - a.total_minutes)
    .map((entry) => ({
      ...entry,
      total_hours: roundToTwo(entry.total_minutes / 60),
    }));

  const studyDays = byDateMap.size;

  return {
    summary: {
      total_sessions: logs.length,
      total_minutes: totalMinutes,
      total_hours: roundToTwo(totalMinutes / 60),
      study_days: studyDays,
      average_minutes_per_study_day:
        studyDays > 0 ? roundToTwo(totalMinutes / studyDays) : 0,
    },
    trends: {
      daily,
      by_subject: bySubject,
    },
  };
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function main() {
  const markdownFiles = walkMarkdownFiles(LOGS_DIR);
  const logs = markdownFiles
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = parseFrontmatterBlock(content, filePath);
      return validateAndNormalizeLog(parsed, filePath);
    })
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.source_file.localeCompare(b.source_file);
      }
      return a.date.localeCompare(b.date);
    });

  const { summary, trends } = buildAggregates(logs);
  const payload = {
    generated_at: new Date().toISOString(),
    source_pattern: "logs/**/*.md",
    logs,
    summary,
    trends,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");

  process.stdout.write(
    `Generated ${path.relative(ROOT, OUTPUT_FILE)} from ${logs.length} logs.\n`,
  );
}

main();
