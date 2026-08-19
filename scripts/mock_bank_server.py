"""
GuardPay AI — Mock Bank/PSP Server
PROMPT 11: Local mock server on port 9000 for bank alert demo

Run this in a separate terminal:
    python scripts/mock_bank_server.py

It receives fraud alerts from bank_alert_service.py and logs them.
"""

import json
import logging
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MockBank] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

ALERTS_LOG = []  # In-memory store of received alerts


class MockBankHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # Suppress default HTTP server logs

    def do_POST(self):
        if self.path != "/fraud-alert":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            alert = json.loads(body)
            ALERTS_LOG.append({**alert, "received_at": datetime.utcnow().isoformat()})

            logger.info("=" * 60)
            logger.info("FRAUD ALERT RECEIVED")
            logger.info(f"  Transaction ID : {alert.get('transaction_id', 'N/A')}")
            logger.info(f"  Risk Score     : {alert.get('risk_score', 'N/A')}")
            logger.info(f"  Amount (INR)   : {alert.get('amount_inr', 'N/A')}")
            logger.info(f"  Beneficiary    : {alert.get('beneficiary_upi_id', 'N/A')}")
            logger.info(f"  Evidence ID    : {alert.get('evidence_bundle_id', 'N/A')}")
            logger.info(f"  Factors        : {alert.get('contributing_factors', [])}")
            logger.info("=" * 60)

            response = json.dumps({
                "status": "alert_received",
                "case_id": f"BANK-CASE-{len(ALERTS_LOG):04d}",
                "message": "Alert logged. Fraud investigation team notified.",
            }).encode()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()

    def do_GET(self):
        if self.path == "/alerts":
            response = json.dumps(ALERTS_LOG, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    PORT = 9000
    server = HTTPServer(("0.0.0.0", PORT), MockBankHandler)
    logger.info(f"Mock Bank Server listening on http://0.0.0.0:{PORT}")
    logger.info(f"  POST /fraud-alert  → receives GuardPay AI alerts")
    logger.info(f"  GET  /alerts       → lists all received alerts")
    logger.info("Waiting for alerts...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info(f"Server stopped. Total alerts received: {len(ALERTS_LOG)}")
