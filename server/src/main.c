#include <signal.h>
#include <stddef.h>
#include <stdio.h>

#include "mongoose.h"

volatile sig_atomic_t keep_running = 1;
char ws_path[] = "/server";
char port[5] = {0};
char url[22] = {0};
char ws_url[19 + sizeof(ws_path) + 1] = {0};

void handle_signal(int sig) {
  printf("Preparing to shutdown...");
  keep_running = 0;
}

static void ev_handler(struct mg_connection *c, int ev, void *ev_data) {
  if (ev == MG_EV_HTTP_MSG) {
    struct mg_http_message *hm = (struct mg_http_message *)ev_data;
    if (mg_match(hm->uri, mg_str(ws_path), NULL)) {
      mg_ws_upgrade(c, hm, NULL);
    } else if (mg_match(hm->uri, mg_str("/"), NULL)) {
      char body_fmt[724] = "<!DOCTYPE html><head><style> body { background-color: transparent; font-family: sans-serif; font-size: 200px; color: white; font-weight: bold; } </style></head><body><div id=\"time\">00:00:00</div><script> const timeElement = document.getElementById(\"time\"); let socket; let reconnectInterval = 1000; const connect = () => { socket = new WebSocket(\"%s\"); socket.onopen = () => { reconnectInterval = 1000; }; socket.onmessage = (event) => { timeElement.innerText = event.data; }; socket.onclose = (e) => { setTimeout(() => { reconnectInterval = Math.min(reconnectInterval * 2, 10000); connect(); }, reconnectInterval); }; socket.onerror = (err) => { socket.close(); }; }; connect(); </script></body></html>";
      mg_http_reply(c, 200, "Content-Type: text/html; charset=UTF-8\r\n", body_fmt, ws_url);
    } else {
      mg_http_reply(c, 404, NULL, "Not Found.");
    }
  } else if (ev == MG_EV_WS_MSG) {
    struct mg_ws_message *wm = (struct mg_ws_message *)ev_data;
    for (struct mg_connection *wc = c->mgr->conns; wc != NULL; wc = wc->next) {
      mg_ws_send(wc, wm->data.buf, wm->data.len, WEBSOCKET_OP_TEXT);
    }
  }
}

int main() {
  signal(SIGINT, handle_signal);

  printf("Playback Timestamp Server\n\n");

  printf("Port : ");
  scanf("%4s", port);
  sprintf(url, "http://localhost:%s", port);
  sprintf(ws_url, "ws://localhost:%s%s", port, ws_path);

  printf("WS   : %s\n", ws_url);
  printf("URL  : %s\n\n", url);

  mg_log_set(MG_LL_ERROR); // Set error log level

  struct mg_mgr mgr; // Event manager
  mg_mgr_init(&mgr); // Inititialise event manager

  // Setup listener
  mg_http_listen(&mgr, url, ev_handler, NULL);

  // Event loop
  while (keep_running) {
    mg_mgr_poll(&mgr, 1000);
  }

  // Cleanup
  mg_mgr_free(&mgr);
  return 0;
}