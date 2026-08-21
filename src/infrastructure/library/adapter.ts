/**
 * The garden's side of the library seam — a thin wrapper around one Tauri
 * command.
 *
 * The Rust side (`src-tauri/src/library/`) resolves the pond and forwards the
 * query into `penceive-core`, which is a crate in this process. Nothing here
 * knows that, and nothing here knows what an entry, a blueprint or a knowledge
 * graph is. It asks for dates and text and gets dates and text back.
 */

import { invoke } from "@tauri-apps/api/core";
import type { LibraryPort, NoteHit } from "@/application/ports";

export const tauriLibrary: LibraryPort = {
  async search(query, opts) {
    try {
      return await invoke<NoteHit[]>("library_search", {
        query,
        limit: opts?.limit,
        since: opts?.since,
        until: opts?.until,
      });
    } catch (error) {
      // Tauri rejects with the Rust `Err(String)` itself, not an Error. Left
      // as a throw rather than an empty result: "the pond is not registered"
      // and "you have never written about this" are different answers, and a
      // surface that cannot tell them apart will quietly show the wrong one.
      throw new Error(typeof error === "string" ? error : String(error));
    }
  },
};
