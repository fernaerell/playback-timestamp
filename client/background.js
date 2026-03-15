let socket = null;
let isActive = false;
let currentTabId = null;
let targetUrl = "";
let reconnectTimeout = null;
let retryCount = 0;

function safeSend(tabId, message) {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, message, () => {
        if (chrome.runtime.lastError) { /* Silent Catch */ }
    });
}

function updateStatus(text, style, forceInactive = false) {
    if (forceInactive) isActive = false;
    chrome.runtime.sendMessage({ type: "STATUS_UPDATE", text, style, isActive }).catch(() => {
        if (chrome.runtime.lastError) { /* Silent Catch */ }
    });
}

async function scanTab(tabId) {
    if (isActive || !tabId) return;
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.querySelectorAll("video").length > 0
        });
        if (result?.result) updateStatus("Video detected. Ready to connect.", "active");
        else updateStatus("No video found on this page.", "");
    } catch (e) {
        updateStatus("Tab restricted or not ready.", "error");
    }
}

function stopWS(reason, style = "error", permanent = false) {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (permanent) {
        isActive = false;
        retryCount = 0;
    }

    if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        socket.close();
        socket = null;
    }

    updateStatus(reason, style, permanent);
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(t => safeSend(t.id, { command: "STOP_TRACKING" }));
    });
}

function startWS(url) {
    targetUrl = url;
    stopWS("Connecting...", "", false);
    
    try {
        socket = new WebSocket(url);
        
        const timeout = setTimeout(() => {
            if (socket && socket.readyState !== WebSocket.OPEN) {
                handleReconnect("Connection Timeout.");
            }
        }, 5000);

        socket.onopen = () => {
            clearTimeout(timeout);
            isActive = true;
            retryCount = 0;
            updateStatus("Connected. Tracking...", "active");
            if (currentTabId) triggerTracking(currentTabId);
        };

        socket.onerror = () => {
            clearTimeout(timeout);
            handleReconnect("Server unreachable.");
        };

        socket.onclose = () => {
            if (isActive) handleReconnect("Server connection lost.");
        };
    } catch (e) {
        stopWS("Invalid URL.", "error", true);
    }
}

function handleReconnect(reason) {
    if (!isActive && retryCount === 0) {
        stopWS(reason, "error", true);
        return;
    }

    const delays = [1000, 2000, 5000, 10000];
    const delay = delays[retryCount] || 10000;
    retryCount++;

    updateStatus(`Reconnect in ${delay/1000}s (Attempt ${retryCount})`, "reconnect");
    
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        if (isActive) startWS(targetUrl);
    }, delay);
}

async function triggerTracking(tabId) {
    if (!isActive || !tabId) return;
    try {
        safeSend(tabId, { command: "STOP_TRACKING" });
        await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
        safeSend(tabId, { command: "START_TRACKING" });
    } catch (e) {}
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_STATE") {
        sendResponse({ isActive });
    } else if (request.type === "START") {
        isActive = true;
        startWS(request.url);
    } else if (request.type === "STOP") {
        stopWS("Disconnected.", "", true);
    } else if (request.type === "SCAN_CURRENT_TAB") {
        chrome.tabs.query({active: true, currentWindow: true}, ([tab]) => {
            if (tab) { currentTabId = tab.id; scanTab(tab.id); }
        });
    } else if (request.type === "TIME_DATA") {
        if (isActive && sender.tab && sender.tab.id === currentTabId) {
            if (socket?.readyState === WebSocket.OPEN) {
                const timeStr = new Date(request.value * 1000).toISOString().substr(11, 8);
                updateStatus(`Tracking: ${request.title} [${timeStr}]`, "active");
                socket.send(timeStr);
            }
        }
    }
    return true; 
});

chrome.tabs.onActivated.addListener(info => {
    const prev = currentTabId;
    currentTabId = info.tabId;
    if (prev) safeSend(prev, { command: "STOP_TRACKING" });
    if (isActive) triggerTracking(info.tabId);
    else scanTab(info.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === 'complete') {
        if (isActive) triggerTracking(tabId);
        else scanTab(tabId);
    }
});