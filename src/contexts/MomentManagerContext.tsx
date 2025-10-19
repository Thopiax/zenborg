"use client";

import { createContext, useContext } from "react";

interface MomentManagerContextValue {
  handleOpenCreateModal: (
    prefilledDay?: string,
    prefilledPhase?: string,
    prefilledAreaId?: string,
    prefilledCycle?: string
  ) => void;
  handleOpenEditModal: (momentId: string) => void;
}

const MomentManagerContext = createContext<MomentManagerContextValue | null>(
  null
);

export function MomentManagerProvider({
  children,
  handleOpenCreateModal,
  handleOpenEditModal,
}: {
  children: React.ReactNode;
  handleOpenCreateModal: (
    prefilledDay?: string,
    prefilledPhase?: string,
    prefilledAreaId?: string,
    prefilledCycle?: string
  ) => void;
  handleOpenEditModal: (momentId: string) => void;
}) {
  return (
    <MomentManagerContext.Provider
      value={{ handleOpenCreateModal, handleOpenEditModal }}
    >
      {children}
    </MomentManagerContext.Provider>
  );
}

export function useMomentManager() {
  const context = useContext(MomentManagerContext);
  if (!context) {
    throw new Error(
      "useMomentManager must be used within MomentManagerProvider"
    );
  }
  return context;
}
