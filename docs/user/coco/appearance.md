# Appearance and readability

Use [Settings → Appearance](/settings/appearance) to change colors, fonts, contrast, and panel motion. These preferences apply to this device or browser.

The settings affect CoCo's interface. They do not change the contents of project files or the agent's instructions.

## Select the CoCo theme

1. Open **Settings → Appearance**.
2. In **Color scheme**, select **Light**, **Dark**, or **System**.
3. In **Themes**, select the CoCo theme card.

The interface uses CoCo's branded colors. **System** changes between light and dark appearance when the operating system changes.

You can select different themes for light and dark appearance. Use the applicable light or dark selection on a theme card.

If the theme appears incorrect after a system appearance change, compare both theme selections. A dark selection does not set the light selection automatically.

If CoCo colors disappear after a settings reset, select the CoCo theme again. An app restart is not necessary for a theme selection.

## Improve contrast and surface opacity

**Contrast** changes the contrast of interface colors and borders. The default is 100 percent.

**Glass opacity** changes how solid menus, dialogs, and the composer appear. Higher values show less background through these surfaces. The default is 80 percent.

1. Open a view with text that is difficult to read.
2. Return to **Appearance**.
3. Increase **Contrast** in small increments.
4. If background content interferes with text, increase **Glass opacity**.
5. Read the affected view again.

Use the reset action beside a control to restore its default. If a custom theme still has unreadable text, select another theme.

## Set interface and code fonts

The normal **Typography** view has two font controls.

| Control            | Text affected                                            |
| ------------------ | -------------------------------------------------------- |
| **Interface font** | Menus, buttons, conversation text, and the prompt input. |
| **Monospace font** | Code blocks, diffs, file previews, and terminal text.    |

A **monospace font** gives every character the same width. This makes code columns easier to align.

1. Open **Typography**.
2. Select a font family in the applicable row.
3. Select the font size.
4. Read the preview below the row.

An empty font-family value uses the app's default font. If a font is unavailable on this device, the app uses a fallback.

## Set separate prompt and terminal fonts

1. In **Typography**, turn on **Advanced**.
2. Change the applicable font family.
3. Change its size.
4. Read the preview.

| Advanced control   | Text affected                                                         | Initial size |
| ------------------ | --------------------------------------------------------------------- | ------------ |
| **Interface font** | Interface and conversation text outside code blocks and the terminal. | 16 pixels.   |
| **Prompt font**    | The input where you write messages.                                   | 14 pixels.   |
| **Code font**      | Code blocks, diffs, and file previews.                                | 13 pixels.   |
| **Terminal font**  | Terminal output.                                                      | 12 pixels.   |

The initial sizes apply to the separate advanced controls. In the normal view, the prompt uses the interface font and the terminal uses the monospace font.

To restore those shared display rules, turn off **Advanced**. The saved separate font choices remain available.

On macOS, **Font smoothing** uses thinner grayscale text smoothing. Turn it off to use the operating system's heavier rendering. This control has no effect on Windows.

**Word wrap** wraps long lines in code blocks, tables, diffs, and file previews. Turn it off to preserve horizontal alignment across long lines.

## Control panel motion

**Panel animations** sets how long panels take to open and close. The default is zero milliseconds, which changes panels immediately.

1. Adjust the **Panel animations** slider.
2. Compare the motion with the example beside the control.
3. Open and close a panel in the app.

For immediate navigation, use zero. Longer durations can make navigation feel slower even when the data is already available.

## Identify a development build

**Environment identification** controls the Dev indicator. This row appears in development builds.

Select **Artwork**, **Version pill**, or **None**. This setting changes the indicator without changing the running application.

Use **General → About** to read the version. Use [Updates](updates.md) to install a new CoCo release.

## Import a theme

CoCo accepts T3 Code and VS Code theme JSON files. A JSON file stores the theme's named color values.

1. Select **Add theme**.
2. Select **Choose files**.
3. Select the theme JSON file.
4. Read the imported theme information.
5. Select **Add theme**.

You can also drop a file into the import area or paste its contents into **Theme JSON**.

If an imported theme is already installed, select **Update existing** to replace it. Select **Keep both** to retain separate copies.

Multiple selected files import as a group. After the import, select the required theme card to make it active.

The dialog also includes theme search. Search requires a network connection; file import can use a file already on your device.

If import fails, read the error under the form. Make sure the file contains a supported theme, not an extension package or a web page.

## Create or edit a theme

1. Select **Create theme**, or use **Duplicate** on an existing theme card.
2. Enter **Theme name**.
3. Select the light or dark appearance to edit.
4. Set **Background**.
5. Set **Accent**.
6. Make sure text and controls in the app are readable.
7. Select **Create theme** or **Save changes**.

The normal editor derives related colors from the background and accent. **Advanced** exposes individual color roles for more detailed changes.

Use **Inspect** to select an app element and identify its color role. Press Escape to cancel inspection.

Select **Cancel** to discard the editor's unsaved changes. Built-in and environment-provided themes require a duplicate before you edit them.

To share a custom theme, use its download action. Import the downloaded JSON file on the other device.

Use a custom theme's remove action to delete it from this client. Read the confirmation when a collection contains more than one theme.

## Resolve a display problem

| Symptom                                                           | Action                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Text becomes unreadable in one theme                              | Select CoCo or a built-in theme, then compare the same text.                     |
| A menu shows distracting background content                       | Increase **Glass opacity**.                                                      |
| Prompt or terminal fonts do not match the selected interface font | Read **Typography → Advanced** and compare its separate font choices.            |
| A custom font has no visible effect                               | Make sure the font is installed on this device. Use the default font to compare. |
| Panels move too slowly                                            | Set **Panel animations** to zero.                                                |
| Another machine has different colors                              | Select the theme on that machine. Client appearance preferences are separate.    |
