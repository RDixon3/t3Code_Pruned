import type { DesktopUpdateState } from "@t3tools/contracts";
import { Separator } from "../ui/separator";

function keyReleaseNoteItems(items: ReadonlyArray<string>) {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const occurrence = occurrences.get(item) ?? 0;
    occurrences.set(item, occurrence + 1);
    return { item, key: JSON.stringify([item, occurrence]) };
  });
}

export function SidebarUpdateReleaseNotes({
  state,
  tooltip,
}: {
  readonly state: DesktopUpdateState;
  readonly tooltip: string;
}) {
  if (state.channel !== "nightly" || state.releaseNotes.length === 0) return <>{tooltip}</>;
  return (
    <div className="flex max-h-[calc(var(--available-height)-0.5rem)] min-h-0 w-fit max-w-[min(24rem,calc(100vw-2rem))] flex-col text-left">
      <div className="shrink-0 px-1">
        {state.status === "available" ? (
          <div>
            <div className="whitespace-nowrap text-sm leading-5 font-medium">
              Update ready to download
            </div>
            {state.availableVersion ? (
              <div className="mt-0.5 text-xs leading-4 text-muted-foreground">
                {state.availableVersion}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm leading-5 font-medium">{tooltip}</div>
        )}
      </div>
      <div className="min-h-0 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto px-1 pt-4 pb-1">
        {state.releaseNotes.map((releaseNote, index) => (
          <div key={releaseNote.version}>
            {index > 0 && <Separator className="my-3 bg-border/60" />}
            <section>
              <h3 className="text-foreground text-xs leading-4 font-semibold">
                {index === 0 ? "What's changed" : `Changes in ${releaseNote.version}`}
              </h3>
              <ul className="mt-2 space-y-1.5 pl-4 text-xs leading-5 text-popover-foreground/90">
                {keyReleaseNoteItems(releaseNote.items).map(({ item, key }) => (
                  <li className="list-disc break-words" key={key}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ))}
      </div>
    </div>
  );
}
