/* =========================================================================
   GitHub activity — put your details here
   =========================================================================

   Pick ONE of the two options below.

   Option A (recommended, safe for a public site)
     Point `proxyUrl` at an endpoint you control — a serverless function, a
     Worker, anything — that holds the token server-side and returns the
     calendar JSON. Nothing secret ends up in this file.

   Option B (fine for local use only)
     Put a fine-grained GitHub token with `read:user` in `token`. Anyone who
     opens devtools on a deployed site can read it, so treat this as a
     development shortcut and rotate the token if it ever ships.

   Leave both blank and the section renders sample data with a note.
   ========================================================================= */

const GITHUB = {
  username: "yourhandle",

  // Option A
  proxyUrl: "", // e.g. "https://your-worker.example.com/contributions"

  // Option B
  endpoint: "https://api.github.com/graphql",
  token: "",
};

/* Both shapes below are accepted, so a proxy can forward GitHub's response
   untouched or send back the trimmed version. */
const CONTRIBUTIONS_QUERY = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { date contributionCount weekday }
          }
        }
      }
    }
  }
`;

/* =========================================================================
   Theme
   ========================================================================= */

const root = document.documentElement;
const toggle = document.querySelector("#theme-toggle");

const labelTheme = () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  toggle.setAttribute("aria-label", `Switch to ${next} theme`);
};

labelTheme();

toggle.addEventListener("click", () => {
  const apply = () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", root.dataset.theme);
    } catch {}
    labelTheme();
  };

  if (
    document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
});

/* =========================================================================
   Nav: mark the section currently in view
   ========================================================================= */

const links = [...document.querySelectorAll(".nav a[href^='#']")];
const targets = links
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if (targets.length) {
  const spy = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;

      for (const link of links) {
        link.classList.toggle(
          "is-current",
          link.getAttribute("href") === `#${visible.target.id}`,
        );
      }
    },
    { rootMargin: "-25% 0px -60% 0px", threshold: [0.01, 0.25, 0.6] },
  );

  targets.forEach((target) => spy.observe(target));
}

/* =========================================================================
   Copy email
   ========================================================================= */

const copyButton = document.querySelector("#copy-email");

copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copyButton.dataset.email);
    copyButton.textContent = "Copied";
  } catch {
    copyButton.textContent = "Press ⌘C";
  }
  setTimeout(() => (copyButton.textContent = "Copy"), 1600);
});

document.querySelector("#year").textContent = new Date().getFullYear();

/* =========================================================================
   Contribution calendar
   ========================================================================= */

const el = {
  status: document.querySelector("#gh-status"),
  body: document.querySelector("#gh-body"),
  scroll: document.querySelector("#gh-scroll"),
  months: document.querySelector("#gh-months"),
  grid: document.querySelector("#gh-grid"),
  foot: document.querySelector("#gh-foot"),
  total: document.querySelector("#gh-total"),
  profile: document.querySelector("#gh-profile-link"),
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Last 52 full weeks, starting on a Sunday. */
function range() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 364);
  from.setDate(from.getDate() - from.getDay());
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Accepts GitHub's raw GraphQL response or a flat { totalContributions, weeks } object. */
function normalise(payload) {
  const calendar =
    payload?.data?.user?.contributionsCollection?.contributionCalendar ??
    payload?.user?.contributionsCollection?.contributionCalendar ??
    payload?.contributionCalendar ??
    payload;

  const weeks = calendar?.weeks;
  if (!Array.isArray(weeks)) throw new Error("Unexpected response shape");

  const days = weeks.flatMap((week) =>
    (week.contributionDays ?? week.days ?? []).map((day) => ({
      date: day.date,
      count: day.contributionCount ?? day.count ?? 0,
    })),
  );

  if (!days.length) throw new Error("No contribution days in response");

  return {
    total:
      calendar.totalContributions ??
      days.reduce((sum, day) => sum + day.count, 0),
    days,
  };
}

async function load() {
  if (GITHUB.proxyUrl) {
    const res = await fetch(GITHUB.proxyUrl, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
    return normalise(await res.json());
  }

  if (GITHUB.token) {
    const { from, to } = range();
    const res = await fetch(GITHUB.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: CONTRIBUTIONS_QUERY,
        variables: { login: GITHUB.username, from, to },
      }),
    });

    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);

    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return normalise(json);
  }

  return null; // nothing configured
}

/** Deterministic stand-in so the section still looks like itself before setup. */
function sample() {
  const days = [];
  const start = new Date();
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 371; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (date > new Date()) break;

    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const wave = (Math.sin(i / 9) + 1) / 2;
    const seeded = ((i * 2654435761) % 97) / 97;
    const count = Math.round(wave * seeded * (weekend ? 4 : 11));

    days.push({ date: date.toISOString().slice(0, 10), count });
  }

  return { total: days.reduce((sum, day) => sum + day.count, 0), days };
}

function level(count, max) {
  if (count <= 0) return 0;
  return Math.min(4, Math.ceil((count / Math.max(max, 1)) * 4));
}

function render({ total, days }) {
  const max = days.reduce((peak, day) => Math.max(peak, day.count), 0);

  // Pad so the first column starts on a Sunday.
  const lead = new Date(`${days[0].date}T00:00:00`).getDay();
  const cells = [...Array.from({ length: lead }, () => null), ...days];

  el.grid.replaceChildren();
  el.months.replaceChildren();

  const format = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  let lastMonth = -1;
  let lastLabelColumn = -99;

  cells.forEach((day, index) => {
    const cell = document.createElement("i");
    cell.className = "cell";

    if (!day) {
      cell.dataset.empty = "";
    } else {
      const date = new Date(`${day.date}T00:00:00`);
      cell.dataset.level = level(day.count, max);
      cell.title = `${day.count} contribution${day.count === 1 ? "" : "s"} on ${format.format(date)}`;
    }

    el.grid.append(cell);

    // One month label slot per week column, filled when the month turns over.
    if (index % 7 === 0) {
      const label = document.createElement("span");
      const first = cells.slice(index, index + 7).find(Boolean);

      if (first) {
        const column = index / 7;
        const month = new Date(`${first.date}T00:00:00`).getMonth();

        if (month !== lastMonth) {
          lastMonth = month;

          // A label is about three columns wide, so skip the ones that
          // would print on top of each other.
          if (column - lastLabelColumn >= 3) {
            label.textContent = MONTHS[month];
            lastLabelColumn = column;
          }
        }
      }

      el.months.append(label);
    }
  });

  el.grid.setAttribute(
    "aria-label",
    `GitHub contribution calendar: ${total} contributions in the last year`,
  );
  el.total.textContent = `${total.toLocaleString()} contributions in the last year`;

  el.body.hidden = false;
  el.foot.hidden = false;
  el.scroll.scrollLeft = el.scroll.scrollWidth; // newest weeks first if it overflows
}

(async () => {
  if (el.profile && GITHUB.username) {
    el.profile.href = `https://github.com/${GITHUB.username}`;
  }

  try {
    const data = await load();

    if (data) {
      el.status.hidden = true;
      render(data);
    } else {
      render(sample());
      el.status.textContent =
        "Sample data. Add your GitHub username and a proxy URL or token in main.js to show real contributions.";
    }
  } catch (error) {
    el.status.hidden = false;
    el.status.textContent = `Couldn't load contributions: ${error.message}. Check the username, token scope (read:user), and proxy URL in main.js.`;
    el.body.hidden = true;
    el.foot.hidden = true;
  }
})();
