import { create } from 'zustand';

export type ModalType = 
  | 'COURSE_EDITOR' 
  | 'TASK_COMPOSER' 
  | 'METADATA_EDITOR' 
  | 'HISTORY_VIEWER' 
  | 'TEAM_MANAGER'
  | 'INTEGRATION_ASSISTANT'
  | 'MICROCURRICULO'
  | 'ARQUITECTURA'
  | 'PLANEACION'
  | 'ESCRITURA'
  | 'VALIDACION'
  | 'MULTIMEDIA'
  | 'LMS'
  | 'QA'
  | 'ENTREGA'
  | 'TASKS'
  | string; // Allow dynamic strings for stage-specific keys like 'products:arquitectura'

interface ModalState {
  activeModal: ModalType | null;
  props: any;
  isOpen: boolean;
  open: (type: ModalType, props?: any) => void;
  close: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  props: {},
  isOpen: false,
  open: (type, props = {}) => set({ activeModal: type, props, isOpen: true }),
  close: () => set({ isOpen: false, activeModal: null, props: {} }),
}));
