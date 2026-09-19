import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import {
  scopeProjectRef,
  scopedThreadKey,
  scopeThreadRef,
} from "@t3tools/client-runtime/environment";

import {
  COMPOSER_DRAFT_STORAGE_KEY,
  DraftId,
  composerDraftHasUserContent,
  markPromotedDraftThreadByRef,
  partializeComposerDraftStoreState,
  useComposerDraftStore,
} from "./composerDraftStore";
import { MAX_CONTEXT_ITEMS, contextItemKey, type ContextItem } from "./lib/contextItem";

const environmentId = EnvironmentId.make("context-test");
const threadRef = scopeThreadRef(environmentId, ThreadId.make("thread-context"));
const item: ContextItem = {
  source: "jira",
  sourceLabel: "Jira",
  sourceScope: "cloud-one",
  recordId: "ISSUE-1",
  title: "Missing owner",
  kind: "issue",
  content: "Assign an owner before launch.",
};

function reset() {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
    stickyModelSelectionByProvider: {},
    stickyActiveProvider: null,
  });
}

describe("composer draft context items", () => {
  beforeEach(reset);
  afterEach(async () => {
    reset();
    await useComposerDraftStore.persist.clearStorage();
    vi.useRealTimers();
  });

  it("keeps context-only drafts and removes them when the final item is removed", () => {
    const store = useComposerDraftStore.getState();
    expect(store.addContextItem(threadRef, item)).toBe(true);
    expect(composerDraftHasUserContent(store.getComposerDraft(threadRef))).toBe(true);
    const persisted = partializeComposerDraftStoreState(useComposerDraftStore.getState());
    expect(persisted.draftsByThreadKey[scopedThreadKey(threadRef)]?.contextItems).toEqual([item]);

    store.removeContextItem(threadRef, contextItemKey(item));
    expect(store.getComposerDraft(threadRef)).toBeNull();
  });

  it("refreshes a record by namespaced key and rejects overflow without touching the draft", () => {
    const store = useComposerDraftStore.getState();
    const items = Array.from({ length: MAX_CONTEXT_ITEMS }, (_, index) => ({
      ...item,
      recordId: `ISSUE-${index}`,
    }));
    store.setContextItems(threadRef, items);
    expect(store.addContextItem(threadRef, { ...item, recordId: "EXTRA" })).toBe(false);
    expect(store.getComposerDraft(threadRef)?.contextItems).toEqual(items);
    expect(store.addContextItem(threadRef, { ...item, content: "Refreshed" })).toBe(true);
    expect(store.getComposerDraft(threadRef)?.contextItems[1]?.content).toBe("Refreshed");
  });

  it("clears context with composer content and supports restoring a failed-send snapshot", () => {
    const store = useComposerDraftStore.getState();
    store.addContextItem(threadRef, item);
    const snapshot = store.getComposerDraft(threadRef)!.contextItems;
    store.clearComposerContent(threadRef);
    expect(store.getComposerDraft(threadRef)).toBeNull();
    store.setContextItems(threadRef, snapshot);
    expect(store.getComposerDraft(threadRef)?.contextItems).toEqual([item]);
    store.clearComposerPromptAndImages(threadRef);
    expect(store.getComposerDraft(threadRef)?.contextItems).toEqual([item]);
  });

  it("round-trips snapshots through persistence and hydration", async () => {
    vi.useFakeTimers();
    useComposerDraftStore.getState().addContextItem(threadRef, item);
    await vi.advanceTimersByTimeAsync(300);
    reset();
    await useComposerDraftStore.persist.rehydrate();
    expect(useComposerDraftStore.getState().getComposerDraft(threadRef)?.contextItems).toEqual([
      item,
    ]);
  });

  it("retains context through draft promotion and scoped access", () => {
    const store = useComposerDraftStore.getState();
    const draftId = DraftId.make("context-draft");
    store.setProjectDraftThreadId(
      scopeProjectRef(environmentId, ProjectId.make("project")),
      draftId,
      {
        threadId: threadRef.threadId,
      },
    );
    store.addContextItem(draftId, item);
    markPromotedDraftThreadByRef(threadRef);
    expect(store.getComposerDraft(draftId)?.contextItems).toEqual([item]);
    expect(store.getComposerDraft(threadRef)?.contextItems).toEqual([item]);
    const persisted = partializeComposerDraftStoreState(useComposerDraftStore.getState());
    expect(persisted.draftsByThreadKey[draftId]?.contextItems).toEqual([item]);
  });

  it("hydrates older drafts with empty context and keeps prompts when context data is malformed", () => {
    const merge = useComposerDraftStore.persist.getOptions().merge!;
    for (const contextItems of [undefined, "invalid", [{ ...item, url: "javascript:alert(1)" }]]) {
      const merged = merge(
        {
          draftsByThreadKey: {
            [scopedThreadKey(threadRef)]: {
              prompt: "Keep my prompt",
              attachments: [],
              contextItems,
            },
          },
          draftThreadsByThreadKey: {},
          logicalProjectDraftThreadKeyByLogicalProjectKey: {},
        },
        useComposerDraftStore.getState(),
      );
      expect(merged.draftsByThreadKey[scopedThreadKey(threadRef)]).toMatchObject({
        prompt: "Keep my prompt",
        contextItems: [],
      });
    }
    expect(useComposerDraftStore.persist.getOptions().name).toBe(COMPOSER_DRAFT_STORAGE_KEY);
  });
});
