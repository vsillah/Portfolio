# Google Pixel Wireless Screen Mirroring On Mac

Use `scrcpy` and Android Debug Bridge (`adb`) to mirror a Google Pixel screen on this Mac without a USB cable.

## One-Time Install

```bash
brew install scrcpy android-platform-tools
```

## Pixel Setup

1. Connect the Pixel and Mac to the same normal Wi-Fi network.
2. On the Pixel, open **Settings -> About phone**.
3. Tap **Build number** 7 times to enable Developer options.
4. Open **Settings -> System -> Developer options**.
5. Turn on **Wireless debugging**.
6. Tap **Wireless debugging**.
7. Tap **Pair device with pairing code** and leave that screen open.

## Pair Wirelessly

On the Mac, use the IP address and pairing port shown on the Pixel:

```bash
adb pair PHONE_IP:PAIRING_PORT
```

Enter the 6-digit pairing code from the Pixel.

Example:

```bash
adb pair 192.168.4.26:38981
```

After pairing, return to the main **Wireless debugging** screen on the Pixel. Use the regular **IP address & Port** value, not the temporary pairing port:

```bash
adb connect PHONE_IP:CONNECT_PORT
```

Example:

```bash
adb connect 192.168.4.26:43343
```

Confirm the device is visible:

```bash
adb devices
```

Expected result:

```text
List of devices attached
192.168.4.26:43343    device
```

## Start Mirroring

```bash
scrcpy -s 192.168.4.26:43343
```

If the IP or port changes, replace `192.168.4.26:43343` with the current **IP address & Port** from the Pixel's Wireless debugging screen.

## If Scrcpy Says Multiple Devices

If `scrcpy` reports multiple ADB devices, choose the Pixel explicitly:

```bash
scrcpy -s 192.168.4.26:43343
```

This happens when ADB sees the same Pixel twice, once by IP and once by the mDNS name.

Optional cleanup:

```bash
adb disconnect 192.168.4.26:43343
adb devices
```

Then use the remaining serial shown by `adb devices`:

```bash
scrcpy -s SERIAL_FROM_ADB_DEVICES
```

## Tailscale Or VPN Gotcha

If pairing fails with an error like this:

```text
error: protocol fault (couldn't read status message): Undefined error: 0
```

Check whether the Pixel IP starts with `100.x.x.x`, such as `100.66.105.99`. That is usually a Tailscale or VPN address. Wireless ADB pairing can fail through that interface.

Fix:

1. Temporarily turn off Tailscale or VPN on the Pixel.
2. Temporarily turn off Tailscale or VPN on the Mac.
3. Toggle **Wireless debugging** off and back on.
4. Pair again using the normal Wi-Fi IP, usually `192.168.x.x`, `10.x.x.x`, or `172.16-31.x.x`.

## Fast Repeat Flow

When already paired and the port has not changed:

```bash
adb connect 192.168.4.26:43343
scrcpy -s 192.168.4.26:43343
```

## Agent Activation Rule

Use this rule in project or global agent instructions:

```text
When Vambah asks to mirror, open, cast, or control his Google Pixel from this Mac, run:

  osascript -e 'tell application "Terminal" to do script "bash /Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh"'

This hands the long-running scrcpy process to Terminal so the agent session can finish cleanly. Do not walk through the full setup unless the script fails. If ADB cannot see the Pixel, ask Vambah to turn on Pixel Wireless debugging and provide the current IP address & Port from Settings -> System -> Developer options -> Wireless debugging. If pairing fails or the IP starts with 100.x.x.x, have Vambah disable Tailscale/VPN and use the normal Wi-Fi IP.
```

## Scripted Agent Flow

The helper script lives at:

```bash
/Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh
```

Default command:

```bash
bash /Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh
```

Agent-safe Terminal handoff:

```bash
osascript -e 'tell application "Terminal" to do script "bash /Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh"'
```

If the wireless debugging port changes, reconnect first:

```bash
adb connect PHONE_IP:CONNECT_PORT
osascript -e 'tell application "Terminal" to do script "bash /Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh"'
```

To pin a known endpoint for a single run:

```bash
osascript -e 'tell application "Terminal" to do script "PIXEL_ADB_ENDPOINT=192.168.4.26:43343 bash /Users/vambahsillah/Projects/Portfolio/scripts/mirror-pixel.sh"'
```
