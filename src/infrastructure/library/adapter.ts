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
import type { LibraryPort, NotebookPort, NoteHit } from "@/application/ports";

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

/**
 * The garden's side of the pull.
 *
 * The Rust side resolves the journals pond — `$KAIROS_HOME/journals` once the
 * prose lives there, the library's registry until then — shells out to
 * `supynote`, and marks the index stale. Nothing here knows any of that; it
 * asks for a pull and gets back a sentence saying what happened.
 */
export const tauriNotebook: NotebookPort = {
  async pull(opts) {
    try {
      return await invoke<string>("library_sync", {
        mode: opts?.mode,
        ip: opts?.ip,
        port: opts?.port,
      });
    } catch (error) {
      // A pull that failed and a notebook with nothing new in it are different
      // answers, and the person needs to be able to tell them apart: one means
      // "write more", the other means "the device is not reachable".
      throw new Error(typeof error === "string" ? error : String(error));
    }
  },
};
