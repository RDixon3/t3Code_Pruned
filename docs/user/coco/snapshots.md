# SnapShots and app capture

A **SnapShot** captures an app window and attaches it to a chat draft. It can also include text and controls that the captured app exposes.

SnapShots are available in the desktop app. A web browser cannot register CoCo's desktop capture shortcut.

## Before you capture

Add a project before the first capture. Open the chat or draft that must receive the image.

Before a capture, make sure the source window has no unwanted private information. A screenshot can include visible text, account names, notifications, or credentials.

A SnapShot is an attachment, not permission for the agent to operate the captured app. The attachment is sent when you send the message.

## Enable SnapShots on Windows

1. Open [Settings → SnapShots](/settings/snap-shot).
2. Turn on **SnapShots**.
3. Make sure the status is **Ready to capture**.
4. Read the assigned **Capture shortcut**.

Windows does not require the macOS permission setup. If capture fails, read the status message before you change the shortcut.

## Enable SnapShots on macOS

1. Open **Settings → SnapShots**.
2. Turn on **SnapShots**.
3. In **Access**, select the action for **Screen Recording**.
4. Grant the requested permission in macOS Settings.
5. Return to CoCo.
6. If app text is required, grant **Accessibility** through the setup action.
7. Return to CoCo.
8. Select **Check again**.
9. When access is ready, select **Continue**.
10. Set the capture shortcut.
11. Select **Save and finish** or **Done**.

Screen Recording permits window capture. Accessibility permits the additional app text and controls when the app makes them available.

If macOS requests an app restart after a permission change, restart CoCo. Return to **SnapShots** to complete setup.

The expected status is **Ready to capture**. If a permission is later revoked, **Continue setup** appears again.

## Capture a window for a chat

1. Open the target chat or draft in CoCo.
2. Switch to the app window that you want to capture.
3. Press the configured **Capture shortcut**.
4. Return to CoCo.
5. Open the new attachment above the input.
6. Enter the task that relates to the image.
7. Send the message.

You can also use **Take snapshot** from the command palette when it is available.

If there is no current draft, CoCo can create one in an available project. If no project exists, add a project and capture the window again.

The capture is not a live view. For a changed window, create a new capture.

## Decide whether to include app text

**Include app text** adds the text and controls that the captured application exposes. The default is on.

This text can help the agent read small controls or understand window structure. Some apps expose little or no text.

Turn off **Include app text** for image-only captures. This does not remove text already visible in the screenshot.

If the captured window contains sensitive information, read the attachment details before you send it. Remove an unwanted attachment with its remove action.

A setting change affects future captures. It does not replace an attachment already in the draft.

## Change the capture shortcut

1. Open **Settings → SnapShots**.
2. Select the **Capture shortcut** control.
3. Record a supported key combination.
4. Select **Save**.
5. Switch to another app.
6. Test the shortcut.

Use the exact shortcut shown in Settings. A shortcut must contain a modifier key; some configurations also support a pair of matching modifier keys.

If the shortcut is unavailable, another app or the operating system can own it. Select another combination.

Select **Cancel** beside an unsaved shortcut to keep the previous shortcut.

## Set capture feedback

| Control                | Result                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| **Capture sound**      | Select **Off**, **Whoosh**, or **Click**. Use the play action to hear a sound. The default is Whoosh. |
| **Capture flash**      | Shows a brief visual cue on the captured window. The default is on.                                   |
| **Capture animations** | Animates the captured image into the draft. The default is on.                                        |

These controls change feedback, not the captured content. Turn them off if the feedback interferes with your work.

## Turn off capture or repair a failure

Turn off **SnapShots** to stop the capture function. Saved chat attachments remain in their conversations.

| Problem                                      | Action                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Only available in the desktop app**        | Open the installed desktop app.                                                                                           |
| **Update the desktop app to use snapshots**  | Install a compatible app release.                                                                                         |
| macOS capture requests access again          | Select **Continue setup** and restore the missing permission.                                                             |
| The shortcut does nothing                    | Read the capture status and shortcut registration, then test another combination.                                         |
| Capture succeeds but no project is available | Add a project, open its draft, and capture again.                                                                         |
| The attachment limit is reached              | Remove an unnecessary attachment, then capture again.                                                                     |
| App text is missing                          | Make sure **Include app text** is on and the required permission is granted. The source app must expose this information. |

For general attachment use, see [Build and chat](build.md).
