#!/usr/bin/env python3
"""Simple SIM800L SMS sender for Raspberry Pi.

Reads `SMS_TO` and `SMS_MESSAGE` from environment variables and sends the
message via a serial-connected SIM800L/GSM modem. Depends on `pyserial`.

Usage:
  export SMS_TO="+639XXXXXXXXX"
  export SMS_MESSAGE="Test message"
  python3 send_sms.py

Environment variables:
  SERIAL_PORT    - serial device (default: /dev/serial0)
  BAUDRATE       - serial baud (default: 115200)
  SMS_TO         - destination phone number
  SMS_MESSAGE    - message text
  DEBUG          - if set, prints commands but does not send

Exit codes:
  0 - success
  2 - missing env
  3 - serial error / failure
"""
import os
import sys
import time

try:
    import serial
except Exception:
    serial = None


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def main():
    to = os.environ.get("SMS_TO")
    msg = os.environ.get("SMS_MESSAGE")
    if not to or not msg:
        eprint("SMS_TO and SMS_MESSAGE must be set in environment")
        return 2

    serial_port = os.environ.get("SERIAL_PORT", "/dev/serial0")
    baud = int(os.environ.get("BAUDRATE", "115200"))
    debug = bool(os.environ.get("DEBUG"))

    if debug:
        print(f"DEBUG mode — would send to {to}: {msg}")
        return 0

    if serial is None:
        eprint("pyserial is not installed. Install with: pip3 install pyserial")
        return 3

    try:
        ser = serial.Serial(serial_port, baudrate=baud, timeout=5)
    except Exception as ex:
        eprint(f"Failed opening serial port {serial_port}: {ex}")
        return 3

    def send_at(cmd, wait=1.0):
        if not cmd.endswith("\r"):
            cmd = cmd + "\r"
        ser.write(cmd.encode("utf-8"))
        time.sleep(wait)
        out = b""
        # read available
        try:
            while ser.in_waiting:
                out += ser.read(ser.in_waiting)
                time.sleep(0.05)
        except Exception:
            pass
        return out.decode(errors="ignore")

    try:
        # Basic handshake
        r = send_at("AT", 0.5)
        if "OK" not in r:
            # try a couple times
            for _ in range(2):
                time.sleep(0.5)
                r = send_at("AT", 0.5)
                if "OK" in r:
                    break
        if "OK" not in r:
            eprint("Modem did not respond to AT commands")
            ser.close()
            return 3

        # Set text mode
        send_at("AT+CMGF=1", 0.5)
        send_at('AT+CSCS="GSM"', 0.2)

        # Send SMS
        # The modem expects: AT+CMGS="+639..." then wait for > prompt, then message + Ctrl-Z
        ser.write(f'AT+CMGS="{to}"\r'.encode())
        time.sleep(0.5)
        # read until prompt or timeout
        prompt = b""
        timeout = time.time() + 5
        while time.time() < timeout:
            if ser.in_waiting:
                prompt += ser.read(ser.in_waiting)
                if b">" in prompt:
                    break
            time.sleep(0.05)

        ser.write(msg.encode("utf-8"))
        # Ctrl-Z (ASCII 26) to submit
        ser.write(bytes([26]))

        # wait for final OK or error
        final = b""
        timeout = time.time() + 15
        while time.time() < timeout:
            if ser.in_waiting:
                final += ser.read(ser.in_waiting)
            if b"OK" in final or b"ERROR" in final:
                break
            time.sleep(0.1)

        text = final.decode(errors="ignore")
        if "OK" in text:
            print("SMS sent")
            ser.close()
            return 0
        else:
            eprint("Failed sending SMS:", text)
            ser.close()
            return 3

    except Exception as ex:
        eprint("Unexpected error:", ex)
        try:
            ser.close()
        except Exception:
            pass
        return 3


if __name__ == "__main__":
    sys.exit(main())
