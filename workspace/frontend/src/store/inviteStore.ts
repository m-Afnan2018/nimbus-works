import { create } from 'zustand';

export interface PendingInvite {
  id: string;
  from: { id: string; name: string; avatar?: string | null };
  roomId: string;
  roomName: string;
  receivedAt: number;
}

interface InviteState {
  invites: PendingInvite[];
  addInvite: (invite: PendingInvite) => void;
  dismissInvite: (id: string) => void;
}

export const useInviteStore = create<InviteState>((set) => ({
  invites: [],
  addInvite: (invite) =>
    set((state) => ({
      invites: state.invites.some(
        (i) => i.roomId === invite.roomId && i.from.id === invite.from.id,
      )
        ? state.invites
        : [...state.invites, invite],
    })),
  dismissInvite: (id) =>
    set((state) => ({ invites: state.invites.filter((i) => i.id !== id) })),
}));
