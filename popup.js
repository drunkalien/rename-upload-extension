let settings = { enabled: true, excludedSites: [] };

const enabledEl = document.getElementById("enabled");
const siteListEl = document.getElementById("siteList");
const emptyNoteEl = document.getElementById("emptyNote");
const siteInputEl = document.getElementById("siteInput");
const statusEl = document.getElementById("status");

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 1500);
}

function save() {
  chrome.storage.local.set({ settings });
}

function render() {
  enabledEl.checked = settings.enabled;
  siteListEl.textContent = "";
  emptyNoteEl.style.display = settings.excludedSites.length ? "none" : "";
  for (const site of settings.excludedSites) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = site;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      settings.excludedSites = settings.excludedSites.filter((s) => s !== site);
      save();
      render();
    });
    li.append(span, remove);
    siteListEl.appendChild(li);
  }
}

// "https://www.Example.com/path", "www.example.com/x", "example.com" → "example.com"
function normalizeSite(text) {
  let host = text.trim().toLowerCase();
  if (!host) return "";
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return "";
  }
  host = host.split("/")[0].split(":")[0];
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

function addSite(host) {
  if (!host) return;
  if (!settings.excludedSites.includes(host)) {
    settings.excludedSites = [...settings.excludedSites, host];
    save();
    render();
  }
  flash(`Excluded ${host}`);
}

chrome.storage.local.get("settings", (data) => {
  if (data.settings) settings = { ...settings, ...data.settings };
  render();
});

enabledEl.addEventListener("change", () => {
  settings.enabled = enabledEl.checked;
  save();
});

document.getElementById("addSite").addEventListener("click", () => {
  const host = normalizeSite(siteInputEl.value);
  if (!host) return flash("Enter a valid site");
  siteInputEl.value = "";
  addSite(host);
});
siteInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addSite").click();
});

document.getElementById("excludeCurrent").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const host = tab && tab.url ? normalizeSite(tab.url) : "";
    if (!host || !tab.url.startsWith("http")) return flash("No site in current tab");
    addSite(host);
  });
});

document.getElementById("clearHistory").addEventListener("click", () => {
  chrome.storage.local.remove("history", () => flash("Rename history cleared"));
});
