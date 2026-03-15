if (window.videoTrackerInterval) {
    clearInterval(window.videoTrackerInterval);
    window.videoTrackerInterval = null;
}

function getCleanTitle() {
    return document.title.replace(/^\(\d+\)\s/, '');
}

function startVideoTracking() {
    const video = document.querySelector('video');
    if (!video) return;

    if (window.videoTrackerInterval) clearInterval(window.videoTrackerInterval);

    window.videoTrackerInterval = setInterval(() => {
        if (!video || !video.isConnected) {
            clearInterval(window.videoTrackerInterval);
            window.videoTrackerInterval = null;
            return;
        }

        chrome.runtime.sendMessage({ 
            type: "TIME_DATA", 
            value: video.currentTime,
            title: getCleanTitle()
        }).catch(() => {
            clearInterval(window.videoTrackerInterval);
            window.videoTrackerInterval = null;
        });
    }, 500);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "START_TRACKING") {
        startVideoTracking();
        sendResponse({ status: "STARTED" });
    } else if (request.command === "STOP_TRACKING") {
        if (window.videoTrackerInterval) {
            clearInterval(window.videoTrackerInterval);
            window.videoTrackerInterval = null;
        }
        sendResponse({ status: "CLEANED" });
    }
    return true;
});