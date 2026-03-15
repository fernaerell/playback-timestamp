const btn = document.getElementById("main_btn");
const statusEl = document.getElementById("status");
const urlInput = document.getElementById("ws_url");

function syncUI(active, text, style) {
    btn.innerText = active ? "Disconnect" : "Connect";
    btn.className = active ? "btn-disconnect" : "btn-connect";
    btn.disabled = (text === "Connecting...");
    statusEl.innerText = text;
    
    let className = "status-bar";
    if (style === 'error') className += " status-error";
    else if (style === 'active') className += " status-active";
    else if (style === 'reconnect') className += " status-reconnecting";
    
    statusEl.className = className;
}

// Load saved URL on startup
chrome.storage.local.get(["saved_ws_url"], (result) => {
    if (result.saved_ws_url) {
        urlInput.value = result.saved_ws_url;
    } else {
        urlInput.value = "ws://localhost:80/server"; // Default value
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STATUS_UPDATE") {
        syncUI(msg.isActive, msg.text, msg.style);
    }
});

btn.onclick = async () => {
    const url = urlInput.value;
    // Save the URL whenever the user clicks Connect
    chrome.storage.local.set({ "saved_ws_url": url });

    try {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        if (!state?.isActive) {
            syncUI(false, "Connecting...", "");
            chrome.runtime.sendMessage({ type: "START", url: url }).catch(() => {});
        } else {
            chrome.runtime.sendMessage({ type: "STOP" }).catch(() => {});
        }
    } catch (e) {
        chrome.runtime.sendMessage({ type: "START", url: url }).catch(() => {});
    }
};

(async function init() {
    try {
        const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        if (state?.isActive) {
            syncUI(true, "Synchronizing...", "active");
        } else {
            chrome.runtime.sendMessage({ type: "SCAN_CURRENT_TAB" }).catch(() => {});
        }
    } catch (e) {}
})();