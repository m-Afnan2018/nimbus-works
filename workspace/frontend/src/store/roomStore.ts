import { create } from 'zustand';

export interface RoomParticipant {
  _id: string;
  name: string;
  avatar?: string;
  role?: string;
  isSpeaking?: boolean;
}

interface RoomState {
  activeRoomId: string | null;
  activeRoomName: string | null;
  participants: RoomParticipant[];
  isMuted: boolean;
  isSpeaking: boolean;
  setActiveRoom: (roomId: string, roomName: string) => void;
  clearActiveRoom: () => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  addParticipant: (p: RoomParticipant) => void;
  removeParticipant: (userId: string) => void;
  setMuted: (muted: boolean) => void;
  setLocalSpeaking: (speaking: boolean) => void;
  setParticipantSpeaking: (userId: string, speaking: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  activeRoomId: null,
  activeRoomName: null,
  participants: [],
  isMuted: false,
  isSpeaking: false,

  setActiveRoom: (roomId, roomName) => set({ activeRoomId: roomId, activeRoomName: roomName }),

  clearActiveRoom: () => set({ activeRoomId: null, activeRoomName: null, participants: [], isMuted: false, isSpeaking: false }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (p) =>
    set((state) => ({
      participants: state.participants.some((x) => x._id === p._id)
        ? state.participants
        : [...state.participants, p],
    })),

  removeParticipant: (userId) =>
    set((state) => ({ participants: state.participants.filter((p) => p._id !== userId) })),

  setMuted: (isMuted) => set({ isMuted }),

  setLocalSpeaking: (speaking) => set({ isSpeaking: speaking }),

  setParticipantSpeaking: (userId, speaking) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p._id === userId ? { ...p, isSpeaking: speaking } : p,
      ),
    })),
}));
