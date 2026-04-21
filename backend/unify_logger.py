"""Structured JSON logger for UNIFY backend.

Replaces bare print statements with JSON-structured logs suitable
for ingestion by Logtail, Datadog, Grafana Loki, or CloudWatch.
"""
import json
import logging
import sys


class JsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON."""

    RESERVED = {
        "args", "asctime", "created", "exc_info", "exc_text", "filename",
        "funcName", "levelname", "levelno", "lineno", "message", "module",
        "msecs", "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName",
        "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Pull any extra kwargs passed to logger.info("x", extra={...})
        for k, v in record.__dict__.items():
            if k not in self.RESERVED and not k.startswith("_"):
                try:
                    json.dumps(v)
                    data[k] = v
                except (TypeError, ValueError):
                    data[k] = str(v)
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, default=str)


def setup_logger(name: str = "unify", level: str = "INFO") -> logging.Logger:
    """Configure a JSON-formatted logger. Idempotent."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.propagate = False
    return logger
