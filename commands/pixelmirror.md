# Pixel Mirror Command

Use this command when Vambah asks to mirror, open, cast, inspect, or validate something on his Google Pixel from this Mac.

## Command

`/pixelmirror`

## Aliases

- `pixelmirror`
- `pixel mirror`
- `mirror pixel`
- `open pixel`
- `validate on mobile`
- `run mobile Slack validation`

## Objective

Bring the Pixel into a known-good mobile validation state with the least possible friction:

- reconnect a previously paired Pixel through ADB,
- open a visible `scrcpy` mirror for Vambah when useful,
- use ADB for screenshots and targeted actions,
- avoid relying on Computer Use to control the `scrcpy` window,
- ask Vambah for only the current Wireless debugging `IP address & Port` when the Pixel is not visible.

## Start Gate

Run a status check first:

```bash
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh status
```

Classify the result:

- If a device is connected, proceed with the requested validation.
- If a cached endpoint exists but no device is connected, try:

  ```bash
  bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh connect "$(cat ~/.codex/pixel-adb-endpoint)"
  ```

- If no Pixel is visible, give Vambah the exact phone steps in the blocker section below.

## Mirror Flow

For a user-visible mirror, hand the long-running `scrcpy` process to Terminal:

```bash
osascript -e 'tell application "Terminal" to do script "bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh mirror"'
```

Do not keep the agent turn blocked on `scrcpy`.

## Agent Control Flow

Prefer ADB commands for functional validation:

```bash
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh screenshot /tmp/pixel-screen.png
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh open-slack
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh tap 540 1480
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh text "/agent help"
```

Use screenshots as the source of truth for what the phone is displaying. If a screenshot contains private content outside the requested validation area, summarize only the relevant state.

## Slack Validation Pattern

When validating Agent Ops in Slack mobile:

1. Open Slack on the Pixel:

   ```bash
   bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh open-slack
   ```

2. Capture a screenshot:

   ```bash
   bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh screenshot /tmp/pixel-slack.png
   ```

3. Confirm the workspace and destination before assuming command failure.
4. Use the relevant command:

   - staging: `/agent-staging help`
   - production: `/agent help`

5. Verify whether the response is ephemeral, threaded, in-channel, or absent.
6. If no visible message appears, inspect server logs before asking Vambah to retry.

## Blocker Instructions For Vambah

If ADB cannot see the Pixel, give these steps:

1. On the Pixel, open **Settings -> System -> Developer options -> Wireless debugging**.
2. Make sure **Wireless debugging** is on.
3. Copy the value labeled **IP address & Port**. Do not use the temporary pairing port.
4. Send back only that `PHONE_IP:CONNECT_PORT` value.

Then run:

```bash
bash /Users/vambahsillah/Projects/Portfolio/scripts/pixel-control.sh connect PHONE_IP:CONNECT_PORT
```

If the IP starts with `100.`, ask Vambah to turn off Tailscale/VPN on the phone and Mac, then use the normal Wi-Fi IP.

## Safety Rules

- Do not browse unrelated personal phone content.
- Do not read private notifications unless they are part of the requested validation.
- Do not send Slack messages, approve work, or trigger external actions from the phone unless Vambah explicitly approves that exact action.
- For Slack Agent Ops validation, stay in the requested workspace and channel or DM.
- If an action could mutate production state, stop and ask for explicit approval.

## Report Format

Return:

- Pixel connection status,
- mirror status,
- validation action performed,
- screenshot path if captured,
- observed mobile result,
- any blocker and the exact next step.
