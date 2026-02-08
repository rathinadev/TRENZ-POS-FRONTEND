#!/usr/bin/env python3
"""
Quick test script to send a test print to XP-V320M from Ubuntu
This verifies the printer is working before testing the full React Native app
"""

import socket
import sys

# Printer MAC address (from bluetoothctl scan)
PRINTER_MAC = "DC:0D:30:CA:8D:4A"
# SPP UUID channel (usually 1 for RFCOMM)
RFCOMM_CHANNEL = 1

def connect_to_printer():
    """Connect to printer via Bluetooth RFCOMM"""
    try:
        # Create RFCOMM socket
        sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
        
        # Connect to printer (MAC address, channel)
        print(f"Connecting to printer {PRINTER_MAC} on channel {RFCOMM_CHANNEL}...")
        sock.connect((PRINTER_MAC, RFCOMM_CHANNEL))
        print("✅ Connected to printer!")
        return sock
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        print("\nNote: You may need to:")
        print("1. Install bluetooth tools: sudo apt install bluez bluez-tools")
        print("2. Make sure printer is paired: bluetoothctl pair DC:0D:30:CA:8D:4A")
        return None

def send_test_print(sock):
    """Send a test print"""
    try:
        # ESC/POS commands
        ESC = b'\x1B'
        
        # Reset printer
        data = ESC + b'@'
        
        # Center align, bold, large text
        data += ESC + b'a' + b'\x01'  # Center
        data += ESC + b'!' + b'\x30'  # Double width and height
        data += ESC + b'E' + b'\x01'  # Bold on
        
        data += b"TEST PRINT\n"
        data += b"FROM UBUNTU\n"
        data += b"\n"
        
        # Reset formatting
        data += ESC + b'@'
        data += ESC + b'a' + b'\x00'  # Left align
        data += ESC + b'E' + b'\x00'  # Bold off
        
        data += b"Printer: XP-V320M\n"
        data += b"Status: Working!\n"
        data += b"\n"
        data += b"-" * 32 + b"\n"
        data += b"\n"
        data += b"If you see this,\n"
        data += b"printer is ready!\n"
        data += b"\n\n\n"
        
        # Cut paper
        data += b'\x0A\x0A'  # Line feeds
        data += b'\x1D\x56\x01'  # Cut paper
        
        # Send data
        print("Sending test print...")
        sock.send(data)
        print("✅ Test print sent!")
        print("\nCheck your printer - you should see a test page!")
        
    except Exception as e:
        print(f"❌ Failed to send print: {e}")
        return False
    return True

def main():
    print("=" * 50)
    print("XP-V320M Printer Test from Ubuntu")
    print("=" * 50)
    print()
    
    sock = connect_to_printer()
    if not sock:
        sys.exit(1)
    
    try:
        send_test_print(sock)
    finally:
        sock.close()
        print("\n✅ Connection closed")

if __name__ == "__main__":
    main()

